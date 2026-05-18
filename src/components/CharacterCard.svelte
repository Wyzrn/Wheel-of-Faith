<script lang="ts">
  import type { SpinResult } from '$lib/session/types'
  import { computeOverallScore, scoreTier } from '$lib/game/scoreTier'
  import { archetypes } from '$lib/content/archetypes'
  import { powers as powersPool } from '$lib/content/powers'
  import { weapons as weaponsPool } from '$lib/content/weapons'
  import { armors as armorsPool } from '$lib/content/armors'
  import { ITEM_GRADE_INFO, ELEMENT_COLORS, ELEMENT_ICONS, highestGrade } from '$lib/content/elements'
  import type { ItemGrade } from '$lib/content/types'
  import { onMount, onDestroy } from 'svelte'

  let { results, name = '', startedAt, readonly = false, rivalsWins = 0, onNewCharacter, onBackToMenu }: {
    results: SpinResult[]
    name?: string
    startedAt: string
    readonly?: boolean
    rivalsWins?: number
    onNewCharacter: () => void
    onBackToMenu?: () => void
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
    'Z-':'#0e7490','Z':'#0891b2','Z+':'#06b6d4',
    'ZZ-':'#3730a3','ZZ':'#4f46e5','ZZ+':'#818cf8',
    'ZZZ-':'#9d174d','ZZZ':'#be185d','ZZZ+':'#ec4899',
    'Celestial-':'#075985','Celestial':'#0284c7','Celestial+':'#38bdf8',
    'Godly-':'#c026d3','Godly':'#e879f9',
    'Primordial':'#ffffff',
  }

  let displayName       = $derived(name?.trim() || 'The Unnamed')
  let race              = $derived(get('race'))
  let raceType          = $derived(get('raceSubType'))
  let raceClass         = $derived(get('raceClass'))
  let devilFruitName    = $derived(get('devilFruitName'))
  let transformation    = $derived(get('raceTransformation'))
  let archetype         = $derived(get('archetype'))
  let archetypeTypeLabel = $derived(archetypes.find(a => a.label === archetype)?.archetypeType ?? null)
  let backstory         = $derived(get('backstory'))
  let height            = $derived(get('height'))
  let gender            = $derived(get('gender'))
  let title             = $derived(get('title'))
  let racialAbilities   = $derived(getAll('racialAbility'))
  let archetypeAbilities = $derived(getAll('archetypeAbility'))
  let powers            = $derived(getAll('power'))
  let weaknesses        = $derived(getAll('weakness'))
  let weapon            = $derived(get('weapon'))
  let weaponType        = $derived(get('weaponType'))
  let weaponEnchs       = $derived(getAll('weaponEnchantment'))
  let armor             = $derived(get('armor'))
  let armorType         = $derived(get('armorType'))
  let armorEnchs        = $derived(getAll('armorEnchantment'))
  let possessionRace    = $derived(get('possessionRace'))
  let possessionStrength = $derived(get('possessionStrength'))
  let redemptionOutcome = $derived(results.find(r => r.category === 'redemptionOutcome')?.resultLabel)

  const statCategories = ['strength','speed','agility','durability','iq','charisma','fightingSkill','powerMastery','weaponMastery','armorStrength','potential','energyLevel'] as const
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

  // Content lookup maps — built once from static pool arrays
  const powerMap  = new Map(powersPool.map(p => [p.label, p]))
  const weaponMap = new Map(weaponsPool.map(w => [w.label, w]))
  const armorMap  = new Map(armorsPool.map(a => [a.label, a]))

  let topPowerGrade = $derived(highestGrade(powers.map(label => powerMap.get(label)?.grade)))
  let weaponGrade   = $derived((weaponMap.get(weapon)?.grade ?? 'F') as ItemGrade)
  let armorGrade    = $derived((armorMap.get(armor)?.grade  ?? 'F') as ItemGrade)
  let weaponElement = $derived(weaponMap.get(weapon)?.element)
  let armorElement  = $derived(armorMap.get(armor)?.element)

  // ── Save & Share state ────────────────────────────────────────────────────

  let saving         = $state(false)
  let shareUrl       = $state<string | null>(null)
  let saveError      = $state<string | null>(null)
  let copied         = $state(false)
  let shareInGallery = $state(false)
  // now ticks every second so canSave/$derived values update in real time
  let now = $state(Date.now())

  let intervalId: ReturnType<typeof setInterval> | null = null

  onMount(() => {
    intervalId = setInterval(() => { now = Date.now() }, 1000)
  })

  onDestroy(() => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  })

  // Session age in seconds from the startedAt prop timestamp
  let sessionAgeSec = $derived((now - new Date(startedAt).getTime()) / 1000)

  // canSave: true when 90s minimum is met AND session is under 24h old.
  // Per RESEARCH.md Assumption A4: on a share view the session_started_at is the original
  // session timestamp. Sessions over 24h are treated as archived share views — we hide
  // the Save button to avoid duplicate re-saves of the same character from the share URL.
  let canSave = $derived(sessionAgeSec >= 90 && sessionAgeSec < 86400)

  async function handleSaveAndShare() {
    saving = true
    saveError = null
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName,
          // race and archetype extracted from results by category — NOT raceClass or raceSubType
          race: results.find(r => r.category === 'race')?.resultLabel ?? '',
          archetype: results.find(r => r.category === 'archetype')?.resultLabel ?? '',
          overall_score: overallScore,
          overall_tier: overallGrade,
          spins: results,
          session_started_at: startedAt,
          share_in_gallery: shareInGallery,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 429) {
          saveError = 'Too many saves from this device. Try again in a few minutes.'
        } else if (res.status === 422) {
          saveError = 'Session too brief — fate needs at least 90 seconds to settle.'
        } else {
          saveError = (body as { message?: string }).message ?? 'Save failed — please try again.'
        }
        return
      }

      const { shareId, url } = await res.json() as { shareId: string; url: string }
      shareUrl = `${window.location.origin}${url}`
      // persist to local character list for the View Characters menu
      try {
        const existing: string[] = JSON.parse(localStorage.getItem('wof_saved_chars') ?? '[]')
        if (!existing.includes(shareId)) {
          localStorage.setItem('wof_saved_chars', JSON.stringify([shareId, ...existing].slice(0, 50)))
        }
      } catch { /* ignore storage errors */ }
    } finally {
      saving = false
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // Clipboard API not available (private browsing, insecure context, etc.)
      // The URL pill text is selectable so users can copy manually (T-04-14 mitigation)
    }
    copied = true
    setTimeout(() => { copied = false }, 1500)
  }
</script>

<div class="w-full max-w-3xl flex flex-col gap-5" style="animation: slideUp 0.4s ease-out forwards;">

  <!-- Hero banner: grade + name + identity -->
  <div class="rounded-xl p-6 relative overflow-hidden"
    style="background: linear-gradient(135deg, {TIER_COLORS[overallGrade] ?? '#1f1f28'}22 0%, #0d0c16 100%); border: 1px solid {TIER_COLORS[overallGrade] ?? '#4e4635'}55; box-shadow: 0 0 50px {TIER_COLORS[overallGrade] ?? '#374151'}28, inset 1px 1px 0 rgba(255,223,150,0.1);"
  >
    <!-- Noise texture -->
    <div class="noise-overlay"></div>
    <!-- Corner brackets -->
    <div class="absolute top-3 left-3 w-8 h-8" style="border-top: 2px solid {TIER_COLORS[overallGrade] ?? 'rgba(240,192,64,0.4)'}60; border-left: 2px solid {TIER_COLORS[overallGrade] ?? 'rgba(240,192,64,0.4)'}60;"></div>
    <div class="absolute top-3 right-3 w-8 h-8" style="border-top: 2px solid {TIER_COLORS[overallGrade] ?? 'rgba(240,192,64,0.4)'}60; border-right: 2px solid {TIER_COLORS[overallGrade] ?? 'rgba(240,192,64,0.4)'}60;"></div>
    <div class="absolute bottom-3 left-3 w-8 h-8" style="border-bottom: 2px solid {TIER_COLORS[overallGrade] ?? 'rgba(240,192,64,0.4)'}60; border-left: 2px solid {TIER_COLORS[overallGrade] ?? 'rgba(240,192,64,0.4)'}60;"></div>
    <div class="absolute bottom-3 right-3 w-8 h-8" style="border-bottom: 2px solid {TIER_COLORS[overallGrade] ?? 'rgba(240,192,64,0.4)'}60; border-right: 2px solid {TIER_COLORS[overallGrade] ?? 'rgba(240,192,64,0.4)'}60;"></div>
    <div class="flex items-start justify-between gap-4 relative z-10">
      <!-- Grade column -->
      <div class="shrink-0">
        <p class="text-xs tracking-[0.2em] uppercase mb-1" style="font-family: 'JetBrains Mono', monospace; color: {TIER_COLORS[overallGrade] ?? '#9a907b'};">Overall Grade</p>
        <p class="leading-none font-black" style="font-family: 'Cinzel', serif; font-size: clamp(3rem, 12vw, 4.5rem); color: {TIER_COLORS[overallGrade] ?? '#ffdf96'}; filter: drop-shadow(0 0 12px {TIER_COLORS[overallGrade] ?? '#f0c040'}55);">{overallGrade}</p>
        <p class="text-xs mt-1" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Score {overallScore} / 150</p>
      </div>
      <!-- Identity column -->
      <div class="text-right min-w-0">
        {#if title !== '—'}
          <p class="text-xs tracking-[0.18em] uppercase mb-1" style="color: #a78bfa;">{title}</p>
        {/if}
        <h1 style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 6vw, 2rem); font-weight: 700; color: #ffdf96; line-height: 1.15; word-break: break-word;">{displayName}</h1>
        <p class="text-sm mt-1.5" style="color: #d2c5ae;">
          {raceType !== '—' ? `${raceType} ` : ''}{race} · {archetype}{archetypeTypeLabel ? ` · ${archetypeTypeLabel}` : ''}
        </p>
        {#if raceClass !== '—'}
          <p class="text-xs mt-0.5 font-semibold" style="color: #fb923c;">{raceClass}</p>
        {/if}
        {#if devilFruitName !== '—'}
          <p class="text-xs mt-0.5" style="color: #7dd3fc; font-family: 'JetBrains Mono', monospace;">{devilFruitName}</p>
        {/if}
        {#if transformation !== '—'}
          <p class="text-xs mt-0.5 font-semibold" style="color: #fb923c;">{transformation}</p>
        {/if}
        {#if height !== '—' || gender !== '—'}
          <p class="text-xs mt-0.5" style="color: #9a907b;">
            {[gender, height].filter(v => v !== '—').join(' · ')}
          </p>
        {/if}
      </div>
    </div>
  </div>

  {#if backstory !== '—'}
    <p class="text-sm italic text-center px-3" style="color: #9a907b;">"{backstory}"</p>
  {/if}

  <!-- Combat Grades -->
  {#if powers.length > 0 || (weapon !== '—' && weapon !== 'No Weapon') || armor !== '—'}
    <div class="flex gap-3">
      {#if powers.length > 0}
        <div class="flex-1 obsidian-slab rounded-lg px-3 py-2.5 text-center" style="border: 1px solid {ITEM_GRADE_INFO[topPowerGrade].color}44;">
          <p class="text-[9px] tracking-[0.18em] uppercase mb-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Power Grade</p>
          <p class="text-base font-black leading-none" style="color: {ITEM_GRADE_INFO[topPowerGrade].color}; font-family: 'Cinzel', serif; filter: drop-shadow(0 0 8px {ITEM_GRADE_INFO[topPowerGrade].glow});">{topPowerGrade}</p>
          <p class="text-[9px] mt-1" style="color: #9a907b;">{ITEM_GRADE_INFO[topPowerGrade].label}</p>
        </div>
      {/if}
      {#if weapon !== '—' && weapon !== 'No Weapon'}
        <div class="flex-1 obsidian-slab rounded-lg px-3 py-2.5 text-center" style="border: 1px solid {ITEM_GRADE_INFO[weaponGrade].color}44;">
          <p class="text-[9px] tracking-[0.18em] uppercase mb-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Weapon Grade</p>
          <p class="text-base font-black leading-none" style="color: {ITEM_GRADE_INFO[weaponGrade].color}; font-family: 'Cinzel', serif; filter: drop-shadow(0 0 8px {ITEM_GRADE_INFO[weaponGrade].glow});">{weaponGrade}</p>
          <p class="text-[9px] mt-1" style="color: #9a907b;">{ITEM_GRADE_INFO[weaponGrade].label}</p>
        </div>
      {/if}
      {#if armor !== '—'}
        <div class="flex-1 obsidian-slab rounded-lg px-3 py-2.5 text-center" style="border: 1px solid {ITEM_GRADE_INFO[armorGrade].color}44;">
          <p class="text-[9px] tracking-[0.18em] uppercase mb-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Armor Grade</p>
          <p class="text-base font-black leading-none" style="color: {ITEM_GRADE_INFO[armorGrade].color}; font-family: 'Cinzel', serif; filter: drop-shadow(0 0 8px {ITEM_GRADE_INFO[armorGrade].glow});">{armorGrade}</p>
          <p class="text-[9px] mt-1" style="color: #9a907b;">{ITEM_GRADE_INFO[armorGrade].label}</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Stats grid -->
  <div>
    <p class="text-xs tracking-[0.18em] uppercase mb-3" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Stats</p>
    <div class="grid grid-cols-2 gap-1.5">
      {#each stats as stat}
        {#if stat.label !== '—'}
          <div class="obsidian-slab rounded-lg px-3 py-2 flex items-center gap-2"
            style="border-left: 3px solid {TIER_COLORS[stat.tier ?? ''] ?? '#4e4635'}; border-top: none; border-right: none; border-bottom: none;">
            {#if stat.tier}
              <span class="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                style="background: {TIER_COLORS[stat.tier] ?? '#374151'}22; color: {TIER_COLORS[stat.tier] ?? '#9a907b'}; border: 1px solid {TIER_COLORS[stat.tier] ?? '#4e4635'}66; box-shadow: 0 0 6px {TIER_COLORS[stat.tier] ?? 'transparent'}33;">
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
            <li class="obsidian-slab text-xs rounded px-3 py-2" style="color: #e4e1ee; border: 1px solid rgba(240,192,64,0.12); border-left: 2px solid rgba(240,192,64,0.35);">{ab}</li>
          {/each}
        </ul>
      </div>
    {/if}
    {#if archetypeAbilities.length > 0}
      <div>
        <p class="text-xs tracking-[0.15em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Archetype Abilities</p>
        <ul class="space-y-1">
          {#each archetypeAbilities as ab}
            <li class="obsidian-slab text-xs rounded px-3 py-2" style="color: #e4e1ee; border: 1px solid rgba(139,92,246,0.15); border-left: 2px solid rgba(139,92,246,0.4);">{ab}</li>
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
          {@const pInfo = powerMap.get(p)}
          {@const pColor = pInfo?.element ? ELEMENT_COLORS[pInfo.element] : '#8b5cf6'}
          {@const pGrade = pInfo?.grade ?? 'F'}
          {@const pGradeInfo = ITEM_GRADE_INFO[pGrade]}
          <span class="text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5"
            style="background: {pColor}18; color: {pColor}dd; border: 1px solid {pColor}44;">
            {#if pInfo?.element}<span style="font-size: 11px; line-height: 1;">{ELEMENT_ICONS[pInfo.element]}</span>{/if}
            {p}
            <span class="text-[9px] font-bold px-1 py-0.5 rounded shrink-0"
              style="background: {pGradeInfo.color}22; color: {pGradeInfo.color}; border: 1px solid {pGradeInfo.color}55;">{pGrade}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Weapon -->
  {#if weapon !== '—' && weapon !== 'No Weapon'}
    {@const wBorderColor = weaponElement ? ELEMENT_COLORS[weaponElement] : 'rgba(240,192,64,0.4)'}
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm" style="color: #f0c040; font-variation-settings: 'FILL' 1;">swords</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Weapon</p>
      </div>
      <div class="obsidian-slab rounded-lg px-4 py-3 flex flex-wrap items-center gap-3"
        style="border: 1px solid {wBorderColor}33; border-left: 3px solid {wBorderColor};">
        <span class="text-xs font-bold px-2 py-0.5 rounded"
          style="background: {ITEM_GRADE_INFO[weaponGrade].color}22; color: {ITEM_GRADE_INFO[weaponGrade].color}; border: 1px solid {ITEM_GRADE_INFO[weaponGrade].color}55;">
          {ITEM_GRADE_INFO[weaponGrade].label}
        </span>
        {#if weaponElement}
          <span class="text-xs" style="color: {ELEMENT_COLORS[weaponElement]};">{ELEMENT_ICONS[weaponElement]} {weaponElement}</span>
        {/if}
        {#if weaponType !== '—'}
          <span class="text-xs px-2 py-1 rounded" style="background: rgba(240,192,64,0.08); color: #9a907b; border: 1px solid rgba(240,192,64,0.15);">{weaponType}</span>
        {/if}
        <span class="text-sm font-medium" style="color: #e4e1ee;">{weapon}</span>
        {#each weaponEnchs as ench}
          <span class="text-xs" style="color: #f0c040;">✦ {ench}</span>
        {/each}
        {#if getTier('weaponMastery')}
          <span class="ml-auto text-xs font-bold px-1.5 py-0.5 rounded"
            style="background: {TIER_COLORS[getTier('weaponMastery') ?? ''] ?? '#374151'}22; color: {TIER_COLORS[getTier('weaponMastery') ?? ''] ?? '#9a907b'}; border: 1px solid {TIER_COLORS[getTier('weaponMastery') ?? ''] ?? '#4e4635'}66;">
            {getTier('weaponMastery')}
          </span>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Armor -->
  {#if armor !== '—'}
    {@const aBorderColor = armorElement ? ELEMENT_COLORS[armorElement] : 'rgba(251,146,60,0.4)'}
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm" style="color: #fb923c; font-variation-settings: 'FILL' 1;">shield</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Armor</p>
      </div>
      <div class="obsidian-slab rounded-lg px-4 py-3 flex flex-wrap items-center gap-3"
        style="border: 1px solid {aBorderColor}33; border-left: 3px solid {aBorderColor};">
        <span class="text-xs font-bold px-2 py-0.5 rounded"
          style="background: {ITEM_GRADE_INFO[armorGrade].color}22; color: {ITEM_GRADE_INFO[armorGrade].color}; border: 1px solid {ITEM_GRADE_INFO[armorGrade].color}55;">
          {ITEM_GRADE_INFO[armorGrade].label}
        </span>
        {#if armorElement}
          <span class="text-xs" style="color: {ELEMENT_COLORS[armorElement]};">{ELEMENT_ICONS[armorElement]} {armorElement}</span>
        {/if}
        {#if armorType !== '—'}
          <span class="text-xs px-2 py-1 rounded" style="background: rgba(251,146,60,0.08); color: #9a907b; border: 1px solid rgba(251,146,60,0.15);">{armorType}</span>
        {/if}
        <span class="text-sm font-medium" style="color: #e4e1ee;">{armor}</span>
        {#each armorEnchs as ench}
          <span class="text-xs" style="color: #fb923c;">✦ {ench}</span>
        {/each}
        {#if getTier('armorStrength')}
          <span class="ml-auto text-xs font-bold px-1.5 py-0.5 rounded"
            style="background: {TIER_COLORS[getTier('armorStrength') ?? ''] ?? '#374151'}22; color: {TIER_COLORS[getTier('armorStrength') ?? ''] ?? '#9a907b'}; border: 1px solid {TIER_COLORS[getTier('armorStrength') ?? ''] ?? '#4e4635'}66;">
            {getTier('armorStrength')}
          </span>
        {/if}
      </div>
    </div>
  {/if}

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

  <!-- Possession -->
  {#if possessionRace !== '—'}
    <div class="rounded-lg px-4 py-3"
      style="background: linear-gradient(135deg, rgba(30,10,50,0.5), rgba(60,20,80,0.3)); border: 1px solid rgba(192,132,252,0.35);">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm" style="color: #c084fc; font-variation-settings: 'FILL' 1;">psychology</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #c084fc;">Possessed By</p>
      </div>
      <p class="text-sm font-medium" style="color: #e4e1ee;">{possessionRace}</p>
      {#if possessionStrength !== '—'}
        <p class="text-xs mt-1" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">{possessionStrength}</p>
      {/if}
    </div>
  {/if}

  <!-- Rivals Wins -->
  {#if rivalsWins > 0}
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm" style="color: #f0c040; font-variation-settings: 'FILL' 1;">workspace_premium</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Rivals Wins</p>
      </div>
      <div class="rounded-lg px-4 py-3 flex flex-wrap items-center gap-2" style="background: rgba(240,192,64,0.06); border: 1px solid rgba(240,192,64,0.25);">
        {#each Array.from({ length: Math.min(rivalsWins, 20) }, (_, i) => i) as _}
          <span class="material-symbols-outlined" style="font-size: 22px; color: #f0c040; font-variation-settings: 'FILL' 1;">workspace_premium</span>
        {/each}
        {#if rivalsWins > 20}
          <span class="text-sm font-bold" style="font-family: 'Cinzel', serif; color: #f0c040;">+{rivalsWins - 20}</span>
        {/if}
        <span class="ml-auto text-sm font-bold" style="font-family: 'Cinzel', serif; color: #ffdf96;">{rivalsWins} Win{rivalsWins !== 1 ? 's' : ''}</span>
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

  <!-- Action row (hidden on share/readonly views — nav handles navigation) -->
  {#if !readonly}
  <div class="flex flex-col gap-3 pt-1">

    {#if shareUrl}
      <!-- Success state: URL pill + Copy button -->
      <div class="flex flex-col gap-2">
        <div class="carved-groove flex items-center gap-2 rounded-lg px-4 py-3" style="border: 1px solid rgba(125,211,252,0.2);">
          <span class="text-xs flex-1 truncate" style="font-family: 'JetBrains Mono', monospace; color: #7dd3fc; user-select: text; cursor: text;">{shareUrl}</span>
          <button
            onclick={handleCopy}
            class="shrink-0 text-xs px-3 py-1.5 rounded font-bold transition-all active:scale-95 obsidian-slab"
            style="font-family: 'JetBrains Mono', monospace; color: {copied ? '#34d399' : '#7dd3fc'}; border: 1px solid {copied ? 'rgba(52,211,153,0.3)' : 'rgba(125,211,252,0.25)'};"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <!-- Secondary actions row -->
        <div class="flex gap-2">
          {#if onBackToMenu}
            <button
              onclick={onBackToMenu}
              class="obsidian-slab flex-1 py-2.5 rounded-lg text-xs tracking-[0.12em] uppercase font-bold transition-all active:scale-95"
              style="font-family: 'Cinzel', serif; color: #9a907b; border: 1px solid #4e4635;"
            >
              ← Menu
            </button>
          {/if}
          <button
            onclick={onNewCharacter}
            class="obsidian-slab flex-1 py-2.5 rounded-lg text-xs tracking-[0.15em] uppercase font-bold transition-all active:scale-95"
            style="font-family: 'Cinzel', serif; color: #d2c5ae; border: 1px solid rgba(240,192,64,0.2);"
          >
            Rewrite Destiny
          </button>
        </div>
      </div>

    {:else}
      <!-- Gallery opt-in toggle -->
      <label class="flex items-center gap-2.5 cursor-pointer select-none py-1" style="opacity: {saving ? 0.5 : 1};">
        <div class="relative shrink-0 w-9 h-5"
          onclick={() => { if (!saving) shareInGallery = !shareInGallery }}
          role="checkbox"
          aria-checked={shareInGallery}
          tabindex="0"
          onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !saving) shareInGallery = !shareInGallery }}
        >
          <div class="absolute inset-0 rounded-full transition-all duration-200"
            style="background: {shareInGallery ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.06)'}; border: 1px solid {shareInGallery ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.12)'};">
          </div>
          <div class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
            style="background: {shareInGallery ? '#a78bfa' : '#4e4635'}; left: {shareInGallery ? '18px' : '2px'}; box-shadow: 0 1px 4px rgba(0,0,0,0.4);">
          </div>
        </div>
        <span class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: {shareInGallery ? '#a78bfa' : '#6b7280'};">
          Share in public gallery
        </span>
      </label>

      <!-- Default / disabled / saving state: two buttons side by side -->
      <div class="flex gap-3">

        <!-- Save & Share button -->
        {#if canSave}
          <button
            onclick={handleSaveAndShare}
            disabled={saving}
            class="hammered-gold flex-1 py-3 rounded-lg relative"
            style="font-family: 'Cinzel', serif; font-size: 0.8rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; color: #f0c040; background: linear-gradient(180deg, #13121c 0%, #0c0b14 100%); opacity: {saving ? '0.7' : '1'};"
          >
            <div class="l-bracket" style="color: rgba(240,192,64,0.35);"></div>
            {saving ? 'Saving…' : 'Save & Share'}
          </button>
        {:else}
          <!-- Disabled -->
          <button
            disabled
            aria-disabled="true"
            class="obsidian-slab flex-1 py-3 rounded-lg text-sm tracking-[0.15em] uppercase font-bold"
            style="font-family: 'Cinzel', serif; color: #4e4635; border: 1px solid #2d3748; cursor: not-allowed;"
          >
            Save & Share
          </button>
        {/if}

        <button
          onclick={onNewCharacter}
          class="obsidian-slab flex-1 py-3 rounded-lg text-sm tracking-[0.15em] uppercase font-bold transition-all active:scale-95"
          style="font-family: 'Cinzel', serif; color: #d2c5ae; border: 1px solid rgba(240,192,64,0.22);"
        >
          Rewrite Destiny
        </button>
      </div>

      <!-- Inline explanation when disabled (aria-disabled + visible text per accessibility requirement) -->
      {#if !canSave && sessionAgeSec < 86400}
        <p class="text-xs text-center" style="font-family: 'JetBrains Mono', monospace; color: #6b7280;">
          Session too brief — fate needs at least 90 seconds to settle.
        </p>
      {/if}

      <!-- Error state -->
      {#if saveError}
        <p class="text-xs text-center" style="font-family: 'JetBrains Mono', monospace; color: #f87171;">
          {saveError}
        </p>
      {/if}

      <!-- Back to Menu (bottom, quiet) -->
      {#if onBackToMenu}
        <button
          onclick={onBackToMenu}
          class="w-full py-2 text-xs tracking-[0.12em] uppercase transition-all"
          style="font-family: 'JetBrains Mono', monospace; color: #4e4635; background: none; border: none; cursor: pointer;"
        >
          ← Back to Menu
        </button>
      {/if}

    {/if}

  </div>
  {/if}

</div>
