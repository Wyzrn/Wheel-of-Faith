<script lang="ts">
  // Tutorial overlay — shown to first-time players.
  // step -1 = tutorial inactive (done / skipped)
  // step  0 = welcome modal (fullscreen)
  // step 1–8 = category-keyed bottom cards
  // step  9 = completion toast

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

  const STAT_CATS = new Set([
    'strength','speed','agility','durability','iq','charisma','fightingSkill',
  ])

  // Maps current game state → which tutorial card to show (null = none).
  // Keyed by "id" so onGotIt(content.id + 1) advances cleanly past it.
  function resolveCard(s: number, cat: string | undefined, revealed: boolean): CardContent | null {
    if (s <= 0 || s >= 9) return null
    if (!cat) return null

    if (cat === 'race' && !revealed && s <= 1) return {
      id: 1,
      icon: 'diversity_3',
      title: 'Spin 1: Race',
      body: '35+ races — from Humans and Elves to Saiyans, Dragons, Hollow Arrancars and Eldritch Beings. Rarer races have lower odds but unlock unique racial ability spins, hidden stat multipliers, and exclusive power pools.',
      cta: 'Got it — spin!',
      accent: '#f0c040',
    }
    if (cat === 'race' && revealed && s <= 2) return {
      id: 2,
      icon: 'check_circle',
      title: 'Race Locked In',
      body: 'Your race shapes everything ahead: how many Racial Ability spins you get (0–3), how many Weaknesses you\'ll roll (0–3), and hidden multipliers on future stat wheels. Certain race + archetype pairs also trigger SYNERGY bonuses mid-session.',
      cta: 'Next spin →',
      accent: '#22c55e',
    }
    if (cat === 'archetype' && s <= 3) return {
      id: 3,
      icon: 'military_tech',
      title: 'Spin: Archetype',
      body: 'Your class — Warrior, Mage, Rogue, Necromancer, Chaos Gremlin, and more. Specific race × archetype combos trigger SYNERGY: bonus spins, extra abilities, or powers spliced into your queue right now.',
      cta: 'Got it — spin!',
      accent: '#a78bfa',
    }
    if (STAT_CATS.has(cat) && s <= 4) return {
      id: 4,
      icon: 'bar_chart',
      title: 'The Tier System',
      body: 'Stats run 42 grades: F–, F, F+, E, D, C, B, A, S, SS, SSS, then Z, ZZ, ZZZ, Celestial, Godly, and finally Primordial. The label you land on IS your result — tier and score are embedded in it. Every stat spin also has a 5% chance to trigger ⚡ WILDCARD, which rewrites the rules entirely.',
      cta: 'Got it — spin!',
      accent: '#f0c040',
    }
    if (cat === 'power' && s <= 5) return {
      id: 5,
      icon: 'bolt',
      title: 'Powers: 1000+ Options',
      body: 'From reality manipulation and time stop to aggressive negotiations and becoming a licensed bureaucrat. What lands is what you get. No filtering. No second chances. Your power is your power.',
      cta: 'Got it — spin!',
      accent: '#fb923c',
    }
    if (cat === 'weakness' && s <= 6) return {
      id: 6,
      icon: 'broken_image',
      title: 'Weaknesses',
      body: 'How many weaknesses you roll depends on your race\'s modifier — anywhere from 0 to 3. They\'re permanent and they\'re yours. The more powerful the race, the more likely it comes with strings attached.',
      cta: 'Got it — spin!',
      accent: '#f87171',
    }
    if (cat === 'redemptionSpin' && s <= 7) return {
      id: 7,
      icon: 'casino',
      title: 'The Redemption Spin',
      body: '25% chance. Land on Redemption and a second wheel activates — reroll your worst stat, gain a bonus power, lose a weakness, or trigger something far more chaotic. Even fate gives second chances. Sometimes.',
      cta: 'Got it — spin!',
      accent: '#c084fc',
    }
    if (cat === 'title' && s <= 8) return {
      id: 8,
      icon: 'workspace_premium',
      title: 'Final Spin: Title',
      body: 'Your Title is the capstone of your identity — an honorary designation that wraps up who your character is. After this spin, you\'ll name your legend and see your complete character card.',
      cta: 'Last spin — let\'s go!',
      accent: '#f0c040',
    }

    return null
  }

  let card = $derived(resolveCard(step, currentCategory, isRevealed))

  // Completion toast: briefly visible when step hits 9
  let toastVisible = $state(false)
  $effect(() => {
    if (step === 9) {
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
          <p>You'll spin <span style="color: #f0c040; font-weight: 700;">~23 fate-chosen wheels</span> to build your character from scratch.</p>
          <p class="mt-2">Race. Archetype. Stats. Powers. Weaknesses. Title.</p>
          <p class="mt-2" style="color: #4e4635; font-style: italic;">Everything is permanent. No take-backs.</p>
        </div>

        <p class="text-[10px] tracking-[0.15em] uppercase mb-5" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">
          This tutorial walks you through each wheel.
        </p>

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

<!-- ─── Bottom card (steps 1–8) ──────────────────────────────────────────── -->
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

        <!-- Progress dots -->
        <div class="ml-auto flex gap-1.5 items-center">
          {#each [1,2,3,4,5,6,7,8] as n}
            <div
              class="rounded-full transition-all duration-300"
              style="width: {n === card.id ? 16 : 5}px; height: 5px; background: {n < card.id ? '#4e4635' : n === card.id ? card.accent : '#2a2a38'};"
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
      <div class="px-4 pt-3.5 pb-1 flex gap-3.5">
        <span
          class="material-symbols-outlined shrink-0 mt-0.5"
          style="font-size: 22px; color: {card.accent}; font-variation-settings: 'FILL' 1;"
        >{card.icon}</span>
        <div class="flex-1 min-w-0">
          <p style="font-family: 'Cinzel', serif; font-size: 0.88rem; font-weight: 700; color: #ffdf96; margin-bottom: 5px; letter-spacing: 0.04em;">{card.title}</p>
          <p style="font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: #9a907b; line-height: 1.65;">{card.body}</p>
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

<!-- ─── Completion toast (step 9) ─────────────────────────────────────────── -->
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
