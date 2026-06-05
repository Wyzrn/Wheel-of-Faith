<script lang="ts">
  // Full reference — every feature in the game, in depth. Linked from the
  // landing modal and from Quill's home-overview scene so players have one
  // canonical place to look anything up without searching the codebase or
  // asking strangers. Built as a long scroll with a sticky TOC on the side
  // (mobile: collapsible top drawer) so any section is one tap away.
  import { onMount } from 'svelte'
  import { tick } from 'svelte'

  type Section = { id: string; title: string; icon: string }
  // Section list drives both the TOC and the headings so they stay in sync.
  const SECTIONS: Section[] = [
    { id: 'overview',      title: 'What is this game?',          icon: 'casino' },
    { id: 'spin',          title: 'The Spin',                     icon: 'rotate_right' },
    { id: 'wildcards',     title: 'Wildcards',                    icon: 'bolt' },
    { id: 'tiers',         title: 'Tier Grades',                  icon: 'workspace_premium' },
    { id: 'races',         title: 'Races',                        icon: 'diversity_3' },
    { id: 'archetypes',    title: 'Archetypes',                   icon: 'military_tech' },
    { id: 'stats',         title: 'The 11 Stats',                 icon: 'bar_chart' },
    { id: 'powers',        title: 'Powers & Elements',            icon: 'auto_awesome' },
    { id: 'weapons',       title: 'Weapons',                      icon: 'swords' },
    { id: 'armor',         title: 'Armor',                        icon: 'shield' },
    { id: 'enchantments',  title: 'Enchantments',                 icon: 'auto_fix_high' },
    { id: 'weaknesses',    title: 'Weaknesses',                   icon: 'broken_image' },
    { id: 'redemption',    title: 'Redemption Spin',              icon: 'all_inclusive' },
    { id: 'twists',        title: 'Twists',                       icon: 'change_history' },
    { id: 'corruption',    title: 'Corruption',                   icon: 'dark_mode' },
    { id: 'limitBreak',    title: 'Limit Break',                  icon: 'speed' },
    { id: 'specials',      title: 'Devil Fruits & Possession',    icon: 'science' },
    { id: 'card',          title: 'The Character Card',           icon: 'badge' },
    { id: 'ascension',     title: 'Ascension Mode',               icon: 'trending_up' },
    { id: 'crystals',      title: 'Crystals',                     icon: 'diamond' },
    { id: 'endless',       title: 'Endless Mode',                 icon: 'all_inclusive' },
    { id: 'rivals',        title: 'Rivals Mode',                  icon: 'sports_kabaddi' },
    { id: 'ranks',         title: 'Rivals Ranks',                 icon: 'leaderboard' },
    { id: 'clans',         title: 'Clans',                        icon: 'flag' },
    { id: 'wars',          title: 'Guild Wars',                   icon: 'gavel' },
    { id: 'friends',       title: 'Friends',                      icon: 'group' },
    { id: 'profile',       title: 'Profile & Hall of Fame',       icon: 'account_circle' },
    { id: 'gallery',       title: 'Hall of Fates (Gallery)',      icon: 'photo_library' },
    { id: 'leaderboard',   title: 'Hall of Champions',            icon: 'emoji_events' },
    { id: 'challenges',    title: 'Daily Challenges',             icon: 'task_alt' },
    { id: 'achievements',  title: 'Achievements',                 icon: 'verified' },
    { id: 'replays',       title: 'Battle Replays',               icon: 'movie' },
    { id: 'currencies',    title: 'Fate Shards & Gems',           icon: 'paid' },
    { id: 'shop',          title: 'The Arcane Shop',              icon: 'storefront' },
    { id: 'gamepasses',    title: 'Gamepasses (full list)',       icon: 'verified_user' },
    { id: 'guide',         title: 'Quill, your NPC guide',        icon: 'history_edu' },
    { id: 'sharing',       title: 'Sharing & Accounts',           icon: 'share' },
    { id: 'settings',      title: 'Settings',                     icon: 'settings' },
  ]

  // Highlighted section in the TOC. Updated by scroll observer.
  let activeId = $state<string>('overview')
  // Mobile TOC drawer state.
  let tocOpen = $state(false)
  // Search box — filters the TOC list. Matches on title (case-insensitive).
  let q = $state('')
  let filteredSections = $derived(
    q.trim().length === 0
      ? SECTIONS
      : SECTIONS.filter(s => s.title.toLowerCase().includes(q.toLowerCase()))
  )

  function scrollTo(id: string) {
    tocOpen = false
    const el = document.getElementById(`sec-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  onMount(() => {
    // IntersectionObserver-based active-section tracking. We pick the
    // first section whose top is within the upper third of the viewport.
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting)
      if (visible.length === 0) return
      // Closest to the top of the viewport
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      const id = visible[0].target.id.replace(/^sec-/, '')
      if (id) activeId = id
    }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 })
    for (const s of SECTIONS) {
      const el = document.getElementById(`sec-${s.id}`)
      if (el) observer.observe(el)
    }
    // Allow ?section=foo deep-link to jump on load.
    const params = new URLSearchParams(window.location.search)
    const want = params.get('section')
    if (want) {
      tick().then(() => scrollTo(want))
    }
    return () => observer.disconnect()
  })
</script>

<svelte:head>
  <title>How to Play — Wheel of Destiny</title>
  <meta name="description" content="Every feature in Wheel of Destiny, explained in depth. Spin mechanics, races, stats, powers, Ascension, Rivals, Clans, currencies, gamepasses, and more." />
</svelte:head>

<main class="htp-page">
  <header class="htp-header">
    <a href="/" class="htp-back" aria-label="Back to home">
      <span class="material-symbols-outlined">arrow_back</span>
    </a>
    <div class="htp-title">
      <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">menu_book</span>
      <h1>How to Play</h1>
    </div>
    <button class="htp-toc-toggle md-hide" onclick={() => tocOpen = !tocOpen} aria-label="Toggle table of contents">
      <span class="material-symbols-outlined">{tocOpen ? 'close' : 'list'}</span>
    </button>
  </header>

  <div class="htp-shell">
    <!-- Sticky TOC — sidebar on desktop, slide-in drawer on mobile -->
    <aside class="htp-toc" class:open={tocOpen}>
      <div class="htp-toc-search">
        <span class="material-symbols-outlined">search</span>
        <input type="text" bind:value={q} placeholder="Search sections…" />
        {#if q}
          <button onclick={() => q = ''} aria-label="Clear search"><span class="material-symbols-outlined">close</span></button>
        {/if}
      </div>
      <nav class="htp-toc-list">
        {#each filteredSections as s}
          <button class="htp-toc-item" class:active={activeId === s.id} onclick={() => scrollTo(s.id)}>
            <span class="material-symbols-outlined" style="font-size: 16px;">{s.icon}</span>
            <span>{s.title}</span>
          </button>
        {:else}
          <p class="htp-toc-empty">No sections match.</p>
        {/each}
      </nav>
      <p class="htp-toc-footer">{SECTIONS.length} sections · last updated 2026-06</p>
    </aside>

    <!-- Main body -->
    <article class="htp-body">
      <section id="sec-overview" class="htp-section">
        <h2><span class="material-symbols-outlined">casino</span> What is this game?</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Spin a wheel ~23 times to randomly generate a character — race, stats, powers, weapons, weaknesses, a title. Every result is permanent. Use the character you forge to battle other players, climb procedurally-scaling worlds in Ascension, or just share the card with friends.</p>
        <p>Wheel of Destiny is a browser-based character creation engine. There is no story, no levels in the traditional sense — the core loop is <strong>roll, see what you got, use that character somewhere</strong>. The genre is closest to a gacha + auto-battler hybrid, except the gacha is your own consent and every roll is committed.</p>
        <p>Three places to use a character once forged:</p>
        <ul>
          <li><strong>Rivals</strong> — auto-resolved 1v1 against other players.</li>
          <li><strong>Ascension</strong> — long-form campaign of 16 worlds, with a roster, gem economy, crystal drops, and Endless Mode.</li>
          <li><strong>Share</strong> — every character has a public URL and an optional Gallery publish.</li>
        </ul>
      </section>

      <section id="sec-spin" class="htp-section">
        <h2><span class="material-symbols-outlined">rotate_right</span> The Spin</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> The character is built across ~23 sequential wheels. The label you land on IS the result. Stats use a 28-grade tier system from F– up to Absolute. Tap the wheel (or the spin button) to fire each one.</p>
        <p>The wheels fire in a fixed order:</p>
        <ol>
          <li><strong>Race</strong> — sets stat multipliers, racial ability count, weakness probability, exclusive power pool.</li>
          <li><strong>Race-injected wheels</strong> (1–3, race-dependent) — e.g. Sun Exposure for Krystalians, Rage Threshold for Zenithians, Wish-Orb Lineage for Verdantians. Around 100 unique race wheels in total.</li>
          <li><strong>Racial Abilities</strong> (1–3) — innate species traits. Immune to Wildcards.</li>
          <li><strong>Archetype</strong> — your combat role (Combat / Magic / Stealth / Support / Chaos).</li>
          <li><strong>Archetype Abilities</strong> — 1–2 role-specific bonus traits.</li>
          <li><strong>11 Stats</strong> — Strength, Speed, Agility, Durability, IQ, Charisma, Fighting Skill, Potential, Energy Level, Power Mastery, Weapon Mastery.</li>
          <li><strong>Powers</strong> (1–3+) — element-tagged abilities, race-gated pool.</li>
          <li><strong>Weapon</strong> (type + actual weapon + sometimes enchantment).</li>
          <li><strong>Armor</strong> (type + strength + sometimes enchantment).</li>
          <li><strong>Weaknesses</strong> (0–3, race-dependent).</li>
          <li><strong>Redemption Spin</strong> (25% chance to fire).</li>
          <li><strong>Backstory</strong> — generated narrative snapshot.</li>
          <li><strong>Title</strong> — the final designation.</li>
          <li><strong>Twists, Corruption, Limit Breaks, Possessions, Devil Fruits</strong> may splice in extra spins along the way depending on race + archetype + outcomes.</li>
        </ol>
        <p>Many race-archetype combinations trigger bonus spin chains automatically. Watch the announcement bar above the wheel — it names what fired and why.</p>
      </section>

      <section id="sec-wildcards" class="htp-section">
        <h2><span class="material-symbols-outlined">bolt</span> Wildcards</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Every stat spin has a 5% chance (10% with the 2× Luck gamepass) to fire a Wildcard that rewrites the result. The screen flashes when it triggers.</p>
        <p>Wildcard outcomes:</p>
        <ul>
          <li><strong>Fate's Blessing</strong> — your roll +3 tiers.</li>
          <li><strong>Fate's Curse</strong> — your roll −3 tiers.</li>
          <li><strong>Chaos Reroll</strong> — immediate re-spin with no modifiers.</li>
          <li><strong>Mirror of Glory</strong> — copy your highest stat rolled so far.</li>
          <li><strong>Gift of Power</strong> — keep the roll AND get a bonus power spin.</li>
          <li><strong>Double-Edged Fate</strong> — +4 tiers, but a weakness is added.</li>
          <li><strong>Primordial Ascension</strong> — forced to absolute maximum tier.</li>
          <li><strong>Frozen Mediocrity</strong> — locked to C (the punishment tier).</li>
          <li><strong>Forgotten by Fate</strong> — locked to F– (the floor).</li>
          <li><strong>Shared Destiny</strong> — copy your most recently rolled stat.</li>
        </ul>
        <p>Item spins (powers, weapons, armor) have a separate 20% wildcard chance (40% with 2× Luck) that triggers an extra bonus spin of the same category, not a stat override.</p>
      </section>

      <section id="sec-tiers" class="htp-section">
        <h2><span class="material-symbols-outlined">workspace_premium</span> Tier Grades</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> The grade ladder runs F– → F → F+ → E– → E → E+ → … → SSS+ → Z- → … → Celestial → Godly → Primordial → Absolute. The label on the wheel segment IS the tier. Your final overall tier is a weighted score across all stats, powers, weapons, and armor — Fighting Skill weighted heaviest.</p>
        <p>Full ladder, ordered weakest to strongest:</p>
        <p class="htp-mono">F– · F · F+ · E– · E · E+ · D– · D · D+ · C– · C · C+ · B– · B · B+ · A– · A · A+ · S– · S · S+ · SS– · SS · SS+ · SSS– · SSS · SSS+ · Z– · Z · Z+ · ZZ– · ZZ · ZZ+ · ZZZ– · ZZZ · ZZZ+ · Celestial– · Celestial · Celestial+ · Godly– · Godly · Primordial · Absolute</p>
        <p>Absolute tier is extremely rare and usually requires multiple stacked bonuses (Transformation × Redemption × race multipliers × Wildcards) to reach.</p>
      </section>

      <section id="sec-races" class="htp-section">
        <h2><span class="material-symbols-outlined">diversity_3</span> Races</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> 50+ races. Your race sets stat multipliers, racial ability count (1–3), the size of your exclusive power pool, the number of weaknesses you'll roll (0–3), and which race-specific wheels splice in.</p>
        <p>Rarity tiers, weakest spawn to rarest:</p>
        <ul>
          <li><strong>Common</strong> — Human, Beastfolk, Dwarf, Elf, Goblin, Orc, etc. Reliable multipliers, fewer weaknesses, smaller exclusive pools.</li>
          <li><strong>Uncommon</strong> — Werewolf, Vampire, Witch, Cyborg, Mutant, etc. Modest boosts and trade-offs.</li>
          <li><strong>Rare</strong> — Kitsune, Cerebrosaur, Ent, Construct, Shapeshifter, etc.</li>
          <li><strong>Epic</strong> — Phoenix, Lich, Aesir, Demon, Angel, Mythological Creature, etc.</li>
          <li><strong>Legendary</strong> — Zenithian, Krystalian, Drakekin, Verdantian, Shinigami, Mechshifter, Null, Lord of Time, etc.</li>
          <li><strong>Mythic</strong> — Phantom Bonded, Reality Anchor, Celestials, etc. Largest exclusive pools, biggest weakness costs.</li>
          <li><strong>Divine</strong> — God, Primordial Entity, Cosmic Horror, Void Sovereign. Floor stats start above F. Weakness count maxes at 3.</li>
        </ul>
        <p>A race's <strong>minStatTier</strong> floors every stat you roll — e.g. a Beast can't go lower than C–. Stat-curve weights shift to make this work without changing the segment labels.</p>
        <p>Every race may inject 1–3 unique custom wheels (Sun Exposure, Soul-Blade Bond, Aetherium Tier, Wish-Orb Lineage, etc.). Each names its own segments and applies its own stat bonuses.</p>
      </section>

      <section id="sec-archetypes" class="htp-section">
        <h2><span class="material-symbols-outlined">military_tech</span> Archetypes</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Your combat role. Adds 1–2 exclusive ability spins and can trigger race-synergy bonus spins automatically.</p>
        <p>Archetype families:</p>
        <ul>
          <li><strong>Combat</strong> — Warrior, Gladiator, Berserker, Warlord, Dawnbringer. Stat bias: Fighting Skill + Strength. Pool: martial techniques, weapon arts.</li>
          <li><strong>Magic</strong> — Mage, Warlock, Sorcerer, Mystic, Eldritch Scholar. Stat bias: Power Mastery + IQ. Pool: spells, curses, conjuration.</li>
          <li><strong>Stealth</strong> — Rogue, Assassin, Shadowblade, Phantom Bonded. Stat bias: Agility + Speed. Pool: ambush, illusion, sleight.</li>
          <li><strong>Support</strong> — Paladin, Healer, Tactician, Bard. Stat bias: Charisma + Potential. Pool: buffs, heals, auras.</li>
          <li><strong>Chaos</strong> — Anti-Hero, Chaos Gremlin, Wild Card. Unpredictable bonuses across the board.</li>
        </ul>
        <p>Race + archetype combos can fire automatic bonus spins. A Combat archetype on a Dragon → absurd strength. A Magic archetype on a Construct → energy efficiency. Watch the announcement bar.</p>
      </section>

      <section id="sec-stats" class="htp-section">
        <h2><span class="material-symbols-outlined">bar_chart</span> The 11 Stats</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> All 11 stats are rolled, each gated by race tier minimums. Fighting Skill is the most heavily weighted in overall tier. Power Mastery and Potential are the second-weighted pair.</p>
        <ul>
          <li><strong>Strength</strong> — raw physical force. Melee damage in Ascension battles.</li>
          <li><strong>Speed</strong> — initiative + ability cooldown. High Speed acts first.</li>
          <li><strong>Agility</strong> — evasion + aerial mobility. Dodge chance multiplier.</li>
          <li><strong>Durability</strong> — passive damage reduction.</li>
          <li><strong>IQ</strong> — magic complexity + counter-play + opening recognition.</li>
          <li><strong>Charisma</strong> — Support-archetype scaling, ally rally, intimidation.</li>
          <li><strong>Fighting Skill</strong> — combat technique. Heaviest-weighted in overall tier.</li>
          <li><strong>Potential</strong> — your untapped ceiling. Long-term Ascension scaling.</li>
          <li><strong>Energy Level</strong> — ability pool capacity. Sustains in long fights.</li>
          <li><strong>Power Mastery</strong> — precision + stability of your powers.</li>
          <li><strong>Weapon Mastery</strong> — skill with whatever weapon you rolled.</li>
        </ul>
        <p>A 12th stat — <strong>Armor Strength</strong> — comes from your armor's own spin, not as a base stat.</p>
      </section>

      <section id="sec-powers" class="htp-section">
        <h2><span class="material-symbols-outlined">auto_awesome</span> Powers & Elements</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> 1–3+ powers, each with an Element and a Grade. Race + archetype gate the pool. In Ascension, element vs. enemy weakness multiplies damage.</p>
        <p>Elements: Fire, Ice, Lightning, Shadow, Arcane, Holy, Nature, Poison, Gravity, Time, Cosmic, Soul, Chaos, Blood, Psychic, Sound, Water, Metal, Earth, Void, Wind.</p>
        <p>Grades: D / C — functional. B / A — fight-defining. S / SS — story-altering. SSS / SSS+ — world-ending. God — you are now the problem.</p>
        <p>1,000+ unique powers across all pools, ranging from textbook (Telekinesis, Pyrokinesis) to character-defining (Resurgence Surge, Mantle of Leadership) to deeply ridiculous.</p>
      </section>

      <section id="sec-weapons" class="htp-section">
        <h2><span class="material-symbols-outlined">swords</span> Weapons</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Weapon Type spins first, then the actual weapon. Race biases which types appear. Equip on roster characters in Ascension to raise damage output.</p>
        <p>Types: Melee, Ranged, Magical, Ancient, Exotic, Cursed, None.</p>
        <p>500+ unique weapons — from Hammer of Thor and Excalibur down to "Pineapple" and "Stick (Hostile)". Each weapon has its own element and grade.</p>
        <p>Race-weapon tendencies:</p>
        <ul>
          <li>Dwarves → Ancient melee</li>
          <li>Elves → Ranged or Magical</li>
          <li>Goblins → Cursed or Exotic</li>
          <li>Krystalians → often None (they ARE the weapon)</li>
          <li>Dragons → Ancient or Exotic</li>
        </ul>
        <p>Cursed weapons add to your hidden Corruption score. See the Corruption section.</p>
      </section>

      <section id="sec-armor" class="htp-section">
        <h2><span class="material-symbols-outlined">shield</span> Armor</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Three spins — Armor Type, the specific Armor, and Armor Strength. Strength is independent of type.</p>
        <p>Types: None, Helmet Only, Half-Suit, Full-Suit, Ancient, Exotic, Cursed.</p>
        <p>Armor Strength is rolled separately. A basic Helmet at SSS+ Strength is divine protection. A Full-Suit at F– is decorative tin.</p>
        <p>Race biases:</p>
        <ul>
          <li>Orcs → Full-Suit ancient plating.</li>
          <li>Elves → Half-Suit or None (rely on agility).</li>
          <li>Krystalians → almost never wear armor.</li>
        </ul>
        <p>In Ascension, equipped armor reduces incoming damage. Higher grades stack meaningfully.</p>
      </section>

      <section id="sec-enchantments" class="htp-section">
        <h2><span class="material-symbols-outlined">auto_fix_high</span> Enchantments</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Weapons and armor of B+ grade or higher may earn enchantments — passive layers that grant elemental affinities, damage reduction, regeneration, or other traits.</p>
        <p>Slot count rises with grade. SS+ items may carry several enchantments simultaneously. Enchantments are rolled on dedicated extra wheels that splice in after the base item resolves.</p>
      </section>

      <section id="sec-weaknesses" class="htp-section">
        <h2><span class="material-symbols-outlined">broken_image</span> Weaknesses</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Race determines how many weaknesses you roll (0–3). They are permanent and public. In Ascension battles, enemies deal bonus damage by hitting your weakness's element.</p>
        <p>500+ weaknesses, race-weighted. Some are classics (Silver, Sunlight, Iron). Some are deeply specific. Some are humiliating. The wheel makes no apologies.</p>
        <p>Only the <strong>Lose One Weakness</strong> Redemption Spin outcome can permanently remove a weakness once rolled.</p>
        <p>The Revenge Protocol gamepass softens the loss column — you still earn 50% of gem drops even when defeated by a weakness exploit.</p>
      </section>

      <section id="sec-redemption" class="htp-section">
        <h2><span class="material-symbols-outlined">all_inclusive</span> Redemption Spin</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> 25% base chance to fire near the end of creation. If it triggers, a second wheel grants a powerful bonus. If it doesn't, the game moves on — no retry.</p>
        <p>Redemption outcomes:</p>
        <ul>
          <li><strong>Reroll Worst Stat</strong> — your lowest stat re-spins.</li>
          <li><strong>Bonus Power</strong> — an extra power spin fires.</li>
          <li><strong>Lose One Weakness</strong> — permanently remove a weakness.</li>
          <li><strong>All Stats +1 Tier</strong> — every stat bumps one grade.</li>
          <li><strong>Double Best Stat</strong> — highest stat doubles.</li>
          <li><strong>Demigod Status</strong> — ALL stats +3 tiers (very rare).</li>
          <li><strong>Chaos Reroll Everything</strong> — all 11 stats re-spin (bonuses preserved).</li>
          <li><strong>Plot Armour</strong> — universal passive defensive trait added.</li>
          <li><strong>The Universe Owes You One</strong> — a randomly-selected powerful bonus.</li>
          <li>~9 more outcomes across various flavors.</li>
        </ul>
      </section>

      <section id="sec-twists" class="htp-section">
        <h2><span class="material-symbols-outlined">change_history</span> Twists</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Race-flavored bonus wheels that splice in mid-creation. Zenithians get Power Level, Benders get Element, Gods get Worshipper Count, and ~18 more.</p>
        <p>21+ twist pools, each a single permanent trait added to the character. Triggered by your race or archetype reaching a certain combination. Always shown in a distinct accent color so you know a twist is firing.</p>
      </section>

      <section id="sec-corruption" class="htp-section">
        <h2><span class="material-symbols-outlined">dark_mode</span> Corruption</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Cursed weapons, cursed armor, and certain weaknesses accrue a hidden Corruption score. Cross the threshold (8+) and a forced Corruption Reveal spin fires at the end of creation.</p>
        <p>Corruption outcomes range from minor flavor (a passive curse aura) to character-defining shifts (an entire identity reroll for chaos). The reveal happens after the Title spin so the character is "complete" before corruption reshapes them.</p>
      </section>

      <section id="sec-limitBreak" class="htp-section">
        <h2><span class="material-symbols-outlined">speed</span> Limit Break</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> When a stat lands at the top of its possible range, a Limit Break may trigger — a chance to push past the cap.</p>
        <p>If Limit Break fires, a Limit Break Level wheel determines how far past the cap you went. Levels run 1, 3, 10 — each adds a tier to the breaking stat. Race influences the trigger odds (the limitBreakOdds field on each race definition).</p>
      </section>

      <section id="sec-specials" class="htp-section">
        <h2><span class="material-symbols-outlined">science</span> Devil Fruits & Possession</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Two race-locked specials. Devil Fruits grant named power-sets. Possession lets a second race ride along inside your character.</p>
        <p><strong>Devil Fruits</strong> — race-locked named powers. The fruit's name is part of the flavor; the power-set it grants is layered onto your hero. Spliced in when your race is on the eligible list.</p>
        <p><strong>Possession</strong> — a second race fused with your first. Two wheels: Possession Race (who) and Possession Strength (how firmly). Strong possessions grant access to a small slice of the possessor's pool. Weak possessions just whisper.</p>
      </section>

      <section id="sec-card" class="htp-section">
        <h2><span class="material-symbols-outlined">badge</span> The Character Card</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> The final result — everything you rolled, on one card. Race, stats, powers, weapons, armor, weaknesses, backstory, title, overall tier, and an AI-generated portrait (if your account has portraits enabled).</p>
        <p>Each card has:</p>
        <ul>
          <li>A <strong>Share button</strong> — copies a public URL anyone can open.</li>
          <li>A <strong>Replay button</strong> — walks through all the spins, one at a time, exactly as they happened.</li>
          <li>A <strong>Send to Rivals button</strong> — launches a duel with this character preselected.</li>
          <li><strong>Publish to Gallery</strong> — adds the card to the public Hall of Fates.</li>
          <li><strong>Remove a spun item</strong> — every power, weapon, and armor in the expand panel has a remove button.</li>
        </ul>
      </section>

      <section id="sec-ascension" class="htp-section">
        <h2><span class="material-symbols-outlined">trending_up</span> Ascension Mode</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Long-form campaign. Four save slots, each independent. Climb 16 worlds (F → Absolute) of 20 battles each. Spend daily spins to forge heroes, equip crystal drops, beat bosses, earn gems, climb forever.</p>
        <p>Per save slot, you get:</p>
        <ul>
          <li><strong>10 free spins per day</strong>, regenerating every 3 hours. Daily Booster gamepass doubles the cap to 20.</li>
          <li><strong>16 Worlds</strong> — F → E → D → C → B → A → S → SS → SSS → Z → ZZ → ZZZ → Celestial → Godly → Primordial → Absolute.</li>
          <li><strong>20 battles per world</strong>. Win drops gems, XP, and crystal containers.</li>
          <li><strong>A roster</strong> of forged heroes — Common, Hero (multiplied stats), or Legend (multiplied higher). Max 20 by default, expandable with the Expanded Roster gamepass.</li>
          <li><strong>Crystal inventory</strong> — open container crystals to reveal random powers, weapons, and armor.</li>
          <li><strong>Stat Crystals</strong> — buy with gems or Fate Shards, apply to a hero to permanently raise a single stat tier.</li>
          <li><strong>Gem economy</strong> — earned by winning battles or selling heroes; spent on shop items or extra spins.</li>
        </ul>
        <p>Each world has a minimum stat tier requirement on heroes you bring. Equipped powers, weapons, armor, and stat crystals all factor into battle damage calculations.</p>
      </section>

      <section id="sec-crystals" class="htp-section">
        <h2><span class="material-symbols-outlined">diamond</span> Crystals</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Two kinds. Container Crystals drop from battles and unseal random powers, weapons, or armor. Stat Crystals permanently raise a single stat tier on one hero.</p>
        <p><strong>Container Crystals</strong> — Common, Uncommon, Rare, Epic, Legendary, Mythic, Divine. Higher grades contain higher-grade contents. Open from the Inventory tab in a save slot. Equip whatever you reveal onto a roster hero. Dismantle the rest for gems.</p>
        <p><strong>Stat Crystals</strong> — Common (+1 tier), Elite (+2–3 tiers), Legendary (+4–5 tiers). Buy from the Arcane Shop with Fate Shards, or from a slot's Shop with gems. Apply via tapping a hero, then tapping the crystal.</p>
        <p>The slot Roster auto-sorts by overall grade in the upgrade picker so you can always pour crystals into your strongest heroes first.</p>
      </section>

      <section id="sec-endless" class="htp-section">
        <h2><span class="material-symbols-outlined">all_inclusive</span> Endless Mode</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Unlocked when you complete World 3. Waves without end. Heroes carry damage between waves. Your deepest wave is recorded on the global leaderboard.</p>
        <p>Endless never ends — the math just keeps scaling. Bring your strongest team and stat-crystalled key fighters. Revival is rare. Bragging rights are forever.</p>
      </section>

      <section id="sec-rivals" class="htp-section">
        <h2><span class="material-symbols-outlined">sports_kabaddi</span> Rivals Mode</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Auto-resolved 1v1 battles. Three formats: Local (share a device), Online (matchmade strangers), Bot Battle (when no online opponent appears). Wins climb your Rivals rank.</p>
        <p>Battle resolution accounts for: all 11 stats, all powers (with element matchup multipliers vs. enemy weaknesses), weapon damage, armor strength + enchantments, equipped Ascension items (powers, weapons, armor, stat crystals), and a critical-hit roll.</p>
        <p>Battle speed is configurable — 1×, 2×, 5×, 10×, and 20× (Instant). Instant is NOT a skip; the engine still runs the full simulation, just at maximum speed.</p>
        <p>VFX include screen flashes on crits (white) and killing blows (red), element-tinted flashes on big spells, and arena shakes on big hits.</p>
        <p>In Rivals mode, gamepasses that affect spin outcomes (Blessed Wheel, Double Luck) are <strong>suppressed</strong> for fairness. Combat gamepasses (Crit Surge) still apply.</p>
      </section>

      <section id="sec-ranks" class="htp-section">
        <h2><span class="material-symbols-outlined">leaderboard</span> Rivals Ranks</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> 10 ranked tiers — Iron, Bronze, Silver, Gold, Platinum, Diamond, Master, Hero, Legend, Paragon. MMR rises with wins, falls with losses.</p>
        <p>Each tier has its own crest, visible on your profile and in clan boards. Higher tiers unlock cosmetic flair. Hero, Legend, and Paragon ranks get a glowing border on their character cards in battle.</p>
        <p>Cloud autosave persists ranked progress at 7 checkpoint events so a disconnect never costs you progress.</p>
      </section>

      <section id="sec-clans" class="htp-section">
        <h2><span class="material-symbols-outlined">flag</span> Clans</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Bands of up to 50 players under one banner. Found a clan or join an existing one. Chat, share top characters, and wage Guild Wars together.</p>
        <p>Three join types:</p>
        <ul>
          <li><strong>Open</strong> — anyone meeting the minimum-wins requirement can join immediately.</li>
          <li><strong>Invite Only</strong> — must request, leader/co-leader/elder must accept.</li>
          <li><strong>Closed</strong> — no new members. Re-open from settings if needed.</li>
        </ul>
        <p>Four roles:</p>
        <ul>
          <li><strong>Leader</strong> — full control. Promote, demote, kick, transfer, disband.</li>
          <li><strong>Co-Leader</strong> — manage members, promote/demote up to Elder, edit settings.</li>
          <li><strong>Elder</strong> — kick members, accept join requests.</li>
          <li><strong>Member</strong> — chat, contribute to wars.</li>
        </ul>
        <p>Each clan has a name (3–32 chars, unique), a tag (2–5 chars, all caps, unique), a crest emoji, a description, and a motto-of-the-day. Founding costs nothing.</p>
        <p>Founding requires you to own at least one character (a war-readiness gate).</p>
      </section>

      <section id="sec-wars" class="htp-section">
        <h2><span class="material-symbols-outlined">gavel</span> Guild Wars</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Scheduled clan-vs-clan battles. Each member commits a 3-character Attack team and a 3-character Defense team. Damage is tallied; higher total wins.</p>
        <p>Bracket sizes: 5v5, 10v10, 15v15, 20v20. The Leader or Co-Leader sounds the war horn and selects a size. The matchmaker pairs against an opposing clan of similar MMR.</p>
        <p>War phases: Searching → Prep → Active → Resolved. Cancel is free during Searching, binding once Prep begins.</p>
        <p>Members must own each character on their war teams — no borrowing from clanmates.</p>
        <p>Clan MMR rises and falls with war results. Climbing the clan ranks unlocks bigger brackets and louder bragging rights.</p>
      </section>

      <section id="sec-friends" class="htp-section">
        <h2><span class="material-symbols-outlined">group</span> Friends</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Add other Spinners by username. See their online status. Challenge them to a Rivals duel from their profile.</p>
        <p>Friend requests show outgoing and incoming on a Requests tab. Accept brings them in immediately; decline removes silently; cancel withdraws your own request.</p>
        <p>Online status uses a WebSocket presence connection that opens while you're logged in. A green dot means they're likely to answer a challenge promptly.</p>
      </section>

      <section id="sec-profile" class="htp-section">
        <h2><span class="material-symbols-outlined">account_circle</span> Profile & Hall of Fame</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Your standing — Rivals wins, ascension peak, hall of fame (top 5 characters), friend count, clan affiliation, recent activity. Visitors can challenge you here.</p>
        <p>Edit your bio and title from the Edit panel. Pin up to 5 characters to the Hall of Fame — these are the cards that appear when someone visits your profile.</p>
        <p>The activity feed below tracks your recent battles, Ascension milestones, notable rolls, and clan events.</p>
      </section>

      <section id="sec-gallery" class="htp-section">
        <h2><span class="material-symbols-outlined">photo_library</span> Hall of Fates (Gallery)</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Public gallery of every character anyone has published. Filter by race, archetype, or tier. Sort by recent or by grade.</p>
        <p>Publish from inside any character's card via the Publish button. Once published, the card is visible at a public URL and indexed in the gallery feed.</p>
      </section>

      <section id="sec-leaderboard" class="htp-section">
        <h2><span class="material-symbols-outlined">emoji_events</span> Hall of Champions (Leaderboard)</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Players ranked by Rivals wins. Weekly and all-time tabs. Top 3 wear crowns on their profiles.</p>
        <p>The weekly board resets each Monday at 00:00 UTC. The all-time board never resets.</p>
        <p>Tapping any row opens that player's profile, where you can challenge them directly.</p>
      </section>

      <section id="sec-challenges" class="htp-section">
        <h2><span class="material-symbols-outlined">task_alt</span> Daily Challenges</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Three small tasks rotating daily at 00:00 UTC. Each pays Fate Shards. Up to 175 Shards per day if you complete all three.</p>
        <p>Sample task types: spin 5 characters, win 2 Rivals matches, equip a crystal, climb a level in Ascension, send a friend challenge.</p>
        <p>Tasks track in the background — no manual claim required mid-task. Tap a completed card to claim the Shard payout.</p>
      </section>

      <section id="sec-achievements" class="htp-section">
        <h2><span class="material-symbols-outlined">verified</span> Achievements</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Milestones across every feature. Some pay Fate Shards on completion. Some are pride-only.</p>
        <p>Categories include: spin counts, race collection, tier-grade benchmarks, Rivals wins, Ascension worlds beaten, crystal openings, clan participation, social interactions, and meta-achievements.</p>
        <p>Each achievement has tiers (Bronze → Silver → Gold → Platinum → Mythic). Progress tracks automatically.</p>
      </section>

      <section id="sec-replays" class="htp-section">
        <h2><span class="material-symbols-outlined">movie</span> Battle Replays</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Every Rivals battle is recorded. Replay-watch the swings, crits, deflections, killing blows exactly as they happened.</p>
        <p>Newest replays sit at the top. Older ones age off after a retention window — save the ones you want to keep with the Share button to lock them in.</p>
        <p>Each replay carries its own URL and is shareable to anyone, account or no account.</p>
      </section>

      <section id="sec-currencies" class="htp-section">
        <h2><span class="material-symbols-outlined">paid</span> Fate Shards & Gems</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Two currencies. Fate Shards are global and forever. Gems are per-Ascension-slot.</p>
        <p><strong>Fate Shards (◆)</strong> — earned from Daily Challenges, Ascension battles, and Achievements. Spent in the Arcane Shop on Gamepasses and Stat Crystals. Never reset, never expire.</p>
        <p><strong>Gems (💎)</strong> — per-slot. Earned by selling roster characters (+25% with Sell Bonus gamepass) and winning Ascension battles. Spent in a slot's local Shop on Stat Crystals and extra spins.</p>
      </section>

      <section id="sec-shop" class="htp-section">
        <h2><span class="material-symbols-outlined">storefront</span> The Arcane Shop</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Trades Fate Shards for two kinds of relic: Gamepasses (permanent boons) and Stat Crystals (apply to any hero).</p>
        <p>Stat Crystals here come in three grades — Common, Elite, Legendary — buyable without daily limit. The slot Shop is a different storefront with its own gem prices.</p>
        <p>Every purchase is permanent. There are no consumables (well, except for Stat Crystals themselves, which are consumed on application).</p>
      </section>

      <section id="sec-gamepasses" class="htp-section">
        <h2><span class="material-symbols-outlined">verified_user</span> Gamepasses (full list)</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Permanent upgrades bought with Fate Shards. Each is a single one-time purchase. Categorized by what they affect.</p>
        <p><strong>Wheel / spin gamepasses:</strong></p>
        <ul>
          <li><strong>2× Luck</strong> — Wildcard chance doubled (5% → 10%) on stat spins; bonus-spin chance on items doubled (20% → 40%).</li>
          <li><strong>Daily Booster</strong> — Ascension daily spin cap doubled (10 → 20).</li>
          <li><strong>Reroll Insurance</strong> — first F-/F result on a stat is automatically rerolled once per character.</li>
          <li><strong>Cursed Wheel</strong> — adds cursed weapons/armor to your pool at higher frequency.</li>
          <li><strong>Boss Magnet</strong> — Ascension boss drops are upgraded one tier on average.</li>
        </ul>
        <p><strong>Battle gamepasses:</strong></p>
        <ul>
          <li><strong>Crit Surge</strong> — +10% crit chance in all battles.</li>
          <li><strong>Revenge Protocol</strong> — earn 50% of gem drops even on losses.</li>
          <li><strong>Instant Battle</strong> — unlocks the 20× battle speed option in Settings.</li>
        </ul>
        <p><strong>Roster / economy gamepasses:</strong></p>
        <ul>
          <li><strong>Expanded Roster</strong> — raises the per-slot roster cap.</li>
          <li><strong>Sell Bonus</strong> — +25% gem return when selling Ascension characters.</li>
          <li><strong>2× Shard Drop</strong> — Ascension battle Shard drops doubled.</li>
        </ul>
        <p><strong>Cosmetic gamepasses:</strong></p>
        <ul>
          <li><strong>Gold Roster Frame</strong> — gold border on every roster card.</li>
          <li><strong>Legend Tag</strong> — [LEGEND] prefix on your name in online matches.</li>
          <li><strong>Custom Wheel Themes</strong> — unlocks alternate visual themes for the wheel.</li>
        </ul>
        <p>Plus a few more rotating in and out. Check the Shop tab for the live list with current prices.</p>
      </section>

      <section id="sec-guide" class="htp-section">
        <h2><span class="material-symbols-outlined">history_edu</span> Quill, your NPC guide</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> An in-character Fate Scribe who explains every screen on first visit. Tap her portrait (bottom-right) any time to re-ask about the current screen.</p>
        <p>Quill's portrait sits above the bottom nav. Tap it to summon her dialogue for whatever screen you're on — including mid-spin, where she'll explain the specific wheel you're looking at (race-injected wheels included).</p>
        <p>First-visit dialogues fire automatically for: each main route, each clan tab, each Ascension hub view, each Rivals phase, each Friends tab.</p>
        <p>Wheel-by-wheel scenes are summon-only — Quill won't pop up on every spin. Ask her when you want context, ignore her when you don't.</p>
      </section>

      <section id="sec-sharing" class="htp-section">
        <h2><span class="material-symbols-outlined">share</span> Sharing & Accounts</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Every character has a public URL viewable without an account. Accounts persist your collection across devices and unlock social features.</p>
        <p>Without an account, your characters live in browser localStorage. Cleared on cache wipe. Still shareable via URL.</p>
        <p>With an account (username + password, no email needed), characters sync to the cloud and follow you across devices. Rivals wins, clan membership, friends, and achievements all become real and persistent.</p>
        <p>Existing in-browser characters are migrated into the account on first login. Nothing is lost.</p>
      </section>

      <section id="sec-settings" class="htp-section">
        <h2><span class="material-symbols-outlined">settings</span> Settings</h2>
        <p class="htp-tldr"><strong>TL;DR:</strong> Sound, battle speed, visual effects, performance mode. Open from the gear icon in the bottom nav.</p>
        <p>Sound — toggleable music + SFX, with separate sliders.</p>
        <p>Battle Speed — 1×, 2×, 5×, 10×, 20× (Instant; requires Instant Battle gamepass).</p>
        <p>Visual Effects — toggle screen shake, click particles, ambient field.</p>
        <p>High Quality — overrides auto-detected performance tier. Force full fidelity on mobile if you trust your device.</p>
      </section>

      <footer class="htp-footer">
        <p>Wheel of Destiny · the wheel has no memory · every spin is fresh</p>
        <a href="/">← Back to home</a>
      </footer>
    </article>
  </div>
</main>

<style>
  .htp-page {
    min-height: 100vh;
    background: transparent;
    color: #e9dfeb;
    font-family: 'JetBrains Mono', monospace;
  }

  .htp-header {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(22,18,26,0.92);
    border-bottom: 2px solid rgba(240,192,82,0.45);
    backdrop-filter: blur(16px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  }
  .htp-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px; height: 36px;
    border-radius: 8px;
    color: #9a907b;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .htp-back:hover { color: #f0c040; background: rgba(240,192,64,0.06); }
  .htp-title { display: flex; align-items: center; gap: 10px; flex: 1; }
  .htp-title h1 {
    font-family: 'Cinzel', serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: #ffdf96;
    letter-spacing: 0.12em;
    margin: 0;
  }
  .htp-title .material-symbols-outlined { color: #f0c040; font-size: 22px; }
  .htp-toc-toggle {
    background: rgba(240,192,64,0.08);
    border: 1px solid rgba(240,192,64,0.25);
    color: #f0c040;
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
  }
  .md-hide { display: none; }
  @media (max-width: 767px) {
    .md-hide { display: flex; }
  }

  .htp-shell {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 24px;
    max-width: 1280px;
    margin: 0 auto;
    padding: 24px 16px 96px 16px;
  }
  @media (max-width: 767px) {
    .htp-shell { grid-template-columns: 1fr; padding-top: 16px; }
  }

  .htp-toc {
    position: sticky;
    top: 80px;
    align-self: start;
    max-height: calc(100vh - 100px);
    overflow: auto;
    background: linear-gradient(180deg, rgba(28,22,40,0.7), rgba(13,10,20,0.7));
    border: 1px solid rgba(240,192,64,0.18);
    border-radius: 12px;
    padding: 12px 8px;
  }
  @media (max-width: 767px) {
    .htp-toc {
      position: fixed;
      top: 62px; left: 8px; right: 8px;
      max-height: calc(100vh - 120px);
      transform: translateY(-150%);
      transition: transform 0.25s cubic-bezier(0.34,1.3,0.64,1);
      z-index: 40;
      box-shadow: 0 12px 40px rgba(0,0,0,0.7);
    }
    .htp-toc.open { transform: translateY(0); }
  }

  .htp-toc-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    margin-bottom: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
  }
  .htp-toc-search .material-symbols-outlined { color: #9a907b; font-size: 16px; }
  .htp-toc-search input {
    flex: 1;
    background: none;
    border: none;
    color: #e9dfeb;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    outline: none;
  }
  .htp-toc-search input::placeholder { color: #4e4635; }
  .htp-toc-search button {
    background: none;
    border: none;
    color: #4e4635;
    cursor: pointer;
    padding: 2px;
    display: flex;
  }
  .htp-toc-search button:hover { color: #f87171; }

  .htp-toc-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .htp-toc-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    background: none;
    border: none;
    color: #9a907b;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .htp-toc-item:hover { background: rgba(240,192,64,0.05); color: #ffdf96; }
  .htp-toc-item.active {
    background: rgba(240,192,64,0.10);
    color: #f0c040;
    border-left: 2px solid #f0c040;
    padding-left: 8px;
  }
  .htp-toc-empty {
    padding: 16px 12px;
    color: #4e4635;
    font-size: 0.7rem;
    text-align: center;
  }
  .htp-toc-footer {
    margin-top: 12px;
    padding: 8px 10px 0 10px;
    border-top: 1px solid rgba(255,255,255,0.06);
    color: #4e4635;
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .htp-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }
  .htp-section {
    background: linear-gradient(180deg, rgba(20,16,26,0.5), rgba(10,8,15,0.5));
    border: 1px solid rgba(240,192,64,0.10);
    border-radius: 12px;
    padding: 24px 24px;
    scroll-margin-top: 80px;
  }
  .htp-section h2 {
    font-family: 'Cinzel', serif;
    font-size: 1.25rem;
    font-weight: 700;
    color: #ffdf96;
    letter-spacing: 0.06em;
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid rgba(240,192,64,0.18);
    padding-bottom: 10px;
  }
  .htp-section h2 .material-symbols-outlined {
    color: #f0c040;
    font-size: 22px;
    font-variation-settings: 'FILL' 1;
  }
  .htp-section p {
    font-size: 0.82rem;
    line-height: 1.7;
    color: #c4b5fd;
    margin: 8px 0;
  }
  .htp-tldr {
    background: rgba(240,192,64,0.05);
    border-left: 3px solid #f0c040;
    padding: 10px 14px;
    border-radius: 0 8px 8px 0;
    color: #ffdf96 !important;
  }
  .htp-tldr strong { color: #f0c040; }
  .htp-section ul, .htp-section ol {
    margin: 8px 0 8px 18px;
    padding-left: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .htp-section li {
    font-size: 0.78rem;
    line-height: 1.6;
    color: #c4b5fd;
  }
  .htp-section li strong { color: #ffdf96; }
  .htp-mono {
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    padding: 12px 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem !important;
    color: #f0c040 !important;
    line-height: 1.8 !important;
    overflow-x: auto;
    letter-spacing: 0.04em;
  }

  .htp-footer {
    margin-top: 16px;
    text-align: center;
    padding: 24px;
    border-top: 1px solid rgba(240,192,64,0.10);
  }
  .htp-footer p {
    color: #4e4635;
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin: 0 0 12px 0;
  }
  .htp-footer a {
    color: #f0c040;
    text-decoration: none;
    font-family: 'Cinzel', serif;
    font-size: 0.85rem;
    letter-spacing: 0.1em;
  }
  .htp-footer a:hover { color: #ffdf96; }
</style>
