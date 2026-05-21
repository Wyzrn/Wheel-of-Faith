<script lang="ts">
  import type { StoryRosterEntry } from '$lib/story/types'
  import TierBadge from '../TierBadge.svelte'

  let { entry, onExpand, onSell }: {
    entry: StoryRosterEntry
    onExpand: (id: string) => void
    onSell: (entry: StoryRosterEntry) => void
  } = $props()
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  role="button"
  tabindex="0"
  class="relative rounded-lg p-2 cursor-pointer flex flex-col gap-1"
  style="
    background: var(--color-surface-container-low);
    border: 1px solid rgba(255,223,150,0.08);
    transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  "
  onclick={() => onExpand(entry.id)}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(entry.id); } }}
  onmouseenter={(e) => {
    const el = e.currentTarget as HTMLElement;
    el.style.borderColor = 'rgba(240,192,64,0.25)';
    el.style.transform = 'translateY(-2px)';
    el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6)';
  }}
  onmouseleave={(e) => {
    const el = e.currentTarget as HTMLElement;
    el.style.borderColor = 'rgba(255,223,150,0.08)';
    el.style.transform = 'translateY(0)';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
  }}
  onfocus={(e) => {
    (e.currentTarget as HTMLElement).style.outline = '2px solid #f0c040';
    (e.currentTarget as HTMLElement).style.outlineOffset = '2px';
  }}
  onblur={(e) => {
    (e.currentTarget as HTMLElement).style.outline = '';
    (e.currentTarget as HTMLElement).style.outlineOffset = '';
  }}
>
  <!-- TierBadge absolute top-right -->
  <div class="absolute top-2 right-2">
    <TierBadge grade={entry.overallTier} />
  </div>

  <!-- Name -->
  <p class="text-sm font-mono font-bold truncate pr-14" style="color: var(--color-on-surface);">
    {entry.name}
  </p>

  <!-- Race -->
  <p class="text-sm font-mono truncate" style="color: var(--color-on-surface-variant);">
    {entry.race}
  </p>

  <!-- Archetype -->
  <p class="text-sm font-mono truncate" style="color: var(--color-outline);">
    {entry.archetype}
  </p>

  <!-- Level / power boost -->
  <div class="flex items-center gap-2 mt-0.5">
    <span class="font-mono text-[10px]" style="color: var(--color-on-surface-variant);">
      Lv {entry.level ?? 1}
    </span>
    {#if (entry.level ?? 1) > 1}
      <span class="font-mono text-[10px] px-1.5 py-0.5 rounded"
        style="background: rgba(134,239,172,0.12); border: 1px solid rgba(134,239,172,0.25); color: #86efac;">
        +{(entry.level - 1)}% Power
      </span>
    {/if}
  </div>

  <!-- Equipped gear indicator -->
  {#if (entry.equippedWeapons?.length ?? 0) + (entry.equippedArmors?.length ?? 0) + (entry.equippedPowers?.length ?? 0) > 0}
    <div class="flex gap-1 flex-wrap mt-0.5">
      {#if (entry.equippedWeapons?.length ?? 0) > 0}
        <span class="font-mono text-[9px] px-1.5 py-0.5 rounded"
          style="background: rgba(129,140,248,0.12); border: 1px solid rgba(129,140,248,0.25); color: #818cf8;">
          ⚔ ×{entry.equippedWeapons.length}
        </span>
      {/if}
      {#if (entry.equippedArmors?.length ?? 0) > 0}
        <span class="font-mono text-[9px] px-1.5 py-0.5 rounded"
          style="background: rgba(45,212,191,0.12); border: 1px solid rgba(45,212,191,0.25); color: #2dd4bf;">
          🛡 ×{entry.equippedArmors.length}
        </span>
      {/if}
      {#if (entry.equippedPowers?.length ?? 0) > 0}
        <span class="font-mono text-[9px] px-1.5 py-0.5 rounded"
          style="background: rgba(251,146,60,0.12); border: 1px solid rgba(251,146,60,0.25); color: #fb923c;">
          ⚡ ×{entry.equippedPowers.length}
        </span>
      {/if}
    </div>
  {/if}

  <!-- Sell button -->
  <button
    class="metal-stamp-crimson w-full rounded text-sm font-bold font-mono"
    style="min-height: 36px; margin-top: 4px; color: #ffb4ab;"
    onclick={(e) => { e.stopPropagation(); onSell(entry); }}
  >
    Sell Character
  </button>
</div>
