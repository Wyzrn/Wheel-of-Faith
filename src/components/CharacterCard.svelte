<script lang="ts">
  import type { SpinResult } from '$lib/session/types'
  import { computeOverallScore, scoreTier } from '$lib/game/scoreTier'

  let { results, name = '', onNewCharacter }: {
    results: SpinResult[]
    name?: string
    onNewCharacter: () => void
  } = $props()

  function get(category: string) {
    return results.find(r => r.category === category)?.resultLabel ?? '—'
  }

  function getAll(category: string) {
    return results.filter(r => r.category === category).map(r => r.resultLabel)
  }

  function getTier(category: string) {
    return results.find(r => r.category === category)?.tier
  }

  const TIER_COLORS: Record<string, string> = {
    'F-':'#555','F':'#666','F+':'#777',
    'E-':'#6b7280','E':'#9ca3af','E+':'#d1d5db',
    'D-':'#92400e','D':'#b45309','D+':'#d97706',
    'C-':'#1d4ed8','C':'#2563eb','C+':'#3b82f6',
    'B-':'#065f46','B':'#059669','B+':'#34d399',
    'A-':'#7c3aed','A':'#8b5cf6','A+':'#a78bfa',
    'S-':'#b91c1c','S':'#dc2626','S+':'#ef4444',
    'SS-':'#ea580c','SS':'#f97316','SS+':'#fb923c',
    'SSS-':'#ca8a04','SSS':'#eab308','SSS+':'#fde047',
    'God':'#e879f9',
  }

  let displayName       = $derived(name?.trim() || 'The Unnamed')
  let race              = $derived(get('race'))
  let raceType          = $derived(get('raceSubType'))
  let transformation    = $derived(get('raceTransformation'))
  let archetype         = $derived(get('archetype'))
  let backstory         = $derived(get('backstory'))
  let height            = $derived(get('height'))
  let title             = $derived(get('title'))
  let racialAbilities   = $derived(getAll('racialAbility'))
  let archetypeAbilities = $derived(getAll('archetypeAbility'))
  let powers            = $derived(getAll('power'))
  let weaknesses        = $derived(getAll('weakness'))
  let weapon            = $derived(get('weapon'))
  let weaponType        = $derived(get('weaponType'))
  let weaponEnch        = $derived(get('weaponEnchantment'))
  let redemptionOutcome = $derived(results.find(r => r.category === 'redemptionOutcome')?.resultLabel)

  const statCategories = ['strength','speed','agility','durability','iq','charisma','fightingSkill','powerMastery','weaponMastery','potential','energyLevel'] as const
  let stats = $derived(statCategories.map(cat => ({
    cat,
    label: results.find(r => r.category === cat)?.resultLabel ?? '—',
    tier: results.find(r => r.category === cat)?.tier,
    score: results.find(r => r.category === cat)?.score,
  })))

  let overallScore = $derived(computeOverallScore(
    Object.fromEntries(statCategories.map(cat => [cat, results.find(r => r.category === cat)?.score ?? 0]))
  ))
  let overallGrade = $derived(scoreTier(overallScore))
</script>

<div class="w-full max-w-3xl flex flex-col gap-5" style="animation: slideUp 0.4s ease-out forwards;">

  <!-- Hero banner: grade + name + identity -->
  <div class="rounded-xl p-6"
    style="background: linear-gradient(135deg, {TIER_COLORS[overallGrade] ?? '#1f1f28'}18, {TIER_COLORS[overallGrade] ?? '#1f1f28'}30); border: 1px solid {TIER_COLORS[overallGrade] ?? '#4e4635'}55; box-shadow: 0 0 40px {TIER_COLORS[overallGrade] ?? '#374151'}20;"
  >
    <div class="flex items-start justify-between gap-4">
      <!-- Grade column -->
      <div class="shrink-0">
        <p class="text-xs tracking-[0.2em] uppercase mb-1" style="font-family: 'JetBrains Mono', monospace; color: {TIER_COLORS[overallGrade] ?? '#9a907b'};">Overall Grade</p>
        <p class="leading-none font-black" style="font-family: 'Cinzel', serif; font-size: clamp(3rem, 12vw, 4.5rem); color: {TIER_COLORS[overallGrade] ?? '#ffdf96'}; filter: drop-shadow(0 0 12px {TIER_COLORS[overallGrade] ?? '#f0c040'}55);">{overallGrade}</p>
        <p class="text-xs mt-1" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Score {overallScore} / 100</p>
      </div>
      <!-- Identity column -->
      <div class="text-right min-w-0">
        {#if title !== '—'}
          <p class="text-xs tracking-[0.18em] uppercase mb-1" style="color: #a78bfa;">{title}</p>
        {/if}
        <h1 style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 6vw, 2rem); font-weight: 700; color: #ffdf96; line-height: 1.15; word-break: break-word;">{displayName}</h1>
        <p class="text-sm mt-1.5" style="color: #d2c5ae;">
          {raceType !== '—' ? `${raceType} ` : ''}{race} · {archetype}
        </p>
        {#if transformation !== '—'}
          <p class="text-xs mt-0.5 font-semibold" style="color: #fb923c;">{transformation}</p>
        {/if}
        {#if height !== '—'}
          <p class="text-xs mt-0.5" style="color: #9a907b;">{height}</p>
        {/if}
      </div>
    </div>
  </div>

  {#if backstory !== '—'}
    <p class="text-sm italic text-center px-3" style="color: #9a907b;">"{backstory}"</p>
  {/if}

  <!-- Stats grid -->
  <div>
    <p class="text-xs tracking-[0.18em] uppercase mb-3" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Stats</p>
    <div class="grid grid-cols-2 gap-1.5">
      {#each stats as stat}
        {#if stat.label !== '—'}
          <div class="rounded-lg px-3 py-2 flex items-center gap-2"
            style="background: #0d0d16; border-left: 2px solid {TIER_COLORS[stat.tier ?? ''] ?? '#4e4635'};">
            {#if stat.tier}
              <span class="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                style="background: {TIER_COLORS[stat.tier] ?? '#374151'}22; color: {TIER_COLORS[stat.tier] ?? '#9a907b'}; border: 1px solid {TIER_COLORS[stat.tier] ?? '#4e4635'}66;">
                {stat.tier}
              </span>
            {/if}
            <span class="text-xs capitalize shrink-0" style="color: #9a907b; width: 5rem;">{stat.cat.replace(/([A-Z])/g, ' $1').trim()}</span>
            <span class="text-xs truncate" style="color: #e4e1ee;">{stat.label}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Abilities -->
  <div class="grid grid-cols-2 gap-4">
    {#if racialAbilities.length > 0}
      <div>
        <p class="text-xs tracking-[0.15em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Racial Abilities</p>
        <ul class="space-y-1">
          {#each racialAbilities as ab}
            <li class="text-xs rounded px-3 py-2" style="background: #0d0d16; color: #e4e1ee; border: 1px solid rgba(240,192,64,0.1);">{ab}</li>
          {/each}
        </ul>
      </div>
    {/if}
    {#if archetypeAbilities.length > 0}
      <div>
        <p class="text-xs tracking-[0.15em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Archetype Abilities</p>
        <ul class="space-y-1">
          {#each archetypeAbilities as ab}
            <li class="text-xs rounded px-3 py-2" style="background: #0d0d16; color: #e4e1ee; border: 1px solid rgba(240,192,64,0.1);">{ab}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <!-- Powers -->
  {#if powers.length > 0}
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm" style="color: #a78bfa; font-variation-settings: 'FILL' 1;">bolt</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Powers</p>
      </div>
      <div class="flex flex-wrap gap-1.5">
        {#each powers as p}
          <span class="text-xs px-3 py-1.5 rounded-full" style="background: rgba(91,33,182,0.22); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.3);">{p}</span>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Weapon -->
  <div>
    <div class="flex items-center gap-2 mb-2">
      <span class="material-symbols-outlined text-sm" style="color: #f0c040; font-variation-settings: 'FILL' 1;">swords</span>
      <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Weapon</p>
    </div>
    <div class="rounded-lg px-4 py-3 flex flex-wrap items-center gap-3" style="background: #0d0d16; border: 1px solid rgba(240,192,64,0.12);">
      {#if weaponType !== '—'}
        <span class="text-xs px-2 py-1 rounded" style="background: #1b1b24; color: #9a907b;">{weaponType}</span>
      {/if}
      <span class="text-sm font-medium" style="color: #e4e1ee;">{weapon}</span>
      {#if weaponEnch !== '—' && weaponEnch}
        <span class="text-xs" style="color: #f0c040;">✦ {weaponEnch}</span>
      {/if}
      {#if getTier('weaponMastery')}
        <span class="ml-auto text-xs font-bold px-1.5 py-0.5 rounded"
          style="background: {TIER_COLORS[getTier('weaponMastery') ?? ''] ?? '#374151'}22; color: {TIER_COLORS[getTier('weaponMastery') ?? ''] ?? '#9a907b'}; border: 1px solid {TIER_COLORS[getTier('weaponMastery') ?? ''] ?? '#4e4635'}66;">
          {getTier('weaponMastery')}
        </span>
      {/if}
    </div>
  </div>

  <!-- Weaknesses -->
  {#if weaknesses.length > 0}
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm" style="color: #f87171; font-variation-settings: 'FILL' 1;">warning</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Weaknesses</p>
      </div>
      <div class="flex flex-wrap gap-1.5">
        {#each weaknesses as w}
          <span class="text-xs px-3 py-1.5 rounded-full" style="background: rgba(127,29,29,0.25); color: #fca5a5; border: 1px solid rgba(248,113,113,0.22);">{w}</span>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Redemption -->
  {#if redemptionOutcome}
    <div class="rounded-lg px-4 py-3"
      style="background: linear-gradient(135deg, rgba(79,70,229,0.12), rgba(109,40,217,0.14)); border: 1px solid rgba(139,92,246,0.3);">
      <div class="flex items-center gap-2 mb-1">
        <span class="material-symbols-outlined text-sm" style="color: #a78bfa; font-variation-settings: 'FILL' 1;">auto_awesome</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #a78bfa;">Redemption</p>
      </div>
      <p class="text-sm font-medium" style="color: #e4e1ee;">{redemptionOutcome}</p>
    </div>
  {/if}

  <!-- Action buttons -->
  <div class="flex gap-3 pt-1">
    <button
      onclick={onNewCharacter}
      class="flex-1 py-3 rounded-lg text-sm tracking-[0.15em] uppercase font-bold transition-all active:scale-95"
      style="font-family: 'Cinzel', serif; color: #ffdf96; background: linear-gradient(135deg, #1c1a2a, #13121c); border: 1px solid #f0c040; box-shadow: 0 0 22px rgba(240,192,64,0.12);"
    >
      Rewrite Destiny
    </button>
  </div>

</div>
