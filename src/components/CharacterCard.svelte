<script lang="ts">
  import type { SpinResult } from '$lib/session/types'
  import { computeOverallScore, scoreTier, normalizeLegacyDisplayLabel } from '$lib/game/scoreTier'
  import { archetypes, getArchetype } from '$lib/content/archetypes'
  import { races } from '$lib/content/races'
  import { powers as powersPool } from '$lib/content/powers'
  import { weapons as weaponsPool } from '$lib/content/weapons'
  import { armors as armorsPool } from '$lib/content/armors'
  import { ITEM_GRADE_INFO, ELEMENT_COLORS, ELEMENT_ICONS, GRADE_ORDER, highestGrade } from '$lib/content/elements'
  import type { ItemGrade } from '$lib/content/types'
  import { classifyAbility, generatePowerDescription, generateWeaponDescription, generateArmorDescription, generateAbilityDescription, getAbilityTypeColor, getAbilityTypeIcon, ABILITY_BATTLE_EFFECT } from '$lib/content/descriptions'
  import { generateCharacterSummary } from '$lib/characterSummary'
  import { raceGlyph } from '$lib/raceGlyphs'
  import { getPerfTier } from '$lib/perf'
  import { onMount, onDestroy } from 'svelte'
  import { auth } from '$lib/stores/auth.svelte'
  import { toast } from '$lib/toast.svelte'

  interface EquippedItemProp { id: string; grade: string; name: string }

  let { results, name = '', startedAt, readonly = false, rivalsWins = 0, equippedItems, onNewCharacter, onBackToMenu, onSaved }: {
    results: SpinResult[]
    name?: string
    startedAt: string
    readonly?: boolean
    rivalsWins?: number
    equippedItems?: { weapons: EquippedItemProp[]; armors: EquippedItemProp[]; powers: EquippedItemProp[] }
    onNewCharacter: () => void
    onBackToMenu?: () => void
    // Fired when the user successfully POSTs this character to /api/characters.
    // Used by the parent (main page) to mark the matching history entry with
    // the returned shareId so the "Save to profile" CTA disappears.
    onSaved?: (shareId: string, startedAt: string) => void
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

  // Returns normalized displayLabel (e.g. "Absolute+5"), else falls back to tier string.
  function getTierLabel(category: string): string | undefined {
    const r = results.find(r => r.category === category)
    return normalizeLegacyDisplayLabel(r?.displayLabel) ?? r?.tier
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
    'Primordial+':'#ccffff','Absolute-':'#99ffff','Absolute':'#00ffff','Absolute+':'#00ddff',
  }

  let displayName       = $derived(name?.trim() || 'The Unnamed')
  // Auto-generated 2-3 sentence narrative "The Read" — combines race +
  // archetype + best/worst stat + signature power + gimmick. Persists on
  // the character card so future visits to a saved character get the same
  // synthesis they saw at creation time (seeded by name+race+archetype).
  let characterSummary  = $derived(generateCharacterSummary(results, displayName))
  let race              = $derived(get('race'))
  let raceType          = $derived(get('raceSubType'))
  let raceClass         = $derived(get('raceClass'))
  let devilFruitName    = $derived(get('devilFruitName'))
  let transformation    = $derived(get('raceTransformation'))
  let archetype         = $derived(get('archetype'))
  let archetypeTypeLabel = $derived(getArchetype(archetype)?.archetypeType ?? null)
  let backstory         = $derived(get('backstory'))
  let height            = $derived(get('height'))
  let gender            = $derived(get('gender'))
  let title             = $derived(get('title'))
  let racialAbilities   = $derived(getAll('racialAbility'))
  let archetypeAbilities = $derived(getAll('archetypeAbility'))
  let powers            = $derived(getAll('power'))
  let weaknesses        = $derived(getAll('weakness'))
  let weapons           = $derived(getAll('weapon').filter(w => w !== 'No Weapon' && w !== 'No Weapon (Unarmed)'))
  let weaponType        = $derived(get('weaponType'))
  let weaponEnchs       = $derived(getAll('weaponEnchantment'))
  let armor             = $derived(get('armor'))
  let armorType         = $derived(get('armorType'))
  let armorEnchs        = $derived(getAll('armorEnchantment'))
  let possessionRace    = $derived(get('possessionRace'))
  let possessionStrength = $derived(get('possessionStrength'))
  let redemptionOutcome = $derived(results.find(r => r.category === 'redemptionOutcome')?.resultLabel)

  const statCategories = ['strength','speed','agility','durability','iq','charisma','fightingSkill','powerMastery','weaponMastery','armorStrength','potential','energyLevel'] as const
  let stats = $derived(statCategories.map(cat => {
    const r = results.find(r => r.category === cat)
    return { cat, label: r?.resultLabel ?? '—', tier: r?.tier, score: r?.score, displayLabel: r?.displayLabel }
  }))

  let overallScore = $derived(computeOverallScore(
    Object.fromEntries(statCategories.map(cat => [cat, results.find(r => r.category === cat)?.score ?? 0]))
  ))
  let overallGrade = $derived(scoreTier(overallScore))
  // Tier-bucket the overall grade for the card aura animation strength.
  // Higher buckets get more dramatic glow + animation — F/E cards look
  // matte; God/Primordial/Absolute cards animate with rotating halo.
  let auraTier = $derived.by((): 'matte' | 'soft' | 'medium' | 'strong' | 'cosmic' => {
    const g = overallGrade
    if (!g) return 'matte'
    if (/Absolute|Primordial|Godly|^God$|Celestial/i.test(g)) return 'cosmic'
    if (/^Z|SSS/i.test(g)) return 'strong'
    if (/^SS/i.test(g) || /^S/i.test(g) && !/SS/.test(g)) return 'medium'
    if (/^[ABCD]/.test(g)) return 'soft'
    return 'matte'
  })
  // Low-tier devices skip the rotating cosmic halo (conic-gradient +
  // filter:blur + animation = expensive) and drop strong-tier rotation
  // too. Mid stays as designed.
  const _perfTier = getPerfTier()
  const cheapAura = _perfTier === 'low'

  // Content lookup maps — built once from static pool arrays
  const powerMap  = new Map(powersPool.map(p => [p.label, p]))
  const weaponMap = new Map(weaponsPool.map(w => [w.label, w]))
  const armorMap  = new Map(armorsPool.map(a => [a.label, a]))

  // Ability lookup — element + grade from race and archetype pools
  const abilityMap = new Map<string, { element?: import('$lib/content/types').ElementType; grade?: ItemGrade }>()
  for (const race of races) {
    for (const entry of [
      ...race.abilities,
      ...(race.subTypePool ?? []).flatMap(e => e.abilities ?? []),
      ...(race.classPool ?? []).flatMap(e => e.abilities ?? []),
      ...(race.transformationPool ?? []).flatMap(e => e.abilities ?? []),
    ]) {
      if ((entry.element || entry.grade) && !abilityMap.has(entry.label)) {
        abilityMap.set(entry.label, { element: entry.element, grade: entry.grade })
      }
    }
  }
  for (const arc of archetypes) {
    for (const entry of [...arc.abilities, ...(arc.customAbilityPool ?? [])]) {
      if ((entry.element || entry.grade) && !abilityMap.has(entry.label)) {
        abilityMap.set(entry.label, { element: entry.element, grade: entry.grade })
      }
    }
  }

  // Grade → numeric score for aggregate calculations (0–9 index in GRADE_ORDER)
  function gradeScore(grade: ItemGrade | undefined): number {
    if (!grade) return 0
    const idx = GRADE_ORDER.indexOf(grade)
    return idx < 0 ? 0 : idx * 11
  }

  function averageGrade(labels: string[], lookupFn: (l: string) => ItemGrade | undefined): ItemGrade {
    const grades = labels.map(lookupFn).filter((g): g is ItemGrade => g !== undefined)
    if (grades.length === 0) return 'F'
    const avg = grades.reduce((s, g) => s + gradeScore(g), 0) / grades.length
    const idx = Math.min(GRADE_ORDER.length - 1, Math.round(avg / 11))
    return GRADE_ORDER[idx]
  }

  let topPowerGrade  = $derived(averageGrade(powers, l => powerMap.get(l)?.grade))
  let topWeaponGrade = $derived(averageGrade(weapons, l => weaponMap.get(l)?.grade))
  let armorGrade     = $derived((armorMap.get(armor)?.grade ?? 'F') as ItemGrade)
  let armorElement   = $derived(armorMap.get(armor)?.element)

  // Effective grades — take highest between spin-derived grade and any equipped crystal items
  let effectivePowerGrade = $derived(
    equippedItems?.powers.length
      ? highestGrade([topPowerGrade, ...equippedItems.powers.map(p => p.grade as ItemGrade)])
      : topPowerGrade
  )
  let effectiveWeaponGrade = $derived(
    equippedItems?.weapons.length
      ? highestGrade([topWeaponGrade, ...equippedItems.weapons.map(w => w.grade as ItemGrade)])
      : topWeaponGrade
  )
  let effectiveArmorGrade = $derived(
    equippedItems?.armors.length
      ? highestGrade([armorGrade, ...equippedItems.armors.map(a => a.grade as ItemGrade)])
      : armorGrade
  )
  let powerBoosted  = $derived(effectivePowerGrade !== topPowerGrade)
  let weaponBoosted = $derived(effectiveWeaponGrade !== topWeaponGrade)
  let armorBoosted  = $derived(effectiveArmorGrade !== armorGrade)

  // ── Save & Share state ────────────────────────────────────────────────────

  let saving         = $state(false)
  let shareUrl       = $state<string | null>(null)
  let saveError      = $state<string | null>(null)
  let copied         = $state(false)
  let shareInGallery = $state(false)
  // Expandable detail panel — key is "{category}:{label}", null = nothing expanded
  let expandedItem   = $state<string | null>(null)
  function toggleItem(key: string) { expandedItem = expandedItem === key ? null : key }
  // now ticks every second so canSave/$derived values update in real time
  let now = $state(Date.now())

  let intervalId: ReturnType<typeof setInterval> | null = null

  onMount(() => {
    // Stop ticking once canSave becomes true — Save button no longer needs second-by-second
    // refresh and stopping the interval cancels all downstream $derived recomputation each second.
    intervalId = setInterval(() => {
      now = Date.now()
      const age = (now - new Date(startedAt).getTime()) / 1000
      if (age >= 90 && intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }, 1000)
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
    if (!auth.loggedIn) {
      saveError = 'login_required'
      return
    }
    saving = true
    saveError = null
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        credentials: 'include',
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
      // Notify parent so it can mark the matching history entry as saved.
      onSaved?.(shareId, startedAt)
      toast.success('Character saved', { detail: 'Share link ready to copy below.' })
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

<div class="w-full max-w-xl flex flex-col gap-5" style="animation: slideUp 0.4s ease-out forwards;">

  <!-- Hero banner: grade + name + identity. Aura class scales with tier
       (matte for F/E up to animated halo for God/Primordial/Absolute).
       Low-tier devices skip the rotating cosmic halo entirely to avoid
       sustained GPU spin on conic-gradient + blur. -->
  <div class="rounded-xl p-6 relative overflow-hidden character-aura character-aura-{auraTier}"
    class:character-aura-cheap={cheapAura}
    style="--aura-color: {TIER_COLORS[overallGrade] ?? '#374151'}; background: linear-gradient(135deg, {TIER_COLORS[overallGrade] ?? '#1f1f28'}22 0%, #0d0c16 100%); border: 1px solid {TIER_COLORS[overallGrade] ?? '#4e4635'}55; box-shadow: 0 0 50px {TIER_COLORS[overallGrade] ?? '#374151'}28, inset 1px 1px 0 rgba(255,223,150,0.1);"
  >
    <!-- Aura halo — pseudo layer that pulses/rotates for high tiers. -->
    {#if auraTier !== 'matte' && !cheapAura}
      <div class="character-aura-halo" aria-hidden="true"></div>
    {/if}
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
        <p class="text-xs mt-1" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Score {overallScore} / 185</p>
      </div>
      <!-- Identity column -->
      <div class="text-right min-w-0 flex-1">
        {#if title !== '—'}
          <p class="text-xs tracking-[0.18em] uppercase mb-1" style="color: #a78bfa;">{title}</p>
        {/if}
        <h1 style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 6vw, 2rem); font-weight: 700; color: #ffdf96; line-height: 1.15; word-break: break-word;">{displayName}</h1>
        <p class="text-sm mt-1.5 flex items-center justify-end gap-1.5 flex-wrap" style="color: #d2c5ae;">
          <!-- Race glyph — picks a Material Symbols icon per race so
               Saiyan (flame), Vampire (crescent), Dragon (fire), etc.
               are visually distinct at a glance. Color-tinted by the
               overall tier so high-rolls glow brighter. -->
          <span class="material-symbols-outlined character-race-glyph"
            style="font-size: 22px; color: {TIER_COLORS[overallGrade] ?? '#ffdf96'}; filter: drop-shadow(0 0 6px {TIER_COLORS[overallGrade] ?? '#f0c040'}66); font-variation-settings: 'FILL' 1;"
            aria-hidden="true">{raceGlyph(race === '—' ? null : race)}</span>
          <span>{raceType !== '—' ? `${raceType} ` : ''}{race} · {archetype}{archetypeTypeLabel ? ` · ${archetypeTypeLabel}` : ''}</span>
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

  <!-- Auto-generated "The Read" — narrative synthesis of the character.
       Persists on the card so future visits to a saved character get the
       same line they saw at creation. -->
  {#if characterSummary && characterSummary.race !== 'Unknown'}
    <div class="relative w-full px-3 py-3 rounded-lg mx-3"
      style="background: linear-gradient(180deg, rgba(240,192,64,0.08) 0%, rgba(240,192,64,0.02) 100%); border-left: 2px solid rgba(240,192,64,0.45); border-right: 2px solid rgba(240,192,64,0.45);">
      <p class="text-[10px] tracking-[0.22em] uppercase mb-1.5"
        style="font-family: 'JetBrains Mono', monospace; color: #c9a050;">The Read</p>
      <p class="text-center"
        style="font-family: 'Cinzel', serif; font-style: italic; font-size: 0.92rem; line-height: 1.5; color: #e8dcb8;">
        {characterSummary.text}
      </p>
    </div>
  {/if}

  <!-- Combat Grades -->
  {#if powers.length > 0 || weapons.length > 0 || armor !== '—'}
    <div class="flex gap-3">
      {#if powers.length > 0}
        <div class="flex-1 obsidian-slab rounded-lg px-3 py-2.5 text-center relative" style="border: 1px solid {ITEM_GRADE_INFO[effectivePowerGrade].color}44;">
          {#if powerBoosted}
            <span class="absolute top-1 right-1.5 text-[8px] font-bold" style="color: #34d399;">↑equip</span>
          {/if}
          <p class="text-[9px] tracking-[0.18em] uppercase mb-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Power Grade</p>
          <p class="text-base font-black leading-none" style="color: {ITEM_GRADE_INFO[effectivePowerGrade].color}; font-family: 'Cinzel', serif; filter: drop-shadow(0 0 8px {ITEM_GRADE_INFO[effectivePowerGrade].glow});">{effectivePowerGrade}</p>
          <p class="text-[9px] mt-1" style="color: #9a907b;">{ITEM_GRADE_INFO[effectivePowerGrade].label} · +{ITEM_GRADE_INFO[effectivePowerGrade].battleBonus}</p>
        </div>
      {/if}
      {#if weapons.length > 0}
        <div class="flex-1 obsidian-slab rounded-lg px-3 py-2.5 text-center relative" style="border: 1px solid {ITEM_GRADE_INFO[effectiveWeaponGrade].color}44;">
          {#if weaponBoosted}
            <span class="absolute top-1 right-1.5 text-[8px] font-bold" style="color: #34d399;">↑equip</span>
          {/if}
          <p class="text-[9px] tracking-[0.18em] uppercase mb-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Weapon Grade</p>
          <p class="text-base font-black leading-none" style="color: {ITEM_GRADE_INFO[effectiveWeaponGrade].color}; font-family: 'Cinzel', serif; filter: drop-shadow(0 0 8px {ITEM_GRADE_INFO[effectiveWeaponGrade].glow});">{effectiveWeaponGrade}</p>
          <p class="text-[9px] mt-1" style="color: #9a907b;">{ITEM_GRADE_INFO[effectiveWeaponGrade].label} · +{ITEM_GRADE_INFO[effectiveWeaponGrade].battleBonus}</p>
        </div>
      {/if}
      {#if armor !== '—'}
        <div class="flex-1 obsidian-slab rounded-lg px-3 py-2.5 text-center relative" style="border: 1px solid {ITEM_GRADE_INFO[effectiveArmorGrade].color}44;">
          {#if armorBoosted}
            <span class="absolute top-1 right-1.5 text-[8px] font-bold" style="color: #34d399;">↑equip</span>
          {/if}
          <p class="text-[9px] tracking-[0.18em] uppercase mb-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Armor Grade</p>
          <p class="text-base font-black leading-none" style="color: {ITEM_GRADE_INFO[effectiveArmorGrade].color}; font-family: 'Cinzel', serif; filter: drop-shadow(0 0 8px {ITEM_GRADE_INFO[effectiveArmorGrade].glow});">{effectiveArmorGrade}</p>
          <p class="text-[9px] mt-1" style="color: #9a907b;">{ITEM_GRADE_INFO[effectiveArmorGrade].label} · +{ITEM_GRADE_INFO[effectiveArmorGrade].battleBonus}</p>
        </div>
      {/if}
    </div>
  {/if}


  <!-- Stats grid -->
  <div>
    <p class="text-xs tracking-[0.18em] uppercase mb-3" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Stats</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {#each stats as stat}
        {#if stat.label !== '—'}
          <div class="obsidian-slab rounded-lg px-3 py-2 flex items-center gap-2"
            style="border-left: 3px solid {TIER_COLORS[stat.tier ?? ''] ?? '#4e4635'}; border-top: none; border-right: none; border-bottom: none;">
            {#if stat.tier}
              <span class="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                style="background: {TIER_COLORS[stat.tier] ?? '#374151'}22; color: {TIER_COLORS[stat.tier] ?? '#9a907b'}; border: 1px solid {TIER_COLORS[stat.tier] ?? '#4e4635'}66; box-shadow: 0 0 6px {TIER_COLORS[stat.tier] ?? 'transparent'}33;">
                {normalizeLegacyDisplayLabel(stat.displayLabel) ?? stat.tier}
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
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {#if racialAbilities.length > 0}
      <div>
        <p class="text-xs tracking-[0.15em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Racial Abilities</p>
        <ul class="space-y-1">
          {#each racialAbilities as ab}
            {@const abMeta = abilityMap.get(ab)}
            {@const abColor = abMeta?.element ? ELEMENT_COLORS[abMeta.element] : 'rgba(240,192,64,0.4)'}
            {@const abGradeInfo = abMeta?.grade ? ITEM_GRADE_INFO[abMeta.grade] : null}
            {@const abKey = `racial:${ab}`}
            {@const abExpanded = expandedItem === abKey}
            {@const abType = classifyAbility(ab, abMeta?.element)}
            <li>
              <button onclick={() => toggleItem(abKey)} class="w-full text-left" style="background: none; border: none; cursor: pointer; padding: 0;">
                <div class="obsidian-slab text-xs rounded px-3 py-2 flex flex-wrap items-center gap-1.5" style="color: #e4e1ee; border: 1px solid rgba(240,192,64,{abExpanded ? '0.25' : '0.12'}); border-left: 2px solid {abColor}55; transition: border-color 0.15s;">
                  {#if abMeta?.element}
                    <img src={ELEMENT_ICONS[abMeta.element]} class="w-4 h-4 object-contain shrink-0" alt={abMeta.element} style="filter: drop-shadow(0 0 3px {ELEMENT_COLORS[abMeta.element]});" />
                  {/if}
                  <span class="flex-1">{ab}</span>
                  {#if abGradeInfo}
                    <span class="text-[9px] font-bold px-1 py-0.5 rounded shrink-0" style="background: {abGradeInfo.color}22; color: {abGradeInfo.color}; border: 1px solid {abGradeInfo.color}55;">{abMeta?.grade}</span>
                  {/if}
                  <span class="material-symbols-outlined shrink-0" style="font-size: 11px; color: #4e4635; transform: rotate({abExpanded ? 180 : 0}deg); transition: transform 0.15s;">expand_more</span>
                </div>
              </button>
              {#if abExpanded}
                <div class="mt-0.5 ml-2 px-3 py-2 rounded-lg text-xs" style="background: {abColor}0a; border: 1px solid {abColor}22; border-left: 2px solid {abColor}55;">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold px-1.5 py-0.5 rounded-full text-[10px]" style="background: {getAbilityTypeColor(abType)}20; color: {getAbilityTypeColor(abType)}; border: 1px solid {getAbilityTypeColor(abType)}44;">{abType}</span>
                    {#if abMeta?.grade}<span class="text-[10px]" style="color: {abGradeInfo?.color ?? '#9a907b'};">Grade {abMeta.grade}</span>{/if}
                  </div>
                  <p style="color: #b8b0a0; line-height: 1.5;">{generateAbilityDescription(ab, abMeta?.element, abMeta?.grade)}</p>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    {#if archetypeAbilities.length > 0}
      <div>
        <p class="text-xs tracking-[0.15em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Archetype Abilities</p>
        <ul class="space-y-1">
          {#each archetypeAbilities as ab}
            {@const abMeta = abilityMap.get(ab)}
            {@const abColor = abMeta?.element ? ELEMENT_COLORS[abMeta.element] : 'rgba(139,92,246,0.4)'}
            {@const abGradeInfo = abMeta?.grade ? ITEM_GRADE_INFO[abMeta.grade] : null}
            {@const abKey = `archetype:${ab}`}
            {@const abExpanded = expandedItem === abKey}
            {@const abType = classifyAbility(ab, abMeta?.element)}
            <li>
              <button onclick={() => toggleItem(abKey)} class="w-full text-left" style="background: none; border: none; cursor: pointer; padding: 0;">
                <div class="obsidian-slab text-xs rounded px-3 py-2 flex flex-wrap items-center gap-1.5" style="color: #e4e1ee; border: 1px solid rgba(139,92,246,{abExpanded ? '0.3' : '0.15'}); border-left: 2px solid {abColor}55; transition: border-color 0.15s;">
                  {#if abMeta?.element}
                    <img src={ELEMENT_ICONS[abMeta.element]} class="w-4 h-4 object-contain shrink-0" alt={abMeta.element} style="filter: drop-shadow(0 0 3px {ELEMENT_COLORS[abMeta.element]});" />
                  {/if}
                  <span class="flex-1">{ab}</span>
                  {#if abGradeInfo}
                    <span class="text-[9px] font-bold px-1 py-0.5 rounded shrink-0" style="background: {abGradeInfo.color}22; color: {abGradeInfo.color}; border: 1px solid {abGradeInfo.color}55;">{abMeta?.grade}</span>
                  {/if}
                  <span class="material-symbols-outlined shrink-0" style="font-size: 11px; color: #4e4635; transform: rotate({abExpanded ? 180 : 0}deg); transition: transform 0.15s;">expand_more</span>
                </div>
              </button>
              {#if abExpanded}
                <div class="mt-0.5 ml-2 px-3 py-2 rounded-lg text-xs" style="background: {abColor}0a; border: 1px solid {abColor}22; border-left: 2px solid {abColor}55;">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold px-1.5 py-0.5 rounded-full text-[10px]" style="background: {getAbilityTypeColor(abType)}20; color: {getAbilityTypeColor(abType)}; border: 1px solid {getAbilityTypeColor(abType)}44;">{abType}</span>
                    {#if abMeta?.grade}<span class="text-[10px]" style="color: {abGradeInfo?.color ?? '#9a907b'};">Grade {abMeta.grade}</span>{/if}
                  </div>
                  <p style="color: #b8b0a0; line-height: 1.5;">{generateAbilityDescription(ab, abMeta?.element, abMeta?.grade)}</p>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <!-- Powers -->
  {#if powers.length > 0 || (equippedItems?.powers?.length ?? 0) > 0}
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm" style="color: #a78bfa; font-variation-settings: 'FILL' 1;">bolt</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Powers</p>
        <span class="text-[9px] ml-auto" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">tap to inspect</span>
      </div>
      <div class="space-y-1">
        {#each powers as p}
          {@const pInfo = powerMap.get(p)}
          {@const pColor = pInfo?.element ? ELEMENT_COLORS[pInfo.element] : '#8b5cf6'}
          {@const pGrade = pInfo?.grade ?? 'F'}
          {@const pGradeInfo = ITEM_GRADE_INFO[pGrade]}
          {@const pKey = `power:${p}`}
          {@const pExpanded = expandedItem === pKey}
          {@const pType = classifyAbility(p, pInfo?.element)}
          {@const pTypeColor = getAbilityTypeColor(pType)}
          <div>
            <button onclick={() => toggleItem(pKey)} class="w-full text-left"
              style="background: none; border: none; cursor: pointer; padding: 0;">
              <span class="text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 w-full"
                style="background: {pColor}{pExpanded ? '28' : '18'}; color: {pColor}dd; border: 1px solid {pColor}{pExpanded ? '66' : '44'}; transition: background 0.15s, border-color 0.15s;">
                {#if pInfo?.element}<img src={ELEMENT_ICONS[pInfo.element]} class="w-4 h-4 object-contain shrink-0" alt={pInfo.element} style="filter: drop-shadow(0 0 3px {ELEMENT_COLORS[pInfo.element]});" />{/if}
                <span class="flex-1">{p}</span>
                <span class="text-[9px] font-bold px-1 py-0.5 rounded shrink-0"
                  style="background: {pGradeInfo.color}22; color: {pGradeInfo.color}; border: 1px solid {pGradeInfo.color}55;">{pGrade}</span>
                <span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: {pColor}88; transition: transform 0.15s; transform: rotate({pExpanded ? 180 : 0}deg);">expand_more</span>
              </span>
            </button>
            {#if pExpanded}
              <div class="mt-1 ml-2 px-3 py-2 rounded-lg text-xs" style="background: {pColor}0d; border: 1px solid {pColor}22; border-left: 2px solid {pColor}66;">
                <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span class="font-bold px-2 py-0.5 rounded-full text-[10px]" style="background: {pTypeColor}20; color: {pTypeColor}; border: 1px solid {pTypeColor}44;">
                    <span class="material-symbols-outlined" style="font-size: 10px; vertical-align: middle; font-variation-settings: 'FILL' 1;">{getAbilityTypeIcon(pType)}</span>
                    {pType}
                  </span>
                  {#if pInfo?.element}<span class="text-[10px]" style="color: {pColor}88;">{pInfo.element}</span>{/if}
                  <span class="ml-auto text-[10px]" style="color: {pGradeInfo.color};">Grade {pGrade} · Score ~{pGradeInfo.battleBonus}</span>
                </div>
                <p style="color: #b8b0a0; line-height: 1.5;">{generatePowerDescription(p, pInfo?.element, pGrade)}</p>
                <p class="mt-1" style="color: #6b6358; font-style: italic;">{ABILITY_BATTLE_EFFECT[pType]}</p>
              </div>
            {/if}
          </div>
        {/each}
        {#each equippedItems?.powers ?? [] as ep}
          {@const epInfo = powerMap.get(ep.name)}
          {@const epColor = epInfo?.element ? ELEMENT_COLORS[epInfo.element] : '#8b5cf6'}
          {@const epGradeInfo = ITEM_GRADE_INFO[ep.grade as import('$lib/content/types').ItemGrade] ?? ITEM_GRADE_INFO['F']}
          {@const epType = classifyAbility(ep.name, epInfo?.element)}
          {@const epTypeColor = getAbilityTypeColor(epType)}
          {@const epKey = `eqpower:${ep.id}`}
          {@const epExpanded = expandedItem === epKey}
          <div>
            <button onclick={() => toggleItem(epKey)} class="w-full text-left" style="background: none; border: none; cursor: pointer; padding: 0;">
              <span class="text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 w-full"
                style="background: {epColor}{epExpanded ? '28' : '18'}; color: {epColor}dd; border: 1px solid {epColor}{epExpanded ? '66' : '44'}; transition: background 0.15s, border-color 0.15s;">
                {#if epInfo?.element}<img src={ELEMENT_ICONS[epInfo.element]} class="w-4 h-4 object-contain shrink-0" alt={epInfo.element} style="filter: drop-shadow(0 0 3px {ELEMENT_COLORS[epInfo.element]});" />{/if}
                <span class="flex-1">{ep.name}</span>
                <span class="text-[9px] font-bold px-1 py-0.5 rounded shrink-0" style="background: {epGradeInfo.color}22; color: {epGradeInfo.color}; border: 1px solid {epGradeInfo.color}55;">{ep.grade}</span>
                <span class="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style="background: #34d39920; color: #34d399; border: 1px solid #34d39944;">EQUIPPED</span>
                <span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: {epColor}88; transition: transform 0.15s; transform: rotate({epExpanded ? 180 : 0}deg);">expand_more</span>
              </span>
            </button>
            {#if epExpanded}
              <div class="mt-1 ml-2 px-3 py-2 rounded-lg text-xs" style="background: {epColor}0d; border: 1px solid {epColor}22; border-left: 2px solid {epColor}66;">
                <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span class="font-bold px-2 py-0.5 rounded-full text-[10px]" style="background: {epTypeColor}20; color: {epTypeColor}; border: 1px solid {epTypeColor}44;">
                    <span class="material-symbols-outlined" style="font-size: 10px; vertical-align: middle; font-variation-settings: 'FILL' 1;">{getAbilityTypeIcon(epType)}</span>
                    {epType}
                  </span>
                  <span class="ml-auto text-[10px]" style="color: {epGradeInfo.color};">Grade {ep.grade} · Score ~{epGradeInfo.battleBonus}</span>
                </div>
                <p style="color: #b8b0a0; line-height: 1.5;">{generatePowerDescription(ep.name, epInfo?.element, ep.grade as import('$lib/content/types').ItemGrade)}</p>
                <p class="mt-1" style="color: #6b6358; font-style: italic;">{ABILITY_BATTLE_EFFECT[epType]}</p>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Weapons (all) -->
  {#if weapons.length > 0 || (equippedItems?.weapons?.length ?? 0) > 0}
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm" style="color: #f0c040; font-variation-settings: 'FILL' 1;">swords</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Weapon{weapons.length > 1 ? 's' : ''}</p>
        {#if getTierLabel('weaponMastery')}
          {@const wmTierColor = TIER_COLORS[getTier('weaponMastery') ?? ''] ?? '#9a907b'}
          <span class="ml-auto text-xs font-bold px-1.5 py-0.5 rounded"
            style="background: {wmTierColor}22; color: {wmTierColor}; border: 1px solid {wmTierColor}66;">
            Mastery: {getTierLabel('weaponMastery')}
          </span>
        {/if}
      </div>
      <div class="space-y-1.5">
        {#each weapons as w, wi}
          {@const wInfo = weaponMap.get(w)}
          {@const wGrade = (wInfo?.grade ?? 'F') as ItemGrade}
          {@const wGradeInfo = ITEM_GRADE_INFO[wGrade]}
          {@const wElement = wInfo?.element}
          {@const wBorderColor = wElement ? ELEMENT_COLORS[wElement] : 'rgba(240,192,64,0.4)'}
          {@const wKey = `weapon:${w}`}
          {@const wExpanded = expandedItem === wKey}
          <div>
            <button onclick={() => toggleItem(wKey)} class="w-full text-left" style="background: none; border: none; cursor: pointer; padding: 0;">
              <div class="obsidian-slab rounded-lg px-4 py-3 flex flex-wrap items-center gap-3"
                style="border: 1px solid {wBorderColor}{wExpanded ? '55' : '33'}; border-left: 3px solid {wBorderColor}; transition: border-color 0.15s;">
                <span class="text-xs font-bold px-2 py-0.5 rounded"
                  style="background: {wGradeInfo.color}22; color: {wGradeInfo.color}; border: 1px solid {wGradeInfo.color}55;">
                  {wGradeInfo.label} +{wGradeInfo.battleBonus}
                </span>
                {#if wElement}
                  <span class="text-xs flex items-center gap-1" style="color: {ELEMENT_COLORS[wElement]};">
                    <img src={ELEMENT_ICONS[wElement]} class="w-3.5 h-3.5 object-contain" alt={wElement} style="filter: drop-shadow(0 0 3px {ELEMENT_COLORS[wElement]});" />
                    {wElement}
                  </span>
                {/if}
                {#if wi === 0 && weaponType !== '—'}
                  <span class="text-xs px-2 py-1 rounded" style="background: rgba(240,192,64,0.08); color: #9a907b; border: 1px solid rgba(240,192,64,0.15);">{weaponType}</span>
                {/if}
                <span class="text-sm font-medium flex-1" style="color: #e4e1ee;">{w}</span>
                {#if wi === 0}
                  {#each weaponEnchs as ench}
                    <span class="text-xs" style="color: #f0c040;">✦ {ench}</span>
                  {/each}
                {/if}
                <span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: #4e4635; transform: rotate({wExpanded ? 180 : 0}deg); transition: transform 0.15s;">expand_more</span>
              </div>
            </button>
            {#if wExpanded}
              <div class="mt-1 ml-2 px-3 py-2 rounded-lg text-xs" style="background: {wBorderColor}0a; border: 1px solid {wBorderColor}22; border-left: 2px solid {wBorderColor}66;">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="font-bold px-2 py-0.5 rounded-full text-[10px]" style="background: rgba(240,192,64,0.15); color: #f0c040; border: 1px solid rgba(240,192,64,0.3);">
                    <span class="material-symbols-outlined" style="font-size: 10px; vertical-align: middle; font-variation-settings: 'FILL' 1;">swords</span>
                    Weapon
                  </span>
                  <span class="ml-auto text-[10px]" style="color: {wGradeInfo.color};">Grade {wGrade} · +{wGradeInfo.battleBonus} Physical DMG</span>
                </div>
                <p style="color: #b8b0a0; line-height: 1.5;">{generateWeaponDescription(w, wElement, wGrade)}</p>
              </div>
            {/if}
          </div>
        {/each}
        {#each equippedItems?.weapons ?? [] as ew}
          {@const ewInfo = weaponMap.get(ew.name)}
          {@const ewGradeInfo = ITEM_GRADE_INFO[ew.grade as import('$lib/content/types').ItemGrade] ?? ITEM_GRADE_INFO['F']}
          {@const ewElement = ewInfo?.element}
          {@const ewBorderColor = ewElement ? ELEMENT_COLORS[ewElement] : 'rgba(240,192,64,0.4)'}
          {@const ewKey = `eqweapon:${ew.id}`}
          {@const ewExpanded = expandedItem === ewKey}
          <div>
            <button onclick={() => toggleItem(ewKey)} class="w-full text-left" style="background: none; border: none; cursor: pointer; padding: 0;">
              <div class="obsidian-slab rounded-lg px-4 py-3 flex flex-wrap items-center gap-3"
                style="border: 1px solid {ewBorderColor}{ewExpanded ? '55' : '33'}; border-left: 3px solid {ewBorderColor}; transition: border-color 0.15s;">
                <span class="text-xs font-bold px-2 py-0.5 rounded" style="background: {ewGradeInfo.color}22; color: {ewGradeInfo.color}; border: 1px solid {ewGradeInfo.color}55;">
                  {ewGradeInfo.label} +{ewGradeInfo.battleBonus}
                </span>
                {#if ewElement}
                  <span class="text-xs flex items-center gap-1" style="color: {ELEMENT_COLORS[ewElement]};">
                    <img src={ELEMENT_ICONS[ewElement]} class="w-3.5 h-3.5 object-contain" alt={ewElement} style="filter: drop-shadow(0 0 3px {ELEMENT_COLORS[ewElement]});" />
                    {ewElement}
                  </span>
                {/if}
                <span class="text-sm font-medium flex-1" style="color: #e4e1ee;">{ew.name}</span>
                <span class="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style="background: #34d39920; color: #34d399; border: 1px solid #34d39944;">EQUIPPED</span>
                <span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: #4e4635; transform: rotate({ewExpanded ? 180 : 0}deg); transition: transform 0.15s;">expand_more</span>
              </div>
            </button>
            {#if ewExpanded}
              <div class="mt-1 ml-2 px-3 py-2 rounded-lg text-xs" style="background: {ewBorderColor}0a; border: 1px solid {ewBorderColor}22; border-left: 2px solid {ewBorderColor}66;">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="font-bold px-2 py-0.5 rounded-full text-[10px]" style="background: rgba(240,192,64,0.15); color: #f0c040; border: 1px solid rgba(240,192,64,0.3);">
                    <span class="material-symbols-outlined" style="font-size: 10px; vertical-align: middle; font-variation-settings: 'FILL' 1;">swords</span>
                    Weapon
                  </span>
                  <span class="ml-auto text-[10px]" style="color: {ewGradeInfo.color};">Grade {ew.grade} · +{ewGradeInfo.battleBonus} Physical DMG</span>
                </div>
                <p style="color: #b8b0a0; line-height: 1.5;">{generateWeaponDescription(ew.name, ewElement, ew.grade as import('$lib/content/types').ItemGrade)}</p>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Armor -->
  {#if armor !== '—' || (equippedItems?.armors?.length ?? 0) > 0}
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm" style="color: #fb923c; font-variation-settings: 'FILL' 1;">shield</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Armor</p>
      </div>
      <div class="space-y-1.5">
        {#if armor !== '—'}
          {@const aBorderColor = armorElement ? ELEMENT_COLORS[armorElement] : 'rgba(251,146,60,0.4)'}
          {@const aKey = `armor:${armor}`}
          {@const aExpanded = expandedItem === aKey}
          <div>
            <button onclick={() => toggleItem(aKey)} class="w-full text-left" style="background: none; border: none; cursor: pointer; padding: 0;">
              <div class="obsidian-slab rounded-lg px-4 py-3 flex flex-wrap items-center gap-3"
                style="border: 1px solid {aBorderColor}{aExpanded ? '55' : '33'}; border-left: 3px solid {aBorderColor}; transition: border-color 0.15s;">
                <span class="text-xs font-bold px-2 py-0.5 rounded"
                  style="background: {ITEM_GRADE_INFO[armorGrade].color}22; color: {ITEM_GRADE_INFO[armorGrade].color}; border: 1px solid {ITEM_GRADE_INFO[armorGrade].color}55;">
                  {ITEM_GRADE_INFO[armorGrade].label}
                </span>
                {#if armorElement}
                  <span class="text-xs flex items-center gap-1" style="color: {ELEMENT_COLORS[armorElement]};">
                    <img src={ELEMENT_ICONS[armorElement]} class="w-3.5 h-3.5 object-contain" alt={armorElement} style="filter: drop-shadow(0 0 3px {ELEMENT_COLORS[armorElement]});" />
                    {armorElement}
                  </span>
                {/if}
                {#if armorType !== '—'}
                  <span class="text-xs px-2 py-1 rounded" style="background: rgba(251,146,60,0.08); color: #9a907b; border: 1px solid rgba(251,146,60,0.15);">{armorType}</span>
                {/if}
                <span class="text-sm font-medium flex-1" style="color: #e4e1ee;">{armor}</span>
                {#each armorEnchs as ench}
                  <span class="text-xs" style="color: #fb923c;">✦ {ench}</span>
                {/each}
                {#if getTierLabel('armorStrength')}
                  {@const asTierColor = TIER_COLORS[getTier('armorStrength') ?? ''] ?? '#9a907b'}
                  <span class="ml-auto text-xs font-bold px-1.5 py-0.5 rounded"
                    style="background: {asTierColor}22; color: {asTierColor}; border: 1px solid {asTierColor}66;">
                    {getTierLabel('armorStrength')}
                  </span>
                {/if}
                <span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: #4e4635; transform: rotate({aExpanded ? 180 : 0}deg); transition: transform 0.15s;">expand_more</span>
              </div>
            </button>
            {#if aExpanded}
              <div class="mt-1 ml-2 px-3 py-2 rounded-lg text-xs" style="background: {aBorderColor}0a; border: 1px solid {aBorderColor}22; border-left: 2px solid {aBorderColor}66;">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="font-bold px-2 py-0.5 rounded-full text-[10px]" style="background: rgba(96,165,250,0.15); color: #60a5fa; border: 1px solid rgba(96,165,250,0.3);">
                    <span class="material-symbols-outlined" style="font-size: 10px; vertical-align: middle; font-variation-settings: 'FILL' 1;">shield</span>
                    Defense
                  </span>
                  <span class="ml-auto text-[10px]" style="color: {ITEM_GRADE_INFO[armorGrade].color};">Grade {armorGrade} · Reduces Incoming Damage</span>
                </div>
                <p style="color: #b8b0a0; line-height: 1.5;">{generateArmorDescription(armor, armorElement, armorGrade)}</p>
              </div>
            {/if}
          </div>
        {/if}
        {#each equippedItems?.armors ?? [] as ea}
          {@const eaInfo = armorMap.get(ea.name)}
          {@const eaGradeInfo = ITEM_GRADE_INFO[ea.grade as import('$lib/content/types').ItemGrade] ?? ITEM_GRADE_INFO['F']}
          {@const eaElement = eaInfo?.element}
          {@const eaBorderColor = eaElement ? ELEMENT_COLORS[eaElement] : 'rgba(251,146,60,0.4)'}
          {@const eaKey = `eqarmor:${ea.id}`}
          {@const eaExpanded = expandedItem === eaKey}
          <div>
            <button onclick={() => toggleItem(eaKey)} class="w-full text-left" style="background: none; border: none; cursor: pointer; padding: 0;">
              <div class="obsidian-slab rounded-lg px-4 py-3 flex flex-wrap items-center gap-3"
                style="border: 1px solid {eaBorderColor}{eaExpanded ? '55' : '33'}; border-left: 3px solid {eaBorderColor}; transition: border-color 0.15s;">
                <span class="text-xs font-bold px-2 py-0.5 rounded" style="background: {eaGradeInfo.color}22; color: {eaGradeInfo.color}; border: 1px solid {eaGradeInfo.color}55;">
                  {eaGradeInfo.label}
                </span>
                {#if eaElement}
                  <span class="text-xs flex items-center gap-1" style="color: {ELEMENT_COLORS[eaElement]};">
                    <img src={ELEMENT_ICONS[eaElement]} class="w-3.5 h-3.5 object-contain" alt={eaElement} style="filter: drop-shadow(0 0 3px {ELEMENT_COLORS[eaElement]});" />
                    {eaElement}
                  </span>
                {/if}
                <span class="text-sm font-medium flex-1" style="color: #e4e1ee;">{ea.name}</span>
                <span class="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style="background: #34d39920; color: #34d399; border: 1px solid #34d39944;">EQUIPPED</span>
                <span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: #4e4635; transform: rotate({eaExpanded ? 180 : 0}deg); transition: transform 0.15s;">expand_more</span>
              </div>
            </button>
            {#if eaExpanded}
              <div class="mt-1 ml-2 px-3 py-2 rounded-lg text-xs" style="background: {eaBorderColor}0a; border: 1px solid {eaBorderColor}22; border-left: 2px solid {eaBorderColor}66;">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="font-bold px-2 py-0.5 rounded-full text-[10px]" style="background: rgba(96,165,250,0.15); color: #60a5fa; border: 1px solid rgba(96,165,250,0.3);">
                    <span class="material-symbols-outlined" style="font-size: 10px; vertical-align: middle; font-variation-settings: 'FILL' 1;">shield</span>
                    Defense
                  </span>
                  <span class="ml-auto text-[10px]" style="color: {eaGradeInfo.color};">Grade {ea.grade} · Reduces Incoming Damage</span>
                </div>
                <p style="color: #b8b0a0; line-height: 1.5;">{generateArmorDescription(ea.name, eaElement, ea.grade as import('$lib/content/types').ItemGrade)}</p>
              </div>
            {/if}
          </div>
        {/each}
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
      <!-- Gallery opt-in toggle — switched from <label>+<div role=checkbox>
           to a single <button role=switch> so it satisfies a11y rules
           without a hidden input. -->
      <div class="flex items-center gap-2.5 select-none py-1" style="opacity: {saving ? 0.5 : 1};">
        <button
          type="button"
          class="relative shrink-0 w-9 h-5 cursor-pointer"
          onclick={() => { if (!saving) shareInGallery = !shareInGallery }}
          role="switch"
          aria-checked={shareInGallery}
          aria-label="Share in public gallery"
        >
          <div class="absolute inset-0 rounded-full transition-all duration-200"
            style="background: {shareInGallery ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.06)'}; border: 1px solid {shareInGallery ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.12)'};">
          </div>
          <div class="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
            style="background: {shareInGallery ? '#a78bfa' : '#4e4635'}; left: {shareInGallery ? '18px' : '2px'}; box-shadow: 0 1px 4px rgba(0,0,0,0.4);">
          </div>
        </button>
        <span class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: {shareInGallery ? '#a78bfa' : '#6b7280'};">
          Share in public gallery
        </span>
      </div>

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
      {#if saveError === 'login_required'}
        <div class="text-center">
          <p class="text-xs mb-2" style="font-family: 'JetBrains Mono', monospace; color: #f87171;">Login required to save your character.</p>
          <a href="/login" class="text-xs tracking-[0.12em] uppercase font-bold px-4 py-2 rounded-lg"
            style="font-family: 'Cinzel', serif; color: #f0c040; background: rgba(240,192,64,0.1); border: 1px solid rgba(240,192,64,0.3); text-decoration: none; display: inline-block;">
            Log In / Register
          </a>
        </div>
      {:else if saveError}
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

<style>
  /* ── Race glyph subtle pulse so the icon "lives" on the card ──────────── */
  .character-race-glyph {
    animation: charGlyphPulse 4.5s ease-in-out infinite;
  }
  @keyframes charGlyphPulse {
    0%, 100% { transform: scale(1);    opacity: 1; }
    50%      { transform: scale(1.08); opacity: 0.85; }
  }
  /* Mobile / touch: kill the always-running glyph pulse — small enough
     that the visual loss is negligible but it removes a constant
     animation from a page that may show many cards (gallery, roster). */
  @media (pointer: coarse), (max-width: 640px) {
    .character-race-glyph { animation: none; }
  }

  /* ── Tier-scaled aura halo — pseudo layer behind the hero banner ──────── */
  .character-aura {
    position: relative;
    isolation: isolate;
  }
  .character-aura-halo {
    position: absolute;
    inset: -2px;
    border-radius: 0.75rem;
    pointer-events: none;
    z-index: 0;
    opacity: 0;
  }

  /* Soft (C-D tiers): faint pulse */
  .character-aura-soft .character-aura-halo {
    box-shadow: 0 0 30px 4px color-mix(in srgb, var(--aura-color) 35%, transparent);
    animation: charAuraSoft 5s ease-in-out infinite;
  }
  @keyframes charAuraSoft {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 1.0; }
  }

  /* Medium (S, A-tier-ish): stronger pulse + slight breathing */
  .character-aura-medium .character-aura-halo {
    box-shadow:
      0 0 50px 6px color-mix(in srgb, var(--aura-color) 50%, transparent),
      inset 0 0 30px color-mix(in srgb, var(--aura-color) 30%, transparent);
    animation: charAuraMedium 4s ease-in-out infinite;
  }
  @keyframes charAuraMedium {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50%      { opacity: 1.0; transform: scale(1.005); }
  }

  /* Strong (SSS, Z tiers): bigger outer ring + faster pulse */
  .character-aura-strong .character-aura-halo {
    box-shadow:
      0 0 80px 10px color-mix(in srgb, var(--aura-color) 60%, transparent),
      0 0 30px color-mix(in srgb, var(--aura-color) 80%, transparent),
      inset 0 0 40px color-mix(in srgb, var(--aura-color) 45%, transparent);
    animation: charAuraStrong 3s ease-in-out infinite;
  }
  @keyframes charAuraStrong {
    0%, 100% { opacity: 0.8; transform: scale(1); }
    50%      { opacity: 1.0; transform: scale(1.01); }
  }

  /* Cosmic (Celestial/Godly/Primordial/Absolute): animated holofoil halo
     that rotates with a conic gradient, plus a sustained outer glow.
     The conic mixes the tier accent color with white for a prismatic
     effect — feels appropriately mythic. */
  .character-aura-cosmic .character-aura-halo {
    box-shadow:
      0 0 120px 14px color-mix(in srgb, var(--aura-color) 70%, transparent),
      0 0 40px color-mix(in srgb, var(--aura-color) 90%, transparent),
      inset 0 0 60px color-mix(in srgb, var(--aura-color) 55%, transparent);
    background:
      conic-gradient(
        from 0deg,
        transparent 0deg,
        color-mix(in srgb, var(--aura-color) 60%, transparent) 30deg,
        transparent 60deg,
        color-mix(in srgb, var(--aura-color) 50%, white) 120deg,
        transparent 150deg,
        color-mix(in srgb, var(--aura-color) 60%, transparent) 210deg,
        transparent 240deg,
        color-mix(in srgb, var(--aura-color) 50%, white) 300deg,
        transparent 330deg,
        transparent 360deg
      );
    filter: blur(18px);
    mix-blend-mode: screen;
    animation: charAuraCosmic 6s linear infinite, charAuraCosmicPulse 2.4s ease-in-out infinite;
  }
  @keyframes charAuraCosmic {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes charAuraCosmicPulse {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.95; }
  }

  @media (prefers-reduced-motion: reduce) {
    .character-race-glyph,
    .character-aura-halo {
      animation: none !important;
      opacity: 0.7 !important;
    }
  }
</style>
