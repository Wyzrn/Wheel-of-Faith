// Dialogue scenes for the in-game NPC guide (Quill, the Fate Scribe).
//
// Each scene is a sequence of dialogue lines, optionally followed by choice
// buttons that navigate, dismiss, or jump to another scene. Scenes fire
// either automatically the first time a player reaches a route, or manually
// when the player taps the persistent "?" portrait button to ask about the
// current screen.
//
// Tone — bookish, wry, slight gravitas. Quill calls the player "Spinner"
// and references fate, ink, the wheel. Lines are kept short (≤2 sentences)
// so the dialogue stays paced; no walls of text. The player advances at
// their own speed by tapping Next.

export type GuideChoice = {
  label: string
  // 'next-scene' — jump to another scene immediately
  // 'navigate'   — goto a route (and optionally fire its first-visit scene)
  // 'dismiss'    — close the guide
  action: 'next-scene' | 'navigate' | 'dismiss'
  // For 'next-scene' this is the scene id; for 'navigate' it's the route
  target?: string
  // Optional accent color for the choice button
  color?: string
}

export type GuideLine = {
  text: string
  // Optional emotion hint, currently just used to subtly tint the portrait
  mood?: 'neutral' | 'wry' | 'grave' | 'pleased' | 'urgent'
}

export type GuideScene = {
  id: string
  // Display name used in the "Ask Quill about…" menu (when the player taps
  // the persistent help portrait). Omit for purely automatic scenes.
  menuLabel?: string
  lines: GuideLine[]
  choices?: GuideChoice[]
  // If true, replaying this scene resets the seen flag for downstream scenes
  // it gates. Usually unused — most scenes are idempotent.
  oneShot?: boolean
}

// Quill's identity is centralized so the portrait + name read consistently.
export const QUILL = {
  name: 'Quill',
  title: 'Fate Scribe',
  // Material symbol used as the portrait. Gold-tinted in the component.
  icon: 'history_edu',
  accent: '#f0c040',
} as const

export const SCENES: Record<string, GuideScene> = {
  // ── Triggered after the first character is built (spin 23 reveal). The
  //    big introduction. Answers Ryan's question: "What IS this game?"
  'first-character': {
    id: 'first-character',
    menuLabel: 'My first character',
    lines: [
      { text: "There you are. I felt the wheel stop — a new fate written.", mood: 'pleased' },
      { text: "I am Quill. I record every destiny the wheel produces. Yours is now in the book.", mood: 'neutral' },
      { text: "What you just built is your first hero. Permanent. Yours. The card on your screen is the whole of them — race, powers, weapons, weaknesses.", mood: 'neutral' },
      { text: "Now the question, Spinner: what will you do with them?", mood: 'wry' },
    ],
    choices: [
      { label: 'Tell me about Ascension', action: 'next-scene', target: 'ascension-intro', color: '#34d399' },
      { label: 'Tell me about Rivals',    action: 'next-scene', target: 'rivals-intro',    color: '#f87171' },
      { label: 'I want to spin again',    action: 'dismiss',                                color: '#f0c040' },
    ],
  },

  'home-overview': {
    id: 'home-overview',
    menuLabel: 'What is this screen?',
    lines: [
      { text: "Welcome back. This is the heart of things — every road begins from here.", mood: 'neutral' },
      { text: "The wheel sits at center. Spin it any time to forge another hero. Each one joins your collection.", mood: 'neutral' },
      { text: "Below, in the bar, lie the other halls: your fighters, your friends, your profile. And the gear-wheel — Settings, for the practical matters.", mood: 'wry' },
      { text: "When in doubt, tap me. I'll explain whatever screen you wander into.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // ── Ascension (Story mode). The biggest single feature.
  'ascension-intro': {
    id: 'ascension-intro',
    menuLabel: 'What is Ascension?',
    lines: [
      { text: "Ascension. The long road, Spinner.", mood: 'grave' },
      { text: "Four save slots — four parallel destinies. Pick one and a world opens to you, beginning at the F rung and climbing to the Absolute.", mood: 'neutral' },
      { text: "Each day the wheel gifts you ten free spins, refreshing every few hours. Use them to forge heroes for your roster, then send those heroes into battle.", mood: 'neutral' },
      { text: "Win battles, and the world drops crystals. Inside each crystal: a power, a weapon, an armor. Equip them. Make your heroes stronger.", mood: 'pleased' },
      { text: "Climb high enough and Endless Mode opens — waves without end, names carved on a global leaderboard.", mood: 'wry' },
    ],
    choices: [
      { label: 'Take me there',  action: 'navigate', target: '/story', color: '#34d399' },
      { label: "I'll go later",  action: 'dismiss',                     color: '#9a907b' },
    ],
  },

  // ── Rivals mode.
  'rivals-intro': {
    id: 'rivals-intro',
    menuLabel: 'What is Rivals?',
    lines: [
      { text: "Rivals. Where heroes meet steel.", mood: 'urgent' },
      { text: "Send one of your characters into the arena. They fight another's — auto-resolved by stats, powers, weapons, weaknesses, and the cruel arithmetic of fate.", mood: 'neutral' },
      { text: "Three flavors: Local, where you and a friend share one device. Online, where the matchmaker finds a stranger. Bot Battle, when no human answers the call.", mood: 'wry' },
      { text: "Every win is recorded. Your rank rises. Climb high enough and a rival might come hunting you instead.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Sounds good',    action: 'dismiss', color: '#f87171' },
    ],
  },

  // ── Clan / Guild.
  'clan-intro': {
    id: 'clan-intro',
    menuLabel: 'What are Clans?',
    lines: [
      { text: "A clan is a banner. Up to ten Spinners under one crest.", mood: 'neutral' },
      { text: "Founding one costs nothing but a name. Joining another requires their open door — or, for invite-only halls, a request and the leader's nod.", mood: 'neutral' },
      { text: "Once banded, you may wage Guild Wars together — coordinated assaults that move your clan up the rankings.", mood: 'urgent' },
      { text: "Look for the crests on the Browse tab. Each tells you, with a pill, whether you may join.", mood: 'wry' },
    ],
    choices: [
      { label: 'Browse clans', action: 'navigate', target: '/clan', color: '#5ad6ef' },
      { label: 'Got it',       action: 'dismiss',                   color: '#9a907b' },
    ],
  },

  // ── Shop / currencies.
  'shop-intro': {
    id: 'shop-intro',
    menuLabel: 'Currencies & Shop',
    lines: [
      { text: "Two currencies hum through this world, Spinner.", mood: 'neutral' },
      { text: "Fate Shards — those gold diamonds — are yours forever. They follow you across slots and sessions. Earn them in Ascension battles and Daily Challenges.", mood: 'pleased' },
      { text: "Gems are smaller things — per-slot, earned by selling roster characters or winning ascension fights. They buy local upgrades.", mood: 'neutral' },
      { text: "The Arcane Shop trades Fate Shards for Gamepasses — permanent boons that bend the wheel in your favor. And for Stat Crystals, if you wish to grow a hero by hand.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // ── Fighters / roster page.
  'characters-intro': {
    id: 'characters-intro',
    menuLabel: 'What is the Fighters page?',
    lines: [
      { text: "Every hero you've forged lives here.", mood: 'neutral' },
      { text: "Tap a card to inspect them. Equip them with crystal-drops. Send them to Rivals. Or — if the ink has dried wrong — sell them back for gems.", mood: 'wry' },
      { text: "Your strongest five may be lifted into your profile's Hall of Fame, a relic for visitors to admire.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // ── Profile.
  'profile-intro': {
    id: 'profile-intro',
    menuLabel: 'What is on my Profile?',
    lines: [
      { text: "Your standing, Spinner. Stamped in gold for the world to read.", mood: 'pleased' },
      { text: "Rivals wins, ascension peak, hall of fame, friends, clan. The shape of your story so far.", mood: 'neutral' },
      { text: "Visitors may challenge you here. Choose your fighters carefully — first impressions linger.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // ── Friends.
  'friends-intro': {
    id: 'friends-intro',
    menuLabel: 'What is the Friends page?',
    lines: [
      { text: "Other Spinners you've crossed paths with. Add them by username, accept their requests, see who's online.", mood: 'neutral' },
      { text: "From here you may challenge a friend to a duel, or pull them into a clan with you.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },
}

// Map of route prefix → first-visit scene id. Used by the layout to fire
// the right introduction automatically. Order matters — first match wins.
export const ROUTE_SCENES: { prefix: string; sceneId: string }[] = [
  { prefix: '/story',      sceneId: 'ascension-intro' },
  { prefix: '/clan',       sceneId: 'clan-intro' },
  { prefix: '/clans',      sceneId: 'clan-intro' },
  { prefix: '/shop',       sceneId: 'shop-intro' },
  { prefix: '/characters', sceneId: 'characters-intro' },
  { prefix: '/friends',    sceneId: 'friends-intro' },
  { prefix: '/profile',    sceneId: 'profile-intro' },
]

// Which scene id is the current-screen "Ask Quill" target for a given route.
// Same map as ROUTE_SCENES + a Home entry.
export function sceneForRoute(pathname: string): string | null {
  if (pathname === '/' || pathname === '') return 'home-overview'
  for (const { prefix, sceneId } of ROUTE_SCENES) {
    if (pathname.startsWith(prefix)) return sceneId
  }
  return null
}
