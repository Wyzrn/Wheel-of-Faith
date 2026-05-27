// descriptions.ts — Dynamic description + ability-type generator for all content items.
//
// All description text shown on character cards / inventory / spin reveals is
// generated at runtime from (label, element, grade) instead of hand-written
// per entry. This file is the entire content voice — keep it rich.
//
// Generators below produce 2-sentence flavor: the first sentence describes
// what the item IS, the second hints at what it does in battle. Tier
// adjectives (`tierAdj`) shape the prose so an F-tier item reads humble
// and a God-tier item reads reality-bending without us writing a unique
// string for every one of the 1,200+ entries.

export type AbilityType = 'Attack' | 'Heal' | 'Defense' | 'Dodge' | 'Nullification' | 'Passive' | 'Buff' | 'Debuff' | 'Summon'

const ABILITY_TYPE_COLOR: Record<AbilityType, string> = {
  Attack:       '#ef4444',
  Heal:         '#34d399',
  Defense:      '#60a5fa',
  Dodge:        '#a78bfa',
  Nullification:'#f59e0b',
  Passive:      '#9ca3af',
  Buff:         '#fbbf24',
  Debuff:       '#f97316',
  Summon:       '#e879f9',
}

const ABILITY_TYPE_ICON: Record<AbilityType, string> = {
  Attack:       'bolt',
  Heal:         'favorite',
  Defense:      'shield',
  Dodge:        'air',
  Nullification:'block',
  Passive:      'auto_awesome',
  Buff:         'trending_up',
  Debuff:       'trending_down',
  Summon:       'add_circle',
}

export function getAbilityTypeColor(t: AbilityType): string { return ABILITY_TYPE_COLOR[t] }
export function getAbilityTypeIcon(t: AbilityType): string  { return ABILITY_TYPE_ICON[t] }

export function classifyAbility(label: string, element?: string): AbilityType {
  if (/\b(heal|mend|restore|recover|regenerat|revive|cure|vital force|life leech|life drain)\b/i.test(label)) return 'Heal'
  if (/\b(barrier|shield|wall|ward|protect|fortress|bunker|bastion|bulwark|fortif|iron fort|aegis|carapace|shell)\b/i.test(label)) return 'Defense'
  if (/\b(dodge|evad|evasion|phase shift|blink|sidestep|vanish|invisible|intangible|afterimage|mirror image|blur|ghost step|phase through)\b/i.test(label)) return 'Dodge'
  if (/\b(null|negate|counter|reflect|absorb|seal|suppress|cancel|anti-|immunity|rebuff|dispel|sever|break)\b/i.test(label)) return 'Nullification'
  if (/\b(summon|conjure|call forth|raise|manifest|legion|minion|army|swarm|familiar)\b/i.test(label)) return 'Summon'
  if (/\b(aura|buff|boost|empower|enhance|strengthen|amplify|inspire|embolden|rally|harden|bless|boon|exalt|ascend)\b/i.test(label)) return 'Buff'
  if (/\b(curse|weaken|slow|stun|paralyze|petrif|drain|corrupt|decay|wither|leech|sap|enervat|blind|debuff)\b/i.test(label)) return 'Debuff'
  if (/\b(passive|innate|natural|ambient|mastery|training|experience|sense|awareness|resilience|endurance|toughness|adaptation)\b/i.test(label)) return 'Passive'
  if (/\b(manipulation|control|dominion|sovereignty|mastery over)\b/i.test(label)) {
    if (element === 'Time') return 'Passive'
    if (element === 'Soul') return 'Debuff'
    return 'Attack'
  }
  if (/\b(strike|blast|attack|surge|slash|smash|crush|shatter|destroy|obliterate|detonate|explosion|bolt|beam|ray|shot|throw|hurl|punch|kick|lunge|stab|cut|pierce|rend|sever|devastat|annihilate|incinerat|carnage|barrage|volley|fusillade|charge|ram|impact|slam|cleave)\b/i.test(label)) return 'Attack'
  if (element === 'Light' && /bless|grace|sacred|divine|holy/i.test(label)) return 'Heal'
  return 'Attack'
}

// ── Element flavor maps ───────────────────────────────────────────────────────
// Multiple synonym banks so the prose doesn't repeat the same phrase across
// items of the same element. The generator picks a deterministic variant
// based on label hash so the description for a given item is stable but
// adjacent items don't all read identically.

interface ElementVoice {
  noun:   string[]   // "blazing fire", "crackling flame"
  verb:   string[]   // "scorches", "sears"
  texture:string[]   // sensory descriptor — "smoke and ember"
  damage: string     // damage-type word — "burn", "frost", "shock"
}

const ELEMENT_VOICE: Record<string, ElementVoice> = {
  Fire:      { noun: ['molten fire','searing flame','infernal blaze','wildfire'],         verb: ['scorches','sears','immolates','ignites'],           texture: ['smoke and ember','wreathed in heat','an ash-choked corona','plumes of flame'], damage: 'burn' },
  Ice:       { noun: ['piercing frost','glacial cold','arctic ice','bitter rime'],        verb: ['freezes','glaciates','locks in ice','crystallises'],texture: ['biting cold','rime-frosted air','a crystalline chill','frozen breath'],   damage: 'frost' },
  Lightning: { noun: ['arcing voltage','crackling thunder','storm-current','plasma arc'], verb: ['shocks','electrocutes','arcs through','overloads'], texture: ['ozone and sparks','a static halo','split-second strikes','thunder-charged air'], damage: 'shock' },
  Earth:    { noun: ['shifting stone','tectonic mass','bedrock','crushing earth'],        verb: ['crushes','grinds','buries','quakes against'],       texture: ['dust and grit','plates of moving rock','seismic tremors','stone-bound'],   damage: 'concussive' },
  Wind:     { noun: ['howling wind','cutting gale','storm-air','sky-wrath'],              verb: ['shreds','slashes through','whips at','flays'],      texture: ['a vortex','whipping cyclones','tearing currents','sky-roar'],            damage: 'sky-cut' },
  Shadow:   { noun: ['writhing shadow','tenebrous dark','umbral void','black silk'],      verb: ['smothers','engulfs','consumes','drowns in dark'],   texture: ['choking gloom','silken black','penumbra','shifting silhouette'],         damage: 'shade' },
  Light:    { noun: ['divine radiance','holy light','solar flare','celestial glow'],      verb: ['blazes through','purifies','sears with light','exalts'], texture: ['blinding white','sacred aura','prismatic dawn','beams of grace'],     damage: 'radiant' },
  Arcane:   { noun: ['woven arcana','raw mana','sorcerous current','mystic weave'],       verb: ['weaves','channels','enchants','unmakes with magic'],texture: ['runes in the air','glyph-stitched light','mana threads','astral hum'],    damage: 'arcane' },
  Nature:   { noun: ['living verdure','primal nature','wildgrowth','green vitality'],     verb: ['ensnares','overgrows','entangles','swallows in growth'], texture: ['vine and root','blooming chaos','wilds awakening','sap-thick air'],   damage: 'wild' },
  Void:     { noun: ['hungering void','annihilating nothingness','null-energy','negation'],verb: ['erases','annuls','unmakes','swallows whole'],      texture: ['empty silence','non-existence','a horizon of nothing','un-light'],        damage: 'erasure' },
  Cosmic:   { noun: ['cosmic force','star-matter','galactic pressure','spacetime fold'],  verb: ['detonates','collapses','radiates','crushes with starlight'], texture: ['nebular dust','stellar dawn','starfield','solar wind'],          damage: 'cosmic' },
  Blood:    { noun: ['crimson tide','sanguine flow','blood-curse','vital essence'],       verb: ['exsanguinates','bleeds','drains','seizes the heart'], texture: ['copper tang','arterial spray','running red','pulsing wound'],          damage: 'hemorrhage' },
  Metal:    { noun: ['hardened steel','razor-metal','chrome edge','iron storm'],          verb: ['lacerates','pierces','impales','rends'],            texture: ['ringing alloy','sharpened plates','steel song','glinting blades'],          damage: 'physical' },
  Soul:     { noun: ['ghost-fire','soul current','spectral thread','wraith-energy'],      verb: ['unmoors','separates','tears the soul from','reaps'], texture: ['ethereal mist','cold whispers','a deathly stillness','beyond-the-veil hum'], damage: 'soul' },
  Poison:   { noun: ['lethal venom','corrosive acid','rotting plague','toxic miasma'],    verb: ['corrodes','rots','poisons','dissolves'],            texture: ['sickly green vapour','dripping ichor','disease-stench','spreading rot'],   damage: 'venom' },
  Time:     { noun: ['warped time','chrono-flux','temporal current','aeons compressed'],  verb: ['stutters','rewinds','accelerates','locks out of time'], texture: ['ticking silence','time-skip blur','hourglass sand','frozen seconds'],   damage: 'temporal' },
  Water:    { noun: ['crushing tide','tidal force','high-pressure water','rolling deep'], verb: ['drowns','batters','tides over','floods'],           texture: ['salt-spray','deep currents','undertow','torrential rain'],                  damage: 'aquatic' },
  Sound:    { noun: ['shattering resonance','sonic boom','soul-wail','sub-bass roar'],    verb: ['ruptures','overwhelms','deafens','shatters'],       texture: ['ringing ears','splitting frequencies','vibrating air','dissonant scream'], damage: 'sonic' },
  Gravity:  { noun: ['crushing gravity','spatial weight','black-hole pull','mass-flux'],  verb: ['crushes','compresses','folds','pulverises'],        texture: ['warped space','impossible weight','collapsing horizon','heavy silence'],   damage: 'gravitic' },
  Psychic:  { noun: ['mind-piercing thought','psychic blade','telepathic shock','mental wave'], verb: ['fractures the mind','overwhelms','dominates','tears through thought'], texture: ['ringing telepathy','intrusive whispers','phantom afterimages','migraine static'], damage: 'psychic' },
  Chaos:    { noun: ['raw chaos','reality-warp','entropic surge','probability-storm'],    verb: ['unravels','re-writes','distorts','randomizes'],     texture: ['shifting impossibility','reality-jitter','colors that shouldn\'t exist','rule-breaking flicker'], damage: 'chaotic' },
  Neutral:  { noun: ['raw force','kinetic power','focused might','channeled energy'],     verb: ['strikes','hammers','breaks','overruns'],            texture: ['raw impact','focused intent','blunt force','clean execution'],             damage: 'kinetic' },
}

function voiceFor(el?: string): ElementVoice {
  if (el && ELEMENT_VOICE[el]) return ELEMENT_VOICE[el]
  return ELEMENT_VOICE.Neutral
}

// Deterministic index from a label string — same label always picks the
// same synonym so a given power's description is stable across loads.
function hashIdx(s: string, mod: number): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h) % mod
}
function pick<T>(arr: T[], seed: string): T { return arr[hashIdx(seed, arr.length)] }

// ── Tier voice (humble F → reality-bending God) ───────────────────────────────
// Tier ranks are taken from the base letter (strips +/-) so "A+", "SSS-",
// and "C" all map to a stable bucket.

interface TierVoice {
  adj:      string[]   // descriptor used to introduce the item
  prefix:   string[]   // sentence-starter
  effect:   string[]   // closing-effect flavor
  rarity:   string     // rarity word for the second sentence
}

const TIER_VOICE: Record<string, TierVoice> = {
  F: {
    adj:    ['battered','crude','amateur','threadbare','novice'],
    prefix: ['A humble','A scrappy','A first-attempt','A worn'],
    effect: ['just enough to scrape by','barely a threat','more bravado than impact','useful in a pinch'],
    rarity: 'common',
  },
  E: {
    adj:    ['simple','workmanlike','training-grade','passable','well-used'],
    prefix: ['A practical','A serviceable','A solid','A reliable'],
    effect: ['steady but unremarkable','reliable in the right hands','enough to hold a line','no frills, no failures'],
    rarity: 'common',
  },
  D: {
    adj:    ['competent','tested','named','field-proven','well-honed'],
    prefix: ['A proven','A confident','A respectable','A field-tested'],
    effect: ['turns heads in a skirmish','dependable under pressure','better than its rank suggests','a noticeable upgrade'],
    rarity: 'uncommon',
  },
  C: {
    adj:    ['veteran','noted','respected','well-storied','rare-stamped'],
    prefix: ['A storied','A veteran','A noted','A respected'],
    effect: ['the kind of thing professionals carry','well above the common cut','difficult to come by, worth keeping','a real difference-maker'],
    rarity: 'rare',
  },
  B: {
    adj:    ['elite','renowned','master-crafted','battle-famous','spoken-of'],
    prefix: ['An elite','A celebrated','A master-crafted','A battle-renowned'],
    effect: ['turns a fight when it lands','breaks the tide of an engagement','elite hands wield these','enough to ruin most foes'],
    rarity: 'epic',
  },
  A: {
    adj:    ['legendary','named','myth-spoken','hero-borne','peerless'],
    prefix: ['A legendary','A hero-bound','A name-stamped','A myth-spoken'],
    effect: ['armies fall to weapons like this','only the strongest survive its touch','a name worth fearing','single-handed war-enders'],
    rarity: 'legendary',
  },
  S: {
    adj:    ['mythic','god-touched','realm-shaking','epoch-defining','sovereign'],
    prefix: ['A mythic','A realm-shaking','A god-touched','A sovereign'],
    effect: ['continents bend around it','myth and reality blur in its wake','no mortal endures it twice','a peak that few weapons ever reach'],
    rarity: 'mythic',
  },
  SS: {
    adj:    ['divine','celestial-forged','godblood','heaven-borne','planar'],
    prefix: ['A divine','A heaven-borne','A celestial-forged','A planar'],
    effect: ['the laws of war buckle around it','heavens shift to allow its strike','gods take notice','planar geometry frays at its edge'],
    rarity: 'divine',
  },
  SSS: {
    adj:    ['primordial','reality-bending','epoch-shaping','world-defining','first-age'],
    prefix: ['A primordial','A world-defining','A reality-bending','A first-age'],
    effect: ['existence itself flinches','realities collapse along its path','rewriting the world per swing','the kind of thing creation myths warn about'],
    rarity: 'primordial',
  },
  God: {
    adj:    ['un-fathomable','reality-anchored','absolute-tier','peerless','flawless'],
    prefix: ['An absolute','An omnipotent','A concept-defining','A god-borne'],
    effect: ['outcomes are no longer negotiable','reality is rewritten at the user\'s preference','the universe yields with reverence','nothing in any plane resists this'],
    rarity: 'god-tier',
  },
}

function tierVoice(grade?: string): TierVoice {
  if (!grade) return TIER_VOICE.C
  const base = grade.replace(/[-+]/g, '').replace(/\s+/g, '')
  return TIER_VOICE[base] ?? TIER_VOICE.C
}

// ── Power description generator ───────────────────────────────────────────────

export function generatePowerDescription(label: string, element?: string, grade?: string): string {
  const v   = voiceFor(element)
  const t   = tierVoice(grade)
  const n   = pick(v.noun,    label)
  const vb  = pick(v.verb,    label + 'v')
  const tex = pick(v.texture, label + 't')
  const eff = pick(t.effect,  label + 'e')
  const l   = label

  // Specific high-signal labels first — these get bespoke flavor.
  if (/omnipoten/i.test(l)) return `Total authority over reality itself — there is no contest. ${eff[0].toUpperCase() + eff.slice(1)}.`
  if (/omniscien/i.test(l)) return `Complete knowledge of every event in every timeline, every possibility, every secret. The user simply knows.`
  if (/^reality (rewrite|warp|alter|edit)/i.test(l)) return `Rewrites the underlying rules of reality at a thought. ${eff[0].toUpperCase() + eff.slice(1)}.`
  if (/^true (immortal|deathless)/i.test(l)) return `The user cannot die. Wounds seal in real time, age slips off them, even the concept of ending refuses to take hold.`
  if (/existence erasure/i.test(l)) return `The target ceases to have ever existed. Their name, deeds, and trace are scrubbed from the record.`
  if (/time stop|stop time|chronolock|chrono-?lock/i.test(l)) return `Locks every other actor outside the flow of time. The user moves freely while the world holds its breath.`
  if (/causality (override|violation)/i.test(l)) return `Untethers effect from cause — strikes land before they're thrown, wounds appear before the swing.`
  if (/pocket universe|own dimension|private dimension/i.test(l)) return `Folds out a self-contained dimension under the user's control — its physics, time, and laws are theirs to set.`
  if (/conceptual (destruction|erasure)/i.test(l)) return `Targets the IDEA of a thing rather than the thing — concepts unravel, memory of them with it.`

  // Element-typed pattern bank — covers ~80% of the named-pattern space.
  if (/\bbolt|beam|ray|lance of/i.test(l))            return `Compresses ${n} into a focused lance and fires it at one target, leaving ${tex} along the trajectory.`
  if (/\bblast|detonat|explosion|nova|supernova\b/i.test(l)) return `${n[0].toUpperCase() + n.slice(1)} detonates outward, ${vb} everything within the blast. ${eff[0].toUpperCase() + eff.slice(1)}.`
  if (/storm|tempest|cyclone|vortex|firestorm|blizzard|whirlwind/i.test(l)) return `Calls down a raging ${n} that ${vb} every foe in its sweep. The battlefield fills with ${tex}.`
  if (/strike|slash|smash|crush|cleave|stab|cut|pierce|rend|impact/i.test(l)) return `A focused single-target strike infused with ${n} — ${tex} trails the blow as the target ${vb} hard.`
  if (/barrier|shield|wall|ward|fortress|aegis|bastion|bulwark|carapace/i.test(l)) return `Raises a defensive barrier woven from ${n}. ${eff[0].toUpperCase() + eff.slice(1)} — incoming damage softens as it passes through.`
  if (/heal|mend|restore|recover|regenerat|revive|cure|vital force/i.test(l)) return `Channels ${n} inward to seal wounds and reset fatigue. ${eff[0].toUpperCase() + eff.slice(1)}.`
  if (/summon|conjure|manifest|call forth|raise|legion|familiar|swarm|horde/i.test(l)) return `Pulls allied constructs of ${n} into existence to fight alongside the user. The summons share the user's intent and add new fronts to the fight.`
  if (/aura|halo|emanation|radiance(?! beam)/i.test(l)) return `Radiates a constant aura of ${n} around the user. ${eff[0].toUpperCase() + eff.slice(1)} — anything within the radius is affected each turn.`
  if (/field|zone|domain|realm|territory|sanctum/i.test(l)) return `Anchors a zone of ${n} on the battlefield. Inside, the user dictates terms; outside it, the world stays normal.`
  if (/form|transformation|mode|awaken|overdrive|overload|berserk(?!er)/i.test(l)) return `Transforms the user into an exalted state of ${n}. While active, every stat surges — ${eff}.`
  if (/step|travel|teleport|phase|blink|warp(?! reality)/i.test(l)) return `Folds short-range space with ${n}, allowing instant repositioning past walls, attacks, or terrain.`
  if (/drain|leech|absorb|siphon|life leech/i.test(l)) return `Pulls ${n} out of the target and channels it back to the user — they weaken, the user heals.`
  if (/creation|forge|craft|construct/i.test(l)) return `Conjures weapons or constructs of ${n} from nothing. ${eff[0].toUpperCase() + eff.slice(1)} — useful for arming allies or reinforcing positions.`
  if (/sense|sight|perception|awareness|intuition|second sight/i.test(l)) return `Tunes the user's perception to read ${n}, surfacing threats, weaknesses, and incoming attacks well before they land.`
  if (/curse|wither|decay|rot|enervat|sap|jinx|hex|mark|seal/i.test(l)) return `Marks the target with ${n} — they steadily wither, taking residual damage every turn the mark holds.`
  if (/manipulation|control|dominion|sovereignty|mastery over/i.test(l)) return `Total command over ${n}. The user shapes it like clay — into projectiles, walls, terrain, or weather, on demand.`
  if (/stun|paralyze|petrif|silence|blind|root/i.test(l)) return `${n[0].toUpperCase() + n.slice(1)} ${vb} the target into stillness — they lose their next action entirely.`
  if (/dodge|evad|sidestep|afterimage|blur(?! magic)/i.test(l)) return `Bends the air around the user with ${n}, allowing supernatural evasion. Strikes pass through where the user used to be.`
  if (/null|negate|counter|reflect|absorb shield|dispel/i.test(l)) return `Cancels an incoming ability outright using ${n}. The negation costs the user little — the attacker pays the full cost.`

  // Attack-type fallback: still vary by tier + element so the prose isn't generic.
  const type = classifyAbility(label, element)
  const suffix = `${eff[0].toUpperCase() + eff.slice(1)}.`
  switch (type) {
    case 'Heal':         return `Knits the user's wounds with ${n}, returning vitality in real time. ${suffix}`
    case 'Defense':      return `Hardens the user against incoming damage — ${n} forms a defensive layer. ${suffix}`
    case 'Dodge':        return `Sharpens the user's reflexes using ${n} — strikes simply miss. ${suffix}`
    case 'Nullification':return `Cancels an opposing effect by inverting it with ${n}. ${suffix}`
    case 'Buff':         return `Wraps the user in ${n}, boosting offensive output for several turns. ${suffix}`
    case 'Debuff':       return `Coats the target in ${n}, sapping their stats and slowing their tempo. ${suffix}`
    case 'Summon':       return `Conjures ${n}-shaped allies into the fight. ${suffix}`
    case 'Passive':      return `A passive attunement to ${n}. Always active — never needs to be invoked. ${suffix}`
    default:             return `Unleashes a focused burst of ${n} at the chosen target. ${tex[0].toUpperCase() + tex.slice(1)} marks the strike. ${suffix}`
  }
}

// ── Weapon description generator ──────────────────────────────────────────────

export function generateWeaponDescription(label: string, element?: string, grade?: string): string {
  const v   = voiceFor(element)
  const t   = tierVoice(grade)
  const n   = pick(v.noun,    label)
  const vb  = pick(v.verb,    label + 'v')
  const tex = pick(v.texture, label + 't')
  const adj = pick(t.adj,     label + 'a')
  const pfx = pick(t.prefix,  label + 'p')

  // Weapon family identification.
  const family =
    /sword|blade|edge|saber|cutlass|rapier|katana|broadsword|longsword/i.test(label) ? { name: 'blade',     act: 'cleaves through openings', bonus: 'high Physical Damage with steady reach' } :
    /bow|crossbow|quiver|long.?bow|short.?bow/i.test(label)                          ? { name: 'bow',       act: 'punches through armor at range', bonus: 'long-range Physical Damage' } :
    /arrow|bolt(?!s)|quarrel/i.test(label)                                          ? { name: 'projectile',act: 'arcs in unerringly', bonus: 'ranged precision damage' } :
    /hammer|maul|warhammer|mace|club|cudgel|flail|morningstar/i.test(label)          ? { name: 'bludgeon',  act: 'caves in plate and bone alike', bonus: 'crushing Physical Damage and stagger' } :
    /spear|lance|trident|pike|halberd|glaive|naginata/i.test(label)                  ? { name: 'polearm',   act: 'keeps foes at a measured distance', bonus: 'reach + Physical Damage' } :
    /scythe|sickle|kama/i.test(label)                                               ? { name: 'reaper',    act: 'hooks past defenses', bonus: 'defense-piercing Physical Damage' } :
    /staff|wand|rod|orb|focus|talisman/i.test(label)                                ? { name: 'focus',     act: 'amplifies cast spells', bonus: 'elevated Power Damage' } :
    /dagger|knife|kris|stiletto|shiv|dirk/i.test(label)                              ? { name: 'shortblade',act: 'finds gaps no one expects', bonus: 'fast strikes and high crit potential' } :
    /axe|hatchet|tomahawk|cleaver/i.test(label)                                     ? { name: 'axe',       act: 'cleaves with terrible weight', bonus: 'cleaving Physical Damage' } :
    /cannon|gun|rifle|pistol|musket|firearm|carbine|shotgun/i.test(label)            ? { name: 'firearm',   act: 'rips a hole through the line', bonus: 'devastating ranged damage' } :
    /chakram|disc|boomerang/i.test(label)                                           ? { name: 'thrown',    act: 'cuts a return arc', bonus: 'ranged Physical Damage' } :
    /whip|chain|lasso|grappling/i.test(label)                                       ? { name: 'flex weapon', act: 'snaps around guards', bonus: 'reach + control' } :
    /gauntlet|knuckle|cestus|fist/i.test(label)                                     ? { name: 'fist weapon', act: 'punches with disproportionate weight', bonus: 'close-range Physical Damage' } :
    /fan|chakram|wheel|disc/i.test(label)                                           ? { name: 'thrown blade', act: 'sweeps in arcs', bonus: 'graceful, repeating damage' } :
    /scroll|grimoire|tome|codex|book/i.test(label)                                  ? { name: 'tome',      act: 'channels written spellwork', bonus: 'Power Damage with utility' } :
    { name: 'weapon', act: 'connects with terrible effect', bonus: 'Physical and Power Damage' }

  // Tier-flavored first sentence + battle-effect second sentence.
  const intro = `${pfx} ${adj} ${family.name} infused with ${n}.`
  const detail = element
    ? `${family.act.charAt(0).toUpperCase() + family.act.slice(1)}, leaving ${tex} on every connect. Grants ${family.bonus}.`
    : `${family.act.charAt(0).toUpperCase() + family.act.slice(1)}. Grants ${family.bonus}.`
  return `${intro} ${detail}`
}

// ── Armor description generator ───────────────────────────────────────────────

export function generateArmorDescription(label: string, element?: string, grade?: string): string {
  const v   = voiceFor(element)
  const t   = tierVoice(grade)
  const n   = pick(v.noun,    label)
  const tex = pick(v.texture, label + 't')
  const adj = pick(t.adj,     label + 'a')
  const pfx = pick(t.prefix,  label + 'p')

  const piece =
    /helmet|helm|cap|hood|mask|visor|crown|circlet|tiara/i.test(label) ? { name: 'head piece',    coverage: 'head', bonus: 'head-shot reduction and minor Armor Reduction' } :
    /full.?suit|plate|panoply|gallea|cataphract|harness/i.test(label)  ? { name: 'full suit',     coverage: 'full body', bonus: 'maximum Armor Reduction across every hit' } :
    /vest|breastplate|cuirass|chestplate|brigandine/i.test(label)       ? { name: 'chest piece',   coverage: 'torso', bonus: 'strong Armor Reduction on body strikes' } :
    /robe|cloak|coat|mantle|drape|garment/i.test(label)                 ? { name: 'mantle',        coverage: 'cloth coverage', bonus: 'light protection with magical affinity' } :
    /gauntlet|glove|bracer|vambrace/i.test(label)                       ? { name: 'hand armor',    coverage: 'hands and forearms', bonus: 'reduces damage to swinging strikes and grapples' } :
    /boots|greaves|sabatons|leggings|sollerets/i.test(label)            ? { name: 'leg armor',     coverage: 'legs and feet', bonus: 'reduces leg damage and improves mobility' } :
    /shield|buckler|targe|kite|tower shield|aegis/i.test(label)         ? { name: 'shield',        coverage: 'blocking arc', bonus: 'high Armor Reduction and active block chance' } :
    /belt|girdle|sash/i.test(label)                                     ? { name: 'belt piece',    coverage: 'midsection', bonus: 'minor stamina + armor bonus' } :
    /ring|amulet|necklace|charm|talisman/i.test(label)                  ? { name: 'trinket',       coverage: 'worn', bonus: 'a small but persistent defensive aura' } :
    { name: 'armor piece', coverage: 'general coverage', bonus: 'a moderate Armor Reduction bonus' }

  const intro = `${pfx} ${adj} ${piece.name} reinforced with ${n}.`
  const detail = element
    ? `Provides ${piece.coverage} protection wreathed in ${tex}. Grants ${piece.bonus}.`
    : `Provides ${piece.coverage} protection. Grants ${piece.bonus}.`
  return `${intro} ${detail}`
}

// ── Ability description generator ─────────────────────────────────────────────
// Abilities are the smaller, more situational moves — distinct from Powers,
// which are flagship signature attacks.

export function generateAbilityDescription(label: string, element?: string, grade?: string): string {
  const v   = voiceFor(element)
  const t   = tierVoice(grade)
  const n   = pick(v.noun,    label)
  const eff = pick(t.effect,  label + 'e')
  const tex = pick(v.texture, label + 't')

  const type = classifyAbility(label, element)
  switch (type) {
    case 'Heal':         return `Mends wounds and restores HP through ${n}. ${eff[0].toUpperCase() + eff.slice(1)}.`
    case 'Defense':      return `Hardens the user against incoming attacks with ${n}. Damage softens as it crosses ${tex}.`
    case 'Dodge':        return `Sharpens evasion using ${n} — incoming strikes simply miss. ${eff[0].toUpperCase() + eff.slice(1)}.`
    case 'Nullification':return `Cancels an opposing ability outright with a perfectly-timed ${n}. ${eff[0].toUpperCase() + eff.slice(1)}.`
    case 'Buff':         return `Amplifies the user's stats with ${n} for several turns. ${eff[0].toUpperCase() + eff.slice(1)}.`
    case 'Debuff':       return `Saps the target's stats with creeping ${n}. Their tempo slows; damage takes a measurable bite.`
    case 'Summon':       return `Conjures ${n}-bound allies into the fight to share the burden. ${eff[0].toUpperCase() + eff.slice(1)}.`
    case 'Passive':      return `An ambient attunement to ${n}. Always active — never needs to be invoked.`
    default:             return `Unleashes a controlled burst of ${n} at the chosen target.`
  }
}

export function generateRaceDescription(label: string): string {
  return `${label} — a distinct ancestry with characteristic stat tendencies, racial techniques, and signature weaknesses.`
}

export function generateArchetypeDescription(label: string): string {
  return `The ${label} archetype shapes the character's combat role, preferred range, and how their powers come together.`
}

// ── Stat boost context text (shown below grade) ───────────────────────────────
export const ABILITY_BATTLE_EFFECT: Record<AbilityType, string> = {
  Attack:       'Contributes to Power Damage in battle',
  Heal:         'Can restore HP during combat',
  Defense:      'Contributes to Armor Reduction',
  Dodge:        'Increases Dodge Chance',
  Nullification:'Can negate opponent abilities',
  Passive:      'Provides a continuous passive bonus',
  Buff:         'Boosts allied stats during combat',
  Debuff:       'Reduces enemy stats during combat',
  Summon:       'Adds independent combatants to the fight',
}
