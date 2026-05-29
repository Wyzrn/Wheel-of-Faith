<script lang="ts">
  import { goto } from '$app/navigation'
  import TierBadge from '../../../../components/TierBadge.svelte'
  import { getStageTierLabel } from '$lib/story/raceTiers'
  import type { StorySaveSlot } from '$lib/story/saveSlots'
  import type { StoryRosterEntry } from '$lib/story/types'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const slot = data.slotData as StorySaveSlot

  const beatenWorlds = Object.entries(slot.worldProgress ?? {})
    .filter(([, p]) => (p as any).beaten)
    .map(([w]) => w)

  function spinClassLabel(entry: StoryRosterEntry): string {
    if (entry.spinClass === 'legend') return 'LEGEND'
    if (entry.spinClass === 'hero') return 'HERO'
    return ''
  }

  function spinClassColor(entry: StoryRosterEntry): string {
    if (entry.spinClass === 'legend') return '#c084fc'
    if (entry.spinClass === 'hero') return '#fbbf24'
    return ''
  }

  function borderColor(entry: StoryRosterEntry): string {
    if (entry.spinClass === 'legend') return 'rgba(168,85,247,0.5)'
    if (entry.spinClass === 'hero') return 'rgba(251,191,36,0.5)'
    return 'rgba(255,223,150,0.08)'
  }

  function glowShadow(entry: StoryRosterEntry): string {
    if (entry.spinClass === 'legend') return '0 0 14px rgba(168,85,247,0.35), 0 2px 8px rgba(0,0,0,0.5)'
    if (entry.spinClass === 'hero') return '0 0 14px rgba(251,191,36,0.3), 0 2px 8px rgba(0,0,0,0.5)'
    return '0 2px 8px rgba(0,0,0,0.4)'
  }

  let copied = $state(false)
  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      copied = true
      setTimeout(() => { copied = false }, 2000)
    })
  }
</script>

<svelte:head>
  <title>Story Slot — Wheel of Fate</title>
</svelte:head>

<main class="min-h-screen" style="background: transparent; color: #e9dfeb;">

  <!-- Nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14"
    style="background: rgba(22,18,26,0.92); border-bottom: 2px solid rgba(240,192,82,0.45); backdrop-filter: blur(16px); box-shadow: 0 4px 20px rgba(90,214,239,0.12);">
    <div class="flex items-center" style="min-width: 80px;">
      <a href="/" class="flex items-center gap-1 transition-all active:scale-95"
        style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
        <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
        <span>Menu</span>
      </a>
    </div>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">casino</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">WHEEL OF FATE</span>
    </div>
    <div style="min-width: 80px;"></div>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto flex flex-col gap-6">

    <!-- Header -->
    <div class="text-center">
      <p class="font-mono text-xs tracking-widest uppercase mb-1" style="color: #9a907b; letter-spacing: 0.18em;">Story Mode Save</p>
      <h1 class="font-bold mb-1" style="font-family: var(--font-cinzel, 'Cinzel', serif); font-size: 1.4rem; color: #ffdf96;">
        Player Level {slot.playerLevel ?? 0}
      </h1>
      <p class="font-mono text-xs" style="color: var(--color-outline);">
        {getStageTierLabel(slot.stage ?? 1)} · {(slot.gems ?? 0).toLocaleString()} gems · {slot.roster?.length ?? 0} characters
      </p>
    </div>

    <!-- Copy link button -->
    <button onclick={copyLink}
      class="w-full py-2.5 rounded-xl font-mono text-sm font-bold flex items-center justify-center gap-2"
      style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.25); color: {copied ? '#34d399' : '#f0c040'}; cursor: pointer; transition: color 200ms;">
      <span class="material-symbols-outlined" style="font-size: 16px;">{copied ? 'check' : 'link'}</span>
      {copied ? 'Link copied!' : 'Copy link'}
    </button>

    <!-- Worlds beaten -->
    {#if beatenWorlds.length > 0}
      <div>
        <p class="font-mono text-xs tracking-widest uppercase mb-2" style="color: #9a907b;">Worlds beaten</p>
        <div class="flex flex-wrap gap-1.5">
          {#each beatenWorlds as w}
            <span class="font-mono text-xs px-2 py-0.5 rounded"
              style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.2); color: #ffdf96;">
              {w}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Roster -->
    {#if slot.roster && slot.roster.length > 0}
      <div>
        <p class="font-mono text-xs tracking-widest uppercase mb-2" style="color: #9a907b;">Roster ({slot.roster.length})</p>
        <div class="grid grid-cols-2 gap-3">
          {#each slot.roster as entry (entry.id)}
            <div class="relative rounded-lg p-2 flex flex-col gap-1"
              style="background: var(--color-surface-container-low, #12121a); border: 1px solid {borderColor(entry)}; box-shadow: {glowShadow(entry)};">

              {#if entry.spinClass}
                <span class="absolute top-2 left-2 font-mono font-bold"
                  style="font-size: 8px; letter-spacing: 0.12em; color: {spinClassColor(entry)}; text-shadow: 0 0 8px {spinClassColor(entry)}88;">
                  {spinClassLabel(entry)}
                </span>
              {/if}

              <div class="absolute top-2 right-2">
                <TierBadge grade={entry.overallTier} />
              </div>

              <p class="text-sm font-mono font-bold truncate pr-14" style="color: #e9dfeb; {entry.spinClass ? 'padding-top: 14px;' : ''}">
                {entry.name}
              </p>
              <p class="text-xs font-mono truncate" style="color: #9a907b;">{entry.race}</p>
              <p class="text-xs font-mono truncate" style="color: #6b7280;">{entry.archetype}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="font-mono text-[10px]" style="color: #9a907b;">
                  Lv {entry.level ?? 1}{(entry.level ?? 1) >= 100 ? ' MAX' : '/100'}
                </span>
                {#if (entry.level ?? 1) > 1}
                  <span class="font-mono text-[10px] px-1 py-0.5 rounded"
                    style="background: rgba(134,239,172,0.12); border: 1px solid rgba(134,239,172,0.25); color: #86efac;">
                    +{entry.level - 1}% Power
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <p class="font-mono text-sm text-center" style="color: #6b7280;">No characters in roster.</p>
    {/if}

  </div>
</main>
