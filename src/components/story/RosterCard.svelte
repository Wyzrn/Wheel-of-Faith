<script lang="ts">
  import type { StoryRosterEntry } from '$lib/story/types'
  import TierBadge from '../TierBadge.svelte'
  import { powerRating, formatPower } from '$lib/story/powerRating'
  import { raceGlyph } from '$lib/raceGlyphs'

  let { entry, onExpand, onSell, goldFrame = false }: {
    entry: StoryRosterEntry
    onExpand: (id: string) => void
    onSell: (entry: StoryRosterEntry) => void
    goldFrame?: boolean
  } = $props()

  const isHero    = entry.spinClass === 'hero'
  const isLegend  = entry.spinClass === 'legend'
  const isParagon = entry.spinClass === 'paragon'

  // Paragon overrides everything else (crimson glow); then legend (purple),
  // then hero (gold), then the optional gold_roster_frame upgrade.
  const borderIdle  = isParagon  ? 'rgba(244,63,94,0.55)'
                    : goldFrame  ? 'rgba(240,192,64,0.6)'
                    : isLegend   ? 'rgba(168,85,247,0.5)'
                    : isHero     ? 'rgba(251,191,36,0.5)'
                    :              'rgba(255,223,150,0.08)'
  const borderHover = isParagon  ? 'rgba(244,63,94,1.0)'
                    : goldFrame  ? 'rgba(240,192,64,1.0)'
                    : isLegend   ? 'rgba(168,85,247,0.9)'
                    : isHero     ? 'rgba(251,191,36,0.9)'
                    :              'rgba(240,192,64,0.25)'
  const shadowIdle  = isParagon  ? '0 0 16px rgba(244,63,94,0.5), 0 2px 8px rgba(0,0,0,0.5)'
                    : goldFrame  ? '0 0 10px rgba(240,192,64,0.3), 0 2px 8px rgba(0,0,0,0.5)'
                    : isLegend   ? '0 0 14px rgba(168,85,247,0.35), 0 2px 8px rgba(0,0,0,0.5)'
                    : isHero     ? '0 0 14px rgba(251,191,36,0.3),  0 2px 8px rgba(0,0,0,0.5)'
                    :              '0 2px 8px rgba(0,0,0,0.4)'
  const shadowHover = isParagon  ? '0 0 28px rgba(244,63,94,0.7), 0 4px 18px rgba(0,0,0,0.6)'
                    : goldFrame  ? '0 0 20px rgba(240,192,64,0.5), 0 4px 16px rgba(0,0,0,0.6)'
                    : isLegend   ? '0 0 22px rgba(168,85,247,0.55), 0 4px 16px rgba(0,0,0,0.6)'
                    : isHero     ? '0 0 22px rgba(251,191,36,0.45), 0 4px 16px rgba(0,0,0,0.6)'
                    :              '0 4px 16px rgba(0,0,0,0.6)'
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  role="button"
  tabindex="0"
  class="relative rounded-lg p-2 cursor-pointer flex flex-col gap-1"
  style="
    background: var(--color-surface-container-low);
    border: 1px solid {borderIdle};
    transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    box-shadow: {shadowIdle};
  "
  onclick={() => onExpand(entry.id)}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(entry.id); } }}
  onmouseenter={(e) => {
    const el = e.currentTarget as HTMLElement;
    el.style.borderColor = borderHover;
    el.style.transform = 'translateY(-2px)';
    el.style.boxShadow = shadowHover;
  }}
  onmouseleave={(e) => {
    const el = e.currentTarget as HTMLElement;
    el.style.borderColor = borderIdle;
    el.style.transform = 'translateY(0)';
    el.style.boxShadow = shadowIdle;
  }}
  onfocus={(e) => {
    (e.currentTarget as HTMLElement).style.outline = `2px solid ${borderHover}`;
    (e.currentTarget as HTMLElement).style.outlineOffset = '2px';
  }}
  onblur={(e) => {
    (e.currentTarget as HTMLElement).style.outline = '';
    (e.currentTarget as HTMLElement).style.outlineOffset = '';
  }}
>
  <!-- Spin class badge (top-left) -->
  {#if isParagon}
    <span class="absolute top-2 left-2 font-mono font-bold"
      style="font-size: 8px; letter-spacing: 0.12em; color: #f87171; text-shadow: 0 0 10px rgba(244,63,94,0.8);">
      PARAGON
    </span>
  {:else if isLegend}
    <span class="absolute top-2 left-2 font-mono font-bold"
      style="font-size: 8px; letter-spacing: 0.12em; color: #c084fc; text-shadow: 0 0 8px rgba(168,85,247,0.7);">
      LEGEND
    </span>
  {:else if isHero}
    <span class="absolute top-2 left-2 font-mono font-bold"
      style="font-size: 8px; letter-spacing: 0.12em; color: #fbbf24; text-shadow: 0 0 8px rgba(251,191,36,0.6);">
      HERO
    </span>
  {/if}

  <!-- TierBadge absolute top-right -->
  <div class="absolute top-2 right-2">
    <TierBadge grade={entry.overallTier} />
  </div>

  <!-- Name (indent when badge present) -->
  <p class="text-sm font-mono font-bold truncate pr-14" style="color: var(--color-on-surface); {isHero || isLegend ? 'padding-top: 14px;' : ''}">
    {entry.name}
  </p>

  <!-- Race + glyph (Material Symbols icon picked per race in raceGlyphs.ts) -->
  <p class="text-sm font-mono truncate flex items-center gap-1.5" style="color: var(--color-on-surface-variant);">
    <span class="material-symbols-outlined shrink-0"
      style="font-size: 16px; color: var(--color-outline); font-variation-settings: 'FILL' 1; opacity: 0.85;"
      aria-hidden="true">{raceGlyph(entry.race)}</span>
    <span class="truncate">{entry.race}</span>
  </p>

  <!-- Archetype -->
  <p class="text-sm font-mono truncate" style="color: var(--color-outline);">
    {entry.archetype}
  </p>

  <!-- Level / power boost + Power Rating headline -->
  <div class="flex items-center gap-2 mt-0.5 flex-wrap">
    <span class="font-mono text-[10px]" style="color: var(--color-on-surface-variant);">
      Lv {entry.level ?? 1}{#if (entry.level ?? 1) >= 100} <span style="color: #f0c040;">MAX</span>{:else}/100{/if}
    </span>
    {#if (entry.level ?? 1) > 1}
      <span class="font-mono text-[10px] px-1.5 py-0.5 rounded"
        style="background: rgba(134,239,172,0.12); border: 1px solid rgba(134,239,172,0.25); color: #86efac;">
        +{(entry.level - 1)}% Power
      </span>
    {/if}
    <!-- Power Rating — single-number headline combining overall score, gear,
         and level. Players can compare two roster characters at a glance. -->
    <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto"
      style="background: rgba(240,192,64,0.12); border: 1px solid rgba(240,192,64,0.28); color: #f0c040;"
      title="Power Rating — stats + gear + level combined">
      PWR {formatPower(powerRating(entry))}
    </span>
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
