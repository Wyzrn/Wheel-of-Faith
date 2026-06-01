export type GamepassId =
  | 'double_shard_drop'
  | 'crit_surge'
  | 'revenge_protocol'
  | 'boss_magnet'
  | 'instant_battle'
  | 'double_luck'
  | 'reroll_insurance'
  | 'blessed_wheel'
  | 'expanded_roster'
  | 'sell_bonus'
  | 'daily_booster'
  | 'legend_tag'
  | 'cursed_wheel'
  | 'gold_roster_frame'
  // Cosmetic wheel skins — one active at a time via settings.activeWheelTheme.
  | 'guilded_wheel'
  | 'holy_wheel'
  | 'hellfire_wheel'
  | 'aquatic_wheel'
  | 'nature_wheel'
  | 'arcane_wheel'
  | 'cosmic_wheel'
  | 'glowing_wheel'
  | 'void_wheel'

export type GamepassCategory = 'combat' | 'spinning' | 'roster' | 'prestige' | 'cosmetic'

export interface GamepassDef {
  id: GamepassId
  name: string
  description: string
  effect: string
  category: GamepassCategory
  costShards: number
  stackable: boolean       // can be bought multiple times
  icon: string             // material-symbols name
  comingSoon?: boolean     // effect not yet active in-game
}

export const GAMEPASSES: GamepassDef[] = [
  // ── Combat ────────────────────────────────────────────────────────────────
  {
    id: 'double_shard_drop',
    name: '2× Shard Drop',
    description: 'All battle wins and boss drops permanently yield double Fate Shards.',
    effect: '2× shards from all battles',
    category: 'combat',
    costShards: 6_000,
    stackable: false,
    icon: 'diamond',
  },
  {
    id: 'crit_surge',
    name: 'Crit Surge',
    description: '+10% critical hit chance permanently across all Ascension characters.',
    effect: '+10% crit chance (stacks with Potential)',
    category: 'combat',
    costShards: 4_500,
    stackable: false,
    icon: 'bolt',
  },
  {
    id: 'revenge_protocol',
    name: 'Revenge Protocol',
    description: 'When you lose a battle, you still receive 50% of the enemy\'s shard drop.',
    effect: '50% shard drop on battle loss',
    category: 'combat',
    costShards: 2_400,
    stackable: false,
    icon: 'shield_with_heart',
  },
  {
    id: 'boss_magnet',
    name: 'Boss Magnet',
    description: 'Boss encounters appear more frequently in Endless Mode.',
    effect: 'Increased boss rate in Endless',
    category: 'combat',
    costShards: 3_600,
    stackable: false,
    icon: 'skull',
  },
  {
    id: 'instant_battle',
    name: 'Instant Battle',
    description: 'Unlocks a Skip button in every battle that fast-forwards the entire fight to the result in one tap.',
    effect: 'In-battle Skip → result',
    category: 'combat',
    costShards: 5_000,
    stackable: false,
    icon: 'fast_forward',
  },

  // ── Spinning ──────────────────────────────────────────────────────────────
  {
    id: 'double_luck',
    name: '2× Luck',
    description: 'Doubles your chance of triggering Fate Wildcards on every spin.',
    effect: '2× wildcard proc chance',
    category: 'spinning',
    costShards: 7_500,
    stackable: false,
    icon: 'casino',
  },
  {
    id: 'reroll_insurance',
    name: 'Reroll Insurance',
    description: 'Once per day, reroll any spin result you dislike — for free.',
    effect: '1 free reroll per day',
    category: 'spinning',
    costShards: 5_400,
    stackable: false,
    icon: 'refresh',
  },
  {
    id: 'blessed_wheel',
    name: 'Blessed Wheel',
    description: 'Stat tiers A- and above get a 1.4× weight bias on every stat wheel — sharper highs without breaking the rarity curve.',
    effect: 'Stat A- and above × 1.4 weight',
    category: 'spinning',
    costShards: 9_000,
    stackable: false,
    icon: 'star',
  },

  // ── Roster / Progression ──────────────────────────────────────────────────
  {
    id: 'expanded_roster',
    name: 'Expanded Roster',
    description: 'Increases your character roster capacity by 25 slots. Stackable.',
    effect: '+25 roster slots per purchase',
    category: 'roster',
    costShards: 1_500,
    stackable: true,
    icon: 'group_add',
  },
  {
    id: 'sell_bonus',
    name: 'Sell Bonus',
    description: 'Earn 25% more Fate Shards whenever you sell a character.',
    effect: '+25% shards on character sell',
    category: 'roster',
    costShards: 3_000,
    stackable: false,
    icon: 'sell',
  },
  {
    id: 'daily_booster',
    name: 'Daily Booster',
    description: 'Your daily free spin allowance is permanently doubled.',
    effect: '10 → 20 free spins per day',
    category: 'roster',
    costShards: 10_500,
    stackable: false,
    icon: 'today',
  },

  // ── Prestige / Flex ───────────────────────────────────────────────────────
  {
    id: 'legend_tag',
    name: 'Legend Tag',
    description: 'Exclusive [LEGEND] badge shown next to your name in Rivals and online modes.',
    effect: 'Cosmetic name badge',
    category: 'prestige',
    costShards: 1_500,
    stackable: false,
    icon: 'military_tech',
  },
  {
    id: 'cursed_wheel',
    name: 'Cursed Wheel',
    description: 'A haunted violet skin: spike crowns ring the rim and a pulsating dark aura churns inside the wheel.',
    effect: 'Wheel skin',
    category: 'cosmetic',
    costShards: 1_500,
    stackable: false,
    icon: 'dark_mode',
  },
  // ── Cosmetic wheel skins — pricier ones look cooler. ─────────────────────
  {
    id: 'glowing_wheel',
    name: 'Glowing Wheel',
    description: 'A clean cyan luminance with a soft inner pulse — every spin feels charged.',
    effect: 'Wheel skin',
    category: 'cosmetic',
    costShards: 500,
    stackable: false,
    icon: 'light_mode',
  },
  {
    id: 'nature_wheel',
    name: 'Nature Wheel',
    description: 'Verdant emerald rim threaded with vines and a soft mossy glow within.',
    effect: 'Wheel skin',
    category: 'cosmetic',
    costShards: 500,
    stackable: false,
    icon: 'forest',
  },
  {
    id: 'guilded_wheel',
    name: 'Guilded Wheel',
    description: 'Bright gilded gold rim with a warm gilded sheen rippling across the inner aura.',
    effect: 'Wheel skin',
    category: 'cosmetic',
    costShards: 1_000,
    stackable: false,
    icon: 'auto_awesome',
  },
  {
    id: 'aquatic_wheel',
    name: 'Aquatic Wheel',
    description: 'Tidal cyan rim and a rolling deep-sea aura that ripples inside the wheel.',
    effect: 'Wheel skin',
    category: 'cosmetic',
    costShards: 1_000,
    stackable: false,
    icon: 'water_drop',
  },
  {
    id: 'holy_wheel',
    name: 'Holy Wheel',
    description: 'A radiant halo of white-gold light, with a divine inner glow that feels sanctified.',
    effect: 'Wheel skin',
    category: 'cosmetic',
    costShards: 1_500,
    stackable: false,
    icon: 'church',
  },
  {
    id: 'arcane_wheel',
    name: 'Arcane Wheel',
    description: 'Indigo runes dance around the rim while an arcane violet-azure aura swims inside.',
    effect: 'Wheel skin',
    category: 'cosmetic',
    costShards: 1_500,
    stackable: false,
    icon: 'auto_fix',
  },
  {
    id: 'hellfire_wheel',
    name: 'Hellfire Wheel',
    description: 'A crown of jagged crimson flames and a furious ember-storm aura raging inside. Cooler than cursed.',
    effect: 'Wheel skin',
    category: 'cosmetic',
    costShards: 2_000,
    stackable: false,
    icon: 'local_fire_department',
  },
  {
    id: 'cosmic_wheel',
    name: 'Cosmic Wheel',
    description: 'A galactic nebula swirls inside the wheel with rotating star fields and a deep-space rim.',
    effect: 'Wheel skin',
    category: 'cosmetic',
    costShards: 2_000,
    stackable: false,
    icon: 'auto_awesome_mosaic',
  },
  {
    id: 'void_wheel',
    name: 'Void Wheel',
    description: 'Reality fractures around the rim — a swirling magenta void inside threatens to consume the wheel. The crown jewel.',
    effect: 'Wheel skin',
    category: 'cosmetic',
    costShards: 2_500,
    stackable: false,
    icon: 'blur_on',
  },
  {
    id: 'gold_roster_frame',
    name: 'Gold Roster Frame',
    description: 'All your character cards display a premium gold frame in Rivals and the roster.',
    effect: 'Gold card frame cosmetic',
    category: 'prestige',
    costShards: 1_800,
    stackable: false,
    icon: 'workspace_premium',
  },
]

export const GAMEPASS_MAP = Object.fromEntries(GAMEPASSES.map(g => [g.id, g])) as Record<GamepassId, GamepassDef>

// ── Shard packs (real-money products) ─────────────────────────────────────────
export interface ShardPack {
  id: string
  name: string
  shards: number
  priceUsd: number        // in cents for Stripe
  priceDisplay: string
  tag?: string            // e.g. "Best Value"
}

export const SHARD_PACKS: ShardPack[] = [
  { id: 'shards_500',    name: 'Handful of Shards', shards: 500,    priceUsd: 99,   priceDisplay: '$0.99' },
  { id: 'shards_2500',   name: 'Shard Pouch',       shards: 2_500,  priceUsd: 399,  priceDisplay: '$3.99' },
  { id: 'shards_10000',  name: 'Shard Chest',        shards: 10_000, priceUsd: 999,  priceDisplay: '$9.99',  tag: 'Popular' },
  { id: 'shards_50000',  name: 'Shard Vault',        shards: 50_000, priceUsd: 3999, priceDisplay: '$39.99', tag: 'Best Value' },
]

export const SHARD_PACK_MAP = Object.fromEntries(SHARD_PACKS.map(p => [p.id, p])) as Record<string, ShardPack>

export const CATEGORY_LABELS: Record<GamepassCategory, string> = {
  combat:   'Combat',
  spinning: 'Spinning',
  roster:   'Roster',
  prestige: 'Prestige',
  cosmetic: 'Cosmetic',
}
