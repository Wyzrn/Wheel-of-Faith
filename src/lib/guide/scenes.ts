// Dialogue scenes for the in-game NPC guide (Quill, the Fate Scribe).
//
// Every route AND every sub-view within a route has a scene below. The
// guide store tracks both the current pathname and a registered sub-view
// (e.g. clan tab "browse"), and the route-resolver picks the most specific
// scene available.
//
// Each scene is a sequence of dialogue lines, optionally followed by choice
// buttons that navigate, dismiss, or jump to another scene. Scenes fire
// either automatically the first time a player reaches a screen, or
// manually when the player taps the persistent "?" portrait button.
//
// Voice — bookish, wry, slight gravitas. Quill calls the player "Spinner"
// and uses fate, ink, and wheel metaphors. Lines are kept under ~2
// sentences so dialogue stays paced; complex screens get more LINES, not
// longer lines. Detailed instructions go in the body of the lines —
// concrete buttons, locations, outcomes — not just flavor.

export type GuideChoice = {
  label: string
  // 'next-scene' — jump to another scene immediately
  // 'navigate'   — goto a route (the route's first-visit scene then fires
  //                automatically if unseen)
  // 'dismiss'    — close the guide
  action: 'next-scene' | 'navigate' | 'dismiss'
  // For 'next-scene' this is the scene id; for 'navigate' it's the route
  target?: string
  // Optional accent color for the choice button
  color?: string
}

export type GuideLine = {
  text: string
  // Optional emotion hint — used to subtly tint the portrait glow
  mood?: 'neutral' | 'wry' | 'grave' | 'pleased' | 'urgent'
}

export type GuideScene = {
  id: string
  // Display name used in the "Ask Quill about…" menu. Omit for purely
  // automatic scenes that don't make sense to summon directly.
  menuLabel?: string
  lines: GuideLine[]
  choices?: GuideChoice[]
}

// Quill's identity is centralized so portrait + name read consistently.
export const QUILL = {
  name: 'Quill',
  title: 'Fate Scribe',
  // Material symbol used as the portrait. Gold-tinted in the component.
  icon: 'history_edu',
  accent: '#f0c040',
} as const

export const SCENES: Record<string, GuideScene> = {

  // ══════════════════════════════════════════════════════════════════════
  //  HOME / MAIN SPIN PAGE  (path: /)
  // ══════════════════════════════════════════════════════════════════════

  // First scene the player ever sees with Quill — fires the moment their
  // first character's title reveals. Answers Ryan's playtest question:
  // "What IS this game?" by reframing it as worldbuilding.
  'first-character': {
    id: 'first-character',
    menuLabel: 'My first character',
    lines: [
      { text: "There you are. I felt the wheel stop — a new fate written.", mood: 'pleased' },
      { text: "I am Quill. I record every destiny the wheel produces. Yours is now in the book.", mood: 'neutral' },
      { text: "Look at the card before you. That is your hero — race, powers, weapons, weaknesses, all of it permanent. The tier in the corner is their grade across the whole.", mood: 'neutral' },
      { text: "From here, four roads lie open. You may forge another, send this one to battle, climb the worlds of Ascension, or share their card with anyone you please.", mood: 'wry' },
      { text: "Tell me which path interests you — or wave me away, and I'll be here when you tap my portrait.", mood: 'wry' },
    ],
    choices: [
      { label: 'Ascension — the long road',  action: 'next-scene', target: 'ascension-intro',  color: '#34d399' },
      { label: 'Rivals — fight someone',     action: 'next-scene', target: 'rivals-intro',     color: '#f87171' },
      { label: 'Spin another hero',          action: 'dismiss',                                 color: '#f0c040' },
    ],
  },

  // The main menu — describes every tile on the gold panel of verbs that
  // sits in the centre of the home screen.
  'home-overview': {
    id: 'home-overview',
    menuLabel: 'What is in this menu?',
    lines: [
      { text: "Welcome back, Spinner. The main hall — every path opens from this menu.", mood: 'pleased' },
      { text: "Spin the Wheel forges a fresh hero. Twenty-three wheels, race to title, in sequence. Your last spun character is shown in a panel beside it.", mood: 'neutral' },
      { text: "Rivals Mode pits one of your heroes against another player's — local, online, or a bot. Wins climb your rank.", mood: 'urgent' },
      { text: "Ascension is the long campaign. Twenty worlds, four save slots, daily spins, crystal drops, an endless mode beyond the climb.", mood: 'grave' },
      { text: "The Arcane Shop trades Fate Shards — those gold diamonds at the top of the screen — for Gamepasses and Stat Crystals. Permanent boons, every one.", mood: 'neutral' },
      { text: "Daily Challenges hands out small tasks each day. Three of them, up to one hundred seventy-five Shards if you finish all.", mood: 'pleased' },
      { text: "Hall of Champions ranks every Spinner by their Rivals victories. Hall of Fates collects characters players have published for the world to see.", mood: 'wry' },
      { text: "The bar below holds the smaller halls — Home returns here, Fighters keeps every hero you've forged, Friends lists allies, Settings is for the practical matters.", mood: 'neutral' },
      { text: "Tap my portrait on any screen and I'll explain it. That is the whole of the deal.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // The main-menu overlay (when triggerMenu() pops the gold panel).
  'home-menu': {
    id: 'home-menu',
    menuLabel: 'What is in this menu?',
    lines: [
      { text: "The main paths of the game, gathered in one place.", mood: 'neutral' },
      { text: "Ascension is the long campaign — twenty worlds to climb. Rivals is direct combat against other Spinners. The Arcane Shop trades Fate Shards for permanent boons.", mood: 'neutral' },
      { text: "Daily Challenges pay Shards for small tasks. The Hall of Champions ranks every Spinner by their wins. Settings adjusts sound, speed, and battle fidelity.", mood: 'wry' },
      { text: "Each opens to its own screen — and when you arrive, I will be there to explain it.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // Active spin session — manual-summon scene for someone who lost their
  // bearings mid-creation.
  'wheel-spinning': {
    id: 'wheel-spinning',
    menuLabel: 'Help — I am mid-spin',
    lines: [
      { text: "Peace, Spinner. The wheel does not punish hesitation.", mood: 'pleased' },
      { text: "Tap the wheel to spin it. The pointer at the top will land on a segment; that segment IS your result, label and all.", mood: 'neutral' },
      { text: "Watch for the flash — a five-percent chance on every stat spin. The Wildcard rewrites your roll: up, down, or sideways. Fortune has many faces.", mood: 'urgent' },
      { text: "When the title spin lands, your hero is complete. Name them, and the card is yours. Until then, only the dropdown at the corner can pause us.", mood: 'neutral' },
    ],
    choices: [
      { label: 'Back to spinning', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  ASCENSION  (paths: /story, /story/slot/[shareId])
  // ══════════════════════════════════════════════════════════════════════

  'ascension-intro': {
    id: 'ascension-intro',
    menuLabel: 'What is Ascension?',
    lines: [
      { text: "Ascension. The long road, Spinner.", mood: 'grave' },
      { text: "You will choose one of four save slots — four parallel destinies, each independent of the others. Tap a slot to claim it.", mood: 'neutral' },
      { text: "Once chosen, a hub opens: a Roster of your forged heroes, a Shop for in-slot purchases, a Wheel that spends your daily spins, and the Worlds — twenty of them, climbing from F to Infinite.", mood: 'neutral' },
      { text: "Each day, the wheel grants you ten free spins, refreshing every three hours. Use them to build heroes. Send those heroes into battle.", mood: 'neutral' },
      { text: "Win, and the world drops Crystals: a power, a weapon, an armor sealed inside each one. Open them. Equip them. Grow stronger.", mood: 'pleased' },
      { text: "Reach the third world and Endless Mode unlocks — waves without end, names carved on a global leaderboard.", mood: 'wry' },
    ],
    choices: [
      { label: 'Take me there',  action: 'navigate', target: '/story', color: '#34d399' },
      { label: "I'll go later",  action: 'dismiss',                     color: '#9a907b' },
    ],
  },

  // /story — the 4-slot picker landing.
  'ascension-slot-select': {
    id: 'ascension-slot-select',
    menuLabel: 'How do save slots work?',
    lines: [
      { text: "Four ledgers lie before you. Each tracks its own progress — its own roster, gems, worlds beaten.", mood: 'neutral' },
      { text: "Tap an empty slot to begin a new story. Tap an occupied slot to continue where you left off.", mood: 'neutral' },
      { text: "Switching slots loses nothing. The other three keep their place, untouched, until you return.", mood: 'wry' },
      { text: "Pick boldly. A slot may be wiped clean later from inside its hub, should you wish to restart.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // /story/slot/[shareId] — the hub menu inside a slot.
  'ascension-hub': {
    id: 'ascension-hub',
    menuLabel: 'What is this hub?',
    lines: [
      { text: "Welcome to your slot, Spinner. Four doors open from this hall.", mood: 'pleased' },
      { text: "Levels — the sixteen worlds, climbed in order. Each holds twenty battles, gem drops, and a boss at the end.", mood: 'neutral' },
      { text: "Roster — every hero you have built in this slot. Equip them, upgrade their stats with crystals, sell the weak ones for gems.", mood: 'neutral' },
      { text: "Shop — spend Gems on Stat Crystals to permanently raise individual stats, or on extra spins when daily refresh is too slow.", mood: 'neutral' },
      { text: "Wheel — the spin wheel itself. Each tap costs one daily spin and forges a new hero. Hero and Legend rolls carry multiplied stats.", mood: 'wry' },
      { text: "Your daily spin count and gem total ride at the top. Watch them.", mood: 'neutral' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // Sub-views inside /story/slot — these fire when guide.setSubView()
  // matches. Routes set the sub-view via an $effect in their <script>.

  'ascension-worlds': {
    id: 'ascension-worlds',
    menuLabel: 'How do the Worlds work?',
    lines: [
      { text: "Twenty worlds, climbed in order. You begin at F, the threshold; the Infinite waits at the summit.", mood: 'grave' },
      { text: "Each world holds twenty battles. Tap a level to choose your team — up to three heroes from your roster — and step in.", mood: 'neutral' },
      { text: "The minimum stat tier required for a hero rises as the worlds climb. Bring strong fighters or be ground down.", mood: 'urgent' },
      { text: "Win, and gems and crystals drop. Lose, and your team is bruised but not gone — try again.", mood: 'neutral' },
      { text: "Clear all twenty in a world to break the seal on the next.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#34d399' },
    ],
  },

  'ascension-roster': {
    id: 'ascension-roster',
    menuLabel: 'What is the Roster?',
    lines: [
      { text: "Every hero forged in this slot lives here.", mood: 'neutral' },
      { text: "Tap a card to inspect them in full — stats, powers, equipment. From the inspect view you may equip crystal drops, apply stat crystals, or sell them back for gems.", mood: 'neutral' },
      { text: "Use the sort and filter at the top to find specific heroes — by grade, by element, by class. The roster grows fast.", mood: 'wry' },
      { text: "Select up to three for a battle team before entering a level. A balanced team beats a star-studded mess.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#34d399' },
    ],
  },

  'ascension-shop': {
    id: 'ascension-shop',
    menuLabel: 'What is the slot Shop?',
    lines: [
      { text: "Gems in, advantages out.", mood: 'wry' },
      { text: "Stat Crystals raise a single stat tier on one hero, permanently. Common ones cost little; Legendary ones move mountains.", mood: 'neutral' },
      { text: "Extra spins may be purchased here when patience is in short supply — though the daily refresh is free, if you can wait.", mood: 'neutral' },
      { text: "Gems are per-slot. Spend them only on this slot's heroes.", mood: 'grave' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#34d399' },
    ],
  },

  'ascension-wheel': {
    id: 'ascension-wheel',
    menuLabel: 'How do Ascension spins work?',
    lines: [
      { text: "Each tap of this wheel costs one of your daily spins and forges a hero — same engine as the main spin, distilled into a slot.", mood: 'neutral' },
      { text: "Most spins are Common. But the wheel sometimes flashes Hero — multiplied stats. Rarer still, Legend — multiplied higher still.", mood: 'urgent' },
      { text: "You begin each day with ten spins. Every three hours, a fresh spin returns up to the cap. The Daily Booster gamepass doubles the cap to twenty.", mood: 'neutral' },
      { text: "Heroes forged here go straight to this slot's Roster. They do not appear in your main collection.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#34d399' },
    ],
  },

  'ascension-crystals': {
    id: 'ascension-crystals',
    menuLabel: 'What are Crystals?',
    lines: [
      { text: "Crystals are sealed gifts the worlds drop when you win battles.", mood: 'pleased' },
      { text: "Inside each: one power, one weapon, one armor — random, graded by the crystal's tier. Common crystals seal common things; Legendary crystals seal the absurd.", mood: 'neutral' },
      { text: "Open them from the Inventory tab. Equip what you wish onto a roster hero — each may hold one power, one weapon, one armor at once.", mood: 'neutral' },
      { text: "Dismantle the ones you do not need. The shards return to your gem pool.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#34d399' },
    ],
  },

  'ascension-stat-crystals': {
    id: 'ascension-stat-crystals',
    menuLabel: 'How do Stat Crystals work?',
    lines: [
      { text: "Stat Crystals shift a hero's foundation. Permanent. Unreversible.", mood: 'grave' },
      { text: "Tap a crystal, then pick the hero to feed it to. The grade is shown — each application bumps the chosen stat by one tier, capped only by absurdity.", mood: 'neutral' },
      { text: "Spent properly, a B-grade hero becomes an S. Spent foolishly, you have lost a crystal to a stat that mattered little.", mood: 'wry' },
      { text: "The roster auto-sorts by grade so you can pour crystals into your strongest first.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#34d399' },
    ],
  },

  'ascension-battle-prep': {
    id: 'ascension-battle-prep',
    menuLabel: 'What is happening here?',
    lines: [
      { text: "The battle is set. Select your team — up to three heroes — before stepping forward.", mood: 'neutral' },
      { text: "Element matters. Read the enemy's weakness in their card; pick a hero whose powers strike that vein. Bonus damage rewards the prepared.", mood: 'urgent' },
      { text: "Adjust your speed in the gear menu if the auto-battle is too slow or too fast for your taste. Instant is twenty times speed; not a skip.", mood: 'wry' },
      { text: "Win and crystals may drop. Lose and only your dignity is bruised.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#34d399' },
    ],
  },

  // /story/slot/[shareId] — public slot-snapshot a player shares as a link.
  'ascension-slot-share': {
    id: 'ascension-slot-share',
    menuLabel: 'What is this page?',
    lines: [
      { text: "A shared glimpse of a Spinner's Ascension slot — beaten worlds, milestones, the shape of their climb.", mood: 'pleased' },
      { text: "If this is your own slot, the link beside the title is yours to copy and share.", mood: 'neutral' },
      { text: "To continue your run, head back to Ascension and select this slot.", mood: 'wry' },
    ],
    choices: [
      { label: 'Open Ascension', action: 'navigate', target: '/story', color: '#34d399' },
      { label: 'Got it',         action: 'dismiss',                     color: '#9a907b' },
    ],
  },

  'ascension-endless': {
    id: 'ascension-endless',
    menuLabel: 'What is Endless Mode?',
    lines: [
      { text: "Endless. No end, no win — only how far before the inevitable.", mood: 'grave' },
      { text: "Wave after wave of enemies, each stronger than the last. Your team carries health across waves; revival is rare.", mood: 'urgent' },
      { text: "The deepest wave you reach is recorded on the global leaderboard. Names of legends. Names of madmen.", mood: 'wry' },
      { text: "Bring your strongest. The score is brutal.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f87171' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  RIVALS  (path: /rivals)
  // ══════════════════════════════════════════════════════════════════════

  'rivals-intro': {
    id: 'rivals-intro',
    menuLabel: 'What is Rivals?',
    lines: [
      { text: "Rivals. Where heroes meet steel.", mood: 'urgent' },
      { text: "Send one of your characters into the arena. They fight another's — auto-resolved by stats, powers, weapons, weaknesses, and the cruel arithmetic of fate.", mood: 'neutral' },
      { text: "Three formats, Spinner. Local — share a device with a friend, take turns picking. Online — the matchmaker pairs you with a stranger. Bot Battle — when no human answers, the wheel sends one of its own.", mood: 'neutral' },
      { text: "Every win is recorded. Your rank rises through tiers — Iron, Bronze, Silver, Gold, and beyond — and gamepasses in the Shop bend the odds further.", mood: 'wry' },
      { text: "Pick a format above to begin. Pick your fighter when prompted.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Take me to Rivals', action: 'navigate', target: '/rivals', color: '#f87171' },
      { label: 'Got it',            action: 'dismiss',                     color: '#9a907b' },
    ],
  },

  'rivals-format-picker': {
    id: 'rivals-format-picker',
    menuLabel: 'Which format should I choose?',
    lines: [
      { text: "Three flavors of combat sit before you.", mood: 'neutral' },
      { text: "Local lets two Spinners share one device — each picks a fighter from your collection. Quick. Quiet. No matchmaking.", mood: 'neutral' },
      { text: "Online queues you against a real Spinner somewhere in the world. Win-loss is recorded on your profile and the Hall of Champions.", mood: 'urgent' },
      { text: "Bot Battle fills the role when no Online opponent appears, and your wins still count. A mercy of the wheel.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f87171' },
    ],
  },

  'rivals-character-picker': {
    id: 'rivals-character-picker',
    menuLabel: 'How do I pick a fighter?',
    lines: [
      { text: "Your roster fans out before you. Tap a card to send them in.", mood: 'neutral' },
      { text: "Tier grade matters — a higher grade carries broader stats. But element matchups and equipped powers can topple the favored. Read your opponent if you can.", mood: 'urgent' },
      { text: "Sort by grade or recent. Hide the ones you'd never deploy. The chooser is yours.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f87171' },
    ],
  },

  'rivals-online-queue': {
    id: 'rivals-online-queue',
    menuLabel: 'What happens in the queue?',
    lines: [
      { text: "The matchmaker is at work. It seeks another Spinner near your rank.", mood: 'neutral' },
      { text: "If none arrive within the wait, a Bot fills the seat — and your win still counts toward your standing.", mood: 'wry' },
      { text: "Leave at any time with the back arrow. Your queue position resets, but no harm is done.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f87171' },
    ],
  },

  'rivals-ranks': {
    id: 'rivals-ranks',
    menuLabel: 'How do Rivals Ranks work?',
    lines: [
      { text: "Ten tiers, Spinner. Iron at the foot, Mythic at the crown.", mood: 'pleased' },
      { text: "Wins lift your MMR. Losses lower it. Cross a threshold and you are promoted; fall too far and the rank slips from your grasp.", mood: 'neutral' },
      { text: "Each tier wears its own crest, visible on your profile and in clan boards. Climbing is its own reward — and a few cosmetics unlock at the higher rungs.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'rivals-result': {
    id: 'rivals-result',
    menuLabel: 'What just happened?',
    lines: [
      { text: "The battle is decided. The screen tallies wins, losses, and MMR change.", mood: 'neutral' },
      { text: "Queue another from here, or step back to the menu to choose a different fighter.", mood: 'wry' },
      { text: "Replays are kept — find this one later under Battle Replays if you want a second look.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  CLAN  (paths: /clan, /clans/[id])
  // ══════════════════════════════════════════════════════════════════════

  // Default scene for /clan — fires on first visit before a sub-view is set.
  'clan-intro': {
    id: 'clan-intro',
    menuLabel: 'What are Clans?',
    lines: [
      { text: "A clan is a banner. Up to fifty Spinners under one crest, sharing wins, chatting, waging guild wars together.", mood: 'neutral' },
      { text: "Three tabs above — My Clan shows your home, Browse lists clans seeking members, Top ranks the strongest by combined victories.", mood: 'neutral' },
      { text: "Founding one costs nothing but a name. Joining another requires their open door — or, for invite-only halls, a request and the leader's nod.", mood: 'neutral' },
      { text: "Once banded, you may wage Guild Wars together — coordinated assaults that move your clan up the rankings.", mood: 'urgent' },
      { text: "Look for the crests on the Browse tab. Each tile carries a pill that tells you, plainly, whether you may join.", mood: 'wry' },
    ],
    choices: [
      { label: 'Browse clans',   action: 'navigate', target: '/clan', color: '#5ad6ef' },
      { label: 'Got it',         action: 'dismiss',                   color: '#9a907b' },
    ],
  },

  'clan-mine': {
    id: 'clan-mine',
    menuLabel: 'What is on the My Clan tab?',
    lines: [
      { text: "Your hall. Banner, members, motto, level — all here.", mood: 'pleased' },
      { text: "The action row offers Chat, Top Characters, and Guild War. If you are Leader, Co-Leader, or Elder, a Pending Requests inbox also appears.", mood: 'neutral' },
      { text: "Members list below. Tap any of them to view their profile or challenge them to a duel.", mood: 'neutral' },
      { text: "Wars can be opened from the Guild War tile — once your clan is large enough, your name may be carved on the war board.", mood: 'urgent' },
      { text: "Leaders may also disband the clan from the bottom — irreversible. Members may simply leave.", mood: 'grave' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'clan-browse': {
    id: 'clan-browse',
    menuLabel: 'How do I find a clan to join?',
    lines: [
      { text: "Every tile is a clan with room — or near it.", mood: 'neutral' },
      { text: "The pill on the right tells the truth at a glance. Green Join means open: tap and you are in. Gold Request means invite-only: tap to apply, the leader decides.", mood: 'neutral' },
      { text: "A grey Closed pill, or a red Full pill, means this door is not yours to open. An In a clan pill means you must leave your current banner before joining another.", mood: 'wry' },
      { text: "Filter by open, invite, or closed up top. Search by name in the box. Tap a tile to see the clan's full profile, roster, and the join button itself.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#5ad6ef' },
    ],
  },

  'clan-leaderboard': {
    id: 'clan-leaderboard',
    menuLabel: 'What is the Top Clans list?',
    lines: [
      { text: "The mightiest clans in the realm, ranked by total Rivals wins across all their members.", mood: 'pleased' },
      { text: "Tap a tile to see the clan's profile — its members, motto, and join terms.", mood: 'neutral' },
      { text: "A place in the top three is a banner of its own. Many clans war for those positions.", mood: 'urgent' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#a78bfa' },
    ],
  },

  'clan-create': {
    id: 'clan-create',
    menuLabel: 'How do I found a clan?',
    lines: [
      { text: "A clan needs four things to be born: a name, a tag, a crest, and a leader.", mood: 'neutral' },
      { text: "The name must be unique across all clans — three to thirty-two characters. The tag is shorter, two to five, all-caps, also unique. The crest is an emoji of your choosing.", mood: 'neutral' },
      { text: "Pick a join type: Open invites all, Invite-Only screens by request, Closed bars the doors. You may change these later from Settings.", mood: 'wry' },
      { text: "Once founded, you become Leader. You may promote, demote, kick, or transfer the crown to another member.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'clan-applications': {
    id: 'clan-applications',
    menuLabel: 'What are My Pending Requests?',
    lines: [
      { text: "Every clan you have applied to but not yet been answered by.", mood: 'neutral' },
      { text: "Tap a tile to view that clan's profile while you wait. Tap Cancel to withdraw the request — useful if a better clan appeared.", mood: 'wry' },
      { text: "When a leader accepts, you are added to their hall and this list shrinks accordingly. When they decline, the entry simply vanishes.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'clan-requests': {
    id: 'clan-requests',
    menuLabel: 'Help with the Pending Requests inbox',
    lines: [
      { text: "Spinners knocking at your door. Each tile is a hopeful, with their win count and how long they've waited.", mood: 'neutral' },
      { text: "Accept brings them in immediately — provided your clan still has room. Decline removes them without comment.", mood: 'wry' },
      { text: "Only Leaders, Co-Leaders, and Elders see this inbox. Use the power kindly.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#5ad6ef' },
    ],
  },

  'clan-settings': {
    id: 'clan-settings',
    menuLabel: 'What can I change in Clan Settings?',
    lines: [
      { text: "The shape of the clan. Description, motto of the day, crest, join type, minimum wins required to apply.", mood: 'neutral' },
      { text: "Only Leaders and Co-Leaders may edit these. Members see the clan as you set it.", mood: 'wry' },
      { text: "The motto floats above the home view — keep it short, keep it sharp.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#a78bfa' },
    ],
  },

  'clan-chat': {
    id: 'clan-chat',
    menuLabel: 'How does Clan Chat work?',
    lines: [
      { text: "The message wall of the clan. Members only — no outsiders see what is said here.", mood: 'neutral' },
      { text: "The wall holds the last hundred messages. Older ones fall away as new ones arrive.", mood: 'wry' },
      { text: "Tap the Challenge action in a member's row and a system message posts here automatically with the duel code, so anyone may join.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#34d399' },
    ],
  },

  'clan-top-chars': {
    id: 'clan-top-chars',
    menuLabel: 'What is Top Characters?',
    lines: [
      { text: "The strongest heroes any of your clanmates have forged. A wall of fame for the banner.", mood: 'pleased' },
      { text: "Sorted by overall tier grade. Tap a card to see its owner and inspect the full character.", mood: 'neutral' },
      { text: "Recruitment tool, too — a clan with mighty cards attracts mighty Spinners.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'clan-teams': {
    id: 'clan-teams',
    menuLabel: 'What are War Teams?',
    lines: [
      { text: "Two teams of three: an attack force and a defense line. Both drawn from your own roster.", mood: 'neutral' },
      { text: "When Guild War begins, your Attack team is sent against an enemy's Defense. Their Attack comes for your Defense in turn.", mood: 'urgent' },
      { text: "Pick wisely. You must own each character — no borrowing from clanmates.", mood: 'wry' },
      { text: "Adjust before a war starts. Once committed, the teams are sealed for that war's duration.", mood: 'grave' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#a78bfa' },
    ],
  },

  'clan-ranks': {
    id: 'clan-ranks',
    menuLabel: 'How do Clan Ranks work?',
    lines: [
      { text: "Clans climb their own ladder — Iron through Hero, Legend, Paragon, and beyond.", mood: 'neutral' },
      { text: "MMR rises with war wins, falls with losses. The matchmaker pairs clans by this rating, not by member count.", mood: 'urgent' },
      { text: "Higher ranks unlock bigger war brackets and louder bragging rights.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#a78bfa' },
    ],
  },

  'clan-war': {
    id: 'clan-war',
    menuLabel: 'What is Guild War?',
    lines: [
      { text: "A scheduled clash between two clans, drawn by matchmaker.", mood: 'urgent' },
      { text: "Each member contributes attacks during the active phase. Damage is tallied by hero grade, weapon, and the brutal arithmetic of element matchups.", mood: 'neutral' },
      { text: "The clan with the higher total damage when time runs out wins the war and claims MMR.", mood: 'grave' },
      { text: "Watch the bracket above — it ticks down through Searching, Prep, Active, and Resolved.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f87171' },
    ],
  },

  'clan-war-start': {
    id: 'clan-war-start',
    menuLabel: 'How do I start a war?',
    lines: [
      { text: "Only Leaders and Co-Leaders may sound the war horn.", mood: 'urgent' },
      { text: "Choose a bracket size — five, ten, fifteen, or twenty members per side. The matchmaker then seeks an opposing clan of similar MMR.", mood: 'neutral' },
      { text: "Cancel during the Searching phase costs nothing. Once Prep begins, the commitment is binding.", mood: 'grave' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f87171' },
    ],
  },

  // /clans/[id] — public profile of a specific clan.
  'public-clan-intro': {
    id: 'public-clan-intro',
    menuLabel: 'What am I looking at here?',
    lines: [
      { text: "A clan's public face. Crest, tag, motto, member roster, total wins.", mood: 'neutral' },
      { text: "The button below the header tells you what action is available — Join, Request, or an explanation of why neither is open to you.", mood: 'neutral' },
      { text: "Tap any member to view their profile, or to challenge them to a Rivals duel.", mood: 'wry' },
      { text: "If you have already applied, you will see the pending state here, with an option to cancel.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  SHOP  (path: /shop)
  // ══════════════════════════════════════════════════════════════════════

  'shop-intro': {
    id: 'shop-intro',
    menuLabel: 'Currencies & Shop',
    lines: [
      { text: "Two currencies hum through this world, Spinner.", mood: 'neutral' },
      { text: "Fate Shards — those gold diamonds — follow you forever. They cross slots and sessions. Earn them in Ascension battles and Daily Challenges, up to one hundred seventy-five a day.", mood: 'pleased' },
      { text: "Gems are smaller things — per-slot, earned by selling roster characters or winning ascension fights. They buy in-slot upgrades only.", mood: 'neutral' },
      { text: "The Arcane Shop trades Fate Shards for two kinds of relic: Gamepasses and Stat Crystals.", mood: 'wry' },
      { text: "Tap a card to see its price and effect. Buy with confidence — every purchase here is permanent.", mood: 'neutral' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'shop-gamepasses': {
    id: 'shop-gamepasses',
    menuLabel: 'What are Gamepasses?',
    lines: [
      { text: "Permanent boons. Bought once, kept always.", mood: 'pleased' },
      { text: "Double Luck doubles your Wildcard chance. Daily Booster doubles your Ascension spin cap. Crit Surge adds ten percent crit chance in battle. There are many more.", mood: 'neutral' },
      { text: "Some are practical, some are cosmetic — the Gold Roster Frame, the Legend Tag for your name. The shop is plain about which is which.", mood: 'wry' },
      { text: "Prices are in Fate Shards. Earn more by playing; spend when you have favorites.", mood: 'neutral' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'shop-crystals': {
    id: 'shop-crystals',
    menuLabel: 'How do shop Crystals work?',
    lines: [
      { text: "The shop sells Stat Crystals directly — Common, Elite, Legendary.", mood: 'neutral' },
      { text: "Common bumps a stat by a single tier. Elite leaps higher. Legendary rewrites the foundation.", mood: 'urgent' },
      { text: "Apply them from inside a slot's Roster — tap a hero, then tap the crystal. Stats lift, permanently.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#34d399' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  CHARACTERS  (paths: /characters, /character/[id])
  // ══════════════════════════════════════════════════════════════════════

  'characters-intro': {
    id: 'characters-intro',
    menuLabel: 'What is the Fighters page?',
    lines: [
      { text: "Every hero you have forged in the main wheel lives here. Not slot heroes — those stay in their slots.", mood: 'neutral' },
      { text: "Tap a card to inspect them in full — full character card, equipment, weaknesses, share link, replay viewer.", mood: 'neutral' },
      { text: "Filters at the top let you narrow by tier, by race, by archetype. Sort by date or by overall grade.", mood: 'wry' },
      { text: "Your strongest five may be lifted into your profile's Hall of Fame — a relic for visitors to admire.", mood: 'pleased' },
      { text: "Send a hero to Rivals from inside their card, or share their URL with anyone — no account is needed to view.", mood: 'neutral' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'character-view': {
    id: 'character-view',
    menuLabel: 'What can I do with this character?',
    lines: [
      { text: "A complete character card. Race, stats, powers, weaknesses, title — all of it.", mood: 'neutral' },
      { text: "The actions row holds the verbs. Share copies a public URL anyone may open. Replay walks through all twenty-three spins again, one by one, exactly as they happened.", mood: 'neutral' },
      { text: "Send to Rivals to challenge a friend or queue Online with this hero in the seat.", mood: 'urgent' },
      { text: "Remove a spun power, weapon, or armor from inside the expand panel — every spun item may be cleared, not only equipped ones.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'character-replay': {
    id: 'character-replay',
    menuLabel: 'What is a Replay?',
    lines: [
      { text: "Every spin that built this hero, in order, as they happened.", mood: 'pleased' },
      { text: "Tap Play to walk forward one at a time. The wheel spins, the result lands, the next category begins.", mood: 'neutral' },
      { text: "Useful for sharing — a friend may watch the journey instead of just seeing the final card.", mood: 'wry' },
      { text: "Tap any step in the timeline to jump directly to it.", mood: 'neutral' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#a78bfa' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  PROFILE  (paths: /profile, /users/[username])
  // ══════════════════════════════════════════════════════════════════════

  'profile-intro': {
    id: 'profile-intro',
    menuLabel: 'What is on my Profile?',
    lines: [
      { text: "Your standing, Spinner. Stamped in gold for the world to read.", mood: 'pleased' },
      { text: "Rivals wins, ascension peak, hall of fame, friends, clan — the shape of your story so far.", mood: 'neutral' },
      { text: "Edit your bio and your title under the avatar. Pin up to five characters to the Hall of Fame from the Edit panel.", mood: 'neutral' },
      { text: "Visitors may challenge you directly from here. Choose your hall-of-fame fighters carefully — first impressions linger.", mood: 'wry' },
      { text: "The activity feed below tracks your recent victories, ascension milestones, and notable rolls.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'user-profile-intro': {
    id: 'user-profile-intro',
    menuLabel: 'Whose profile is this?',
    lines: [
      { text: "Another Spinner's hall. Their bio, hall of fame, clan, rank.", mood: 'neutral' },
      { text: "Tap the Challenge button to send them a duel invitation. They will be notified at once.", mood: 'urgent' },
      { text: "Add them as a Friend to make future challenges easier — and to see when they are online.", mood: 'wry' },
      { text: "Their Hall of Fame holds their proudest five. Worth a look before any duel.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  FRIENDS  (path: /friends)
  // ══════════════════════════════════════════════════════════════════════

  'friends-intro': {
    id: 'friends-intro',
    menuLabel: 'What is the Friends page?',
    lines: [
      { text: "The Spinners you have crossed paths with — and those who would join your circle.", mood: 'neutral' },
      { text: "Three tabs above. Friends lists those already in your circle, with online status. Requests holds incoming and outgoing invitations. Search lets you add by exact username.", mood: 'neutral' },
      { text: "Tap any friend to view their profile, challenge them to a Rivals duel, or invite them to your clan.", mood: 'wry' },
      { text: "The green dot beside a name means they are online and likely to answer a challenge swiftly.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'friends-list': {
    id: 'friends-list',
    menuLabel: 'What is the Friends list?',
    lines: [
      { text: "Your circle, sorted by online first.", mood: 'pleased' },
      { text: "Tap a row to open a friend's profile. From there, you may challenge them or remove the friendship.", mood: 'neutral' },
      { text: "The number beside a username is their Rivals win count — a quick read of their strength.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#34d399' },
    ],
  },

  'friends-requests': {
    id: 'friends-requests',
    menuLabel: 'How do friend requests work?',
    lines: [
      { text: "Two stacks. Incoming, from those who wish you in their circle. Outgoing, from those you have invited yourself.", mood: 'neutral' },
      { text: "Accept brings them in immediately. Decline removes them without notice. Cancel withdraws your own request.", mood: 'wry' },
      { text: "Pending invitations stay until one side acts. There is no expiration.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'friends-search': {
    id: 'friends-search',
    menuLabel: 'How do I find someone?',
    lines: [
      { text: "Type a username — case insensitive — and tap Search.", mood: 'neutral' },
      { text: "Matches appear below. Tap Add to send a friend request. Tap their name to view their profile first.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#5ad6ef' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  GALLERY, LEADERBOARD, ACHIEVEMENTS, CHALLENGES, REPLAYS, BATTLE, LOGIN
  // ══════════════════════════════════════════════════════════════════════

  'gallery-intro': {
    id: 'gallery-intro',
    menuLabel: 'What is the Hall of Fates?',
    lines: [
      { text: "Every character that has been published to the public ledger. The wheel's full bestiary, by other hands.", mood: 'pleased' },
      { text: "Filter by race, archetype, or tier. Sort by recent or by grade.", mood: 'neutral' },
      { text: "Tap any card to view it in full. Some Spinners publish their proudest; some publish their strangest. Both are worth a look.", mood: 'wry' },
      { text: "You may publish your own from inside any character's card — look for the Publish button.", mood: 'neutral' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#a78bfa' },
    ],
  },

  'leaderboard-intro': {
    id: 'leaderboard-intro',
    menuLabel: 'What is the Hall of Champions?',
    lines: [
      { text: "The Spinners ranked by Rivals wins. The standings of the realm.", mood: 'pleased' },
      { text: "The top three wear crowns. Tap any row to view that Spinner's profile.", mood: 'neutral' },
      { text: "Tabs above let you switch between weekly and all-time. The weekly board resets each Monday.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'achievements-intro': {
    id: 'achievements-intro',
    menuLabel: 'How do Achievements work?',
    lines: [
      { text: "Milestones, recorded in gold. Quiet recognitions for deeds done across the game.", mood: 'pleased' },
      { text: "Win battles, climb ascension worlds, forge legendary characters, found a clan. Each tier of progress unlocks a stamp.", mood: 'neutral' },
      { text: "Some pay Fate Shards on completion. Others are simply pride. Tap a row to see the requirements.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'challenges-intro': {
    id: 'challenges-intro',
    menuLabel: 'How do Daily Challenges work?',
    lines: [
      { text: "Three small tasks, rotating every day at midnight UTC.", mood: 'neutral' },
      { text: "Each pays Fate Shards on completion — up to one hundred seventy-five Shards in a day if you finish all three.", mood: 'pleased' },
      { text: "Tasks track in the background as you play. Spin five times, win two Rivals matches, equip a crystal — that flavor of thing.", mood: 'wry' },
      { text: "Tap a card to see its target and current progress. The timer at the top shows when the board refreshes.", mood: 'neutral' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f0c040' },
    ],
  },

  'replays-intro': {
    id: 'replays-intro',
    menuLabel: 'What are Battle Replays?',
    lines: [
      { text: "Every Rivals battle, recorded in full and kept here.", mood: 'pleased' },
      { text: "Tap a row to re-watch the duel — every swing, every spell, every critical, exactly as it played out.", mood: 'neutral' },
      { text: "The latest replays sit at the top. Older ones age off after a time, so save any you wish to keep with the Share button.", mood: 'wry' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#a78bfa' },
    ],
  },

  'battle-intro': {
    id: 'battle-intro',
    menuLabel: 'What is happening in this battle?',
    lines: [
      { text: "Auto-resolution, hero against hero. Stats, powers, weapons, weaknesses — all weighed in real time.", mood: 'urgent' },
      { text: "Watch the log scroll past. Hits, crits, deflections, killing blows — each line names what just struck whom.", mood: 'neutral' },
      { text: "Adjust speed from the gear at the top corner. Instant — twentyfold — finishes any battle in seconds, but is not a skip; the engine still runs.", mood: 'wry' },
      { text: "The result screen at the end tallies damage and drops. From there, queue another or step away.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#f87171' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  WHEEL-BY-WHEEL  (path: /, sub-view = the active spin category)
  //  Each scene fires when Quill is summoned during a spin session. The
  //  sub-view is set by +page.svelte tracking currentDef?.category. Lines
  //  are kept short — the player is mid-creation and should not be held.
  // ══════════════════════════════════════════════════════════════════════

  'wheel-race': {
    id: 'wheel-race',
    menuLabel: 'What is the Race wheel?',
    lines: [
      { text: "The Race wheel. The foundation of every hero.", mood: 'grave' },
      { text: "Your race sets your stat multipliers, your exclusive power pool, the count of your racial abilities, and the number of weaknesses you will roll.", mood: 'neutral' },
      { text: "Rarer races carry stronger multipliers and bigger exclusive pools — but they also pay more in weaknesses. Common races are reliable; rare ones are volatile.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-raceSubType': {
    id: 'wheel-raceSubType',
    menuLabel: 'What is the Subtype wheel?',
    lines: [
      { text: "Your variant within the race — your bloodline, your sub-clan, your kind.", mood: 'neutral' },
      { text: "Subtypes shift stat focus and may unlock specific ability pools that the base race cannot reach.", mood: 'wry' },
      { text: "Some subtypes are common; some are rare and powerful indeed. The wheel tells.", mood: 'pleased' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-raceClass': {
    id: 'wheel-raceClass',
    menuLabel: 'What is the Race Class wheel?',
    lines: [
      { text: "Your class within the race — Berserker, Runic, Scholar, Outlaw, whatever lineage your kind allows.", mood: 'neutral' },
      { text: "Each class adds its own stat lean and a small pool of class-specific abilities. Race-class combinations are where strong builds are born.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-raceTransformation': {
    id: 'wheel-raceTransformation',
    menuLabel: 'What is the Transformation wheel?',
    lines: [
      { text: "A global multiplier on every stat you will roll. Yes — every one.", mood: 'urgent' },
      { text: "Tiers run from below 1.0 to over 2.2. A high transformation on a rare race is the stuff of legend.", mood: 'pleased' },
      { text: "Some races have no transformations at all. If you see this wheel, fortune already favors you.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-raceWheel': {
    id: 'wheel-raceWheel',
    menuLabel: 'What is this race-specific wheel?',
    lines: [
      { text: "A custom wheel, drawn from your race's own lore.", mood: 'pleased' },
      { text: "These race-injected spins layer race-specific traits over your base identity — a transformation ladder, a soul-blade bond, a sun-exposure type, depending on what you rolled.", mood: 'neutral' },
      { text: "Each result carries its own stat bonuses or grants. The wheel knows.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-racialAbility': {
    id: 'wheel-racialAbility',
    menuLabel: 'What is the Racial Ability wheel?',
    lines: [
      { text: "A birthright. A trait innate to your kind, unrelated to powers you may later roll.", mood: 'pleased' },
      { text: "Racial abilities are immune to Wildcards. They appear on your card permanently and carry into Ascension battles unmodified.", mood: 'neutral' },
      { text: "Your race may grant one, two, or three of these spins. Read the announcement bar — it tells the count.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-archetype': {
    id: 'wheel-archetype',
    menuLabel: 'What is the Archetype wheel?',
    lines: [
      { text: "Your role. The shape of how you fight.", mood: 'neutral' },
      { text: "Combat raises Fighting Skill and Strength. Magic raises Power Mastery and IQ. Stealth raises Agility and Speed. Support raises Charisma and Potential. Chaos shifts everything sideways.", mood: 'neutral' },
      { text: "Race-archetype synergies trigger bonus spins automatically. Watch the announcement bar — fortune often arrives in pairs.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-archetypeAbility': {
    id: 'wheel-archetypeAbility',
    menuLabel: 'What is this Archetype Ability wheel?',
    lines: [
      { text: "An ability granted by your role — exclusive to your archetype.", mood: 'neutral' },
      { text: "Combat archetypes pull from martial-form pools; Magic from spell pools; Stealth from ambush pools. Your card lists each one.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  // ── 11 stats. Short, focused — what the stat IS in battle terms.
  'wheel-strength': {
    id: 'wheel-strength', menuLabel: 'What does Strength do?',
    lines: [
      { text: "Strength. Raw physical force.", mood: 'urgent' },
      { text: "How hard you hit, what you can lift, what walls you walk through. Determines melee damage output in Ascension battles.", mood: 'neutral' },
      { text: "The wheel will land. The label IS your tier. Watch for the Wildcard flash.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },
  'wheel-speed': {
    id: 'wheel-speed', menuLabel: 'What does Speed do?',
    lines: [
      { text: "Speed — reaction, movement, initiative.", mood: 'neutral' },
      { text: "High Speed acts first in combat and activates abilities faster. Vital for any aggressive build.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },
  'wheel-agility': {
    id: 'wheel-agility', menuLabel: 'What does Agility do?',
    lines: [
      { text: "Agility — flexibility, evasion, aerial mobility.", mood: 'neutral' },
      { text: "Makes you harder to hit. Improves dodge chance in battle. Stealth archetypes lean heavily on this.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },
  'wheel-durability': {
    id: 'wheel-durability', menuLabel: 'What does Durability do?',
    lines: [
      { text: "Durability — how much punishment your body absorbs.", mood: 'grave' },
      { text: "Your passive damage reduction. The difference between tanking a hit and being deleted.", mood: 'urgent' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },
  'wheel-iq': {
    id: 'wheel-iq', menuLabel: 'What does IQ do?',
    lines: [
      { text: "IQ — intelligence and tactical depth.", mood: 'neutral' },
      { text: "Affects magic complexity, your ability to counter enemy powers, and how effectively you exploit openings in battle.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },
  'wheel-charisma': {
    id: 'wheel-charisma', menuLabel: 'What does Charisma do?',
    lines: [
      { text: "Charisma — social force, persuasion, battlefield presence.", mood: 'pleased' },
      { text: "Heavily weighted in Support archetypes. Affects how quickly allies rally and how enemies waver.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },
  'wheel-fightingSkill': {
    id: 'wheel-fightingSkill', menuLabel: 'What does Fighting Skill do?',
    lines: [
      { text: "Fighting Skill — combat technique and instincts.", mood: 'urgent' },
      { text: "The most heavily weighted stat in your overall tier grade. Raw power without this is just a liability.", mood: 'grave' },
      { text: "If any single roll should bless you, let it be this one.", mood: 'pleased' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },
  'wheel-potential': {
    id: 'wheel-potential', menuLabel: 'What does Potential do?',
    lines: [
      { text: "Potential — your untapped ceiling.", mood: 'neutral' },
      { text: "How much stronger training can make you. Critical for long-term Ascension scaling and character growth.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },
  'wheel-energyLevel': {
    id: 'wheel-energyLevel', menuLabel: 'What does Energy Level do?',
    lines: [
      { text: "Energy — ki, mana, chakra, aura. Whatever fuels your abilities.", mood: 'neutral' },
      { text: "More energy means sustained ability use without running dry in extended fights.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },
  'wheel-powerMastery': {
    id: 'wheel-powerMastery', menuLabel: 'What does Power Mastery do?',
    lines: [
      { text: "Power Mastery — precision and control over your powers.", mood: 'neutral' },
      { text: "Low mastery is powerful but unstable and costly. High mastery is efficient, stable, and lethal on demand.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },
  'wheel-weaponMastery': {
    id: 'wheel-weaponMastery', menuLabel: 'What does Weapon Mastery do?',
    lines: [
      { text: "Weapon Mastery — skill with whatever weapon the wheel grants you.", mood: 'neutral' },
      { text: "A God-grade sword still needs someone competent to hold it. Your archetype and race bias which weapon types appear.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-statBonus': {
    id: 'wheel-statBonus', menuLabel: 'What is this Stat Bonus spin?',
    lines: [
      { text: "A bonus spin — your archetype, title, or backstory granted it.", mood: 'pleased' },
      { text: "It adds an extra tier to a specific stat you have already rolled. Free strength, freely given.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-power': {
    id: 'wheel-power', menuLabel: 'What is the Power wheel?',
    lines: [
      { text: "A power, drawn from a pool your race and archetype permit.", mood: 'pleased' },
      { text: "Each power has an Element — Fire, Ice, Lightning, Shadow, Holy, and many more — and a Grade. Higher grades are world-ending; lower grades are practical.", mood: 'neutral' },
      { text: "In Ascension, powers become active abilities. Element vs. enemy weakness multiplies damage. Pick wisely whom you bring.", mood: 'urgent' },
      { text: "You will roll one to three or more of these, depending on your race and archetype.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-weapon': {
    id: 'wheel-weapon', menuLabel: 'What is the Weapon wheel?',
    lines: [
      { text: "A weapon — Melee, Ranged, Magical, Ancient, Exotic, Cursed, or None.", mood: 'neutral' },
      { text: "Race biases which weapons appear. Dwarves trend Ancient melee; Elves trend Ranged or Magical; Dragons trend Ancient or Exotic.", mood: 'wry' },
      { text: "Each weapon has its own Element and Grade. Equip it on a roster character to raise their damage in Ascension battles.", mood: 'neutral' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-weaponType': {
    id: 'wheel-weaponType', menuLabel: 'What is the Weapon Type wheel?',
    lines: [
      { text: "The category of weapon you will receive — Melee, Ranged, Magical, Ancient, Exotic, Cursed, or None.", mood: 'neutral' },
      { text: "Cursed weapons add to your Corruption score. A small risk for a notable boon.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-weaponEnchantment': {
    id: 'wheel-weaponEnchantment', menuLabel: 'What is this Enchantment wheel?',
    lines: [
      { text: "A magical layer atop your weapon — an elemental affinity, a passive trait, a hidden edge.", mood: 'pleased' },
      { text: "Granted when the weapon's grade is high enough. The wheel keeps its own counsel on what appears.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-armor': {
    id: 'wheel-armor', menuLabel: 'What is the Armor wheel?',
    lines: [
      { text: "Armor type — None, Helmet, Half-Suit, Full-Suit, Ancient, Exotic, Cursed.", mood: 'neutral' },
      { text: "Race biases here too. Orcs trend Full-Suit plating; Elves trend Half-Suit or None; some races never wear armor at all.", mood: 'wry' },
      { text: "Armor Grade determines enchantment slots. B+ adds one; SS+ may carry several.", mood: 'pleased' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-armorType': {
    id: 'wheel-armorType', menuLabel: 'What is the Armor Type wheel?',
    lines: [
      { text: "The form of armor — coverage shape, from a single helmet to a full suit, or none at all.", mood: 'neutral' },
      { text: "Type alone is not protection. The Armor Strength spin that follows tells how well it shields.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-armorStrength': {
    id: 'wheel-armorStrength', menuLabel: 'What is Armor Strength?',
    lines: [
      { text: "Independent of armor type. The raw protective power of whatever you wear.", mood: 'neutral' },
      { text: "Even a basic Helmet at SSS+ is divine protection. A Full-Suit at F– is decorative tin.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-armorEnchantment': {
    id: 'wheel-armorEnchantment', menuLabel: 'What is this Armor Enchantment?',
    lines: [
      { text: "A passive layer on your armor — damage reduction, elemental resistance, regeneration.", mood: 'pleased' },
      { text: "Slot count rises with grade. SS+ armor may carry several enchantments at once.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-weakness': {
    id: 'wheel-weakness', menuLabel: 'What is the Weakness wheel?',
    lines: [
      { text: "Your flaw, your vulnerability. The wheel makes no apologies.", mood: 'grave' },
      { text: "Race determines count — zero to three. Powerful races pay more in weaknesses, as cosmic balance demands.", mood: 'neutral' },
      { text: "Permanent and public. Enemies in Ascension deal bonus damage by hitting your weakness element. Bosses target it especially.", mood: 'urgent' },
      { text: "Only a Redemption Spin's 'Lose One Weakness' outcome can ever remove one.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-redemptionSpin': {
    id: 'wheel-redemptionSpin', menuLabel: 'What is the Redemption wheel?',
    lines: [
      { text: "The gate of Redemption. Twenty-five percent chance to open at all.", mood: 'urgent' },
      { text: "If it fires, a second wheel decides your fortune: reroll your worst stat, gain a bonus power, lose a weakness, double your best, or even Demigod Status.", mood: 'pleased' },
      { text: "If it stays closed, the game moves on. No retry, no fallback.", mood: 'grave' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-redemptionOutcome': {
    id: 'wheel-redemptionOutcome', menuLabel: 'What is this Redemption Outcome?',
    lines: [
      { text: "The gate opened. Now the wheel decides what fortune grants.", mood: 'pleased' },
      { text: "Outcomes range from a single stat reroll to all stats plus three tiers. Some are chaos — every stat rerolls from scratch.", mood: 'urgent' },
      { text: "Whatever lands is yours. Take it gladly.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-backstory': {
    id: 'wheel-backstory', menuLabel: 'What is the Backstory wheel?',
    lines: [
      { text: "A generated origin tying your race, archetype, and powers into a narrative snapshot.", mood: 'pleased' },
      { text: "Flavor, not mechanic — but it shapes the character. Some are dramatic, some tragic, some deeply ironic.", mood: 'wry' },
      { text: "Some backstories also grant a small stat bonus spin. Watch for the announcement.", mood: 'neutral' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-title': {
    id: 'wheel-title', menuLabel: 'What is the Title wheel?',
    lines: [
      { text: "Your honorary designation. The capstone of identity.", mood: 'urgent' },
      { text: "Titles run from grand and heroic to absurd and self-defeating. Some race-weighted, many universal. Permanent.", mood: 'wry' },
      { text: "When this wheel lands, your hero is complete. Name them next — and I will be there.", mood: 'pleased' },
    ],
    choices: [{ label: 'Last spin — let it land!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-gender': {
    id: 'wheel-gender', menuLabel: 'What is the Gender wheel?',
    lines: [
      { text: "A small but visible aspect of your hero. Some races have only certain options; some are wide open.", mood: 'neutral' },
      { text: "Affects your portrait when generated, nothing more.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-height': {
    id: 'wheel-height', menuLabel: 'What is the Height wheel?',
    lines: [
      { text: "How tall your hero stands. Race-weighted — a Dwarf will rarely tower; a Giant will rarely stoop.", mood: 'neutral' },
      { text: "Flavor on the card. Useful for portrait prompts and the occasional joke.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-twistSpin': {
    id: 'wheel-twistSpin', menuLabel: 'What is the Twist Spin?',
    lines: [
      { text: "A twist. Race-flavored — your kind has its own pool of these.", mood: 'pleased' },
      { text: "Zenithians may get a Super Zenith ladder. Krystalians may get a Sun Exposure type. Each twist is a layer of identity unique to your race.", mood: 'neutral' },
      { text: "What lands is permanent. The wheel decides which twist your fate carries.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-corruptionReveal': {
    id: 'wheel-corruptionReveal', menuLabel: 'What is the Corruption Reveal?',
    lines: [
      { text: "Your darkness made manifest, Spinner.", mood: 'grave' },
      { text: "Cursed weapons, cursed armor, cursed weaknesses — they accrue a Corruption score in secret. Cross the threshold and the wheel forces this reveal.", mood: 'urgent' },
      { text: "What it lands on shapes the form your corruption takes. It is not gentle.", mood: 'grave' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-limitBreak': {
    id: 'wheel-limitBreak', menuLabel: 'What is the Limit Break wheel?',
    lines: [
      { text: "A breakable ceiling. Roll high enough on a stat and a Limit Break may trigger — a chance to push past the cap.", mood: 'urgent' },
      { text: "Race influences the odds. Some races break limits readily; others must claw at them.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-limitBreakLevel': {
    id: 'wheel-limitBreakLevel', menuLabel: 'What is the Limit Break Level?',
    lines: [
      { text: "How far past the cap you broke. One level, three, ten — fortune decides.", mood: 'pleased' },
      { text: "Each level adds a tier to the stat that triggered the break. Rare and precious.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-devilFruitName': {
    id: 'wheel-devilFruitName', menuLabel: 'What is the Demon Fruit name?',
    lines: [
      { text: "A named fruit, granting a specific power-set. Race-locked — only certain kinds may eat.", mood: 'pleased' },
      { text: "The name is half the flavor. The power it carries is the rest.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-possessionRace': {
    id: 'wheel-possessionRace', menuLabel: 'What does Possession Race mean?',
    lines: [
      { text: "A second race, layered atop your first. Some spirits walk in two bodies; some bodies host two spirits.", mood: 'grave' },
      { text: "The Possession Race adds its own ability pool — small but potent — to your hero.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-possessionStrength': {
    id: 'wheel-possessionStrength', menuLabel: 'What is Possession Strength?',
    lines: [
      { text: "How firmly the second presence holds. Weak possessions whisper; strong possessions speak through you.", mood: 'urgent' },
      { text: "Stronger bonds grant more of the possessor's pool to your character.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'wheel-prestige': {
    id: 'wheel-prestige', menuLabel: 'What is the Prestige wheel?',
    lines: [
      { text: "A station, a tier of renown — Noble, Commoner, Outcast, Royalty.", mood: 'neutral' },
      { text: "Prestige flavors your title and shifts a few stat weights. The wheel decides who your character is in the eyes of their world.", mood: 'wry' },
    ],
    choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
  },

  'how-to-play-intro': {
    id: 'how-to-play-intro',
    menuLabel: 'How do I use this guide?',
    lines: [
      { text: "Every system, every wheel, every relic — all written down here.", mood: 'pleased' },
      { text: "Use the index on the left to jump anywhere. Search by name in the box above it. Each section opens with a TL;DR for the quick read and detail beneath for the long.", mood: 'neutral' },
      { text: "This page is always here. Return whenever the wheel offers something new.", mood: 'wry' },
    ],
    choices: [{ label: 'Got it', action: 'dismiss', color: '#a78bfa' }],
  },

  'login-intro': {
    id: 'login-intro',
    menuLabel: 'Why log in?',
    lines: [
      { text: "An account, Spinner, is a key.", mood: 'neutral' },
      { text: "Without one, you may still play — your characters live in this browser only. With one, they follow you across devices, and your Rivals wins, clan, and friends become real.", mood: 'pleased' },
      { text: "Create an account with a username and password — no email required for now. Or log in if you have been here before.", mood: 'wry' },
      { text: "Your existing in-browser characters are migrated into the account on first login. Nothing is lost.", mood: 'pleased' },
    ],
    choices: [
      { label: 'Got it', action: 'dismiss', color: '#5ad6ef' },
    ],
  },
}

// ────────────────────────────────────────────────────────────────────────
//  Route → scene resolution
// ────────────────────────────────────────────────────────────────────────

// Map of route prefix → first-visit scene id used by the layout's auto-fire.
// Order matters — first match wins. More specific prefixes come first.
//
// Note: /story/slot/[shareId] is a public slot-snapshot share page (lists
// beaten worlds + a copy-link), NOT the actual Ascension game. Visitors
// land there from a shared URL. The real Ascension hub lives at /story and
// drives its sub-views from internal `view` state.
export const ROUTE_SCENES: { prefix: string; sceneId: string }[] = [
  { prefix: '/character/new',        sceneId: 'first-character' },
  { prefix: '/spin',                 sceneId: 'wheel-spinning' },
  { prefix: '/story/slot',           sceneId: 'ascension-slot-share' },
  { prefix: '/story',                sceneId: 'ascension-intro' },
  { prefix: '/clans/',               sceneId: 'public-clan-intro' },
  { prefix: '/clan',                 sceneId: 'clan-intro' },
  { prefix: '/character/',           sceneId: 'character-view' },
  { prefix: '/characters',           sceneId: 'characters-intro' },
  { prefix: '/users/',               sceneId: 'user-profile-intro' },
  { prefix: '/profile',              sceneId: 'profile-intro' },
  { prefix: '/friends',              sceneId: 'friends-intro' },
  { prefix: '/shop',                 sceneId: 'shop-intro' },
  { prefix: '/rivals',               sceneId: 'rivals-intro' },
  { prefix: '/gallery',              sceneId: 'gallery-intro' },
  { prefix: '/leaderboard',          sceneId: 'leaderboard-intro' },
  { prefix: '/achievements',         sceneId: 'achievements-intro' },
  { prefix: '/challenges',           sceneId: 'challenges-intro' },
  { prefix: '/replays',              sceneId: 'replays-intro' },
  { prefix: '/battle',               sceneId: 'battle-intro' },
  { prefix: '/login',                sceneId: 'login-intro' },
  { prefix: '/how-to-play',          sceneId: 'how-to-play-intro' },
]

// Sub-view scene maps, keyed by route prefix. The active sub-view (e.g.
// the player's selected clan tab) is registered with the guide store by
// the route's component; when set, the resolver prefers the sub-view's
// scene over the route default.
const SUB_VIEW_SCENES: Record<string, Record<string, string>> = {
  '/clan': {
    mine:         'clan-mine',
    browse:       'clan-browse',
    leaderboard:  'clan-leaderboard',
    create:       'clan-create',
    applications: 'clan-applications',
    requests:     'clan-requests',
    settings:     'clan-settings',
    chat:         'clan-chat',
    topChars:     'clan-top-chars',
    teams:        'clan-teams',
    ranks:        'clan-ranks',
    war:          'clan-war',
    warStart:     'clan-war-start',
  },
  '/story': {
    // Real view-state values used by /story/+page.svelte
    saveSlotSelect: 'ascension-slot-select',
    hub:            'ascension-hub',
    worlds:         'ascension-worlds',
    roster:         'ascension-roster',
    expanded:       'ascension-roster',
    shop:           'ascension-shop',
    spin:           'ascension-wheel',
    inventory:      'ascension-crystals',
    teams:          'ascension-battle-prep',
    battle:         'ascension-battle-prep',
    endless:        'ascension-endless',
  },
  '/rivals': {
    // Map /rivals/+page.svelte Phase values onto scenes.
    menu:             'rivals-format-picker',
    searching:        'rivals-online-queue',
    create_or_join:   'rivals-online-queue',
    waiting:          'rivals-online-queue',
    preview:          'rivals-character-picker',
    battle_ready:     'battle-intro',
    battle:           'battle-intro',
    forfeit_result:   'rivals-result',
    ranks:            'rivals-ranks',
  },
  '/shop': {
    gamepasses: 'shop-gamepasses',
    crystals:   'shop-crystals',
  },
  '/characters': {
    view: 'character-view',
  },
  '/friends': {
    friends:  'friends-list',
    requests: 'friends-requests',
  },
  '/character': {
    replay: 'character-replay',
  },

  // Wheel-by-wheel scenes. The main spin page (/) registers the active
  // spin category via guide.setSubView(currentDef.category). The "Ask
  // Quill" button then shows the wheel's specific explanation instead of
  // the generic home-overview. Categories the player never asks about
  // simply fall through to home-overview / wheel-spinning.
  '/': {
    race:                  'wheel-race',
    raceSubType:           'wheel-raceSubType',
    raceClass:             'wheel-raceClass',
    raceTransformation:    'wheel-raceTransformation',
    raceWheel:             'wheel-raceWheel',
    racialAbility:         'wheel-racialAbility',
    archetype:             'wheel-archetype',
    archetypeAbility:      'wheel-archetypeAbility',
    strength:              'wheel-strength',
    speed:                 'wheel-speed',
    agility:               'wheel-agility',
    durability:            'wheel-durability',
    iq:                    'wheel-iq',
    charisma:              'wheel-charisma',
    fightingSkill:         'wheel-fightingSkill',
    potential:             'wheel-potential',
    energyLevel:           'wheel-energyLevel',
    powerMastery:          'wheel-powerMastery',
    weaponMastery:         'wheel-weaponMastery',
    statBonus:             'wheel-statBonus',
    statPenalty:           'wheel-statBonus',
    power:                 'wheel-power',
    weapon:                'wheel-weapon',
    weaponType:            'wheel-weaponType',
    weaponEnchantment:     'wheel-weaponEnchantment',
    armor:                 'wheel-armor',
    armorType:             'wheel-armorType',
    armorStrength:         'wheel-armorStrength',
    armorEnchantment:      'wheel-armorEnchantment',
    weakness:              'wheel-weakness',
    redemptionSpin:        'wheel-redemptionSpin',
    redemptionOutcome:     'wheel-redemptionOutcome',
    backstory:             'wheel-backstory',
    title:                 'wheel-title',
    gender:                'wheel-gender',
    height:                'wheel-height',
    twistSpin:             'wheel-twistSpin',
    corruptionReveal:      'wheel-corruptionReveal',
    limitBreak:            'wheel-limitBreak',
    limitBreakLevel:       'wheel-limitBreakLevel',
    devilFruitName:        'wheel-devilFruitName',
    possessionRace:        'wheel-possessionRace',
    possessionStrength:    'wheel-possessionStrength',
    prestige:              'wheel-prestige',
  },
}

// ────────────────────────────────────────────────────────────────────────
//  Per-wheel dialogue synthesis
//  When the player asks Quill mid-spin, the store passes the live
//  SpinDefinition context (category, displayName, raceWheelId, twistId,
//  forRace). For wheels that have variants — race-injected wheels (~110
//  unique ids), twist pools (~20 unique ids) — the generic scene is
//  overlaid with displayName-aware lines so dialogue names the specific
//  wheel. Categories without variants (Strength, Power, Title, etc.)
//  return the base scene unchanged.
// ────────────────────────────────────────────────────────────────────────

export interface SpinContextShape {
  category: string
  displayName?: string
  raceWheelId?: string
  twistId?: string
  forRace?: string
}

// Light, evocative one-liners keyed by raceWheelId. Anything not listed
// here falls back to a generic "a wheel of your race's lore" sentence
// stitched together from displayName + forRace.
const RACE_WHEEL_FLAVOR: Record<string, string> = {
  rageThreshold:        "how easily your hero escalates — lower thresholds mean transformations trigger fast under pressure.",
  sunExposure:          "the sun that bathes your Krystalian — red drains, yellow empowers, blue exceeds, solar-engorged blinds.",
  geneticPotential:     "the bloodline strain your Krystalian carries — standard, designed for combat, hybrid, cloned, or Genesis-pure.",
  soulBlade:            "the bond between your Shinigami and their soul-blade — sealed, awakened, twin-bound, true-form, or fully fused.",
  aetheriumTier:        "the grade of aetherium burning in your Mechshifter's core — the higher, the more capable the form.",
  wishOrbLineage:       "your Verdantian's role within the Wish-Orb tradition — Wish-Shaper, Sovereign, or some rarer kinship.",
  bloodline:            "the strain of your bloodline — pure, mixed, or something stranger your kind admits with discomfort.",
  bloodlinePurity:      "how undiluted your bloodline runs. Pure lines carry stronger racial gifts but invite stranger weaknesses.",
  alpha:                "your rank within the pack — Omega is hard living, Alpha rules, the unique Alpha-of-Alphas dominates.",
  apex:                 "your apex trait — the singular evolutionary edge your kind sharpened above all else.",
  ascension:            "which path of ascension your hero walks — earthly, mortal-divine, divine, or beyond-divine.",
  awakeningPotential:   "the ceiling of your awakening — how high your latent power may yet climb.",
  blessing:             "which divine blessing rests on your hero. Light blessings comfort; rare blessings reshape.",
  brainConsumption:     "how many minds your cerebrosaur has consumed — each one adding a thread of memory and skill.",
  breathEvolution:      "the breathing style your warrior has cultivated — flame, water, mist, thunder, sun.",
  catastrophe:          "the disaster your hero embodies — flood, quake, plague, drought, end-of-world.",
  causeOfDeath:         "how your undead hero died, and what shadow that leaves on them now.",
  choir:                "the choir of angels you sing with — seraphim, cherubim, throne, dominion.",
  colossus:             "the colossal scale you operate at — building-tall, tower-tall, city-block, district, kaiju.",
  conflict:             "the inner conflict that drives or breaks you. Few escape unaffected.",
  conquest:             "your standing in the conquest — fresh soldier, captain, warlord, conqueror absolute.",
  contract:             "the infernal contract you signed — and what it took, and what it gave.",
  core:                 "the core that powers your construct — coal, steam, atomic, anti-matter, singularity.",
  corruptedTech:        "the state of the corrupted tech inside you — booting, stable, glitching, sentient, awakened.",
  corruption:           "how deep the corruption has set in — touched, infested, dominated, consumed.",
  creationDomain:       "the domain your creator-god rules — fire, life, time, void, dream.",
  creationElement:      "the primordial element woven through your existence.",
  deathCounter:         "how many times you have died and returned. Each death sharpens — or breaks — the next.",
  defect:               "the manufacturing defect that gives your hero their unique edge — or curse.",
  destiny:              "the destiny written for your hero — chosen, accidental, refused, embraced.",
  disaster:             "the disaster footprint your hero leaves wherever they go.",
  divineDomain:         "the divine domain your hero presides over.",
  divineDuty:           "the divine duty laid on your hero — the task they cannot refuse.",
  dragonAspect:         "which dragon aspect runs in your bloodline — chromatic, metallic, primordial, or stranger.",
  dragonBlood:          "how thick the dragon-blood runs in your veins.",
  earthshaker:          "the earthshaking power level your hero carries.",
  endurance:            "your hero's endurance reserves — how long they last in the fight.",
  erasureDepth:         "how deeply your hero erases what they strike. Surface, soul, lineage, concept.",
  eternalAge:           "the age of your eternal one — recent ascension, ancient, primordial, before-time.",
  evolution:            "which evolutionary path your kind has taken.",
  experiment:           "what experiment created your hero, and how much of that subject survived.",
  fortune:              "the fortune that follows your hero — luck of fools, of nobles, of the damned.",
  gadget:               "which gadget your hero relies on most — the signature tool.",
  halo:                 "the halo of your celestial — its color, its weight, its meaning.",
  hellfire:             "the hellfire grade of your demon — ember, blaze, inferno, abyssal.",
  heritage:             "the heritage line you trace your hero to — common, noble, royal, divine.",
  hoard:                "the hoard your dragon has gathered — modest pile, vault, mountain, world's worth.",
  host:                 "how compatible the host body is with the spirit riding it.",
  hunger:               "the hunger that drives your hero — for blood, for power, for peace.",
  hunt:                 "the hunt your hero is on — small game, dangerous prey, gods themselves.",
  implant:              "the implant grafted into your hero — what it does, and what it costs.",
  instinct:             "the instinct your hero falls back on when thought fails.",
  kaijuMutation:        "the kaiju mutation reshaping your hero.",
  legacy:               "the legacy your hero inherits — title, debt, curse, blade.",
  leviathan:            "your leviathan class — coastal terror, deep-water, ocean-scale, world-girdling.",
  lineage:              "your draconic lineage's purity and station.",
  loot:                 "the loot your hero carries — junk, treasure, artifact, relic of gods.",
  madness:              "the madness touch your hero carries — whispers, visions, certainty.",
  masteryLevel:         "your mastery level over your discipline — novice, adept, master, peerless.",
  module:               "the module installed in your hero — combat, stealth, infiltration, prophecy.",
  moonPhase:            "the moon phase your hero draws power from — new, waxing, full, blood.",
  mutation:             "the mutation reshaping your hero. Slight, severe, total.",
  mythType:             "which myth-species your hero belongs to.",
  pack:                 "the pack rank or pack identity your hero holds.",
  pact:                 "the pact your hero swore — and what cost it carries.",
  paraMutation:         "the parasitic mutation working through your hero.",
  planetOrigin:         "the planet your alien hero hails from.",
  possession:           "how possessed your hero is, and by whom.",
  predator:             "the predator type your hero is — stalker, ambush, pursuit, apex.",
  primordialCatastrophe:"the primordial catastrophe domain your hero embodies.",
  protocol:             "the combat protocol your construct follows.",
  psychicEvolution:     "the psychic evolution stage your hero has reached.",
  rage:                 "the rage your hero carries — banked, kindled, blazing, consuming.",
  realityFracture:      "how fractured reality has become around your hero.",
  realityLaw:           "the reality law your hero may bend or break.",
  realm:                "the realm your hero hails from.",
  reflex:               "the reflex speed your hero operates at.",
  regeneration:         "the regeneration rate your hero recovers at.",
  scrap:                "the scrap pile your construct was assembled from.",
  seaKingPath:          "the sea-king path your hero walks — coastal, deep, abyssal, world.",
  sin:                  "the sin your hero embodies — pride, wrath, envy, sloth, greed, gluttony, lust.",
  soul:                 "the soul-anchor that keeps your hero tethered to themselves.",
  survival:             "your hero's survival index — odds of walking away from any given fight.",
  symMutation:          "the symbiotic mutation reshaping your hero.",
  talent:               "the talent your hero has cultivated above all others.",
  temperament:          "the temperament your hero brings into every encounter.",
  tide:                 "the tide affinity that pulls at your hero.",
  timeline:             "the timeline authority your hero holds — observer, traveler, anchor, fixer.",
  titanGrowth:          "how titanic your hero has grown — tall, towering, world-spanning.",
  trinket:              "the trinket your hero keeps — small, unremarkable, secretly important.",
  upgradeTree:          "which upgrade tree your construct has pursued.",
  vengeance:            "the vengeance your hero pursues — petty, blood-debt, dynastic, cosmic.",
  voidAspect:           "the void aspect that lives inside your hero.",
  voidMark:             "the void-mark burned into your hero's flesh.",
  warpaint:             "the warpaint your hero wears — banner, ritual, mourning.",
  warriorClan:          "the warrior clan your hero belongs to.",
  worship:              "the worship your hero commands — none, local, regional, worldwide.",
  abyss:                "how deep into the abyss your hero descends.",
  adaptation:           "the adaptation your hero has made to survive.",
  alienMutation:        "the alien bio-form your hero carries.",
  altForm:              "the alternate form your shifter takes.",
  ancientInstinct:      "the ancient instinct your hero still obeys.",
  bountyContract:       "the bounty contract your hero hunts under.",
  cosmicScope:          "the cosmic scope your hero operates at.",
  curseDomain:          "the cursed domain your hero rules.",
  divineParent:         "the divine parent who fathered or mothered your hero.",
  dwarfClan:            "the dwarf clan your hero is sworn to.",
  insanityTier:         "how unhinged your hero has become.",
  mutantOrigin:         "the mutant origin behind your hero's powers.",
  powerLevel:           "your hero's power level — the meme stat made real.",
  psionicClass:         "your hero's psionic class.",
  standStats:           "the stats of your hero's Stand.",
  temporalEra:          "the temporal era your hero hails from.",
  undeadCommand:        "the command your undead hero exerts over the dead.",
  vampireAge:           "how ancient your vampire hero is.",
  wildMagic:            "the wild magic your hero channels.",
  worshipperCount:      "how many worshippers fuel your god-hero.",
  chaosFactor:          "the chaos factor your hero brings into every situation.",
  chaosRoll:            "the chaos roll dictating your hero's outcomes.",
  benderElement:        "which element your bender commands.",
  breathingStyle:       "the breathing style your warrior practices.",
}

// Twist titles map to their flavor. If we don't have a specific entry we
// just stitch from twistId / displayName.
const TWIST_FLAVOR: Record<string, string> = {
  worshipperCount: "How many believers fuel your god. More faith, more might.",
  powerLevel:      "Your power level. The meme stat, real here. Base form is humble; full Zenithian Instinct is absurd.",
  benderElement:   "Which element your bender commands — water, earth, fire, or sky.",
  insanityTier:    "How unhinged your hero has become. Quirky, eccentric, paranoid, broken, transcendent.",
  temporalEra:     "The era your time-walker hails from. Ancient, medieval, modern, future, beyond-time.",
  chaosRoll:       "A pure-chaos roll. Whatever lands, lands.",
  divineParent:    "Which god fathered or mothered your demigod.",
  cosmicScope:     "The cosmic scale your hero operates at.",
  mutantOrigin:    "How your mutant got their powers — bite, birth, lab, cosmic ray.",
  curseDomain:     "Which cursed domain your hero rules.",
  vampireAge:      "How old your vampire is. Each century compounds.",
  moonPhase:       "Which lunar phase empowers your hero.",
  dragonHoard:     "The size of your dragon's hoard.",
  dwarfClan:       "Which dwarven clan your hero swore to.",
  standStats:      "Your hero's Stand — its power, speed, range, precision, and persistence.",
  bountyContract:  "The bounty your hero hunts under.",
  breathingStyle: "The breathing style your warrior cultivates.",
  wildMagic:       "The wild magic your hero channels — unstable, unpredictable, devastating.",
  psionicClass:    "Your hero's psionic class.",
  chaosFactor:     "The chaos factor your hero embodies.",
  undeadCommand:   "The command your undead hero holds over the dead.",
}

// Categories whose generic scene gets overlaid with a context-aware
// version when guide.spinContext is set. Others use their static scene
// as-is (e.g. wheel-strength always describes Strength).
const CATEGORIES_WITH_VARIANTS = new Set([
  'raceWheel',
  'twistSpin',
  'weaponEnchantment',
  'armorEnchantment',
  'devilFruitName',
  'racialAbility',
  'archetypeAbility',
  'power',
  'weapon',
  'armor',
  'limitBreak',
  'limitBreakLevel',
])

// Synthesize a context-aware scene for the active wheel. Returns null if
// no contextual override is wanted (caller uses the base scene).
export function synthesizeSpinScene(
  sceneId: string,
  base: GuideScene,
  ctx: SpinContextShape,
): GuideScene | null {
  if (!CATEGORIES_WITH_VARIANTS.has(ctx.category)) return null

  const dn = ctx.displayName?.trim() || base.lines[0]?.text || 'this wheel'
  const race = ctx.forRace?.trim()

  // Race-injected wheels — every unique injected wheel id gets a tailored
  // description, falling back to a generic but still race-named line.
  if (ctx.category === 'raceWheel' && ctx.raceWheelId) {
    const flavor = RACE_WHEEL_FLAVOR[ctx.raceWheelId]
    const raceLine = race
      ? `${dn}. A wheel drawn from ${race} lore — only ${race} characters spin it.`
      : `${dn}. A race-specific wheel — only your kind spins it.`
    const detail = flavor
      ? `It determines ${flavor}`
      : "Whatever lands becomes a permanent part of your hero's identity, layered atop their race."
    return {
      id: sceneId,
      menuLabel: `What is the ${dn} wheel?`,
      lines: [
        { text: raceLine, mood: 'pleased' },
        { text: detail,   mood: 'neutral' },
        { text: "The segments before you are the full range of what fortune allows here. Spin and accept.", mood: 'wry' },
      ],
      choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
    }
  }

  // Twist spins — race-flavored "wildcards" with their own pool.
  if (ctx.category === 'twistSpin') {
    const flavor = ctx.twistId ? TWIST_FLAVOR[ctx.twistId] : undefined
    return {
      id: sceneId,
      menuLabel: `What is the ${dn} wheel?`,
      lines: [
        { text: `${dn}. A twist drawn from your race's lore.`, mood: 'pleased' },
        { text: flavor ?? "Each twist is a single permanent trait, layered on top of everything else fate already wrote.", mood: 'neutral' },
        { text: "Spin. The wheel decides which thread of your race's tradition takes hold.", mood: 'wry' },
      ],
      choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
    }
  }

  // Enchantment wheels — weapon vs armor. Synthesize from the live display
  // name so the player sees "Weapon Enchantment" or whatever specific name
  // was used, while Quill explains what enchantments are.
  if (ctx.category === 'weaponEnchantment') {
    return {
      id: sceneId,
      menuLabel: `What does ${dn} do?`,
      lines: [
        { text: `${dn}. A magical layer woven into your weapon.`, mood: 'pleased' },
        { text: "It grants an elemental affinity, a passive trait, or a hidden edge — read the segments to see the range.", mood: 'neutral' },
        { text: "High-grade weapons may earn multiple enchantments. Yours has earned at least one.", mood: 'wry' },
      ],
      choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
    }
  }

  if (ctx.category === 'armorEnchantment') {
    return {
      id: sceneId,
      menuLabel: `What does ${dn} do?`,
      lines: [
        { text: `${dn}. A passive layer set into your armor.`, mood: 'pleased' },
        { text: "Damage reduction, elemental resistance, regeneration — the kinds of effect that turn a long fight your way.", mood: 'neutral' },
        { text: "Slot count rises with grade. SS+ armor may carry several enchantments at once.", mood: 'wry' },
      ],
      choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
    }
  }

  // Demon Fruit names — race-locked named powers.
  if (ctx.category === 'devilFruitName') {
    return {
      id: sceneId,
      menuLabel: `What is ${dn}?`,
      lines: [
        { text: `${dn}. A named fruit, granting a specific power-set.`, mood: 'pleased' },
        { text: race ? `Only ${race} may eat. The fruit's name is half the flavor; the power it carries is the rest.` : "Race-locked — only certain kinds may eat. The name is half the flavor.", mood: 'neutral' },
        { text: "Whatever the wheel lands on becomes part of your hero's signature, written into the card.", mood: 'wry' },
      ],
      choices: [{ label: 'Spin!', action: 'dismiss', color: '#f0c040' }],
    }
  }

  // The "you rolled wheel N of M" categories. We keep the generic scene
  // but rename the menuLabel to match the displayName so a player asking
  // about e.g. "Racial Ability 2" sees the specific name, not a generic.
  if (
    ctx.category === 'racialAbility' ||
    ctx.category === 'archetypeAbility' ||
    ctx.category === 'power' ||
    ctx.category === 'weapon' ||
    ctx.category === 'armor' ||
    ctx.category === 'limitBreak' ||
    ctx.category === 'limitBreakLevel'
  ) {
    return {
      ...base,
      menuLabel: `What is the ${dn} wheel?`,
      lines: [
        { text: `${dn}.`, mood: base.lines[0]?.mood ?? 'neutral' },
        ...base.lines,
      ],
    }
  }

  return null
}

// Resolve the most specific scene id for a route + sub-view pair. Used by
// both the auto-fire (first-visit) effect and the "Ask Quill" button.
//
// Sub-view ALWAYS wins if mapped — even on / — so the main spin page's
// per-wheel scenes (wheel-race, wheel-strength, …) fire correctly while
// the player is mid-spin. Without this, the pathname='/' early return
// short-circuited to home-overview and Quill explained the menu instead
// of the active wheel. Worked in Ascension (pathname=/story → no early
// return) but not the main spin (pathname=/), which is what the player
// observed: "it works in story mode for the wheel but not the other one."
export function sceneForRoute(pathname: string, subView: string | null = null): string | null {
  // Suffix-based overrides for nested dynamic routes (where the parameter
  // sits between prefix and suffix, so a startsWith prefix can't match).
  if (/^\/character\/[^/]+\/replay$/.test(pathname)) return 'character-replay'

  // Sub-view check FIRST — walk longest prefix first so /story/slot beats
  // /story, and so '/' (single-slash) catches main-spin sub-views.
  if (subView) {
    const prefixes = Object.keys(SUB_VIEW_SCENES).sort((a, b) => b.length - a.length)
    for (const prefix of prefixes) {
      if (pathname.startsWith(prefix)) {
        const map = SUB_VIEW_SCENES[prefix]
        if (map && map[subView]) return map[subView]
      }
    }
  }

  // No sub-view match — fall back to route defaults.
  if (pathname === '/' || pathname === '') return 'home-overview'
  for (const { prefix, sceneId } of ROUTE_SCENES) {
    if (pathname.startsWith(prefix)) return sceneId
  }
  return null
}
