<script lang="ts">
  import { WORLD_GRADES, BATTLES_PER_WORLD, MAX_ABSOLUTE_PLUS, PLAYER_LEVEL_WORLDS, type WorldGrade } from '$lib/story/worlds'
  import type { StorySaveSlot } from '$lib/story/saveSlots'

  let { slot, onEnterWorld, onEnterAbsolutePlus, onBack }: {
    slot: StorySaveSlot
    onEnterWorld: (world: WorldGrade) => void
    onEnterAbsolutePlus?: (level: number) => void
    onBack: () => void
  } = $props()

  let absoluteBeaten = $derived(slot.worldProgress['Absolute']?.beaten ?? false)
  let absCompleted   = $derived(slot.absolutePlusCompleted ?? 0)
  let absBattles     = $derived(slot.absolutePlusBattles ?? 0)
  let absMaxed       = $derived(absCompleted >= MAX_ABSOLUTE_PLUS)
  // The plus level the player is currently on (1-based; e.g. 1 = "Absolute +1")
  let currentPlusLevel = $derived(absCompleted + 1)

  const GRADE_COLORS: Record<string, string> = {
    F: '#6b7280', E: '#78716c', D: '#a3a3a3', C: '#4ade80',
    B: '#60a5fa', A: '#a78bfa', S: '#f59e0b', SS: '#f97316',
    SSS: '#ef4444', Z: '#ec4899', ZZ: '#d946ef', ZZZ: '#8b5cf6',
    Celestial: '#67e8f9', Godly: '#fbbf24', Primordial: '#f87171', Absolute: '#ffffff',
  }

  const LEVEL_WORLD: Record<number, WorldGrade> = PLAYER_LEVEL_WORLDS as Record<number, WorldGrade>

  function worldProgress(w: WorldGrade) {
    return slot.worldProgress[w] ?? { battlesCompleted: 0, beaten: false }
  }

  function isUnlocked(w: WorldGrade): boolean {
    const idx = WORLD_GRADES.indexOf(w)
    if (idx === 0) return true
    return slot.worldProgress[WORLD_GRADES[idx - 1]]?.beaten ?? false
  }

  // The "active" world is the first unlocked, unbeaten world — or the last beaten world
  let activeWorld = $derived(
    WORLD_GRADES.find(w => isUnlocked(w) && !worldProgress(w).beaten) ??
    [...WORLD_GRADES].reverse().find(w => isUnlocked(w)) ??
    WORLD_GRADES[0]
  )
  let activeProg   = $derived(worldProgress(activeWorld))
  let activeColor  = $derived(GRADE_COLORS[activeWorld] ?? '#9a907b')
  let activeBattle = $derived(activeProg.battlesCompleted + 1)
  let pctActive    = $derived(activeProg.beaten ? 100 : Math.round((activeProg.battlesCompleted / BATTLES_PER_WORLD) * 100))
</script>

<header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4"
  style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);">
  <button onclick={onBack}
    style="background: none; border: none; cursor: pointer; color: var(--color-outline); font-size: 18px; padding: 8px;">←</button>
  <h2 class="font-bold flex-1" style="font-family: var(--font-cinzel); font-size: 18px; color: var(--color-on-surface);">Worlds</h2>
  <div class="flex items-center gap-1.5">
    <span class="material-symbols-outlined" style="font-size: 15px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">military_tech</span>
    <span class="font-mono text-sm font-bold" style="color: var(--gold-bright);">Lv {slot.playerLevel}</span>
  </div>
</header>

<div class="pt-20 pb-24 px-4 max-w-md mx-auto flex flex-col gap-3">

  <!-- ── Active World Card (pinned near top) ──────────────────────────────── -->
  <div class="rounded-2xl overflow-hidden mb-2"
    style="background: linear-gradient(140deg, {activeColor}14 0%, rgba(7,7,13,0.97) 60%);
           border: 1px solid {activeColor}44;
           box-shadow: 0 0 40px {activeColor}18, inset 0 1px 0 rgba(255,255,255,0.06);">
    <div class="px-5 pt-5 pb-4">
      <div class="flex items-center gap-4 mb-4">
        <!-- Grade emblem -->
        <div class="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center font-bold"
          style="background: {activeColor}20; border: 2px solid {activeColor}66;
                 color: {activeColor}; font-family: var(--font-cinzel);
                 font-size: {activeWorld.length > 3 ? '10px' : '16px'};
                 box-shadow: 0 0 20px {activeColor}28, inset 0 1px 0 rgba(255,255,255,0.1);">
          {activeWorld}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-bold" style="font-family: var(--font-cinzel); font-size: 17px; color: var(--color-on-surface);">
              {activeWorld} World
            </span>
            {#if activeProg.beaten}
              <span class="material-symbols-outlined" style="font-size: 16px; color: #4ade80; font-variation-settings: 'FILL' 1;">check_circle</span>
            {/if}
          </div>
          <p class="font-mono text-xs" style="color: var(--color-outline);">
            {activeProg.beaten ? 'Conquered' : `Battle ${activeBattle} of ${BATTLES_PER_WORLD}`}
          </p>
          <!-- Progress bar -->
          <div class="mt-2 rounded-full overflow-hidden" style="height: 4px; background: rgba(255,255,255,0.07);">
            <div class="h-full rounded-full" style="width: {pctActive}%; background: {activeColor}; transition: width 0.4s ease; box-shadow: 0 0 6px {activeColor};"></div>
          </div>
        </div>
      </div>

      <!-- Big battle button -->
      <button
        onclick={() => onEnterWorld(activeWorld)}
        class="w-full py-4 rounded-xl font-bold tracking-widest"
        style="font-family: var(--font-cinzel); font-size: 15px;
               background: linear-gradient(135deg, {activeColor}28, {activeColor}10);
               border: 1.5px solid {activeColor}88;
               color: {activeColor};
               box-shadow: 0 4px 24px {activeColor}22, inset 0 1px 0 rgba(255,255,255,0.08);
               cursor: pointer; letter-spacing: 0.15em;
               text-shadow: 0 0 12px {activeColor}88;"
      >
        {activeProg.beaten ? '↩ Replay World' : '⚔ Enter Battle'}
      </button>
    </div>
  </div>

  <!-- ── Divider ─────────────────────────────────────────────────────────── -->
  <div class="flex items-center gap-3 my-1">
    <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.05);"></div>
    <p class="font-mono text-xs tracking-widest uppercase" style="color: var(--color-outline);">All Worlds</p>
    <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.05);"></div>
  </div>

  <!-- ── World list ──────────────────────────────────────────────────────── -->
  {#each WORLD_GRADES as world}
    {@const prog = worldProgress(world)}
    {@const unlocked = isUnlocked(world)}
    {@const color = GRADE_COLORS[world] ?? '#9a907b'}
    {@const pct = prog.beaten ? 100 : Math.round((prog.battlesCompleted / BATTLES_PER_WORLD) * 100)}
    {@const levelUnlock = Object.entries(LEVEL_WORLD).find(([, w]) => w === world)?.[0]}
    {@const isActive = world === activeWorld && !absoluteBeaten}

    <div
      class="rounded-xl overflow-hidden"
      style="{unlocked ? `border: 1px solid ${color}${isActive ? '44' : '1a'};` : 'opacity: 0.38; border: 1px solid rgba(255,255,255,0.05);'}
             background: {isActive ? `${color}0a` : 'rgba(13,13,22,0.7)'};"
    >
      <div class="px-4 py-3.5 flex items-center gap-3">
        <!-- Grade badge -->
        <div
          class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold"
          style="background: {color}14; border: 1px solid {color}33; color: {color}; font-family: var(--font-cinzel); font-size: {world.length > 3 ? '8px' : '12px'};"
        >
          {world}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">
              {world} World
            </span>
            {#if prog.beaten}
              <span class="material-symbols-outlined" style="font-size: 13px; color: #4ade80; font-variation-settings: 'FILL' 1;">check_circle</span>
            {/if}
            {#if levelUnlock}
              <span class="font-mono text-xs px-1.5 py-0.5 rounded"
                style="background: rgba(240,192,64,0.08); color: var(--gold-bright); border: 1px solid rgba(240,192,64,0.18); font-size: 9px;">
                Lv {levelUnlock}
              </span>
            {/if}
          </div>
          <div class="font-mono text-xs" style="color: var(--color-outline); font-size: 10px;">
            {#if !unlocked}
              🔒 Locked
            {:else if prog.beaten}
              Complete · 20/20
            {:else}
              {prog.battlesCompleted}/{BATTLES_PER_WORLD} battles
            {/if}
          </div>
          {#if unlocked}
            <div class="mt-1.5 rounded-full overflow-hidden" style="height: 2px; background: rgba(255,255,255,0.06);">
              <div class="h-full rounded-full" style="width: {pct}%; background: {color};"></div>
            </div>
          {/if}
        </div>

        <!-- Enter / Replay button (compact) -->
        {#if unlocked && !prog.beaten && !isActive}
          <button onclick={() => onEnterWorld(world)}
            class="flex-shrink-0 rounded-lg px-2.5 py-1.5 font-bold font-mono"
            style="font-size: 10px; background: {color}18; border: 1px solid {color}44; color: {color}; cursor: pointer; letter-spacing: 0.05em;">
            Enter
          </button>
        {:else if unlocked && prog.beaten}
          <button onclick={() => onEnterWorld(world)}
            class="flex-shrink-0 rounded-lg px-2.5 py-1.5 font-bold font-mono"
            style="font-size: 10px; background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.25); color: #4ade80; cursor: pointer;">
            Replay
          </button>
        {:else if !unlocked}
          <span class="material-symbols-outlined flex-shrink-0" style="font-size: 18px; color: rgba(255,255,255,0.15);">lock</span>
        {/if}
      </div>
    </div>
  {/each}

  <!-- ── Absolute+ Section ──────────────────────────────────────────────── -->
  {#if absoluteBeaten}
    {@const plusColor = '#ffffff'}
    <div class="flex items-center gap-3 my-1 mt-3">
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.05);"></div>
      <p class="font-mono text-xs tracking-widest uppercase" style="color: var(--color-outline);">Absolute +</p>
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.05);"></div>
    </div>

    <div class="rounded-xl overflow-hidden"
      style="border: 1px solid rgba(255,255,255,{absMaxed ? '0.3' : '0.18'});
             background: rgba(255,255,255,0.04);">
      <div class="px-4 py-3.5 flex items-center gap-3">
        <!-- Badge -->
        <div class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold"
          style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25);
                 color: #fff; font-family: var(--font-cinzel); font-size: 8px; text-align: center; line-height: 1.2;">
          ABS<br>+{absMaxed ? MAX_ABSOLUTE_PLUS : currentPlusLevel}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">
              Absolute +{absMaxed ? MAX_ABSOLUTE_PLUS : currentPlusLevel}
            </span>
            {#if absMaxed}
              <span class="font-mono text-xs px-1.5 py-0.5 rounded"
                style="background: rgba(255,215,0,0.12); color: #ffd700; border: 1px solid rgba(255,215,0,0.3); font-size: 9px;">
                MAXED
              </span>
            {:else}
              <span class="font-mono text-xs" style="color: var(--color-outline); font-size: 10px;">
                {absCompleted}/{MAX_ABSOLUTE_PLUS} cleared
              </span>
            {/if}
          </div>
          <div class="font-mono text-xs" style="color: var(--color-outline); font-size: 10px;">
            {#if absMaxed}
              All tiers conquered
            {:else}
              Run {absBattles}/{BATTLES_PER_WORLD} battles
            {/if}
          </div>
          {#if !absMaxed}
            <div class="mt-1.5 rounded-full overflow-hidden" style="height: 2px; background: rgba(255,255,255,0.06);">
              <div class="h-full rounded-full"
                style="width: {Math.round((absBattles / BATTLES_PER_WORLD) * 100)}%;
                       background: rgba(255,255,255,0.7);"></div>
            </div>
          {/if}
        </div>

        <!-- Enter / Maxed -->
        {#if absMaxed}
          <span class="material-symbols-outlined flex-shrink-0" style="font-size: 18px; color: #ffd700; font-variation-settings: 'FILL' 1;">emoji_events</span>
        {:else}
          <button onclick={() => onEnterAbsolutePlus?.(currentPlusLevel)}
            class="flex-shrink-0 rounded-lg px-2.5 py-1.5 font-bold font-mono"
            style="font-size: 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.3); color: #fff; cursor: pointer; letter-spacing: 0.05em;">
            Enter
          </button>
        {/if}
      </div>
    </div>
  {/if}

</div>
