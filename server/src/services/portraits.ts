/**
 * AI character portrait generation.
 *
 * Pipeline: build prompt from character data → fal.ai Flux Schnell →
 * upload returned image to Cloudflare R2 → return public URL.
 *
 * Required env vars (service is a no-op when any are missing):
 *   FAL_API_KEY            fal.ai dashboard key (https://fal.ai/dashboard/keys)
 *   R2_ACCOUNT_ID          Cloudflare account id
 *   R2_ACCESS_KEY_ID       R2 API token access key id
 *   R2_SECRET_ACCESS_KEY   R2 API token secret
 *   R2_BUCKET              bucket name (e.g. wheel-of-fate-portraits)
 *   R2_PUBLIC_URL          public base URL bound to the bucket
 *                          (e.g. https://portraits.wheeloffate.app)
 *
 * Status check on startup: portraitsEnabled() — call once from app.ts and
 * log so it's obvious in deploys whether portraits will work.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// ── Config / env ────────────────────────────────────────────────────────────

interface PortraitConfig {
  falApiKey: string
  r2AccountId: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2Bucket: string
  r2PublicUrl: string  // no trailing slash
}

let cachedConfig: PortraitConfig | null = null
let cachedS3: S3Client | null = null

function readConfig(): PortraitConfig | null {
  if (cachedConfig) return cachedConfig
  const cfg = {
    falApiKey:         process.env.FAL_API_KEY ?? '',
    r2AccountId:       process.env.R2_ACCOUNT_ID ?? '',
    r2AccessKeyId:     process.env.R2_ACCESS_KEY_ID ?? '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    r2Bucket:          process.env.R2_BUCKET ?? '',
    r2PublicUrl:      (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, ''),
  }
  if (!cfg.falApiKey || !cfg.r2AccountId || !cfg.r2AccessKeyId
      || !cfg.r2SecretAccessKey || !cfg.r2Bucket || !cfg.r2PublicUrl) {
    return null
  }
  cachedConfig = cfg
  return cfg
}

function s3(cfg: PortraitConfig): S3Client {
  if (cachedS3) return cachedS3
  cachedS3 = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     cfg.r2AccessKeyId,
      secretAccessKey: cfg.r2SecretAccessKey,
    },
  })
  return cachedS3
}

/** Single-call status check for startup logging. */
export function portraitsEnabled(): boolean {
  return readConfig() !== null
}

// ── Prompt builder ──────────────────────────────────────────────────────────

// Keep the style preamble in one place so every portrait reads as a single
// art-directed set. Tweaks here automatically propagate to every future spin.
const STYLE_PREAMBLE =
  'digital painting portrait, dark fantasy comic-book splash page, ' +
  'bold ink outlines, dynamic three-quarter pose, dramatic rim lighting, ' +
  'centered subject on a moody gradient background, painted texture'

const NEGATIVE_PROMPT =
  'photorealism, anime cel-shading, text, letters, watermark, ' +
  'multiple subjects, extra limbs, low contrast, blurry, deformed'

// Light blocklist — keeps obviously NSFW/problem terms out of the prompt
// even when they appear in a weakness or power label. Token-level match so
// fragments inside compound words still get neutered. This is intentionally
// minimal; a real classifier is in the plan but out of scope for MVP.
const BLOCKLIST = /\b(nude|naked|nsfw|sexual|porn|gore|graphic violence)\b/gi

// Race form hints — feeds the model a concrete physical description so it
// doesn't render every race as a human. Keys are race labels (exact match
// against character.race). Missing entries default to the humanoid template.
// The hint REPLACES "a [gender] [race]" subject when present, so it should
// read as a noun phrase (no leading "a"). Gender word stays in the prefix.
const RACE_FORM_HINTS: Record<string, string> = {
  // Beasts & creatures
  'Beast':            'a feral beast on all fours — bared fangs, thick pelt, glowing predator eyes, NOT humanoid',
  'Werebeast':        'a hulking lycanthropic beast-form, half-shifted, fur and claws bursting from sinew',
  'Dragon':           'a massive scaled wyrm — broad wings, horned skull, talons longer than swords, NOT humanoid',
  'Cosmic Dragon':    'a galaxy-scaled cosmic wyrm, stars rippling beneath translucent scales, NOT humanoid',
  'Dinosaur':         'a prehistoric saurian, scaled hide, raptor stance or quadrupedal bulk, NOT humanoid',
  'Kaiju':            'a colossal monster of skyscraper scale, plated hide, glowing aperture eyes, NOT humanoid',
  'Mythological Creature': 'a chimeric mythic beast — composite limbs, hybrid features, NOT humanoid',
  'Chimera':          'a fused chimera with mismatched animal heads and bodies, NOT humanoid',
  'Insectoid':        'a chitinous insectoid creature — segmented exoskeleton, mandibles, multi-jointed limbs',
  'Rat':              'an actual rat, knee-high at best, whiskers and naked tail, NOT humanoid',
  'Catfolk':          'an upright feline humanoid with tail, fur, slit pupils, and pointed ears',
  'Harpy':            'an avian humanoid — feathered wings replacing arms, taloned feet, beak-like features',
  'Griffin':          'a griffin — eagle head/wings + lion hindquarters, quadrupedal, NOT humanoid',
  // Constructs & robots
  'Robot':            'a fully mechanical chrome humanoid robot, exposed servos and panel seams',
  'Cyborg':           'a part-organic, part-machine hybrid — cybernetic prosthetics fused into living tissue',
  'Soulforged':       'an animated automaton of brass and clockwork, glowing soul-core in the chest',
  'Construct':        'a sentient artificial frame — alloy plating, glowing aperture eyes, no organic features',
  'Golem':            'a massive humanoid construct of clay, obsidian, or brass, slow and ponderous',
  'Mechshifter':      'a transforming mecha-hybrid, plates folding and reconfiguring, glowing seams',
  // Incorporeal / spirit
  'Ghost':            'a translucent spectral apparition, faint glow, tattered ethereal form',
  'Spirit':           'an incorporeal spirit, semi-transparent and trailing wisps of energy',
  'Wisp':             'a small floating orb of luminous energy, faint humanoid outline at its core',
  'Wraith':           'a shrouded wraith — hooded robes empty of form, glowing eye-sockets within',
  'Elemental':        'a humanoid silhouette composed entirely of its element (fire, water, stone, etc.) — no flesh',
  // Undead & corrupted
  'Skeleton':         'an animated skeletal warrior, no flesh, glowing eye-sockets, exposed bone',
  'Zombie':           'a rotting undead corpse, sallow flesh, lurching posture, exposed muscle and bone',
  'Undead':           'a desiccated undead figure, mummified skin, sunken sockets, ragged shroud',
  'Vampire':          'a noble vampire, pale, fanged, regal but predatory bearing',
  'Lich Overlord':    'a robed undead sorcerer, skeletal face beneath a hood, glowing phylactery at the chest',
  'Revenant':         'a vengeance-bound undead corpse, glowing soul-fire bleeding from old wounds',
  'Ghoul':            'a humanoid carrion-eater with elongated jaw, claws, and patchwork skin',
  'Parasyte':         'a host body partially overtaken by a parasitic organism — flesh splitting into tendrils and blade-limbs',
  // Fae / sprite / tiny
  'Sprite':           'a tiny winged fae, palm-sized, glowing pollen-trail, NOT humanoid scale',
  'Pixie':            'a small dragonfly-winged fae, glowing motes around their form',
  'Fairy':            'a winged fae the size of a child, gossamer wings, otherworldly features',
  'Dryad':            'a tree-spirit humanoid, bark-skin, leafed hair, rooted feet',
  'Treant':           'a massive walking tree-warden, branches for arms, knotwood face, towering',
  // Slimes / amorphous / void
  'Slime':            'an amorphous gelatinous blob with vague humanoid suggestion, NOT humanoid',
  'Eldritch Being':   'a non-Euclidean horror, too-many eyes/limbs, geometry that hurts to look at',
  'Void Sovereign':   'a robed silhouette of pure void, stars where eyes should be',
  'Outer God':        'a cosmic horror beyond comprehension, suggestion of vast tentacles and impossible angles',
  'Watcher':          'a hooded cosmic observer wreathed in iris-eyes',
  'Null':             'a featureless humanoid silhouette of absolute black, no detail, no edges',
  // Giants & titans
  'Giant':            'a towering humanoid of mountain-scale, crude features, primal demeanor',
  'Goliath':          'a stone-skinned mountain-humanoid, broad and tall, granite features',
  'Titan':            'a titanic primordial humanoid of sun-scale, mythological proportions',
  'Astral Titan':     'a star-skinned cosmic giant, constellations drifting across its body',
  // Lizard / reptile / serpent
  'Lizardfolk':       'a bipedal reptilian humanoid, scaled hide, tail, slit pupils',
  'Drakekin':         'a draconic humanoid, scaled skin, vestigial wings, draconic facial features',
  'Half-Dragon':      'a hybrid dragon-humanoid, half-scaled, partial wings, draconic horns',
  'Lamia':            'a serpent-tailed humanoid — woman/man torso fused to a long serpentine lower body',
  'Naga':             'a snake-bodied humanoid, hooded cobra crest, no human legs',
  // Birds / aquatic
  'Merfolk':          'an aquatic humanoid — gilled, finned, fish-tailed lower body',
  'Abyssal Leviathan':'a deep-sea humanoid with bioluminescent skin, fin-frills, predator dentition',
  'Atlantean':        'a regal aquatic humanoid with gills, finned ears, oceanic regalia',
  // Demons / angels
  'Demon':            'a horned demonic humanoid, leathery skin, burning eyes, often clawed and tailed',
  'Hellborn':         'a humanoid touched by infernal blood — horns, embered eyes, hooved or clawed',
  'Imp':              'a small mischievous demon, bat-winged, horned, child-sized, sharp grin',
  'Devil':            'an aristocratic devil — refined features, vestigial horns, predator presence',
  'Felfolk':          'a chaos-corrupted humanoid, eldritch sigils carved into flesh, warped proportions',
  'Hellbeast':        'a fire-veined demonic quadruped, smoldering hide, brimstone breath',
  'Oni':              'a hulking Japanese-demon-style humanoid, horned brow, vivid skin (red/blue), tusks',
  'Angel':            'a winged celestial humanoid — feathered wings, halo, radiant aura',
  'Aesir':            'a god-blooded humanoid warrior, runic markings, divine bearing',
  // Fungal / parasitic
  'Parasite':         'a humanoid host with parasitic growths bursting from flesh, fungal/insectoid limbs',
  'Symbiote':         'a humanoid encased in living symbiotic biomass that flows around them',
  // Mountain folk / pig-folk
  'Hobgoblin':        'a tall disciplined goblinoid soldier, military bearing, sharpened features',
  'Goblin':           'a small green-skinned humanoid, pointed ears, sharp teeth, mischievous',
  'Gnome':            'a small bearded humanoid tinker, child-height, hands always at work',
  'Halfling':         'a small barefoot humanoid, child-height, hairy feet, cheerful bearing',
  'Kobold':           'a small reptilian humanoid, scaled, dog-snouted, tribal scrap-armor',
  'Centaur':          'a centaur — humanoid torso fused to a four-legged equine body',
  'Satyr':            'a goat-legged humanoid — cloven hooves, horned brow, hairy lower body',
  'Dullahan':         'a headless mounted humanoid carrying its own glowing skull at its hip',
  'Gargoyle':         'a stone-skinned winged humanoid, gothic statue come to life, fanged maw',
  'Mutant':           'a humanoid with wildly mutated features — extra eyes, irregular limbs, asymmetric anatomy',
  'Bender':           'a humanoid element-channeler, mid-pose with their element swirling around them',
  // Specific clades from revamp
  'Numokian':         'a clan-warrior humanoid with thin antennae, elastic limbs, and patchwork tunic',
  'Alien':            'an extraterrestrial entity — non-human anatomy: insectoid, reptilian, amorphous, or energy-based depending on form',
}

// Form hints by exact race label. Fall back to humanoid default. Lower-case
// for lookup robustness.
function formHintFor(race: string): string | null {
  return RACE_FORM_HINTS[race] ?? null
}

interface PortraitPromptInput {
  name: string
  race: string
  archetype: string
  /** First / signature power. Falls back gracefully when omitted. */
  topPower?: string
  /** Additional powers — joined with the topPower into a short list so
   *  the model sees the full kit, not just one ability. Caller should cap
   *  at 3-4 to avoid bloating the prompt. */
  extraPowers?: string[]
  /** Primary weapon, if any. Helps the model render the right silhouette. */
  weapon?: string
  /** Primary armor, if any. */
  armor?: string
  /** Gender label rolled at character creation. Surfaced as a pronoun hint
   *  so the rendered figure matches the player's spin. */
  gender?: string
  /** Height label (e.g. "6'2\""). Suppressed for non-humanoid form races
   *  where the race hint already conveys scale better. */
  height?: string
  /** Race sub-type result (e.g. Dragon's "Hatchling" or Alien's
   *  "Reptilian/Saurian Envoy"). Major visual differentiator within a race. */
  raceSubType?: string
  /** Race class result (e.g. Vampire's "Blood Blade" or Construct's
   *  "Aegis Vanguard"). Combat aesthetic. */
  raceClass?: string
  /** Primary element on the topPower / weapon — used to bias lighting and
   *  palette ("Fire" → warm tones, "Void" → cosmic black, etc.). */
  element?: string
  /** Overall tier grade (e.g. "S", "Cosmic", "God"). Surfaces a "power
   *  level" hint so legendary characters read as more imposing. */
  overallTier?: string
  /** Narrative line from generateCharacterSummary().text. */
  summary?: string
}

export function buildPortraitPrompt(c: PortraitPromptInput): string {
  // Gender slots in as an adjective when meaningful so the model gets a
  // clear pronoun signal without needing prose. For creature races where
  // the form hint dominates, gender is appended as a parenthetical hint
  // rather than baked into the noun phrase.
  const rawGender = c.gender && !/^[—-]?$/.test(c.gender) ? c.gender.toLowerCase() : ''
  // Race-specific form descriptor — tells the model what the race ACTUALLY
  // looks like instead of letting it default to a generic human in costume.
  // Critical for non-humanoid races (dragons, beasts, slimes, spirits).
  const formHint = formHintFor(c.race)
  const subject = formHint
    ? `${formHint}${rawGender ? ` (${rawGender})` : ''} — a ${c.archetype} named ${c.name}`
    : `a ${rawGender ? `${rawGender} ` : ''}${c.race} ${c.archetype} named ${c.name}`

  // Sub-form clause — when a sub-type/class was rolled, surface it. Helps
  // disambiguate (e.g. Werebeast Wolf Form vs Dragon Form, Alien Insectoid
  // vs Reptilian, etc.). Many Rare-tier classes are visually distinctive.
  const subForm = c.raceSubType && c.raceSubType !== '—' ? c.raceSubType : null
  const raceClass = c.raceClass && c.raceClass !== '—' ? c.raceClass : null
  const formClause = subForm && raceClass && subForm !== raceClass
    ? `. Sub-form: ${subForm}; class: ${raceClass}`
    : subForm  ? `. Sub-form: ${subForm}`
    : raceClass ? `. Class: ${raceClass}`
    : ''

  // Power list: combine topPower + extraPowers (deduped), cap at 4 to keep
  // the prompt rich without bloating. Adds a hint about each so the model
  // can suggest the right magical/elemental aesthetic.
  const allPowers = [c.topPower, ...(c.extraPowers ?? [])]
    .filter((p): p is string => !!p && p !== '—')
  const uniquePowers = Array.from(new Set(allPowers)).slice(0, 4)
  const powerClause = uniquePowers.length === 0 ? ''
    : uniquePowers.length === 1 ? `, channeling ${uniquePowers[0]}`
    : `, channeling ${uniquePowers.slice(0, -1).join(', ')}, and ${uniquePowers[uniquePowers.length - 1]}`

  const weaponClause = c.weapon && c.weapon !== '—' && !/^No Weapon/i.test(c.weapon)
    ? `. Armed with ${c.weapon}`
    : ''

  const armorClause = c.armor && c.armor !== '—' && !/^No Armor/i.test(c.armor)
    ? `. Wearing ${c.armor}`
    : ''

  // Height only meaningful for humanoid-form races. For huge creatures
  // (Dragon, Kaiju, Giant) the form hint already conveys scale better than
  // a number, and "Height: 40'0\"" on a Dragon misleads more than it helps.
  const heightClause = c.height && c.height !== '—' && !formHint
    ? `. Height: ${c.height}`
    : ''

  // Element / tier flavor — when a primary element is rolled, surface it
  // so the lighting/palette skews accordingly.
  const elementClause = c.element && c.element !== 'Neutral' && c.element !== '—'
    ? `. Elemental affinity: ${c.element}`
    : ''

  const tierClause = c.overallTier && c.overallTier !== '—'
    ? `. Overall power tier: ${c.overallTier}`
    : ''

  const flavor = c.summary ? `. ${c.summary}` : ''

  const raw = `${STYLE_PREAMBLE}. ${subject}${formClause}${powerClause}${weaponClause}${armorClause}${heightClause}${elementClause}${tierClause}${flavor}.`
  return raw.replace(BLOCKLIST, '[redacted]')
}

// Deterministic seed from shareId so a re-roll of the same character would
// produce the same image. Simple FNV-1a 32-bit — collision is fine here.
export function seedFromShareId(shareId: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < shareId.length; i++) {
    hash ^= shareId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// ── fal.ai client ───────────────────────────────────────────────────────────

interface FalResponse {
  images?: Array<{ url: string; width?: number; height?: number }>
}

async function callFlux(prompt: string, seed: number, apiKey: string): Promise<Buffer> {
  // Flux Schnell is the cheapest fal model at ~$0.003 per 512×512 image and
  // typically returns in 1–2s. Reference: https://fal.ai/models/fal-ai/flux/schnell
  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size:          'square',  // 512×512
      num_inference_steps: 4,         // Schnell is tuned for 4 steps
      num_images:          1,
      seed,
      enable_safety_checker: true,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`fal.ai HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json() as FalResponse
  const imageUrl = json.images?.[0]?.url
  if (!imageUrl) throw new Error('fal.ai response missing image url')

  // Download the actual image bytes — the returned URL is hosted by fal and
  // will expire, so we re-host on R2 for permanence.
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`fal image fetch HTTP ${imgRes.status}`)
  return Buffer.from(await imgRes.arrayBuffer())
}

// ── R2 upload ───────────────────────────────────────────────────────────────

async function uploadToR2(
  cfg: PortraitConfig,
  shareId: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const key = `portraits/${shareId}.webp`
  await s3(cfg).send(new PutObjectCommand({
    Bucket:       cfg.r2Bucket,
    Key:          key,
    Body:         body,
    ContentType:  contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return `${cfg.r2PublicUrl}/${key}`
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface GeneratePortraitInput {
  shareId: string
  name: string
  race: string
  archetype: string
  topPower?: string
  extraPowers?: string[]
  weapon?: string
  armor?: string
  gender?: string
  height?: string
  raceSubType?: string
  raceClass?: string
  element?: string
  overallTier?: string
  summary?: string
}

export interface GeneratePortraitResult {
  ok: true
  url: string
}

export interface GeneratePortraitDisabled {
  ok: false
  reason: 'disabled' | 'failed'
  message: string
}

export async function generatePortrait(
  input: GeneratePortraitInput,
): Promise<GeneratePortraitResult | GeneratePortraitDisabled> {
  const cfg = readConfig()
  if (!cfg) {
    return { ok: false, reason: 'disabled', message: 'portrait env vars not configured' }
  }

  try {
    const prompt = buildPortraitPrompt(input)
    const seed   = seedFromShareId(input.shareId)
    const png    = await callFlux(prompt, seed, cfg.falApiKey)
    // fal returns PNG by default. We upload as-is under a .webp key — the
    // browser content-type negotiation honors the actual MIME, not the
    // extension. Converting PNG→WebP server-side would need `sharp` and the
    // size win on a 4-step Schnell image is marginal (~30%), so we skip it.
    const url    = await uploadToR2(cfg, input.shareId, png, 'image/png')
    return { ok: true, url }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: 'failed', message }
  }
}
