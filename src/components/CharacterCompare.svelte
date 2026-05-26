<script lang="ts">
  // Side-by-side comparison of two roster characters. Shows the 11 stats with
  // tier badge per side, plus a diff column highlighting which side wins each
  // stat. Used from the roster (pick a second char to compare against the
  // currently-expanded one). Lightweight — pure presentation, no mutations.
  import type { StoryRosterEntry } from '$lib/story/types'
  import { powerRating, formatPower, powerBreakdown } from '$lib/story/powerRating'
  import TierBadge from './TierBadge.svelte'

  let { left, right, onClose }: {
    left: StoryRosterEntry
    right: StoryRosterEntry
    onClose: () => void
  } = $props()

  // The 11 stat categories shown in compare order. Keeps it identical to the
  // ordering players see during a spin session so they recognise the layout.
  const STAT_ORDER: { key: string; label: string }[] = [
    { key: 'strength',      label: 'Strength' },
    { key: 'speed',         label: 'Speed' },
    { key: 'agility',       label: 'Agility' },
    { key: 'durability',    label: 'Durability' },
    { key: 'iq',            label: 'IQ' },
    { key: 'charisma',      label: 'Charisma' },
    { key: 'fightingSkill', label: 'Fighting Skill' },
    { key: 'powerMastery',  label: 'Power Mastery' },
    { key: 'weaponMastery', label: 'Weapon Mastery' },
    { key: 'potential',     label: 'Potential' },
    { key: 'energyLevel',   label: 'Energy Level' },
  ]

  function statOf(e: StoryRosterEntry, key: string): { tier: string; score: number } {
    const r = e.spins.find(s => s.category === key)
    return { tier: (r?.tier as string) ?? '—', score: r?.score ?? 0 }
  }

  // Diff: positive means right is ahead, negative means left is ahead.
  function diff(l: { score: number }, r: { score: number }): number {
    return r.score - l.score
  }

  let lPwr = $derived(powerRating(left))
  let rPwr = $derived(powerRating(right))
  let pwrDiff = $derived(rPwr - lPwr)
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center px-4"
  style="background: rgba(7,7,13,0.92); backdrop-filter: blur(14px);"
  onclick={onClose} role="presentation">
  <div class="obsidian-slab w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl relative"
    onclick={(e) => e.stopPropagation()}
    role="dialog" aria-modal="true" aria-labelledby="compare-title"
    style="border: 1px solid rgba(240,192,64,0.32); box-shadow: 0 0 80px rgba(0,0,0,0.96), 0 0 40px rgba(240,192,64,0.08);">

    <!-- Header -->
    <div class="sticky top-0 z-10 px-5 py-4 flex items-center justify-between"
      style="background: rgba(13,12,22,0.96); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,255,255,0.06);">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined" style="font-size: 20px; color: #f0c040;">compare_arrows</span>
        <h2 id="compare-title" style="font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.1em;">Compare</h2>
      </div>
      <button onclick={onClose} aria-label="Close"
        style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #9a907b; cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
      </button>
    </div>

    <!-- Headers row: two character cards -->
    <div class="grid grid-cols-2 gap-3 px-5 pt-5">
      <div class="rounded-xl px-4 py-3 text-center" style="background: linear-gradient(160deg, rgba(125,211,252,0.10), #0c0b14 80%); border: 1px solid rgba(125,211,252,0.32);">
        <p class="font-bold text-base truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{left.name}</p>
        <p class="text-xs mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">{left.race} · {left.archetype}</p>
        <div class="mt-2 flex justify-center"><TierBadge grade={left.overallTier} interactive={false} /></div>
        <p class="font-mono text-xs mt-2 font-bold" style="color: #f0c040;">PWR {formatPower(lPwr)}</p>
      </div>
      <div class="rounded-xl px-4 py-3 text-center" style="background: linear-gradient(200deg, rgba(249,168,212,0.10), #0c0b14 80%); border: 1px solid rgba(249,168,212,0.32);">
        <p class="font-bold text-base truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{right.name}</p>
        <p class="text-xs mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">{right.race} · {right.archetype}</p>
        <div class="mt-2 flex justify-center"><TierBadge grade={right.overallTier} interactive={false} /></div>
        <p class="font-mono text-xs mt-2 font-bold" style="color: #f0c040;">PWR {formatPower(rPwr)}</p>
      </div>
    </div>

    <!-- Power Rating banner -->
    {#if pwrDiff !== 0}
      <div class="px-5 mt-4">
        <div class="rounded-lg px-3 py-2 text-center" style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.25);">
          <p class="font-mono text-xs" style="color: #9a907b;">
            <span style="color: #ffdf96; font-weight: 700;">{pwrDiff > 0 ? right.name : left.name}</span>
            leads by <span style="color: #f0c040; font-weight: 700;">{formatPower(Math.abs(pwrDiff))}</span> power
          </p>
        </div>
      </div>
    {/if}

    <!-- Stat rows -->
    <div class="px-5 py-4 space-y-2">
      <p class="font-mono text-[10px] tracking-[0.2em] uppercase" style="color: #4e4635;">Stat-by-stat</p>
      {#each STAT_ORDER as s}
        {@const ls = statOf(left, s.key)}
        {@const rs = statOf(right, s.key)}
        {@const d = diff(ls, rs)}
        {@const lLeads = d < 0}
        {@const rLeads = d > 0}
        <div class="grid items-center gap-2" style="grid-template-columns: 1fr 110px 1fr;">
          <div class="rounded-lg px-3 py-1.5 flex items-center justify-end gap-2"
            style="background: rgba(125,211,252,{lLeads ? '0.10' : '0.04'}); border: 1px solid rgba(125,211,252,{lLeads ? '0.32' : '0.10'});">
            <span class="font-mono text-xs" style="color: {lLeads ? '#ffdf96' : '#9a907b'}; font-weight: {lLeads ? '700' : '400'};">{ls.tier}</span>
            <TierBadge grade={ls.tier as any} interactive={false} />
          </div>
          <div class="text-center">
            <p class="font-mono text-[10px] tracking-widest uppercase" style="color: #4e4635;">{s.label}</p>
            {#if d !== 0}
              <p class="font-mono text-[10px] font-bold mt-0.5" style="color: {d > 0 ? '#f9a8d4' : '#7dd3fc'};">{d > 0 ? '+' : ''}{d}</p>
            {:else}
              <p class="font-mono text-[10px] mt-0.5" style="color: #4e4635;">tie</p>
            {/if}
          </div>
          <div class="rounded-lg px-3 py-1.5 flex items-center gap-2"
            style="background: rgba(249,168,212,{rLeads ? '0.10' : '0.04'}); border: 1px solid rgba(249,168,212,{rLeads ? '0.32' : '0.10'});">
            <TierBadge grade={rs.tier as any} interactive={false} />
            <span class="font-mono text-xs" style="color: {rLeads ? '#ffdf96' : '#9a907b'}; font-weight: {rLeads ? '700' : '400'};">{rs.tier}</span>
          </div>
        </div>
      {/each}
    </div>

    <!-- Equipped gear count -->
    <div class="px-5 pb-5">
      <p class="font-mono text-[10px] tracking-[0.2em] uppercase mb-2" style="color: #4e4635;">Equipped</p>
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-lg px-3 py-2 text-xs" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); color: #9a907b; font-family: 'JetBrains Mono', monospace;">
          ⚔ {left.equippedWeapons?.length ?? 0} · 🛡 {left.equippedArmors?.length ?? 0} · ⚡ {left.equippedPowers?.length ?? 0}
        </div>
        <div class="rounded-lg px-3 py-2 text-xs" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); color: #9a907b; font-family: 'JetBrains Mono', monospace;">
          ⚔ {right.equippedWeapons?.length ?? 0} · 🛡 {right.equippedArmors?.length ?? 0} · ⚡ {right.equippedPowers?.length ?? 0}
        </div>
      </div>
    </div>
  </div>
</div>
