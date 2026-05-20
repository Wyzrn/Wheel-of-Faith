<script lang="ts">
  import { WORLD_GRADES, BATTLES_PER_WORLD, PLAYER_LEVEL_WORLDS, type WorldGrade } from '$lib/story/worlds'
  import type { StorySaveSlot } from '$lib/story/saveSlots'

  let { slot, onEnterWorld, onBack }: {
    slot: StorySaveSlot
    onEnterWorld: (world: WorldGrade) => void
    onBack: () => void
  } = $props()

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
</script>

<header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4"
  style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);">
  <button onclick={onBack}
    style="background: none; border: none; cursor: pointer; color: var(--color-outline); font-size: 18px;">←</button>
  <h2 class="font-bold" style="font-family: var(--font-cinzel); font-size: 18px; color: var(--color-on-surface);">Worlds</h2>
  <div class="ml-auto flex items-center gap-1.5">
    <span class="material-symbols-outlined" style="font-size: 15px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">military_tech</span>
    <span class="font-mono text-sm font-bold" style="color: var(--gold-bright);">Lv {slot.playerLevel}</span>
  </div>
</header>

<div class="pt-20 pb-24 px-4 max-w-md mx-auto flex flex-col gap-3">

  {#each WORLD_GRADES as world}
    {@const prog = worldProgress(world)}
    {@const unlocked = isUnlocked(world)}
    {@const color = GRADE_COLORS[world] ?? '#9a907b'}
    {@const pct = prog.beaten ? 100 : Math.round((prog.battlesCompleted / BATTLES_PER_WORLD) * 100)}
    {@const levelUnlock = Object.entries(LEVEL_WORLD).find(([, w]) => w === world)?.[0]}

    <div
      class="obsidian-slab rounded-xl overflow-hidden"
      style="{unlocked ? `border: 1px solid ${color}28;` : 'opacity: 0.45;'}"
    >
      <div class="px-4 py-4 flex items-center gap-4">
        <!-- Grade badge -->
        <div
          class="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold"
          style="background: {color}18; border: 1px solid {color}44; color: {color}; font-family: var(--font-cinzel); font-size: {world.length > 3 ? '9px' : '13px'}; letter-spacing: 0.05em;"
        >
          {world}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">
              {world} World
            </span>
            {#if prog.beaten}
              <span class="material-symbols-outlined" style="font-size: 14px; color: #4ade80; font-variation-settings: 'FILL' 1;">check_circle</span>
            {/if}
            {#if levelUnlock}
              <span class="font-mono text-xs px-1.5 py-0.5 rounded"
                style="background: rgba(240,192,64,0.1); color: var(--gold-bright); border: 1px solid rgba(240,192,64,0.2);">
                Lv {levelUnlock}
              </span>
            {/if}
          </div>
          <div class="font-mono text-xs mt-1" style="color: var(--color-outline);">
            {#if !unlocked}
              Locked
            {:else if prog.beaten}
              Complete — 20/20 battles
            {:else}
              {prog.battlesCompleted}/{BATTLES_PER_WORLD} battles
            {/if}
          </div>
          <!-- Progress bar -->
          {#if unlocked}
            <div class="mt-2 rounded-full overflow-hidden" style="height: 3px; background: rgba(255,255,255,0.07);">
              <div class="h-full rounded-full" style="width: {pct}%; background: {color}; transition: width 0.4s ease;"></div>
            </div>
          {/if}
        </div>

        <!-- Enter button -->
        {#if unlocked && !prog.beaten}
          <button
            onclick={() => onEnterWorld(world)}
            class="flex-shrink-0 metal-stamp-gold rounded-lg px-3 py-2 font-bold font-mono text-xs"
          >
            Enter
          </button>
        {:else if unlocked && prog.beaten}
          <button
            onclick={() => onEnterWorld(world)}
            class="flex-shrink-0 rounded-lg px-3 py-2 font-bold font-mono text-xs"
            style="background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.3); color: #4ade80; cursor: pointer;"
          >
            Replay
          </button>
        {:else}
          <span class="material-symbols-outlined flex-shrink-0" style="font-size: 20px; color: var(--color-outline);">lock</span>
        {/if}
      </div>
    </div>
  {/each}
</div>
