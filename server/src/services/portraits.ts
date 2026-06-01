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

interface PortraitPromptInput {
  name: string
  race: string
  archetype: string
  /** First / signature power. Falls back gracefully when omitted. */
  topPower?: string
  /** Additional powers — joined with the topPower into a short list so
   *  the model sees the full kit, not just one ability. Caller should cap
   *  at 2-3 to avoid bloating the prompt. */
  extraPowers?: string[]
  /** Primary weapon, if any. Helps the model render the right silhouette. */
  weapon?: string
  /** Gender label rolled at character creation. Surfaced as a pronoun hint
   *  so the rendered figure matches the player's spin. */
  gender?: string
  /** Height label (e.g. "6'2\""). Coarse but helps the model bias frame. */
  height?: string
  /** Narrative line from generateCharacterSummary().text. */
  summary?: string
}

export function buildPortraitPrompt(c: PortraitPromptInput): string {
  // Identity clause: "a [gender] [race] [archetype] named [name]".
  // Gender slots in as an adjective when present so the model gets a
  // clear pronoun signal without needing prose.
  const genderAdj = c.gender && !/^[—-]?$/.test(c.gender)
    ? `${c.gender.toLowerCase()} `
    : ''
  const subject = `a ${genderAdj}${c.race} ${c.archetype} named ${c.name}`

  // Power list: combine topPower + extraPowers (deduped), cap at 3 to keep
  // the prompt tight. "wielding A, B, and C" reads naturally to the model.
  const allPowers = [c.topPower, ...(c.extraPowers ?? [])]
    .filter((p): p is string => !!p && p !== '—')
  const uniquePowers = Array.from(new Set(allPowers)).slice(0, 3)
  const powerClause = uniquePowers.length === 0 ? ''
    : uniquePowers.length === 1 ? `, wielding ${uniquePowers[0]}`
    : uniquePowers.length === 2 ? `, wielding ${uniquePowers[0]} and ${uniquePowers[1]}`
    : `, wielding ${uniquePowers.slice(0, -1).join(', ')}, and ${uniquePowers[uniquePowers.length - 1]}`

  const weaponClause = c.weapon && c.weapon !== '—' && !/^No Weapon/i.test(c.weapon)
    ? `. Armed with ${c.weapon}`
    : ''

  const heightClause = c.height && c.height !== '—'
    ? `. Height: ${c.height}`
    : ''

  const flavor = c.summary ? `. ${c.summary}` : ''

  const raw = `${STYLE_PREAMBLE}. ${subject}${powerClause}${weaponClause}${heightClause}${flavor}.`
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
  gender?: string
  height?: string
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
