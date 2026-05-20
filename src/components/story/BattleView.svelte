<script lang="ts">
  import { getEnemy, rollDrops, BATTLES_PER_WORLD, type WorldGrade, type Enemy } from '$lib/story/worlds'
  import {
    recordBattleWin, applyBattleDrops, addCharacterXp,
    type StorySaveSlot, type BattleDrops,
  } from '$lib/story/saveSlots'
  import type { StoryRosterEntry } from '$lib/story/types'

  let { slot, world, onBattleComplete, onBack }: {
    slot: StorySaveSlot
    world: WorldGrade
    onBattleComplete: (updated: StorySaveSlot) => void
    onBack: () => void
  } = $props()

  const GRADE_COLORS: Record<string, string> = {
    F: '#6b7280', E: '#78716c', D: '#a3a3a3', C: '#4ade80',
    B: '#60a5fa', A: '#a78bfa', S: '#f59e0b', SS: '#f97316',
    SSS: '#ef4444', Z: '#ec4899', ZZ: '#d946ef', ZZZ: '#8b5cf6',
    Celestial: '#67e8f9', Godly: '#fbbf24', Primordial: '#f87171', Absolute: '#ffffff',
  }

  // ── Battle state ───────────────────────────────────────────────────────────
  type Phase = 'pick' | 'fight' | 'result'
  let phase = $state<Phase>('pick')
  let selectedChar = $state<StoryRosterEntry | null>(null)
  let enemy = $state<Enemy | null>(null)
  let lastDrops = $state<BattleDrops | null>(null)
  let playerWon = $state(false)
  let resolving = $state(false)

  let battleNumber = $derived(
    (slot.worldProgress[world]?.battlesCompleted ?? 0) + 1
  )

  let currentEnemy = $derived(getEnemy(world, battleNumber))

  let sortedRoster = $derived(
    [...slot.roster].sort((a, b) => b.overallScore - a.overallScore)
  )

  function gradeColor(g: string): string {
    return GRADE_COLORS[g] ?? '#9a907b'
  }

  // ── Battle resolution ──────────────────────────────────────────────────────
  async function startFight() {
    if (!selectedChar) return
    resolving = true
    phase = 'fight'
    enemy = currentEnemy

    // Small delay for drama
    await new Promise(r => setTimeout(r, 900))

    // Resolution: compare player's overall score vs enemy grade index (scaled to match score range)
    const GRADE_NAMES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'Z', 'ZZ', 'ZZZ', 'Celestial', 'Godly', 'Primordial', 'Absolute']
    const enemyGradeIdx = GRADE_NAMES.indexOf(enemy!.grade)
    // Enemy "power" — scale the grade index into a rough score equivalent
    const enemyBasePower = 5 + enemyGradeIdx * 6.5
    // Add ±20% randomness to both sides so upsets are possible
    const playerPower = selectedChar.overallScore * (0.8 + Math.random() * 0.4)
    const enemyPower = enemyBasePower * (0.8 + Math.random() * 0.4)
    playerWon = playerPower >= enemyPower

    // Roll drops (only if player wins)
    if (playerWon) {
      lastDrops = rollDrops(enemy!)
    } else {
      lastDrops = null
    }

    resolving = false
    phase = 'result'
  }

  function confirmResult() {
    if (!playerWon || !lastDrops) {
      phase = 'pick'
      return
    }
    let updated = recordBattleWin(slot, world)
    updated = applyBattleDrops(updated, lastDrops)
    if (selectedChar) {
      updated = addCharacterXp(updated, selectedChar.id, lastDrops.xp)
    }
    onBattleComplete(updated)
  }

  const DROP_LABELS: Record<string, string> = {
    fateShard: 'Fate Shard',
    powerCrystal: 'Power Crystal (F)',
    statCrystal: 'Stat Crystal (Common)',
    weaponCrystal: 'Weapon Crystal (F)',
    armorCrystal: 'Armor Crystal (F)',
  }
</script>

<header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4"
  style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);">
  {#if phase === 'pick'}
    <button onclick={onBack}
      style="background: none; border: none; cursor: pointer; color: var(--color-outline); font-size: 18px;">←</button>
  {:else}
    <div style="width: 28px;"></div>
  {/if}
  <h2 class="font-bold flex-1 text-center" style="font-family: var(--font-cinzel); font-size: 16px; color: var(--color-on-surface);">
    {world} World — Battle {battleNumber}/{BATTLES_PER_WORLD}
  </h2>
  <div style="width: 28px;"></div>
</header>

<div class="pt-20 pb-24 px-4 max-w-md mx-auto">

  <!-- ── Enemy card (always visible in fight / result) ──────────────────────── -->
  {#if phase !== 'pick'}
    {@const ec = gradeColor(enemy?.grade ?? 'F')}
    <div class="obsidian-slab rounded-xl p-5 mb-4 flex items-center gap-4"
      style="border: 1px solid {ec}33;">
      <div class="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center font-bold"
        style="background: {ec}18; border: 1px solid {ec}44; color: {ec}; font-family: var(--font-cinzel); font-size: {(enemy?.grade?.length ?? 1) > 3 ? '9px' : '14px'};">
        {enemy?.grade}
      </div>
      <div>
        <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{enemy?.name}</p>
        <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">
          {enemy?.type === 'boss' ? '⚔ Boss' : enemy?.type === 'elite' ? '★ Elite' : 'Normal'}
        </p>
      </div>
      {#if phase === 'fight' && resolving}
        <div class="ml-auto">
          <span class="font-mono text-xs" style="color: var(--color-outline);">battling…</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── Phase: pick character ─────────────────────────────────────────────── -->
  {#if phase === 'pick'}
    <div class="mb-4">
      <p class="font-mono text-xs mb-3" style="color: var(--color-outline);">Enemy: <span style="color: {gradeColor(currentEnemy.grade)};">{currentEnemy.name}</span> ({currentEnemy.type})</p>
      <p class="font-bold text-sm mb-4" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Choose your fighter:</p>
    </div>

    {#if sortedRoster.length === 0}
      <div class="text-center pt-8">
        <p class="font-mono text-sm" style="color: var(--color-outline);">No characters in roster. Spin to add some first.</p>
        <button onclick={onBack}
          class="metal-stamp-gold rounded-lg px-5 py-2 font-bold font-mono text-sm mt-5">
          Back
        </button>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each sortedRoster as char (char.id)}
          {@const selected = selectedChar?.id === char.id}
          <button
            onclick={() => selectedChar = char}
            class="obsidian-slab rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
            style="border: 1px solid {selected ? 'rgba(240,192,64,0.5)' : 'transparent'}; cursor: pointer; background: {selected ? 'rgba(240,192,64,0.05)' : ''}; transition: border-color 120ms;"
          >
            <div class="flex-1 min-w-0">
              <p class="font-bold text-sm truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{char.name}</p>
              <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">{char.race} · {char.archetype} · Lv {char.level}</p>
            </div>
            <div class="flex-shrink-0 text-right">
              <p class="font-mono text-xs font-bold" style="color: var(--gold-bright);">{char.overallTier}</p>
              <p class="font-mono text-xs" style="color: var(--color-outline);">score {char.overallScore}</p>
            </div>
            {#if selected}
              <span class="material-symbols-outlined flex-shrink-0" style="font-size: 18px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">check_circle</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
        style="background: linear-gradient(transparent, rgba(7,7,13,0.97)); z-index: 20;">
        <div class="max-w-md mx-auto">
          <button
            onclick={startFight}
            disabled={!selectedChar}
            class="{selectedChar ? 'metal-stamp-gold' : 'obsidian-slab'} w-full py-3 rounded-xl font-bold font-mono text-sm"
            style="{!selectedChar ? 'opacity: 0.4; cursor: not-allowed;' : ''}"
          >
            ⚔ Fight
          </button>
        </div>
      </div>
    {/if}
  {/if}

  <!-- ── Phase: result ─────────────────────────────────────────────────────── -->
  {#if phase === 'result'}
    <div class="flex flex-col items-center gap-5 pt-2">

      {#if playerWon}
        <!-- Win -->
        <div class="text-center">
          <p class="font-bold text-2xl mb-1" style="font-family: var(--font-cinzel); color: #4ade80;">Victory!</p>
          <p class="font-mono text-sm" style="color: var(--color-outline);">{selectedChar?.name} defeated {enemy?.name}</p>
        </div>

        {#if lastDrops}
          <div class="obsidian-slab w-full rounded-xl px-5 py-4">
            <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: var(--color-outline);">Battle Drops</p>
            <div class="flex items-center gap-4 mb-2">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #34d399; font-variation-settings: 'FILL' 1;">paid</span>
                <span class="font-mono text-sm font-bold" style="color: #34d399;">+{lastDrops.gems.toLocaleString()} gems</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #a78bfa; font-variation-settings: 'FILL' 1;">bolt</span>
                <span class="font-mono text-sm font-bold" style="color: #a78bfa;">+{lastDrops.xp.toLocaleString()} XP</span>
              </div>
            </div>
            {#if lastDrops.chanceDrops.length > 0}
              <div class="flex flex-wrap gap-1.5 mt-2">
                {#each lastDrops.chanceDrops as drop}
                  <span class="font-mono text-xs px-2 py-1 rounded"
                    style="background: rgba(240,192,64,0.1); border: 1px solid rgba(240,192,64,0.25); color: var(--gold-bright);">
                    {DROP_LABELS[drop] ?? drop}
                  </span>
                {/each}
              </div>
            {/if}
            {#if battleNumber === BATTLES_PER_WORLD}
              <p class="font-mono text-sm mt-3 text-center font-bold" style="color: #4ade80;">
                🏆 World Cleared!
              </p>
            {/if}
          </div>
        {/if}

      {:else}
        <!-- Defeat -->
        <div class="text-center">
          <p class="font-bold text-2xl mb-1" style="font-family: var(--font-cinzel); color: #ef4444;">Defeated!</p>
          <p class="font-mono text-sm" style="color: var(--color-outline);">{selectedChar?.name} lost to {enemy?.name}. Try again.</p>
        </div>
      {/if}

      <button onclick={confirmResult}
        class="metal-stamp-gold w-full py-3 rounded-xl font-bold font-mono text-sm max-w-xs">
        {playerWon && battleNumber < BATTLES_PER_WORLD ? 'Continue' : 'Done'}
      </button>
    </div>
  {/if}

</div>
