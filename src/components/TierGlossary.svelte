<script lang="ts">
  // Lightweight modal explaining the full tier ladder. Mounted on demand from
  // any tier badge that has the data-tier-glossary attribute. Keeps players
  // from having to memorise the F– → Absolute progression.
  import { TIER_THRESHOLDS } from '$lib/game/scoreTier'
  let { open = $bindable(false) }: { open?: boolean } = $props()

  // Grouped tier ladder. The first entry of each group is the "name" tier;
  // each tier also has a flavour note so it doesn't look like a wall of names.
  const TIER_GROUPS: { name: string; tiers: string[]; color: string; flavor: string }[] = [
    { name: 'Failure',     tiers: ['F–', 'F', 'F+'],          color: '#6b7280', flavor: 'You exist. Just barely.' },
    { name: 'Worthless',   tiers: ['E–', 'E', 'E+'],          color: '#9ca3af', flavor: 'Better than dead. Marginally.' },
    { name: 'Mediocre',    tiers: ['D–', 'D', 'D+'],          color: '#d97706', flavor: 'A working-class fate.' },
    { name: 'Common',      tiers: ['C–', 'C', 'C+'],          color: '#3b82f6', flavor: 'The journeyman threshold.' },
    { name: 'Capable',     tiers: ['B–', 'B', 'B+'],          color: '#10b981', flavor: 'Now we\'re talking.' },
    { name: 'Excellent',   tiers: ['A–', 'A', 'A+'],          color: '#8b5cf6', flavor: 'Heroic stock.' },
    { name: 'Superior',    tiers: ['S–', 'S', 'S+'],          color: '#ef4444', flavor: 'Story-altering power.' },
    { name: 'Mythic',      tiers: ['SS–', 'SS', 'SS+'],       color: '#f97316', flavor: 'Reality starts to bend.' },
    { name: 'Legendary',   tiers: ['SSS–', 'SSS', 'SSS+'],    color: '#eab308', flavor: 'Recorded in history.' },
    { name: 'Beyond',      tiers: ['Z–', 'Z', 'Z+'],          color: '#06b6d4', flavor: 'The ladder ran out. We made more.' },
    { name: 'Far Beyond',  tiers: ['ZZ–', 'ZZ', 'ZZ+'],       color: '#6366f1', flavor: 'Numbers stop applying.' },
    { name: 'Apocalyptic', tiers: ['ZZZ–', 'ZZZ', 'ZZZ+'],    color: '#ec4899', flavor: 'You are now the boss fight.' },
    { name: 'Celestial',   tiers: ['Celestial–', 'Celestial', 'Celestial+'], color: '#0ea5e9', flavor: 'Galactic relevance.' },
    { name: 'Godly',       tiers: ['Godly–', 'Godly'],        color: '#fbbf24', flavor: 'Pantheon-tier.' },
    { name: 'Primordial',  tiers: ['Primordial'],             color: '#ffffff', flavor: 'Pre-creation power.' },
    { name: 'Absolute',    tiers: ['Absolute–', 'Absolute', 'Absolute+'], color: '#00ffff', flavor: 'The ceiling. There is none above.' },
  ]
</script>

{#if open}
  <div
    class="fixed inset-0 z-[80] flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.92); backdrop-filter: blur(14px); animation: tgFadeIn 0.2s ease-out forwards;"
    onclick={() => open = false}
    role="presentation"
  >
    <div
      class="obsidian-slab w-full max-w-md rounded-2xl relative overflow-hidden flex flex-col"
      style="max-height: min(85vh, 720px); border: 1px solid rgba(240,192,64,0.32); box-shadow: 0 0 80px rgba(0,0,0,0.96), 0 0 40px rgba(240,192,64,0.08);"
      onclick={(e) => e.stopPropagation()}
      role="dialog" tabindex="-1"
      aria-modal="true"
      aria-labelledby="tier-glossary-title"
    >
      <div class="noise-overlay"></div>
      <div class="absolute top-3 left-3 w-7 h-7 pointer-events-none" style="border-top: 2px solid rgba(240,192,64,0.45); border-left: 2px solid rgba(240,192,64,0.45);"></div>
      <div class="absolute top-3 right-3 w-7 h-7 pointer-events-none" style="border-top: 2px solid rgba(240,192,64,0.45); border-right: 2px solid rgba(240,192,64,0.45);"></div>
      <div class="absolute bottom-3 left-3 w-7 h-7 pointer-events-none" style="border-bottom: 2px solid rgba(240,192,64,0.45); border-left: 2px solid rgba(240,192,64,0.45);"></div>
      <div class="absolute bottom-3 right-3 w-7 h-7 pointer-events-none" style="border-bottom: 2px solid rgba(240,192,64,0.45); border-right: 2px solid rgba(240,192,64,0.45);"></div>

      <!-- Header -->
      <div class="relative z-10 flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined" style="color: #f0c040; font-size: 20px; font-variation-settings: 'FILL' 1;">menu_book</span>
          <h2 id="tier-glossary-title" style="font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.12em;">Tier Ladder</h2>
        </div>
        <button
          onclick={() => open = false}
          aria-label="Close glossary"
          style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #9a907b; cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"
        >
          <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
        </button>
      </div>

      <!-- Body -->
      <div class="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        <p class="text-xs mb-4" style="color: #9a907b; line-height: 1.5; font-family: 'JetBrains Mono', monospace;">
          {TIER_THRESHOLDS.length}+ grades, lowest to highest. Each stat lands on one. The "+" or "–" within a tier is the score band inside it.
        </p>
        <div class="flex flex-col gap-2.5">
          {#each TIER_GROUPS as group}
            <div class="rounded-lg px-3 py-2.5" style="background: {group.color}10; border: 1px solid {group.color}33;">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold" style="font-family: 'Cinzel', serif; font-size: 0.82rem; color: {group.color}; letter-spacing: 0.06em;">{group.name}</span>
                <div class="flex gap-1 flex-wrap">
                  {#each group.tiers as t}
                    <span class="font-mono text-[10px] px-1.5 py-0.5 rounded" style="background: {group.color}22; border: 1px solid {group.color}55; color: {group.color}; letter-spacing: 0.04em;">{t}</span>
                  {/each}
                </div>
              </div>
              <p class="text-[10px] mt-1.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; line-height: 1.45;">{group.flavor}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes tgFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
</style>
