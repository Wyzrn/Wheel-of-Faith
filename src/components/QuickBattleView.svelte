<!--
  QuickBattleView.svelte — "Quick Fight" team-vs-team battle.

  This view used to carry its own copy of the chrome (cards, log, VFX,
  damage indicators, projectile fallbacks). It's now a thin caller of the
  unified BattleArena: it builds the two BattleCharacter arrays, applies
  per-spin ability modifiers + Crit Surge gamepass, normalizes engine
  rounds, and supplies the mode-specific intro splash + result modal.

  Auto-only for the moment; team-battle manual mode lands with the
  BattleControllerTeam follow-up.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import {
    buildBattleCharacter, formatHp,
    type BattleCharacter,
  } from '$lib/game/battle'
  import { settings } from '$lib/settings.svelte'
  import { auth } from '$lib/stores/auth.svelte'
  import type { SpinResult } from '$lib/session/types'
  import BattleArena from './BattleArena.svelte'
  import {
    memberFromChar, hpColor,
    type ArenaTeam, type ArenaWinner,
  } from '$lib/battle/arena'
  import { BattleControllerTeam } from '$lib/battle/teamController'

  export interface BattleTeamMember {
    results: SpinResult[]
    name: string
    shareId?: string
    statBonuses?: Record<string, number>
  }

  const {
    team1,
    team2,
    team1Label = 'Your Team',
    team2Label = 'Opponent',
    title = 'Battle',
    team2Color = '#f9a8d4',
    onComplete,
    onRematch,
    onBack,
    backLabel = 'Back',
  }: {
    team1: BattleTeamMember[]
    team2: BattleTeamMember[]
    team1Label?: string
    team2Label?: string
    title?: string
    team2Color?: string
    onComplete?: (winner: 'team1' | 'team2' | 'draw') => void
    onRematch: () => void
    onBack: () => void
    backLabel?: string
  } = $props()

  let phase = $state<'intro' | 'battle' | 'result'>('intro')
  let battleWinner = $state<ArenaWinner | null>(null)

  // Engine state — built once on mount.
  let t1Chars = $state<BattleCharacter[]>([])
  let t2Chars = $state<BattleCharacter[]>([])
  let arenaTeams = $state<[ArenaTeam, ArenaTeam] | null>(null)
  let controller = $state<BattleControllerTeam | null>(null)
  // Live HP snapshot for the survivors block in the result modal (updated
  // by the controller as turns resolve).
  let finalT1Hp = $state<number[]>([])
  let finalT2Hp = $state<number[]>([])

  // Manual / Auto preference for this battle, seeded from settings and
  // flippable via the in-arena switch.
  let manualMode = $state(!settings.autoBattle)

  let showCritSurge = $state(false)
  let canInstant = $derived((auth.user?.gamepasses ?? []).includes('instant_battle'))

  // ── Per-spin ability modifiers (kept verbatim from the legacy view) ──────
  function extractBattleModifiers(results: SpinResult[]) {
    let critBonus = 0, damageBonus = 0, dodgeBonus = 0
    for (const r of results) {
      const label = r.resultLabel.toLowerCase()
      if (/crit|critical|precision/.test(label))   critBonus   += 0.05
      if (/strength|power|fury/.test(label))       damageBonus += 0.08
      if (/agility|speed|reflex/.test(label))      dodgeBonus  += 0.05
      if (/blessed|divine|sacred/.test(label))     { critBonus += 0.03; damageBonus += 0.05 }
      if (/cursed|dark|shadow/.test(label))        damageBonus += 0.07
    }
    return {
      critBonus:   Math.min(critBonus,   0.40),
      damageBonus: Math.min(damageBonus, 0.50),
      dodgeBonus:  Math.min(dodgeBonus,  0.30),
    }
  }

  onMount(() => {
    const gamepasses    = auth.user?.gamepasses ?? []
    const hasCritSurge  = gamepasses.includes('crit_surge')

    // Build & buff characters
    const t1Base = team1.map(m => buildBattleCharacter(m.results, m.name))
    const t2Base = team2.map(m => buildBattleCharacter(m.results, m.name))

    t1Chars = t1Base.map((c, i) => {
      const mods = extractBattleModifiers(team1[i]?.results ?? [])
      const critChance = mods.critBonus + (hasCritSurge ? 0.10 : 0)
      const hasCrit = Math.random() < critChance
      if (hasCrit) { showCritSurge = true; setTimeout(() => { showCritSurge = false }, 2500) }
      const mult = 1 + mods.damageBonus + (hasCrit ? 0.25 : 0)
      return { ...c, hp: Math.round(c.hp * mult), maxHp: Math.round(c.maxHp * mult) }
    })
    t2Chars = t2Base.map((c, i) => {
      const mods = extractBattleModifiers(team2[i]?.results ?? [])
      const hasCrit = Math.random() < mods.critBonus
      const mult = 1 + mods.damageBonus + (hasCrit ? 0.25 : 0)
      return { ...c, hp: Math.round(c.hp * mult), maxHp: Math.round(c.maxHp * mult) }
    })

    // Build ArenaTeams + the stateful team controller. The arena drives
    // turns through it — turn-by-turn so manual mode can pause for each
    // ally's input.
    const t1Ids = t1Chars.map((_, i) => `t1-${i}`)
    const t2Ids = t2Chars.map((_, i) => `t2-${i}`)
    arenaTeams = [
      {
        side: 'team1', label: team1Label, accent: '#f0c040',
        members: t1Chars.map((c, i) => memberFromChar(c, t1Ids[i], 'team1', formatHp)),
      },
      {
        side: 'team2', label: team2Label, accent: team2Color,
        members: t2Chars.map((c, i) => memberFromChar(c, t2Ids[i], 'team2', formatHp)),
      },
    ]
    controller = new BattleControllerTeam(
      t1Chars.map((c, i) => ({ id: t1Ids[i], side: 'team1', char: c })),
      t2Chars.map((c, i) => ({ id: t2Ids[i], side: 'team2', char: c })),
    )
    finalT1Hp = t1Chars.map(c => c.hp)
    finalT2Hp = t2Chars.map(c => c.hp)
  })

  function handleBattleEnd(w: ArenaWinner) {
    battleWinner = w
    if (controller) {
      finalT1Hp = t1Chars.map((_, i) => controller!.getHp(`t1-${i}`))
      finalT2Hp = t2Chars.map((_, i) => controller!.getHp(`t2-${i}`))
    }
    onComplete?.(w === 'draw' ? 'draw' : w)
  }

  let team1Won = $derived(battleWinner === 'team1')
</script>

<!-- Fixed header — mode-specific (Back + title + round counter) -->
<header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4"
  style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);">
  <button onclick={onBack}
    style="background: none; border: none; cursor: pointer; color: #9a907b; font-size: 20px; line-height: 1; padding: 8px;">←</button>
  <h2 class="font-bold flex-1 text-center truncate"
    style="font-family: 'Cinzel', serif; font-size: 15px; color: #e9dfeb;">
    {title}
  </h2>
  <div style="width: 52px;"></div>
</header>

<div class="pt-20 px-3 w-full flex flex-col"
  style="max-width: 800px; margin: 0 auto; min-height: 100dvh;
         padding-bottom: max(96px, calc(env(safe-area-inset-bottom, 0px) + 96px));">

  <!-- CRITICAL HIT surge banner (Crit Surge gamepass proc) -->
  {#if showCritSurge}
    <div class="fixed top-16 inset-x-0 z-40 flex justify-center pointer-events-none"
         style="animation: resultReveal 0.3s ease-out forwards;">
      <div class="px-5 py-2 rounded-xl font-bold text-sm"
           style="font-family: 'Cinzel', serif; background: rgba(253,224,71,0.2);
                  border: 1px solid rgba(253,224,71,0.5); color: #fde047; letter-spacing: 0.12em;">
        ⚡ CRITICAL HIT!
      </div>
    </div>
  {/if}

  {#if arenaTeams && controller}
    <BattleArena
      bind:phase
      teams={arenaTeams}
      controller={controller}
      manualMode={manualMode}
      onManualToggle={(m) => manualMode = m}
      modeTitle={title}
      modeSubtitle="⚔ Quick Battle"
      modeAccent="#f9a8d4"
      speedFactor={settings.battleSpeed}
      effectsEnabled={settings.effectsEnabled}
      canInstant={canInstant}
      onBattleEnd={handleBattleEnd}>

      {#snippet prebattle()}
        <div class="text-center py-8" style="animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
          <div class="flex items-center justify-center gap-6 mb-4">
            <div class="text-right">
              {#each t1Chars as c}
                <p class="font-bold text-sm truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{c.name}</p>
              {/each}
              <p class="font-mono text-xs mt-1" style="color: rgba(240,192,64,0.6);">{team1Label}</p>
            </div>
            <p style="font-family: 'Cinzel', serif; font-size: 2.5rem; font-weight: 900; color: #f0c040;
                      letter-spacing: 0.2em; filter: drop-shadow(0 0 20px rgba(240,192,64,0.5));">VS</p>
            <div class="text-left">
              {#each t2Chars as c}
                <p class="font-bold text-sm truncate" style="font-family: 'Cinzel', serif; color: {team2Color};">{c.name}</p>
              {/each}
              <p class="font-mono text-xs mt-1" style="color: {team2Color}99;">{team2Label}</p>
            </div>
          </div>
          <p class="mt-2 text-xs tracking-[0.2em] uppercase"
             style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">
            {t1Chars.length}v{t2Chars.length} · Calculating fate…
          </p>
        </div>
      {/snippet}

      {#snippet result()}
        {@const winColor = team1Won ? '#f0c040' : battleWinner === 'draw' ? '#9a907b' : team2Color}
        {@const winLabel = team1Won ? team1Label : battleWinner === 'draw' ? 'Draw' : team2Label}
        <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
          style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px);
                 padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
          <div class="w-full max-w-md rounded-2xl overflow-hidden"
            style="background: {winColor}0a; border: 1px solid {winColor}44; box-shadow: 0 0 60px {winColor}14;
                   animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
            <div class="px-5 py-6 text-center">
              <p class="text-xs tracking-[0.25em] uppercase mb-2"
                 style="font-family: 'JetBrains Mono', monospace; color: {winColor};">
                {team1Won ? 'Victory' : battleWinner === 'draw' ? 'Draw' : 'Defeated'}
              </p>
              <p style="font-family: 'Cinzel', serif; font-size: clamp(1.3rem, 5vw, 2rem); font-weight: 900;
                        color: {winColor}; letter-spacing: 0.1em; filter: drop-shadow(0 0 16px {winColor}55);">
                {battleWinner === 'draw' ? 'DRAW!' : `${winLabel} WINS!`}
              </p>
              {#if battleWinner !== 'draw'}
                <p class="mt-1 text-sm" style="color: #9a907b;">
                  {team1Won ? 'Fate has spoken.' : 'Better luck next time.'}
                </p>
              {:else}
                <p class="mt-1 text-sm" style="color: #9a907b;">The fates are balanced.</p>
              {/if}

              <!-- Winner survivor stats -->
              {#if battleWinner !== 'draw'}
                {@const winChars = team1Won ? t1Chars : t2Chars}
                {@const winHp    = team1Won ? finalT1Hp : finalT2Hp}
                <div class="mt-4 rounded-xl px-4 py-3 text-left"
                     style="background: rgba(0,0,0,0.3); border: 1px solid {winColor}18;">
                  <p class="font-mono text-xs mb-2 tracking-widest uppercase" style="color: #9a907b;">Survivors</p>
                  {#each winChars as c, i}
                    {@const hp  = winHp[i] ?? 0}
                    {@const pct = c.maxHp > 0 ? hp / c.maxHp : 0}
                    {#if hp > 0}
                      <div class="flex items-center gap-3 mb-1.5">
                        <span class="font-bold text-xs truncate flex-1"
                              style="font-family: 'Cinzel', serif; color: {winColor};">{c.name}</span>
                        <div class="w-20 rounded-full overflow-hidden"
                             style="height: 5px; background: rgba(255,255,255,0.08);">
                          <div class="h-full rounded-full"
                               style="width: {pct * 100}%; background: {hpColor(pct)};"></div>
                        </div>
                        <span class="font-mono text-xs shrink-0"
                              style="color: {hpColor(pct)};">{formatHp(hp)}</span>
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}

              <!-- Action buttons -->
              <div class="mt-5 flex flex-col gap-2">
                <button onclick={onRematch}
                  class="w-full metal-stamp-gold py-3 rounded-xl font-bold font-mono text-sm tracking-widest">
                  ↺ Rematch
                </button>
                <button onclick={onBack}
                  class="w-full obsidian-slab py-2.5 rounded-xl font-mono text-sm tracking-widest"
                  style="border: 1px solid {winColor}28; color: {winColor};">
                  ← {backLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      {/snippet}
    </BattleArena>
  {:else if phase === 'intro'}
    <!-- Pre-mount loading state -->
    <div class="flex flex-col items-center justify-center py-24 gap-4">
      <span class="material-symbols-outlined text-4xl"
            style="color: #f0c040; font-variation-settings: 'FILL' 1;">swords</span>
      <p class="font-mono text-xs tracking-widest uppercase" style="color: #9a907b;">Preparing battle…</p>
    </div>
  {/if}
</div>
