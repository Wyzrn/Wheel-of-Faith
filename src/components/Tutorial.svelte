<script lang="ts">
  // Tutorial overlay — shown to first-time players.
  // step -1 = tutorial inactive (done / skipped)
  // step  0 = welcome modal (fullscreen)
  // step 1–12 = category-keyed bottom cards
  // step 13 = completion toast

  interface Props {
    step: number
    currentCategory?: string
    isRevealed?: boolean
    onGotIt: (nextStep: number) => void
    onSkip: () => void
    onStartGame: () => void  // called by welcome "Let's go!"
  }

  let { step, currentCategory, isRevealed = false, onGotIt, onSkip, onStartGame }: Props = $props()

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
    strength:     'Raw physical force — how hard you hit, what you can lift, and how many walls you walk through.',
    speed:        'Reaction time and movement speed. Also affects how fast your powers activate in combat.',
    agility:      'Flexibility, acrobatics, and evasion. Higher agility = harder to land a hit on you.',
    durability:   'How much punishment you can absorb. Cannot go below zero — you\'re either surviving or you\'re not.',
    iq:           'Intelligence and tactical thinking. Affects magic complexity, trap detection, and how many bad decisions you make.',
    charisma:     'Social presence — persuasion, intimidation, and how quickly people trust (or are terrified of) you.',
    fightingSkill:'Combat technique — the most heavily weighted stat in your overall score. Raw power without skill is just noise.',
    potential:    'Your untapped ceiling — how much stronger you can become with training. Important to fans. Rarely decides fights.',
    energyLevel:  'Ki, mana, chakra, aura — whatever fuels your abilities. More energy = more uses before you run dry.',
    powerMastery: 'How precisely you control your powers. Low mastery = destructive but unstable. High mastery = efficient and lethal.',
    weaponMastery:'Skill with weapons. Race and archetype can bias specific weapon types on top of this base score.',
  }

  // Maps current game state → which tutorial card to show (null = none).
  function resolveCard(s: number, cat: string | undefined, revealed: boolean): CardContent | null {
    if (s <= 0 || s >= 13) return null
    if (!cat) return null

    // Step 1 — Race (before spin)
    if (cat === 'race' && !revealed && s <= 1) return {
      id: 1,
      icon: 'diversity_3',
      title: 'Spin 1: Race',
      body: '50+ races available — from Humans and Halflings to Saiyans, Hollow Arrancars, Eldritch Beings, and literal Gods. Rarer races (lower spawn odds) carry higher stat multipliers, more racial ability spins, and access to exclusive power pools. The wheel decides. Accept it.',
      cta: 'Got it — spin!',
      accent: '#f0c040',
    }

    // Step 2 — Race locked in
    if (cat === 'race' && revealed && s <= 2) return {
      id: 2,
      icon: 'check_circle',
      title: 'Race Locked In',
      body: 'Your race shapes everything ahead:\n\n• Racial Abilities — passive or active traits unique to your race (1–3 spins incoming)\n• Class / Subtype — your racial variant (e.g., Wood Elf vs. High Elf vs. Drow vs. Eladrin). Each unlocks different abilities and stat bonuses\n• Transformation — some races roll a power multiplier: 0.9× to 2.2× on ALL future stats\n• Stat Multipliers — hidden modifiers on your stat wheels (Dragon gets Strength 1.8×; Goblin gets Durability 0.7×)\n• SYNERGY — certain race × archetype combos trigger bonus spins mid-session',
      cta: 'Next spin →',
      accent: '#22c55e',
    }

    // Step 3 — Racial features (class, subtype, transformation, ability)
    if (RACIAL_CATS.has(cat) && s <= 3) return {
      id: 3,
      icon: 'auto_awesome',
      title: 'Racial Features',
      body: 'These spins build your racial identity:\n\n• Class / Subtype — your variant within the race. Each has unique abilities and grants a stat bonus (e.g., Berserker Orc = Strength bonus; Runic Dwarf = Power Mastery bonus)\n• Racial Abilities — passive and active traits. Separate from regular Powers — these are your birthright\n• Transformation (some races) — scales all your stats by a multiplier. Higher transformation = stronger overall character\n\nRarer subtype picks tend to grant better abilities and larger bonuses. The wheel decides which variant you are.',
      cta: 'Got it — spin!',
      accent: '#a78bfa',
    }

    // Step 4 — Archetype
    if (cat === 'archetype' && s <= 4) return {
      id: 4,
      icon: 'military_tech',
      title: 'Spin: Archetype',
      body: 'Your class — what role you fill. Archetypes have types:\n\n• Combat (Warrior, Gladiator, Berserker) — Fighting Skill + Strength\n• Magic (Mage, Warlock, Sorcerer) — Power Mastery + IQ\n• Stealth (Rogue, Assassin, Shinobi) — Agility + Speed\n• Support / Aura (Paladin, Healer, Bard) — Charisma + Potential\n• Chaos (Chaos Gremlin, Berserker, Anti-Hero) — wild bonuses across the board\n\nYour archetype also has its own ability pool and can grant bonus stat spins. Specific race × archetype combos trigger SYNERGY bonuses — watch the announcement bar.',
      cta: 'Got it — spin!',
      accent: '#a78bfa',
    }

    // Step 5 — First stat (shown on any stat category)
    if (STAT_CATS.has(cat) && !revealed && s <= 5) {
      const statDetail = STAT_DETAILS[cat] ?? ''
      return {
        id: 5,
        icon: 'bar_chart',
        title: `Stat: ${cat.replace(/([A-Z])/g, ' $1').trim()}`,
        body: `${statDetail}\n\nStats run 42 grades:\nF–, F, F+ → E, D, C, B, A, S, SS, SSS → Z, ZZ, ZZZ, Celestial, Godly, Primordial\n\nThe label you land on IS your tier — score is embedded in it. Your race shifts the odds: common races average C–B, rare races skew toward S–SSS+. You have 11 stats total.\n\n⚡ Every stat spin has a 5% WILDCARD chance. Watch for it.`,
        cta: 'Got it — spin!',
        accent: '#f0c040',
      }
    }

    // Step 6 — Wildcard (shown after forced wildcard resolves on strength)
    if (cat === 'strength' && revealed && s === 6) return {
      id: 6,
      icon: 'bolt',
      title: '⚡ That Was a Wildcard',
      body: 'A 5% chance on every stat spin that overwrites fate. Possible outcomes:\n\n• Fate\'s Blessing — +3 tiers above your roll\n• Fate\'s Curse — −3 tiers below your roll\n• Chaos Reroll — immediate re-spin, no modifiers\n• Mirror of Glory — copy your highest stat so far\n• Gift of Power — keep your roll AND get a bonus power spin\n• Double-Edged Fate — +4 tiers but a new weakness is added\n• Primordial Ascension — max tier, instantly\n• Frozen Mediocrity — locked to C, no argument\n• Forgotten by Fate — F–, no argument\n\nItem spins (powers, weapons) have a 20% bonus extra-spin wildcard instead.',
      cta: 'Got it →',
      accent: '#f0c040',
    }

    // Step 7 — Powers and elements
    if (cat === 'power' && s <= 7) return {
      id: 7,
      icon: 'bolt',
      title: 'Powers & Elements',
      body: 'Powers are your special abilities. You spin 1–3+ based on race and archetype.\n\nEvery power, ability, and weapon has an Element and Grade:\n\nElements: Fire, Ice, Lightning, Shadow, Arcane, Light, Nature, Poison, Gravity, Time, Cosmic, Soul, Chaos, Blood, Psychic, Sound, Water, Metal, Earth\n\nGrades:\n• D / C — functional, reliable\n• B / A — strong with unique effects\n• S / SS — game-defining\n• SSS+ — world-ending\n• God — you are now the problem\n\nYour race gates which powers can appear. Rarer races unlock exclusive pools.',
      cta: 'Got it — spin!',
      accent: '#fb923c',
    }

    // Step 8 — Weapons
    if (cat === 'weapon' && s <= 8) return {
      id: 8,
      icon: 'swords',
      title: 'Weapons',
      body: 'Weapon types: Melee, Ranged, Magical, Ancient, Exotic, Cursed, and None.\n\nEach weapon has an Element and Grade — higher grade = more broken.\n\nYour race and archetype bias certain types:\n• Dwarves → Ancient melee\n• Goblins → Cursed / Exotic\n• Elves → Ranged / Magical\n• Kryptonians → their bare hands (None)\n\nWeapon Mastery (a stat you\'ll spin soon) measures how well you use whatever you\'re holding. Even a god-tier weapon needs someone competent to hold it.',
      cta: 'Got it — spin!',
      accent: '#64748b',
    }

    // Step 9 — Armor
    if ((cat === 'armor' || cat === 'armorStrength') && s <= 9) return {
      id: 9,
      icon: 'shield',
      title: 'Armor',
      body: 'Armor types: None, Helmet Only, Half-Suit, Full-Suit, Ancient, Exotic, Cursed.\n\nArmor has its own strength tier — land on B+ or above and you unlock armor enchantments. SS+ unlocks multiple enchantments.\n\nArmor Strength is a separate stat wheel that determines the protective power of your armor — even basic armor can be supernaturally durable at high tiers.\n\nHigher-tier armors from rare races have type biases — Orcs tend toward Full-Suit ancient plating, Elves toward Half-Suit or None.',
      cta: 'Got it — spin!',
      accent: '#94a3b8',
    }

    // Step 10 — Weaknesses
    if (cat === 'weakness' && s <= 10) return {
      id: 10,
      icon: 'broken_image',
      title: 'Weaknesses',
      body: 'How many weaknesses you roll depends on your race\'s weakness modifier — anywhere from 0 to 3.\n\nThey\'re permanent. They\'re real. They\'re yours.\n\nMore powerful races tend to have more weaknesses — cosmic balance demands payment. A God-tier character is still vulnerable to something humiliating.\n\nRace-specific weaknesses can be tailored to the race. Some are funnier than others. You\'ll see.',
      cta: 'Got it — spin!',
      accent: '#f87171',
    }

    // Step 11 — Redemption spin
    if (cat === 'redemptionSpin' && s <= 11) return {
      id: 11,
      icon: 'casino',
      title: 'The Redemption Spin',
      body: '25% chance to land Redemption. If you do, a second wheel activates:\n\n• Reroll Your Worst Stat\n• Gain a Bonus Power\n• Lose One Weakness\n• All Stats +1 Tier\n• Double Your Best Stat\n• Demigod Status — all stats +3 tiers (very rare)\n• Reroll Everything: Chaos Edition\n• Plot Armour (Permanent)\n• The Universe Owes You One\n\nEven fate gives second chances. Sometimes.',
      cta: 'Got it — spin!',
      accent: '#c084fc',
    }

    // Step 12 — Title (final spin)
    if (cat === 'title' && s <= 12) return {
      id: 12,
      icon: 'workspace_premium',
      title: 'Final Spin: Title',
      body: 'Your Title is the capstone of your identity — an honorary designation that wraps up who your character is. Their legacy, their reputation, their vibe.\n\nAfter this spin, you\'ll name your legend and your complete character card will be revealed with your overall tier grade.\n\nThe wheel has spoken. Own it.',
      cta: 'Last spin — let\'s go!',
      accent: '#f0c040',
    }

    return null
  }

  let card = $derived(resolveCard(step, currentCategory, isRevealed))

  // Completion toast: briefly visible when step hits 13
  let toastVisible = $state(false)
  $effect(() => {
    if (step === 13) {
      toastVisible = true
      const t = setTimeout(() => { toastVisible = false; onSkip() }, 2200)
      return () => clearTimeout(t)
    }
  })
</script>

<!-- ─── Welcome modal (step 0) ────────────────────────────────────────────── -->
{#if step === 0}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.96); backdrop-filter: blur(20px);"
  >
    <div
      class="obsidian-slab w-full max-w-sm rounded-2xl p-8 text-center relative overflow-hidden"
      style="border: 1px solid rgba(240,192,64,0.3); box-shadow: 0 0 80px rgba(0,0,0,0.9), 0 0 40px rgba(240,192,64,0.06);"
    >
      <div class="noise-overlay"></div>
      <!-- Corner accents -->
      <div class="absolute top-3 left-3 w-6 h-6" style="border-top: 2px solid rgba(240,192,64,0.4); border-left: 2px solid rgba(240,192,64,0.4);"></div>
      <div class="absolute top-3 right-3 w-6 h-6" style="border-top: 2px solid rgba(240,192,64,0.4); border-right: 2px solid rgba(240,192,64,0.4);"></div>
      <div class="absolute bottom-3 left-3 w-6 h-6" style="border-bottom: 2px solid rgba(240,192,64,0.4); border-left: 2px solid rgba(240,192,64,0.4);"></div>
      <div class="absolute bottom-3 right-3 w-6 h-6" style="border-bottom: 2px solid rgba(240,192,64,0.4); border-right: 2px solid rgba(240,192,64,0.4);"></div>

      <div class="relative z-10">
        <span
          class="material-symbols-outlined block"
          style="font-size: 56px; color: #f0c040; font-variation-settings: 'FILL' 1; filter: drop-shadow(0 0 16px rgba(240,192,64,0.5)); margin-bottom: 16px;"
        >casino</span>

        <p class="text-[10px] tracking-[0.3em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">First time here?</p>

        <h2 style="font-family: 'Cinzel', serif; font-size: 1.5rem; font-weight: 900; color: #ffdf96; letter-spacing: 0.08em; line-height: 1.25; margin-bottom: 18px; text-shadow: 0 0 20px rgba(240,192,64,0.3);">
          Welcome to<br/>Wheel of Fate
        </h2>

        <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: #9a907b; line-height: 1.7; margin-bottom: 24px;">
          <p>You'll spin <span style="color: #f0c040; font-weight: 700;">~23+ fate-chosen wheels</span> to build your character from scratch.</p>
          <p class="mt-2">Race. Class. Stats. Powers. Weaknesses. Title.</p>
          <p class="mt-2">The tutorial walks you through <span style="color: #e4e1ee;">each system</span> as it appears — race mechanics, wildcards, elements, grades, weapons, armor, and everything in between.</p>
          <p class="mt-2" style="color: #4e4635; font-style: italic;">Everything is permanent. No take-backs.</p>
        </div>

        <button
          onclick={() => { onStartGame() }}
          class="metal-stamp-gold w-full py-3 rounded-lg relative mb-3"
          style="font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;"
        >
          <div class="l-bracket" style="color: rgba(255,255,255,0.25);"></div>
          Let's Go!
        </button>

        <button
          onclick={onSkip}
          style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: #4e4635; background: none; border: none; cursor: pointer; letter-spacing: 0.1em;"
        >
          Skip tutorial
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── Bottom card (steps 1–12) ──────────────────────────────────────────── -->
{#if card}
  <div
    class="fixed inset-x-0 z-40 flex justify-center px-3"
    style="bottom: 0; pointer-events: none; animation: tutSlideUp 0.3s cubic-bezier(0.34,1.3,0.64,1) forwards;"
  >
    <div
      class="w-full max-w-lg rounded-t-2xl overflow-hidden"
      style="pointer-events: all; background: rgba(9,9,15,0.98); backdrop-filter: blur(20px); border: 1px solid rgba(240,192,64,0.18); border-bottom: none; border-top: 2px solid {card.accent}; box-shadow: 0 -8px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(240,192,64,0.06);"
    >
      <!-- Header bar -->
      <div class="flex items-center gap-2 px-4 py-2.5" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span class="material-symbols-outlined" style="font-size: 13px; color: {card.accent}; font-variation-settings: 'FILL' 1;">school</span>
        <span class="text-[9px] tracking-[0.25em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Tutorial</span>

        <!-- Progress dots (12 steps) -->
        <div class="ml-auto flex gap-1 items-center">
          {#each [1,2,3,4,5,6,7,8,9,10,11,12] as n}
            <div
              class="rounded-full transition-all duration-300"
              style="width: {n === card.id ? 14 : 4}px; height: 4px; background: {n < card.id ? '#4e4635' : n === card.id ? card.accent : '#2a2a38'};"
            ></div>
          {/each}
        </div>

        <button
          onclick={onSkip}
          class="ml-3 text-[9px] tracking-[0.1em] uppercase transition-colors hover:opacity-80"
          style="font-family: 'JetBrains Mono', monospace; color: #4e4635; background: none; border: none; cursor: pointer;"
        >
          Skip
        </button>
      </div>

      <!-- Content -->
      <div class="px-4 pt-3.5 pb-1 flex gap-3.5" style="max-height: 55vh; overflow-y: auto;">
        <span
          class="material-symbols-outlined shrink-0 mt-0.5"
          style="font-size: 22px; color: {card.accent}; font-variation-settings: 'FILL' 1;"
        >{card.icon}</span>
        <div class="flex-1 min-w-0">
          <p style="font-family: 'Cinzel', serif; font-size: 0.88rem; font-weight: 700; color: #ffdf96; margin-bottom: 5px; letter-spacing: 0.04em;">{card.title}</p>
          <p style="font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: #9a907b; line-height: 1.7; white-space: pre-line;">{card.body}</p>
        </div>
      </div>

      <!-- Button row -->
      <div class="px-4 pt-3 pb-4 flex justify-end">
        <button
          onclick={() => onGotIt(card!.id + 1)}
          class="metal-stamp-gold px-5 py-2 rounded-lg text-xs font-bold relative"
          style="font-family: 'Cinzel', serif; letter-spacing: 0.15em; text-transform: uppercase;"
        >
          <div class="l-bracket" style="color: rgba(255,255,255,0.2);"></div>
          {card.cta}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── Completion toast (step 13) ─────────────────────────────────────────── -->
{#if toastVisible}
  <div
    class="fixed top-16 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
    style="animation: tutSlideDown 0.3s ease-out forwards;"
  >
    <div
      class="px-5 py-2.5 rounded-full flex items-center gap-2.5"
      style="background: rgba(9,9,15,0.97); border: 1px solid rgba(240,192,64,0.4); box-shadow: 0 4px 24px rgba(0,0,0,0.7); backdrop-filter: blur(12px);"
    >
      <span class="material-symbols-outlined text-sm" style="color: #f0c040; font-variation-settings: 'FILL' 1;">check_circle</span>
      <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: #f0c040; letter-spacing: 0.12em;">Tutorial complete — you know the system</span>
      <span style="color: #4e4635; font-size: 0.7rem;">✦</span>
    </div>
  </div>
{/if}

<style>
  @keyframes tutSlideUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes tutSlideDown {
    from { transform: translateY(-20px); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }
</style>
