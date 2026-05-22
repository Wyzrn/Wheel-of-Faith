export type GamepassId =
  | 'double_shard_drop'
  | 'crit_surge'
  | 'revenge_protocol'
  | 'boss_magnet'
  | 'double_luck'
  | 'reroll_insurance'
  | 'blessed_wheel'
  | 'expanded_roster'
  | 'sell_bonus'
  | 'daily_booster'
  | 'legend_tag'
  | 'cursed_wheel'
  | 'gold_roster_frame'

export type GamepassCategory = 'combat' | 'spinning' | 'roster' | 'prestige'

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
    costShards: 2_000,
    stackable: false,
    icon: 'diamond',
  },
  {
    id: 'crit_surge',
    name: 'Crit Surge',
    description: '+10% critical hit chance permanently across all Story Mode characters.',
    effect: '+10% crit chance (stacks with Potential)',
    category: 'combat',
    costShards: 1_500,
    stackable: false,
    icon: 'bolt',
    comingSoon: true,
  },
  {
    id: 'revenge_protocol',
    name: 'Revenge Protocol',
    description: 'When you lose a battle, you still receive 50% of the enemy\'s shard drop.',
    effect: '50% shard drop on battle loss',
    category: 'combat',
    costShards: 800,
    stackable: false,
    icon: 'shield_with_heart',
    comingSoon: true,
  },
  {
    id: 'boss_magnet',
    name: 'Boss Magnet',
    description: 'Boss encounters appear more frequently in Endless Mode.',
    effect: 'Increased boss rate in Endless',
    category: 'combat',
    costShards: 1_200,
    stackable: false,
    icon: 'skull',
    comingSoon: true,
  },

  // ── Spinning ──────────────────────────────────────────────────────────────
  {
    id: 'double_luck',
    name: '2× Luck',
    description: 'Doubles your chance of triggering Fate Wildcards on every spin.',
    effect: '2× wildcard proc chance',
    category: 'spinning',
    costShards: 2_500,
    stackable: false,
    icon: 'casino',
  },
  {
    id: 'reroll_insurance',
    name: 'Reroll Insurance',
    description: 'Once per day, reroll any spin result you dislike — for free.',
    effect: '1 free reroll per day',
    category: 'spinning',
    costShards: 1_800,
    stackable: false,
    icon: 'refresh',
  },
  {
    id: 'blessed_wheel',
    name: 'Blessed Wheel',
    description: 'Higher-tier segments carry slightly more weight on every spin.',
    effect: 'Higher segments slightly favoured',
    category: 'spinning',
    costShards: 3_000,
    stackable: false,
    icon: 'star',
    comingSoon: true,
  },

  // ── Roster / Progression ──────────────────────────────────────────────────
  {
    id: 'expanded_roster',
    name: 'Expanded Roster',
    description: 'Increases your character roster capacity by 25 slots. Stackable.',
    effect: '+25 roster slots per purchase',
    category: 'roster',
    costShards: 500,
    stackable: true,
    icon: 'group_add',
  },
  {
    id: 'sell_bonus',
    name: 'Sell Bonus',
    description: 'Earn 25% more Fate Shards whenever you sell a character.',
    effect: '+25% shards on character sell',
    category: 'roster',
    costShards: 1_000,
    stackable: false,
    icon: 'sell',
  },
  {
    id: 'daily_booster',
    name: 'Daily Booster',
    description: 'Your daily free spin allowance is permanently doubled.',
    effect: '10 → 20 free spins per day',
    category: 'roster',
    costShards: 3_500,
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
    costShards: 500,
    stackable: false,
    icon: 'military_tech',
    comingSoon: true,
  },
  {
    id: 'cursed_wheel',
    name: 'Cursed Wheel',
    description: 'Transforms the spin wheel into a dark, eldritch variant with a haunted visual theme.',
    effect: 'Dark wheel cosmetic',
    category: 'prestige',
    costShards: 800,
    stackable: false,
    icon: 'dark_mode',
    comingSoon: true,
  },
  {
    id: 'gold_roster_frame',
    name: 'Gold Roster Frame',
    description: 'All your character cards display a premium gold frame in Rivals and the roster.',
    effect: 'Gold card frame cosmetic',
    category: 'prestige',
    costShards: 600,
    stackable: false,
    icon: 'workspace_premium',
    comingSoon: true,
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
}
