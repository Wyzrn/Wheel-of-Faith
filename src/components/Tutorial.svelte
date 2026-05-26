<script lang="ts">
  // Tutorial overlay — shown to first-time players.
  // step -1 = tutorial inactive (done / skipped)
  // step  0 = welcome modal (multi-page)
  // step 1–14 = category-keyed bottom cards during the spin
  // step 15 = completion toast

  interface Props {
    step: number
    currentCategory?: string
    isRevealed?: boolean
    onGotIt: (nextStep: number) => void
    onSkip: () => void
    onStartGame: () => void
    onTriggerAction?: () => void
  }

  let { step, currentCategory, isRevealed = false, onGotIt, onSkip, onStartGame, onTriggerAction }: Props = $props()

  // ── Welcome modal pages ───────────────────────────────────────────────────
  let welcomePage = $state(0)
  const WELCOME_PAGES = 6

  type WelcomePage = {
    icon: string
    iconColor: string
    label: string
    title: string
    body: string
  }

  const WELCOME: WelcomePage[] = [
    {
      icon: 'casino',
      iconColor: '#f0c040',
      label: 'Welcome',
      title: 'Welcome to\nWheel of Fate',
      body: 'A character creation engine driven entirely by chance.\n\nYou spin ~23 sequential wheels that decide your race, class, powers, stats, weapons, weaknesses, and title — in that order. Every result is permanent. The only strategy is acceptance.\n\nThis tutorial walks you through every system before your first spin, then gives you context cards at each stage of the game as it appears.',
    },
    {
      icon: 'rotate_right',
      iconColor: '#a78bfa',
      label: 'The Spin',
      title: 'How the Spin Works',
      body: 'The 23+ wheels fire in sequence:\n\n① Race — your species, stat multipliers, and power pool\n② Racial features — subtype, class, transformation, abilities (1–3 spins)\n③ Archetype — your role (Combat, Magic, Stealth, Support, Chaos)\n④ 11 Stats — Strength, Speed, Agility, Durability, IQ, Charisma, Fighting Skill, Potential, Energy Level, Power Mastery, Weapon Mastery\n⑤ Powers — 1–3+ spins based on race and archetype\n⑥ Weapon + Armor + Armor Strength\n⑦ Weaknesses — 0–3 based on your race\n⑧ Redemption Spin — 25% chance to alter your fate\n⑨ Backstory — generated origin story\n⑩ Title — your final designation\n\nEvery stat spin carries a 5% Wildcard chance that rewrites the result mid-spin. Watch for the flash.',
    },
    {
      icon: 'menu_book',
      iconColor: '#34d399',
      label: 'Story Mode',
      title: 'Story Mode',
      body: 'A full progression mode with 4 independent save slots.\n\nEach slot gives you:\n• 10 free spins/day (refreshing every 3 hrs). Daily Booster gamepass doubles this to 20.\n• A roster of characters you build by spending spins — Hero and Legend spins give multiplied stats\n• 16 Worlds: F → E → D → C → B → A → S → SS → SSS → Z → ZZ → ZZZ → Celestial → Godly → Primordial → Absolute\n• 20 battles per world. Win them to earn Gems, XP, and crystal drops.\n• Crystal inventory — open grade-based crystals to get random powers, weapons, and armor to equip\n• Stat Crystals — spend Gems or Fate Shards to boost individual stats permanently\n\n⚑ Endless Mode unlocks at Level 3 — infinite scaling waves, global leaderboard by highest wave cleared.',
    },
    {
      icon: 'swords',
      iconColor: '#f87171',
      label: 'Rivals',
      title: 'Rivals Mode',
      body: 'Battle your characters against others. Two formats:\n\n⚔ Local — fight a friend on the same device. Each player picks a character from your shared collection and they fight in an auto-battle simulator. Stats, powers, weapons, armor, and equipped crystals all factor in.\n\n🌐 Online — real-time matchmaking pairs you with another player. Your selected character fights theirs in an auto-battle. Wins tracked on your profile and the Rivals leaderboard.\n\n🤖 Bot Battle — no match found? A bot fills in. Wins still count.\n\n⚑ Revenge Protocol gamepass: if you lose a battle you still earn 50% of the gem drops.\n⚑ Crit Surge gamepass: +10% critical hit chance in all battles.\n⚑ Legend Tag gamepass: [LEGEND] prefix shown next to your name in online matches.',
    },
    {
      icon: 'diamond',
      iconColor: '#f0c040',
      label: 'Shards & Shop',
      title: 'Fate Shards, Shop & Clans',
      body: 'Fate Shards are your global account currency — they never reset across save slots or sessions.\n\nEarn Fate Shards by:\n• Winning battles in Story Mode (chance drops, doubled with 2× Shard Drop gamepass)\n• Daily Challenges — up to 175 shards/day from 3 rotating tasks\n\nEarn Gems (per-slot currency) by:\n• Selling characters from your roster (+25% with Sell Bonus gamepass)\n• Winning battles in Story Mode worlds\n\nSpend Fate Shards in the Arcane Shop on:\n• Gamepasses — permanent upgrades: 2× Luck, Reroll Insurance, Expanded Roster, Daily Booster, Boss Magnet, Cursed Wheel, Gold Roster Frame, and more\n• Stat Crystals — buy Common (50 ◆), Elite (500 ◆), or Legendary (1,000 ◆) crystals directly, no daily limit\n\n⚑ Clans — team up with up to 9 other players. Clan leaderboard ranks by total combined Rivals wins. Join from the Clan page on the main menu.',
    },
    {
      icon: 'workspace_premium',
      iconColor: '#f0c040',
      label: "Let's Go",
      title: "You're Ready",
      body: 'After your 23 spins, you receive an Overall Tier Grade:\n\nF– → F → F+ → E → D → C → B → A → S → SS → SSS → Z → ZZ → ZZZ → Celestial → Godly → Primordial → Absolute\n\nDerived from a weighted score across all 11 stats, powers, and equipment. Fighting Skill is weighted heaviest. Absolute tier is extremely rare.\n\nYour completed character card can be:\n• Shared — a unique URL anyone can open\n• Published to the Public Gallery\n• Added to your Profile Hall of Fame (top 5 characters you\'ve ever rolled)\n• Replayed — step through all 23 spins in a viewer\n\nContext cards will appear during the spin to explain each system as it comes up. You can end the tutorial at any time by clicking "End tutorial" on any card.\n\nThe wheel has no memory. Every spin is fresh.',
    },
  ]

  // ── In-game step card definitions ─────────────────────────────────────────
  type CardContent = {
    id: number
    icon: string
    title: string
    body: string
    cta: string
    accent: string
  }

  const RACIAL_CATS = new Set(['raceSubType', 'raceClass', 'raceTransformation', 'racialAbility'])
  const STAT_CATS = new Set([
    'strength','speed','agility','durability','iq','charisma','fightingSkill',
    'potential','energyLevel','powerMastery','weaponMastery',
  ])

  const STAT_DETAILS: Record<string, string> = {
    strength:     'Raw physical force — how hard you hit, what you can lift, and how many walls you walk through. Determines melee damage output in Story Mode battles.',
    speed:        'Reaction time, movement speed, and initiative. High Speed characters act first in combat and activate abilities faster.',
    agility:      'Flexibility, evasion, and aerial mobility. High Agility makes you harder to hit and improves dodge chance in battle.',
    durability:   'How much punishment your body absorbs. Your passive damage reduction — the difference between tanking a hit and being deleted.',
    iq:           'Intelligence and tactical depth. Affects magic complexity, ability to counter enemy powers, and how effectively you exploit openings in battle.',
    charisma:     'Social force — persuasion, intimidation, and battlefield presence. Heavily weighted in Support archetypes. Affects how quickly allies rally.',
    fightingSkill:'Combat technique and instincts. The most heavily weighted stat in your overall score. Raw power without this is just a liability.',
    potential:    'Your untapped ceiling — how much stronger training can make you. Critical for long-term Story Mode progression scaling and character growth.',
    energyLevel:  'Ki, mana, chakra, aura — whatever fuels your abilities. More energy = sustained ability use without running dry in extended fights.',
    powerMastery: 'Precision and control over your powers. Low = powerful but unstable and costly. High = efficient, stable, and lethal on demand.',
    weaponMastery:'Skill with whatever weapon the wheel gives you. Your archetype and race bias which weapon types appear — this determines how well you use them.',
    armorStrength:'The protective power of your armor independent of type. Even a basic Helmet at SSS+ is divine protection.',
  }

  const TOTAL_STEPS = 14

  function resolveCard(s: number, cat: string | undefined, revealed: boolean): CardContent | null {
    if (s <= 0 || s >= 15) return null
    if (!cat) return null

    // Step 1 — Race wheel (before spin)
    if (cat === 'race' && !revealed && s <= 1) return {
      id: 1,
      icon: 'diversity_3',
      title: 'Spin 1 — Race',
      body: '50+ races: Humans, Elves, Dwarves, Saiyans, Hollow Arrancars, Elder Dragons, Primordial Entities, Cosmic Gods, and many more.\n\nYour race sets the foundation for everything:\n• Stat multipliers — Dragon boosts Strength 1.8×; Goblin penalises Durability 0.7×\n• Power pool access — exclusive powers that only your race can receive\n• Racial ability count — 1 to 3 spins of birthright traits\n• Weakness modifier — powerful races pay with more weaknesses (0–3)\n• Transformation eligibility — some races roll a 0.9× to 2.2× multiplier on ALL stats\n\nRarer races (lower spawn weight on the wheel) carry stronger multipliers and bigger exclusive ability pools. Common races are reliable; rare races are volatile in the best way.\n\nThe wheel has already decided. Spin it.',
      cta: 'Got it — spin!',
      accent: '#f0c040',
    }

    // Step 2 — Race locked in
    if (cat === 'race' && revealed && s <= 2) return {
      id: 2,
      icon: 'check_circle',
      title: 'Race Locked In',
      body: 'Permanent. Here\'s what your race now determines for every spin ahead:\n\n• Racial Abilities — 1–3 upcoming spins of traits unique to your species\n• Subtype / Class — your variant within the race (Pure Saiyan vs. Half-Blood; Wood Elf vs. Drow)\n• Transformation — if eligible, a global stat multiplier (0.9× to 2.2×) is applied to all 11 stats after they\'re rolled\n• Hidden stat weights — your race silently shifts the probability curves on every stat wheel without showing you numbers\n• Synergy triggers — specific race × archetype combinations fire bonus spins automatically mid-session\n\nThe spins coming up are all racial features. They expand your race into a full identity.',
      cta: 'Next spin →',
      accent: '#22c55e',
    }

    // Step 3 — Racial features
    if (RACIAL_CATS.has(cat) && !revealed && s <= 3) return {
      id: 3,
      icon: 'auto_awesome',
      title: 'Racial Features',
      body: 'These spins build your identity within your race:\n\nSubtype / Class — your racial variant. Berserker Orc gets +2 Strength tiers; Runic Dwarf gets +2 Power Mastery; Pure Saiyan accesses a larger transformation pool. Each subtype unlocks its own exclusive abilities on top of this.\n\nRacial Abilities — your birthright. Separate from regular Powers — these are innate to your species and are not affected by Wildcards. They appear on your card and carry into Story Mode battles.\n\nTransformation (if eligible) — picked from a tiered pool. Higher tiers multiply all your stat scores after they are calculated. A God transformation on a rare race is devastating.\n\nSynergy note: if your race + the archetype you\'ll spin next form a known combo, a bonus spin fires automatically. Watch the announcement bar at the top.',
      cta: 'Got it — spin!',
      accent: '#a78bfa',
    }

    // Step 4 — Archetype
    if (cat === 'archetype' && !revealed && s <= 4) return {
      id: 4,
      icon: 'military_tech',
      title: 'Spin — Archetype',
      body: 'Your combat role. Archetypes are grouped into types:\n\nCombat (Warrior, Gladiator, Berserker, Warlord)\n→ Fighting Skill + Strength bonuses, melee ability pools\n\nMagic (Mage, Warlock, Sorcerer, Mystic)\n→ Power Mastery + IQ bonuses, spell and curse ability pools\n\nStealth (Rogue, Assassin, Shinobi, Phantom)\n→ Agility + Speed bonuses, ambush ability pools\n\nSupport / Aura (Paladin, Healer, Tactician, Bard)\n→ Charisma + Potential bonuses, buff and healing pools\n\nChaos (Anti-Hero, Chaos Gremlin, Wild Card)\n→ Unpredictable stat bonuses across the board\n\nYour archetype adds 1–2 exclusive ability spins and can trigger race synergy bonus spins. A Combat archetype on a Dragon race = absurd strength. A Magic archetype on a Human = reliable but capped.',
      cta: 'Got it — spin!',
      accent: '#a78bfa',
    }

    // Step 5 — First stat spin
    if (STAT_CATS.has(cat) && !revealed && s <= 5) {
      const statName = cat.replace(/([A-Z])/g, ' $1').trim()
      const detail = STAT_DETAILS[cat] ?? ''
      return {
        id: 5,
        icon: 'bar_chart',
        title: `Stat — ${statName}`,
        body: `${detail}\n\nThe grade system runs 46 levels:\nF–, F, F+\nE–, E, E+\nD–, D, D+\nC–, C, C+\nB–, B, B+\nA–, A, A+\nS–, S, S+\nSS–, SS, SS+\nSSS–, SSS, SSS+\nZ–, Z, Z+\nZZ–, ZZ, ZZ+\nZZZ–, ZZZ, ZZZ+\nCelestial–, Celestial, Celestial+\nGodly–, Godly\nPrimordial, Absolute\n\nThe label you land on IS your tier. Score is embedded in it. Your race silently shifts the probability of landing higher tiers. You spin all 11 stats in this section.\n\n⚡ Every stat spin has a 5% Wildcard chance (10% with 2× Luck gamepass) that can rewrite your result entirely — up, down, or sideways. Next card explains how Wildcards work.`,
        cta: 'Got it — spin!',
        accent: '#f0c040',
      }
    }

    // Step 6 — Wildcard explanation (fires after the forced tutorial wildcard on strength)
    if (cat === 'strength' && revealed && s === 6) return {
      id: 6,
      icon: 'bolt',
      title: '⚡ Wildcards Explained',
      body: 'A 5% proc on every stat spin (10% with the 2× Luck gamepass). When it fires, the screen flashes and a Wildcard outcome replaces your result:\n\n• Fate\'s Blessing — your roll +3 tiers\n• Fate\'s Curse — your roll −3 tiers\n• Chaos Reroll — immediate re-spin, no modifiers\n• Mirror of Glory — copy your highest stat rolled so far\n• Gift of Power — keep your roll AND receive a bonus power spin\n• Double-Edged Fate — +4 tiers, but a weakness is added\n• Primordial Ascension — forced to the absolute maximum tier\n• Frozen Mediocrity — locked to C (the punishment tier)\n• Forgotten by Fate — locked to F– (the floor)\n• Shared Destiny — copy your most recently rolled stat\n\nItem spins (powers, weapons, armor) have a 20% chance (40% with 2× Luck) of triggering a bonus extra spin of the same category instead of a stat override.',
      cta: 'Got it →',
      accent: '#f0c040',
    }

    // Step 7 — Powers
    if (cat === 'power' && !revealed && s <= 7) return {
      id: 7,
      icon: 'bolt',
      title: 'Powers & Elements',
      body: 'You spin 1–3+ powers based on your race and archetype. Each power has two attributes:\n\nElement — determines battle type matching:\nFire, Ice, Lightning, Shadow, Arcane, Holy, Nature, Poison, Gravity, Time, Cosmic, Soul, Chaos, Blood, Psychic, Sound, Water, Metal, Earth, Void, Wind\n\nGrade — determines power level:\nD / C — functional and reliable\nB / A — strong, often fight-defining\nS / SS — exceptional and story-altering\nSSS / SSS+ — world-ending capability\nGod — you are now the problem\n\nYour race strictly gates which powers appear. Dragon-race characters access draconic power pools unavailable to Humans. Rarer races = rarer, more exclusive power pools.\n\nIn Story Mode: powers become active abilities with elemental bonus damage vs. enemy weaknesses. Higher-grade powers deal significantly more damage.',
      cta: 'Got it — spin!',
      accent: '#fb923c',
    }

    // Step 8 — Weapons
    if (cat === 'weapon' && !revealed && s <= 8) return {
      id: 8,
      icon: 'swords',
      title: 'Weapons',
      body: 'Weapon categories: Melee, Ranged, Magical, Ancient, Exotic, Cursed, and None.\n\nEach weapon has an Element and Grade — higher grade = more broken. The rarity of your race biases which weapon categories can appear.\n\nRace-weapon tendencies:\n• Dwarves → Ancient melee weapons\n• Goblins → Cursed / Exotic\n• Elves → Ranged / Magical\n• Kryptonians → None (they ARE the weapon)\n• Dragons → Ancient or Exotic\n\nWeapon Mastery (spinning very soon) determines how effectively you use whatever the wheel gives you. A God-grade sword still needs someone competent to hold it.\n\nIn Story Mode: equip weapons to roster characters from the inventory screen. Higher-grade equipped weapons raise your team\'s damage output in battle. The Gold Roster Frame gamepass adds a visual gold border to all your roster cards.',
      cta: 'Got it — spin!',
      accent: '#64748b',
    }

    // Step 9 — Armor
    if ((cat === 'armor' || cat === 'armorStrength') && !revealed && s <= 9) return {
      id: 9,
      icon: 'shield',
      title: 'Armor & Armor Strength',
      body: 'Armor types: None, Helmet Only, Half-Suit, Full-Suit, Ancient, Exotic, Cursed.\n\nArmor Grade determines enchantment slots:\n• B+ grade → 1 enchantment slot added\n• SS+ grade → multiple enchantments possible\n\nArmor Strength is a separate spin — it measures the raw protective power of your armor independently of its type. Basic Helmet at SSS+ is divine protection. Full-Suit at F– is decorative tin.\n\nRace biases:\n• Orcs → Full-Suit ancient plating\n• Elves → Half-Suit or None (they rely on agility)\n• Kryptonians → almost never wear armor\n\nIn Story Mode: equip armor to roster characters from your inventory. Equipped armor reduces incoming damage in battles. Higher-grade armor stacks meaningfully.',
      cta: 'Got it — spin!',
      accent: '#94a3b8',
    }

    // Step 10 — Weaknesses
    if (cat === 'weakness' && !revealed && s <= 10) return {
      id: 10,
      icon: 'broken_image',
      title: 'Weaknesses',
      body: 'Your race determines how many weaknesses you roll: 0 to 3. More powerful races pay with more weaknesses as cosmic balance.\n\nWeaknesses are:\n• Permanent — they cannot be removed except via Redemption Spin ("Lose One Weakness" outcome)\n• Public — visible on your character card to anyone who views it\n• Thematic — some are race-specific, others are universal\n• Sometimes humiliating — the wheel makes no apologies\n\nIn Story Mode battles: enemies can deal bonus damage against you by hitting your weakness element. Boss enemies are significantly more likely to target weakness angles. A God-tier character with a weakness to salt is still weak to salt.\n\nThe Revenge Protocol gamepass softens losses — you still earn 50% of gem drops even when defeated.',
      cta: 'Got it — spin!',
      accent: '#f87171',
    }

    // Step 11 — Redemption spin
    if (cat === 'redemptionSpin' && !revealed && s <= 11) return {
      id: 11,
      icon: 'casino',
      title: 'The Redemption Spin',
      body: '25% base chance to trigger Redemption. If it fires, a second wheel appears:\n\n• Reroll Your Worst Stat — identifies and re-spins your lowest stat automatically\n• Gain a Bonus Power — extra power spin added immediately\n• Lose One Weakness — one weakness permanently removed\n• All Stats +1 Tier — every one of your 11 stats bumps up one grade\n• Double Your Best Stat — your highest-scoring stat is doubled\n• Demigod Status — ALL stats +3 tiers (very rare)\n• Reroll Everything: Chaos Edition — all 11 stats re-spin from scratch (bonuses preserved)\n• Plot Armour (Permanent) — a universal passive defensive trait is added\n• The Universe Owes You One — a chaotic and powerful bonus applied randomly\n\nIf Redemption does NOT trigger (75% chance), the wheel moves on. No retry, no fallback.',
      cta: 'Got it — spin!',
      accent: '#c084fc',
    }

    // Step 12 — Backstory
    if (cat === 'backstory' && !revealed && s <= 12) return {
      id: 12,
      icon: 'history_edu',
      title: 'Backstory',
      body: 'A generated origin that ties your race, archetype, and powers into a narrative snapshot. It\'s flavour — not mechanical — but it gives your character context.\n\nSome backstories are dramatic. Some are tragic. Some are deeply ironic given your actual stats. The wheel picks without consulting you.\n\nYour backstory appears on your final character card and is visible to anyone you share your character with. It also appears in the Public Gallery if you choose to publish your character.\n\nThis is the second-to-last spin. One more to go.',
      cta: 'Got it — one more!',
      accent: '#9a907b',
    }

    // Step 13 — Title (final spin)
    if (cat === 'title' && !revealed && s <= 13) return {
      id: 13,
      icon: 'workspace_premium',
      title: 'Final Spin — Title',
      body: 'Your honorary designation. The capstone of your identity.\n\nTitles range from grand and heroic to absurd and self-defeating. Some are race-weighted; many are universal. Permanent and visible on your character card forever.\n\nAfter this spin, you\'ll name your character. Then your complete card is revealed with your Overall Tier Grade:\n\nF– → F → F+ → E → D → C → B → A → S → SS → SSS → Z → ZZ → ZZZ → Celestial → Godly → Primordial → Absolute\n\nThis grade is calculated from a weighted score across all 11 stats, powers, weapons, and armor. Fighting Skill is weighted heaviest. Absolute tier is extremely rare.\n\nThis is it. Spin.',
      cta: 'Last spin — let\'s go!',
      accent: '#f0c040',
    }

    // Step 14 — post-reveal / what to do next
    if (cat === 'title' && revealed && s <= 14) return {
      id: 14,
      icon: 'stars',
      title: 'Character Complete — What Next?',
      body: 'Your fate is decided. Here\'s what you can do with your character:\n\n⚔ Rivals Mode — battle this character against friends (local) or real opponents (online). Wins climb the Rivals leaderboard on your profile.\n\n📖 Story Mode — build a full roster. Spin more characters (including Hero and Legend-class variants), battle through Worlds, collect and equip crystal drops, and unlock Endless Mode at Level 3.\n\n◆ Fate Shards — earn from battles and Daily Challenges (up to 175/day). Spend in the Arcane Shop on permanent Gamepass upgrades.\n💎 Gems — earned by selling Story Mode characters and winning battles. Used for in-slot upgrades and crystals.\n\n⚑ Clans — team up with up to 9 players and compete on the Clan leaderboard by combined Rivals wins.\n\n🔗 Share — copy your character\'s link and send it to anyone. No account needed to view.',
      cta: 'Done — I\'m ready!',
      accent: '#f0c040',
    }

    return null
  }

  let card = $derived(resolveCard(step, currentCategory, isRevealed))

  // Card body shortening — show the first 3 lines (or up to ~280 chars) by
  // default; "Read more" expands the full body. Keeps the mobile card small
  // enough not to cover the wheel/result. Users in a hurry can ignore the
  // body entirely and just tap the CTA — the icon + title carry the gist.
  function summarize(body: string): { short: string; needsExpand: boolean } {
    const lines = body.split('\n').filter(l => l.trim().length > 0)
    const firstThree = lines.slice(0, 3).join('\n')
    const short = firstThree.length > 280 ? firstThree.slice(0, 280) + '…' : firstThree
    return { short, needsExpand: lines.length > 3 || body.length > short.length }
  }
  let bodyExpanded = $state(false)
  let cardCollapsed = $state(false)

  // Auto-collapse the card when a result is revealed so the player can see what
  // they actually got. Also reset expand state when the card switches.
  $effect(() => {
    if (isRevealed) cardCollapsed = true
    else cardCollapsed = false
    bodyExpanded = false
  })

  // Completion toast: briefly visible when step hits 15
  let toastVisible = $state(false)
  $effect(() => {
    if (step === 15) {
      toastVisible = true
      const t = setTimeout(() => { toastVisible = false; onSkip() }, 2400)
      return () => clearTimeout(t)
    }
  })
</script>

<!-- ─── Welcome modal (step 0) — multi-page ────────────────────────────────── -->
{#if step === 0}
  {@const pg = WELCOME[welcomePage]}
  <div class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.97); backdrop-filter: blur(20px);">
    <div class="obsidian-slab w-full max-w-sm rounded-2xl relative overflow-hidden"
      style="border: 1px solid rgba(240,192,64,0.25); box-shadow: 0 0 80px rgba(0,0,0,0.9), 0 0 40px rgba(240,192,64,0.05);">
      <div class="noise-overlay"></div>

      <!-- Corner accents -->
      <div class="absolute top-3 left-3 w-5 h-5 pointer-events-none" style="border-top: 2px solid rgba(240,192,64,0.4); border-left: 2px solid rgba(240,192,64,0.4);"></div>
      <div class="absolute top-3 right-3 w-5 h-5 pointer-events-none" style="border-top: 2px solid rgba(240,192,64,0.4); border-right: 2px solid rgba(240,192,64,0.4);"></div>
      <div class="absolute bottom-3 left-3 w-5 h-5 pointer-events-none" style="border-bottom: 2px solid rgba(240,192,64,0.4); border-left: 2px solid rgba(240,192,64,0.4);"></div>
      <div class="absolute bottom-3 right-3 w-5 h-5 pointer-events-none" style="border-bottom: 2px solid rgba(240,192,64,0.4); border-right: 2px solid rgba(240,192,64,0.4);"></div>

      <!-- Page tabs -->
      <div class="relative z-10 flex border-b" style="border-color: rgba(255,255,255,0.06);">
        {#each WELCOME as p, i}
          <button
            onclick={() => welcomePage = i}
            class="flex-1 py-2 text-center transition-all"
            style="font-family: 'JetBrains Mono', monospace; font-size: 7.5px; letter-spacing: 0.1em; text-transform: uppercase; border: none; background: none; cursor: pointer; color: {welcomePage === i ? pg.iconColor : '#2a2640'}; border-bottom: 2px solid {welcomePage === i ? pg.iconColor : 'transparent'}; margin-bottom: -1px;">
            {p.label}
          </button>
        {/each}
      </div>

      <!-- Content -->
      <div class="relative z-10 px-6 pt-5 pb-3" style="min-height: 360px; overflow-y: auto; max-height: 70vh;">
        <div class="flex flex-col items-center text-center mb-4">
          <span class="material-symbols-outlined mb-3"
            style="font-size: 42px; color: {pg.iconColor}; font-variation-settings: 'FILL' 1; filter: drop-shadow(0 0 14px {pg.iconColor}55);">{pg.icon}</span>
          <h2 style="font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 900; color: #ffdf96; letter-spacing: 0.06em; line-height: 1.25; white-space: pre-line;">{pg.title}</h2>
        </div>
        <p style="font-family: 'JetBrains Mono', monospace; font-size: 0.69rem; color: #9a907b; line-height: 1.78; white-space: pre-line;">{pg.body}</p>
      </div>

      <!-- Navigation -->
      <div class="relative z-10 px-5 pt-3 pb-3 flex items-center gap-2.5">
        {#if welcomePage > 0}
          <button onclick={() => welcomePage--}
            class="px-4 py-2.5 rounded-lg text-xs font-bold hover:brightness-110 transition-all"
            style="font-family: 'Cinzel', serif; letter-spacing: 0.08em; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #9a907b; cursor: pointer;">
            ← Back
          </button>
        {/if}

        {#if welcomePage < WELCOME_PAGES - 1}
          <!-- "Played before" express path — on page 0 only, prominent next to Next so
               returning players see it instantly. Skips the 6-page intro and starts the
               game with the contextual in-game tutorial cards intact. -->
          {#if welcomePage === 0}
            <button onclick={() => { onSkip(); onStartGame() }}
              class="px-3 py-2.5 rounded-lg text-xs font-bold transition-all"
              style="font-family: 'Cinzel', serif; letter-spacing: 0.08em; background: rgba(167,139,250,0.10); border: 1px solid rgba(167,139,250,0.32); color: #a78bfa; cursor: pointer; white-space: nowrap;"
              title="Skip the intro — I've played before">
              Played before
            </button>
          {/if}
          <button onclick={() => welcomePage++}
            data-fx="big"
            class="metal-stamp-gold flex-1 py-2.5 rounded-lg relative text-xs font-bold"
            style="font-family: 'Cinzel', serif; letter-spacing: 0.15em; text-transform: uppercase;">
            <div class="l-bracket" style="color: rgba(255,255,255,0.2);"></div>
            Next →
          </button>
        {:else}
          <button onclick={() => { onStartGame() }}
            data-fx="big"
            class="metal-stamp-gold flex-1 py-2.5 rounded-lg relative text-xs font-bold"
            style="font-family: 'Cinzel', serif; letter-spacing: 0.15em; text-transform: uppercase;">
            <div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>
            Let's Spin!
          </button>
        {/if}
      </div>

      <!-- Dot indicators -->
      <div class="relative z-10 flex justify-center gap-1.5 pb-3">
        {#each Array.from({length: WELCOME_PAGES}, (_, i) => i) as i}
          <div class="rounded-full transition-all duration-300 cursor-pointer"
            onclick={() => welcomePage = i}
            role="button" tabindex="0"
            onkeydown={(e) => { if (e.key === 'Enter') welcomePage = i }}
            style="width: {welcomePage === i ? 16 : 5}px; height: 5px; background: {welcomePage === i ? pg.iconColor : '#2a2640'};"></div>
        {/each}
      </div>

      <!-- Skip -->
      <div class="relative z-10 pb-3 text-center">
        <button onclick={onSkip}
          style="font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; color: #2a2640; background: none; border: none; cursor: pointer; letter-spacing: 0.1em; text-decoration: underline;">
          Skip tutorial
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── In-game step cards (steps 1–14) ─────────────────────────────────────
     Positioning rules:
       Mobile (≤640px): pinned to BOTTOM of viewport, above the 64px nav bar.
         Never covers the wheel or the result reveal. Auto-collapses on reveal.
       Desktop (>640px): top-left as before so it doesn't cover the wheel.
     When isRevealed=true the card auto-collapses to a slim chevron-strip that
     the user can tap to expand. The CTA on each card also doubles as the
     "trigger action" — pressing it advances + auto-fires the next spin via
     onTriggerAction so the tutorial flows without the user having to find
     and tap the spin button after every card. -->
{#if card}
  {@const summary = summarize(card.body)}
  <div
    class="tut-card-wrap"
    style="--accent: {card.accent}; animation: tutSlideUp 0.3s cubic-bezier(0.34,1.3,0.64,1) forwards;">
    <div class="tut-card" style="border-top: 2px solid {card.accent};">

      <!-- Header — collapsed mode hides everything except a thin progress strip + expand button -->
      <div class="tut-header">
        <span class="material-symbols-outlined" style="font-size: 11px; color: {card.accent}; font-variation-settings: 'FILL' 1;">school</span>
        <span class="text-[9px] tracking-[0.22em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Tutorial · {card.id} / {TOTAL_STEPS}</span>

        <!-- Progress dots -->
        <div class="ml-auto flex gap-0.5 items-center">
          {#each Array.from({length: TOTAL_STEPS}, (_, i) => i + 1) as n}
            <div class="rounded-full transition-all duration-300"
              style="width: {n === card.id ? 10 : 3}px; height: 3px; background: {n < card.id ? '#3e3828' : n === card.id ? card.accent : '#1a1828'};"></div>
          {/each}
        </div>

        <button onclick={() => { cardCollapsed = !cardCollapsed }}
          class="tut-collapse-btn ml-2"
          aria-label={cardCollapsed ? 'Expand tutorial' : 'Collapse tutorial'}>
          <span class="material-symbols-outlined" style="font-size: 14px;">{cardCollapsed ? 'expand_less' : 'expand_more'}</span>
        </button>
        <button onclick={onSkip}
          class="tut-skip-btn"
          title="End tutorial">
          <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
        </button>
      </div>

      <!-- Body (hidden when collapsed) -->
      {#if !cardCollapsed}
        <div class="tut-body">
          <div class="tut-body-row">
            <span class="material-symbols-outlined shrink-0 mt-0.5"
              style="font-size: 22px; color: {card.accent}; font-variation-settings: 'FILL' 1; filter: drop-shadow(0 0 6px {card.accent}55);">{card.icon}</span>
            <div class="flex-1 min-w-0">
              <p class="tut-title">{card.title}</p>
              <p class="tut-text">{bodyExpanded ? card.body : summary.short}</p>
              {#if summary.needsExpand}
                <button onclick={() => bodyExpanded = !bodyExpanded}
                  class="tut-expand-btn"
                  style="color: {card.accent};">
                  {bodyExpanded ? '← Less' : 'Read more →'}
                </button>
              {/if}
            </div>
          </div>

          <!-- CTA: pulses to draw the eye. Clicking it advances + triggers the next action. -->
          <div class="tut-cta-row">
            {#if !isRevealed}
              <span class="tut-hint">
                <span class="material-symbols-outlined tut-arrow" style="font-size: 14px;">arrow_downward</span>
                Tap below — we'll spin for you
              </span>
            {/if}
            <button onclick={() => { onGotIt(card!.id + 1); onTriggerAction?.() }}
              data-fx="big"
              class="tut-cta-btn"
              style="border-color: {card.accent}; color: {card.accent};">
              {card.cta}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ─── Completion toast (step 15) ─────────────────────────────────────────── -->
{#if toastVisible}
  <div class="fixed top-16 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
    style="animation: tutSlideDown 0.3s ease-out forwards;">
    <div class="px-5 py-2.5 rounded-full flex items-center gap-2.5"
      style="background: rgba(9,9,15,0.97); border: 1px solid rgba(240,192,64,0.4); box-shadow: 0 4px 24px rgba(0,0,0,0.7); backdrop-filter: blur(12px);">
      <span class="material-symbols-outlined" style="font-size: 14px; color: #f0c040; font-variation-settings: 'FILL' 1;">check_circle</span>
      <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: #f0c040; letter-spacing: 0.12em;">Tutorial complete — you know the system</span>
      <span style="color: #4e4635; font-size: 0.7rem;">✦</span>
    </div>
  </div>
{/if}

<style>
  @keyframes tutSlideUp {
    from { transform: translateY(20px) scale(0.97); opacity: 0; filter: brightness(1.4) blur(2px); }
    to   { transform: translateY(0) scale(1); opacity: 1; filter: none; }
  }
  @keyframes tutSlideDown {
    from { transform: translateY(20px) scale(0.97); opacity: 0; filter: brightness(1.4) blur(2px); }
    to   { transform: translateY(0) scale(1); opacity: 1; filter: none; }
  }

  /* In-game card positioning. Mobile pins it to the bottom (above 64px nav) so
     the wheel + result are never covered. Desktop floats it top-left at a safe
     width since there's room above the wheel anyway. */
  .tut-card-wrap {
    position: fixed;
    z-index: 40;
    left: 0;
    right: 0;
    pointer-events: none;
    padding: 0 12px;
    /* Mobile: pin to bottom above nav */
    bottom: 76px;
    top: auto;
    display: flex;
    justify-content: center;
  }
  @media (min-width: 641px) {
    .tut-card-wrap {
      top: 64px;
      bottom: auto;
      right: auto;
      max-width: 420px;
      justify-content: flex-start;
    }
  }

  .tut-card {
    pointer-events: all;
    width: 100%;
    max-width: 420px;
    border-radius: 14px;
    overflow: hidden;
    background: rgba(9, 9, 15, 0.98);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(240, 192, 64, 0.18);
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(240, 192, 64, 0.04);
  }

  .tut-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .tut-collapse-btn, .tut-skip-btn {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: #9a907b;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .tut-collapse-btn:hover, .tut-skip-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #e4e1ee;
  }
  .tut-skip-btn { margin-left: 4px; }

  .tut-body { padding: 12px 14px 12px; }
  .tut-body-row { display: flex; gap: 10px; }
  .tut-title {
    font-family: 'Cinzel', serif;
    font-size: 0.86rem;
    font-weight: 700;
    color: #ffdf96;
    margin-bottom: 4px;
    letter-spacing: 0.04em;
  }
  .tut-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.67rem;
    color: #9a907b;
    line-height: 1.65;
    white-space: pre-line;
  }
  .tut-expand-btn {
    margin-top: 6px;
    background: none;
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    padding: 0;
  }

  .tut-cta-row {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .tut-hint {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--accent, #f0c040);
    opacity: 0.85;
    letter-spacing: 0.06em;
  }
  .tut-arrow {
    animation: tutArrowBob 1.2s ease-in-out infinite;
    display: inline-block;
  }
  @keyframes tutArrowBob {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(3px); }
  }
  .tut-cta-btn {
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(240, 192, 64, 0.10);
    border: 1px solid;
    font-family: 'Cinzel', serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.18s, transform 0.12s;
    animation: tutCtaPulse 2.4s ease-in-out infinite;
  }
  .tut-cta-btn:hover { background: rgba(240, 192, 64, 0.18); }
  .tut-cta-btn:active { transform: scale(0.96); }
  @keyframes tutCtaPulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--accent, rgba(240,192,64,0.4)); }
    50%      { box-shadow: 0 0 0 6px transparent; }
  }
</style>
