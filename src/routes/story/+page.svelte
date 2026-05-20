<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import {
    loadAllSlots, loadSaveSlot, saveSaveSlot, createSaveSlot, deleteSaveSlot,
    addCharacterToSlot, sellCharacterFromSlot, purchaseSpin, consumeSpin,
    buyStatCrystal, getDailyBought, applySpinRefresh, msUntilNextRefresh,
    upgradeRosterCapacity, rosterUpgradeCost, buyFCrystal, buyEndlessKey,
    SHARD_COST_PER_SPIN, STAGE_LABELS, MAX_DAILY_SPINS,
    STAT_CRYSTAL_COSTS, STAT_CRYSTAL_DAILY_LIMITS, F_CRYSTAL_COST, ENDLESS_KEY_GEM_COST,
    type StorySaveSlot, type SlotId, type StatCrystalType,
  } from '$lib/story/saveSlots'
  import { getShardValue } from '$lib/story/shards'
  import { getStageTierLabel } from '$lib/story/raceTiers'
  import type { WorldGrade } from '$lib/story/worlds'
  import type { StoryRosterEntry } from '$lib/story/types'
  import CharacterCard from '../../components/CharacterCard.svelte'
  import TierBadge from '../../components/TierBadge.svelte'
  import RosterCard from '../../components/story/RosterCard.svelte'
  import SellConfirmModal from '../../components/story/SellConfirmModal.svelte'
  import StorySpinView from '../../components/story/StorySpinView.svelte'
  import WorldsView from '../../components/story/WorldsView.svelte'
  import BattleView from '../../components/story/BattleView.svelte'

  // ── View state machine ─────────────────────────────────────────────────────
  type View = 'saveSlotSelect' | 'hub' | 'spin' | 'roster' | 'expanded' | 'shop' | 'worlds' | 'battle' | 'inventory'
  let view = $state<View>('saveSlotSelect')

  // ── Slot state ─────────────────────────────────────────────────────────────
  let slots = $state<(StorySaveSlot | null)[]>([null, null, null, null])
  let currentSlot = $state<StorySaveSlot | null>(null)
  let deleteConfirmId = $state<SlotId | null>(null)
  let activeWorld = $state<WorldGrade | null>(null)

  // ── Roster/sort/dialog state ───────────────────────────────────────────────
  let sortBy = $state<'tier' | 'race' | 'archetype'>('tier')
  let expandedId = $state<string | null>(null)
  let sellTarget = $state<StoryRosterEntry | null>(null)
  let rosterCapAlert = $state(false)

  // ── Spin refresh timer ─────────────────────────────────────────────────────
  let refreshMs = $state(0)
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  function formatRefreshTime(ms: number): string {
    if (ms <= 0) return ''
    const totalSec = Math.ceil(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  function tickRefresh() {
    if (!currentSlot) return
    // Apply any pending refresh intervals
    const refreshed = applySpinRefresh($state.snapshot(currentSlot) as StorySaveSlot)
    if (refreshed !== ($state.snapshot(currentSlot) as StorySaveSlot)) {
      currentSlot = refreshed
    }
    refreshMs = msUntilNextRefresh($state.snapshot(currentSlot) as StorySaveSlot)
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  let roster = $derived(currentSlot?.roster ?? [])
  let gems = $derived(currentSlot?.gems ?? 0)
  let shards = $derived(currentSlot?.shards ?? 0)
  let stage = $derived(currentSlot?.stage ?? 1)
  let playerLevel = $derived(currentSlot?.playerLevel ?? 0)
  let spinsRemaining = $derived(currentSlot?.spinsRemaining ?? 0)
  let rosterCapacity = $derived(currentSlot?.rosterCapacity ?? 5)
  let rosterUpgradeCount = $derived(currentSlot?.rosterUpgradeCount ?? 0)
  let nextUpgradeCost = $derived(rosterUpgradeCost(rosterUpgradeCount))
  let statCrystalInventory  = $derived(currentSlot?.inventory?.statCrystals  ?? { common: 0, elite: 0, legendary: 0 })
  let powerCrystalInventory = $derived(currentSlot?.inventory?.powerCrystals  ?? { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0, God: 0 })
  let weaponCrystalInventory= $derived(currentSlot?.inventory?.weaponCrystals ?? { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0, God: 0 })
  let armorCrystalInventory = $derived(currentSlot?.inventory?.armorCrystals  ?? { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0, God: 0 })
  let endlessKeys           = $derived(currentSlot?.endlessKeys ?? 0)

  let dailyCommon    = $derived(currentSlot ? getDailyBought(currentSlot, 'common')    : 0)
  let dailyElite     = $derived(currentSlot ? getDailyBought(currentSlot, 'elite')     : 0)
  let dailyLegendary = $derived(currentSlot ? getDailyBought(currentSlot, 'legendary') : 0)

  let commonCanBuy    = $derived(gems >= STAT_CRYSTAL_COSTS.common    && dailyCommon    < STAT_CRYSTAL_DAILY_LIMITS.common)
  let eliteCanBuy     = $derived(gems >= STAT_CRYSTAL_COSTS.elite     && dailyElite     < STAT_CRYSTAL_DAILY_LIMITS.elite)
  let legendaryCanBuy = $derived(gems >= STAT_CRYSTAL_COSTS.legendary && dailyLegendary < STAT_CRYSTAL_DAILY_LIMITS.legendary)
  let canUpgradeRoster = $derived(gems >= nextUpgradeCost)

  let sortedRoster = $derived(
    [...roster].sort((a, b) => {
      if (sortBy === 'tier') return b.overallScore - a.overallScore
      if (sortBy === 'race') return a.race.localeCompare(b.race)
      return a.archetype.localeCompare(b.archetype)
    })
  )

  let expandedEntry = $derived(
    expandedId !== null ? roster.find(r => r.id === expandedId) ?? null : null
  )

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(() => {
    slots = loadAllSlots()
    refreshInterval = setInterval(tickRefresh, 10_000)
  })

  onDestroy(() => {
    if (refreshInterval !== null) clearInterval(refreshInterval)
  })

  // ── Persist current slot on every change ──────────────────────────────────
  $effect(() => {
    if (currentSlot) saveSaveSlot($state.snapshot(currentSlot) as StorySaveSlot)
  })

  // ── Save slot actions ──────────────────────────────────────────────────────
  function selectSlot(id: SlotId) {
    const existing = loadSaveSlot(id)
    let slot = existing ?? createSaveSlot(id)
    // Award any pending spin refreshes immediately on load
    slot = applySpinRefresh(slot)
    saveSaveSlot(slot)
    currentSlot = slot
    slots = loadAllSlots()
    refreshMs = msUntilNextRefresh(slot)
    view = 'hub'
  }

  function confirmDeleteSlot(id: SlotId) {
    deleteConfirmId = id
  }

  function doDeleteSlot() {
    if (deleteConfirmId === null) return
    deleteSaveSlot(deleteConfirmId)
    slots = loadAllSlots()
    deleteConfirmId = null
  }

  // ── Hub actions ────────────────────────────────────────────────────────────
  function startSpin() {
    if (!currentSlot || currentSlot.spinsRemaining <= 0) return
    const updated = consumeSpin($state.snapshot(currentSlot) as StorySaveSlot)
    if (!updated) return
    currentSlot = updated
    view = 'spin'
  }

  // ── Shop ───────────────────────────────────────────────────────────────────
  function buySpin() {
    if (!currentSlot) return
    const updated = purchaseSpin($state.snapshot(currentSlot) as StorySaveSlot)
    if (!updated) return
    currentSlot = updated
  }

  let crystalBuyError = $state<string | null>(null)

  function handleBuyStatCrystal(type: StatCrystalType) {
    if (!currentSlot) return
    const result = buyStatCrystal($state.snapshot(currentSlot) as StorySaveSlot, type)
    if (result === 'insufficient_gems') {
      crystalBuyError = 'Not enough gems.'
      setTimeout(() => { crystalBuyError = null }, 2500)
      return
    }
    if (result === 'daily_limit') {
      crystalBuyError = `Daily limit reached for ${type} stat crystals.`
      setTimeout(() => { crystalBuyError = null }, 2500)
      return
    }
    currentSlot = result
  }

  // ── Roster actions ─────────────────────────────────────────────────────────
  function handleExpand(id: string) {
    expandedId = id
    view = 'expanded'
  }

  function handleSell(entry: StoryRosterEntry) {
    sellTarget = entry
  }

  function confirmSell() {
    if (!sellTarget || !currentSlot) return
    const value = getShardValue(sellTarget.overallTier)
    currentSlot = sellCharacterFromSlot(
      $state.snapshot(currentSlot) as StorySaveSlot,
      sellTarget.id,
      value,
    )
    sellTarget = null
  }

  function closeExpanded() {
    expandedId = null
    view = 'roster'
  }

  // ── Session complete ───────────────────────────────────────────────────────
  function handleStoryComplete(entry: StoryRosterEntry) {
    if (!currentSlot) return
    const updated = addCharacterToSlot(
      $state.snapshot(currentSlot) as StorySaveSlot,
      entry,
    )
    if (updated === null) {
      rosterCapAlert = true
      currentSlot = $state.snapshot(currentSlot) as StorySaveSlot
      view = 'roster'
      return
    }
    currentSlot = updated
    view = 'roster'
  }

  function handleSpinCancel() {
    if (!currentSlot) { view = 'hub'; return }
    currentSlot = {
      ...($state.snapshot(currentSlot) as StorySaveSlot),
      spinsRemaining: currentSlot.spinsRemaining + 1,
    }
    view = 'hub'
  }

  // ── Worlds / battle ────────────────────────────────────────────────────────
  function enterWorld(world: WorldGrade) {
    activeWorld = world
    view = 'battle'
  }

  function handleBattleComplete(updated: StorySaveSlot) {
    currentSlot = updated
    // Return to worlds view so player can continue next battle
    view = 'worlds'
  }

  // ── Graded crystal purchases ───────────────────────────────────────────────
  let fCrystalBuyError = $state<string | null>(null)

  function handleBuyFCrystal(type: 'power' | 'weapon' | 'armor') {
    if (!currentSlot) return
    const result = buyFCrystal($state.snapshot(currentSlot) as StorySaveSlot, type)
    if (result === 'insufficient_gems') {
      fCrystalBuyError = 'Not enough gems.'
      setTimeout(() => { fCrystalBuyError = null }, 2500)
      return
    }
    currentSlot = result
  }

  let endlessKeyBuyError = $state<string | null>(null)

  function handleBuyEndlessKey() {
    if (!currentSlot) return
    const result = buyEndlessKey($state.snapshot(currentSlot) as StorySaveSlot)
    if (result === 'insufficient_gems') {
      endlessKeyBuyError = 'Not enough gems.'
      setTimeout(() => { endlessKeyBuyError = null }, 2500)
      return
    }
    currentSlot = result
  }

  // ── Shop extras ────────────────────────────────────────────────────────────
  let rosterUpgradeError = $state<string | null>(null)

  function handleRosterUpgrade() {
    if (!currentSlot) return
    const result = upgradeRosterCapacity($state.snapshot(currentSlot) as StorySaveSlot)
    if (!result) {
      rosterUpgradeError = 'Not enough gems.'
      setTimeout(() => { rosterUpgradeError = null }, 2500)
      return
    }
    currentSlot = result
  }

  function backToHub() {
    view = 'hub'
    rosterCapAlert = false
  }

  // ── Inventory constants ────────────────────────────────────────────────────
  const CRYSTAL_GRADES = ['F','E','D','C','B','A','S','SS','SSS','God'] as const
  const CRYSTAL_GRADE_COLORS: Record<string, string> = {
    F:'#6b7280', E:'#78716c', D:'#a3a3a3', C:'#4ade80', B:'#60a5fa',
    A:'#a78bfa', S:'#f59e0b', SS:'#f97316', SSS:'#ef4444', God:'#ffd700',
  }
</script>

<!-- ── Save Slot Selection ──────────────────────────────────────────────────── -->
{#if view === 'saveSlotSelect'}
  <div class="min-h-screen flex flex-col items-center justify-center px-4 pt-16 pb-24 gap-8">

    <div class="text-center">
      <h1
        class="gold-emboss font-bold tracking-widest mb-2"
        style="font-family: var(--font-cinzel); font-size: 28px;"
      >
        STORY MODE
      </h1>
      <p class="text-sm font-mono" style="color: var(--color-outline);">
        Choose a save slot to continue or begin
      </p>
    </div>

    <div class="flex flex-col gap-3 w-full max-w-xs">
      {#each [1, 2, 3, 4] as slotNum (slotNum)}
        {@const slotId = slotNum as SlotId}
        {@const slot = slots[slotNum - 1]}
        <div class="obsidian-slab rounded-xl overflow-hidden">
          <button
            class="w-full text-left px-5 py-4 flex items-center gap-4"
            style="background: none; border: none; cursor: pointer;"
            onclick={() => selectSlot(slotId)}
          >
            <!-- Slot number -->
            <div
              class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold font-mono text-sm"
              style="background: rgba(240,192,64,0.08); color: var(--gold-bright); border: 1px solid rgba(240,192,64,0.2);"
            >
              {slotNum}
            </div>

            {#if slot}
              <!-- Occupied slot -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-bold text-sm truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">
                    Lv {slot.playerLevel} — {getStageTierLabel(slot.stage)}
                  </span>
                </div>
                <div class="flex items-center gap-3 font-mono text-xs" style="color: var(--color-outline);">
                  <span>{slot.roster.length} chars</span>
                  <span>·</span>
                  <span style="color: #34d399;">{(slot.gems ?? 0).toLocaleString()} gems</span>
                  <span>·</span>
                  <span>{slot.spinsRemaining} spin{slot.spinsRemaining === 1 ? '' : 's'}</span>
                </div>
              </div>
            {:else}
              <!-- Empty slot -->
              <div class="flex-1">
                <span class="font-mono text-sm" style="color: var(--color-outline);">
                  Empty Save Slot
                </span>
              </div>
              <span class="font-mono text-xs" style="color: var(--color-outline);">New</span>
            {/if}
          </button>

          <!-- Delete button for occupied slots -->
          {#if slot}
            <div style="border-top: 1px solid rgba(255,255,255,0.04);" class="px-5 py-2 flex justify-end">
              <button
                class="font-mono text-xs"
                style="color: var(--color-outline); background: none; border: none; cursor: pointer; opacity: 0.6;"
                onclick={(e) => { e.stopPropagation(); confirmDeleteSlot(slotId) }}
              >
                Delete save
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>

  </div>
{/if}

<!-- ── Hub Menu ─────────────────────────────────────────────────────────────── -->
{#if view === 'hub' && currentSlot}
  <div class="min-h-screen flex flex-col items-center justify-center px-4 pt-16 pb-24 gap-6">

    <!-- Header -->
    <div class="w-full max-w-xs flex items-center gap-3">
      <button
        class="font-mono text-sm"
        style="color: var(--color-outline); background: none; border: none; cursor: pointer;"
        onclick={() => { view = 'saveSlotSelect'; currentSlot = null }}
      >
        ←
      </button>
      <div class="flex-1 text-center">
        <h1
          class="gold-emboss font-bold tracking-widest"
          style="font-family: var(--font-cinzel); font-size: 20px;"
        >
          STORY MODE
        </h1>
      </div>
      <div style="width: 24px;"></div>
    </div>

    <!-- Stats bar -->
    <div class="obsidian-slab w-full max-w-xs rounded-xl px-5 py-3 flex flex-col gap-2">
      <div class="flex items-center justify-between gap-4">
        <!-- Gems -->
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined" style="font-size: 16px; color: #34d399; font-variation-settings: 'FILL' 1;">paid</span>
          <span class="font-mono text-sm font-bold" style="color: #34d399;">{gems.toLocaleString()}</span>
          <span class="font-mono text-xs" style="color: var(--color-outline);">gems</span>
        </div>
        <!-- Shards -->
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined" style="font-size: 16px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">diamond</span>
          <span class="font-mono text-sm font-bold" style="color: var(--gold-bright);">{shards}</span>
          <span class="font-mono text-xs" style="color: var(--color-outline);">shards</span>
        </div>
      </div>
      <div class="flex items-center justify-between gap-4">
        <!-- Chars -->
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined" style="font-size: 16px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">person</span>
          <span class="font-mono text-sm font-bold" style="color: var(--color-on-surface);">{roster.length}</span>
          <span class="font-mono text-xs" style="color: var(--color-outline);">chars</span>
        </div>
        <!-- Player level -->
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined" style="font-size: 16px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">military_tech</span>
          <span class="font-mono text-sm font-bold" style="color: var(--color-on-surface);">Lv {playerLevel}</span>
          <span class="font-mono text-xs" style="color: var(--color-outline);">{getStageTierLabel(stage)}</span>
        </div>
      </div>
    </div>

    <!-- Hub menu options -->
    <div class="flex flex-col gap-3 w-full max-w-xs">

      <!-- Wheel (primary CTA) -->
      <div class="obsidian-slab rounded-xl overflow-hidden">
        <button
          class="w-full px-5 py-5 flex items-center gap-4 {spinsRemaining > 0 ? '' : 'opacity-40 cursor-not-allowed'}"
          style="background: none; border: none; cursor: {spinsRemaining > 0 ? 'pointer' : 'not-allowed'};"
          onclick={startSpin}
          disabled={spinsRemaining <= 0}
        >
          <div
            class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style="background: rgba(240,192,64,0.12); border: 1px solid rgba(240,192,64,0.3);"
          >
            <span class="material-symbols-outlined" style="font-size: 22px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">casino</span>
          </div>
          <div class="flex-1 text-left">
            <div class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Wheel</div>
            <div class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">
              {spinsRemaining}/{MAX_DAILY_SPINS} spins
              {#if spinsRemaining < MAX_DAILY_SPINS && refreshMs > 0}
                · +1 in {formatRefreshTime(refreshMs)}
              {/if}
            </div>
          </div>
          {#if spinsRemaining > 0}
            <span class="material-symbols-outlined text-sm" style="color: var(--color-outline);">chevron_right</span>
          {/if}
        </button>
      </div>

      <!-- Roster -->
      <div class="obsidian-slab rounded-xl overflow-hidden">
        <button
          class="w-full px-5 py-5 flex items-center gap-4"
          style="background: none; border: none; cursor: pointer;"
          onclick={() => view = 'roster'}
        >
          <div
            class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.15);"
          >
            <span class="material-symbols-outlined" style="font-size: 22px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">group</span>
          </div>
          <div class="flex-1 text-left">
            <div class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Roster</div>
            <div class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">
              {roster.length} / {rosterCapacity} characters
            </div>
          </div>
          <span class="material-symbols-outlined text-sm" style="color: var(--color-outline);">chevron_right</span>
        </button>
      </div>

      <!-- Shop -->
      <div class="obsidian-slab rounded-xl overflow-hidden">
        <button
          class="w-full px-5 py-5 flex items-center gap-4"
          style="background: none; border: none; cursor: pointer;"
          onclick={() => view = 'shop'}
        >
          <div
            class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.15);"
          >
            <span class="material-symbols-outlined" style="font-size: 22px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">storefront</span>
          </div>
          <div class="flex-1 text-left">
            <div class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Shop</div>
            <div class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">
              Buy spins · {SHARD_COST_PER_SPIN} shards each
            </div>
          </div>
          <span class="material-symbols-outlined text-sm" style="color: var(--color-outline);">chevron_right</span>
        </button>
      </div>

      <!-- Worlds -->
      <div class="obsidian-slab rounded-xl overflow-hidden">
        <button
          class="w-full px-5 py-5 flex items-center gap-4"
          style="background: none; border: none; cursor: pointer;"
          onclick={() => view = 'worlds'}
        >
          <div
            class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.15);"
          >
            <span class="material-symbols-outlined" style="font-size: 22px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">map</span>
          </div>
          <div class="flex-1 text-left">
            <div class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Worlds</div>
            <div class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">
              {Object.values(currentSlot?.worldProgress ?? {}).filter(w => w.beaten).length} / 16 worlds cleared
            </div>
          </div>
          <span class="material-symbols-outlined text-sm" style="color: var(--color-outline);">chevron_right</span>
        </button>
      </div>

      <!-- Inventory -->
      <div class="obsidian-slab rounded-xl overflow-hidden">
        <button
          class="w-full px-5 py-5 flex items-center gap-4"
          style="background: none; border: none; cursor: pointer;"
          onclick={() => view = 'inventory'}
        >
          <div
            class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.15);"
          >
            <span class="material-symbols-outlined" style="font-size: 22px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">inventory_2</span>
          </div>
          <div class="flex-1 text-left">
            <div class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Inventory</div>
            <div class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">
              Crystals · keys · items
            </div>
          </div>
          <span class="material-symbols-outlined text-sm" style="color: var(--color-outline);">chevron_right</span>
        </button>
      </div>

    </div>
  </div>
{/if}

<!-- ── Shop view ────────────────────────────────────────────────────────────── -->
{#if view === 'shop' && currentSlot}
  <header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-4 px-4"
    style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);"
  >
    <button
      class="font-mono text-sm"
      style="color: var(--color-outline); background: none; border: none; cursor: pointer;"
      onclick={backToHub}
    >
      ←
    </button>
    <h2 class="font-bold" style="font-family: var(--font-cinzel); font-size: 18px; color: var(--color-on-surface);">
      Fate Shop
    </h2>
    <!-- Currency display -->
    <div class="ml-auto flex items-center gap-4">
      <div class="flex items-center gap-1.5">
        <span class="material-symbols-outlined" style="font-size: 15px; color: #34d399; font-variation-settings: 'FILL' 1;">paid</span>
        <span class="font-mono text-sm font-bold" style="color: #34d399;">{gems.toLocaleString()}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="material-symbols-outlined" style="font-size: 15px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">diamond</span>
        <span class="font-mono text-sm font-bold" style="color: var(--gold-bright);">{shards}</span>
      </div>
    </div>
  </header>

  <div class="pt-20 pb-24 px-4 flex flex-col items-center gap-5 max-w-xs mx-auto w-full">

    <!-- Error toasts -->
    {#if rosterUpgradeError}
      <div class="w-full rounded-lg px-4 py-2 text-center font-mono text-sm"
        style="background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.3); color: #ef4444;">
        {rosterUpgradeError}
      </div>
    {/if}
    {#if fCrystalBuyError}
      <div class="w-full rounded-lg px-4 py-2 text-center font-mono text-sm"
        style="background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.3); color: #ef4444;">
        {fCrystalBuyError}
      </div>
    {/if}
    {#if endlessKeyBuyError}
      <div class="w-full rounded-lg px-4 py-2 text-center font-mono text-sm"
        style="background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.3); color: #ef4444;">
        {endlessKeyBuyError}
      </div>
    {/if}
    {#if crystalBuyError}
      <div class="w-full rounded-lg px-4 py-2 text-center font-mono text-sm"
        style="background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.3); color: #ef4444;">
        {crystalBuyError}
      </div>
    {/if}

    <!-- Spin credits -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-4 text-center">
      <p class="font-mono text-xs mb-1" style="color: var(--color-outline);">Current spin credits</p>
      <p class="font-bold text-3xl" style="font-family: var(--font-cinzel); color: var(--gold-bright);">{spinsRemaining}</p>
    </div>

    <!-- Buy spin -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-5 flex items-center gap-4">
      <div class="flex-1">
        <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Fate Spin</p>
        <p class="font-mono text-xs mt-1" style="color: var(--color-outline);">Generate one new character</p>
        <p class="font-mono text-xs mt-1" style="color: var(--gold-bright);">{SHARD_COST_PER_SPIN} shards</p>
      </div>
      <button
        class="{shards >= SHARD_COST_PER_SPIN ? 'metal-stamp-gold' : 'obsidian-slab'} rounded-lg px-4 py-2 font-bold font-mono text-sm"
        style="{shards < SHARD_COST_PER_SPIN ? 'color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07); opacity: 0.5; cursor: not-allowed;' : ''}"
        onclick={buySpin}
        disabled={shards < SHARD_COST_PER_SPIN}
      >
        Buy
      </button>
    </div>

    <!-- ── Stat Crystals section ──────────────────────────────────────────── -->
    <div class="w-full flex items-center gap-3 mt-2">
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
      <p class="font-mono text-xs tracking-widest uppercase" style="color: var(--color-outline);">Stat Crystals</p>
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
    </div>
    <p class="font-mono text-xs text-center" style="color: var(--color-outline); line-height: 1.6; margin-top: -8px;">
      Boost any character stat. Daily limits reset at midnight.
    </p>

    <!-- Inventory summary -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-3 flex items-center justify-around gap-2">
      <div class="text-center">
        <p class="font-mono text-xs" style="color: var(--color-outline);">Common</p>
        <p class="font-bold font-mono" style="color: #9ca3af;">{statCrystalInventory.common}</p>
      </div>
      <div style="width: 1px; height: 28px; background: rgba(255,255,255,0.06);"></div>
      <div class="text-center">
        <p class="font-mono text-xs" style="color: var(--color-outline);">Elite</p>
        <p class="font-bold font-mono" style="color: #8b5cf6;">{statCrystalInventory.elite}</p>
      </div>
      <div style="width: 1px; height: 28px; background: rgba(255,255,255,0.06);"></div>
      <div class="text-center">
        <p class="font-mono text-xs" style="color: var(--color-outline);">Legendary</p>
        <p class="font-bold font-mono" style="color: #f59e0b;">{statCrystalInventory.legendary}</p>
      </div>
    </div>

    <!-- Common Stat Crystal -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-4 flex items-center gap-4">
      <div
        class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style="background: rgba(156,163,175,0.1); border: 1px solid rgba(156,163,175,0.25);"
      >
        <span class="material-symbols-outlined" style="font-size: 20px; color: #9ca3af; font-variation-settings: 'FILL' 1;">hexagon</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Common Crystal</p>
        <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">+1 to any stat</p>
        <div class="flex items-center gap-3 mt-1">
          <span class="font-mono text-xs" style="color: #34d399;">{STAT_CRYSTAL_COSTS.common.toLocaleString()} gems</span>
          <span class="font-mono text-xs" style="color: {dailyCommon >= STAT_CRYSTAL_DAILY_LIMITS.common ? '#ef4444' : 'var(--color-outline)'};">
            {dailyCommon}/{STAT_CRYSTAL_DAILY_LIMITS.common} today
          </span>
        </div>
      </div>
      <button
        class="{commonCanBuy ? 'metal-stamp-gold' : 'obsidian-slab'} rounded-lg px-3 py-2 font-bold font-mono text-sm flex-shrink-0"
        style="{!commonCanBuy ? 'color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07); opacity: 0.45; cursor: not-allowed;' : ''}"
        onclick={() => handleBuyStatCrystal('common')}
        disabled={!commonCanBuy}
      >
        Buy
      </button>
    </div>

    <!-- Elite Stat Crystal -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-4 flex items-center gap-4">
      <div
        class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style="background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3);"
      >
        <span class="material-symbols-outlined" style="font-size: 20px; color: #8b5cf6; font-variation-settings: 'FILL' 1;">hexagon</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Elite Crystal</p>
        <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">+3 to any stat</p>
        <div class="flex items-center gap-3 mt-1">
          <span class="font-mono text-xs" style="color: #34d399;">{STAT_CRYSTAL_COSTS.elite.toLocaleString()} gems</span>
          <span class="font-mono text-xs" style="color: {dailyElite >= STAT_CRYSTAL_DAILY_LIMITS.elite ? '#ef4444' : 'var(--color-outline)'};">
            {dailyElite}/{STAT_CRYSTAL_DAILY_LIMITS.elite} today
          </span>
        </div>
      </div>
      <button
        class="{eliteCanBuy ? 'metal-stamp-gold' : 'obsidian-slab'} rounded-lg px-3 py-2 font-bold font-mono text-sm flex-shrink-0"
        style="{!eliteCanBuy ? 'color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07); opacity: 0.45; cursor: not-allowed;' : ''}"
        onclick={() => handleBuyStatCrystal('elite')}
        disabled={!eliteCanBuy}
      >
        Buy
      </button>
    </div>

    <!-- Legendary Stat Crystal -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-4 flex items-center gap-4">
      <div
        class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3);"
      >
        <span class="material-symbols-outlined" style="font-size: 20px; color: #f59e0b; font-variation-settings: 'FILL' 1;">hexagon</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Legendary Crystal</p>
        <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">+5 to any stat</p>
        <div class="flex items-center gap-3 mt-1">
          <span class="font-mono text-xs" style="color: #34d399;">{STAT_CRYSTAL_COSTS.legendary.toLocaleString()} gems</span>
          <span class="font-mono text-xs" style="color: {dailyLegendary >= STAT_CRYSTAL_DAILY_LIMITS.legendary ? '#ef4444' : 'var(--color-outline)'};">
            {dailyLegendary}/{STAT_CRYSTAL_DAILY_LIMITS.legendary} today
          </span>
        </div>
      </div>
      <button
        class="{legendaryCanBuy ? 'metal-stamp-gold' : 'obsidian-slab'} rounded-lg px-3 py-2 font-bold font-mono text-sm flex-shrink-0"
        style="{!legendaryCanBuy ? 'color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07); opacity: 0.45; cursor: not-allowed;' : ''}"
        onclick={() => handleBuyStatCrystal('legendary')}
        disabled={!legendaryCanBuy}
      >
        Buy
      </button>
    </div>

    <!-- ── Combat Crystals section ─────────────────────────────────────── -->
    <div class="w-full flex items-center gap-3 mt-2">
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
      <p class="font-mono text-xs tracking-widest uppercase" style="color: var(--color-outline);">Combat Crystals</p>
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
    </div>
    <p class="font-mono text-xs text-center" style="color: var(--color-outline); line-height: 1.6; margin-top: -8px;">
      Used to fuse and upgrade power, weapon, and armor items.
    </p>

    <!-- Power Crystal (F) -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-4 flex items-center gap-4">
      <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style="background: rgba(251,146,60,0.1); border: 1px solid rgba(251,146,60,0.3);">
        <span class="material-symbols-outlined" style="font-size: 20px; color: #fb923c; font-variation-settings: 'FILL' 1;">flash_on</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Power Crystal (F)</p>
        <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">Owned: {powerCrystalInventory.F}</p>
        <span class="font-mono text-xs mt-1 block" style="color: #34d399;">{F_CRYSTAL_COST.toLocaleString()} gems</span>
      </div>
      <button
        class="{gems >= F_CRYSTAL_COST ? 'metal-stamp-gold' : 'obsidian-slab'} rounded-lg px-3 py-2 font-bold font-mono text-sm flex-shrink-0"
        style="{gems < F_CRYSTAL_COST ? 'color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07); opacity: 0.45; cursor: not-allowed;' : ''}"
        onclick={() => handleBuyFCrystal('power')}
        disabled={gems < F_CRYSTAL_COST}
      >Buy</button>
    </div>

    <!-- Weapon Crystal (F) -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-4 flex items-center gap-4">
      <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3);">
        <span class="material-symbols-outlined" style="font-size: 20px; color: #818cf8; font-variation-settings: 'FILL' 1;">swords</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Weapon Crystal (F)</p>
        <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">Owned: {weaponCrystalInventory.F}</p>
        <span class="font-mono text-xs mt-1 block" style="color: #34d399;">{F_CRYSTAL_COST.toLocaleString()} gems</span>
      </div>
      <button
        class="{gems >= F_CRYSTAL_COST ? 'metal-stamp-gold' : 'obsidian-slab'} rounded-lg px-3 py-2 font-bold font-mono text-sm flex-shrink-0"
        style="{gems < F_CRYSTAL_COST ? 'color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07); opacity: 0.45; cursor: not-allowed;' : ''}"
        onclick={() => handleBuyFCrystal('weapon')}
        disabled={gems < F_CRYSTAL_COST}
      >Buy</button>
    </div>

    <!-- Armor Crystal (F) -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-4 flex items-center gap-4">
      <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style="background: rgba(20,184,166,0.1); border: 1px solid rgba(20,184,166,0.3);">
        <span class="material-symbols-outlined" style="font-size: 20px; color: #2dd4bf; font-variation-settings: 'FILL' 1;">shield</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Armor Crystal (F)</p>
        <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">Owned: {armorCrystalInventory.F}</p>
        <span class="font-mono text-xs mt-1 block" style="color: #34d399;">{F_CRYSTAL_COST.toLocaleString()} gems</span>
      </div>
      <button
        class="{gems >= F_CRYSTAL_COST ? 'metal-stamp-gold' : 'obsidian-slab'} rounded-lg px-3 py-2 font-bold font-mono text-sm flex-shrink-0"
        style="{gems < F_CRYSTAL_COST ? 'color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07); opacity: 0.45; cursor: not-allowed;' : ''}"
        onclick={() => handleBuyFCrystal('armor')}
        disabled={gems < F_CRYSTAL_COST}
      >Buy</button>
    </div>

    <!-- ── Endless Keys (level 3+) ──────────────────────────────────────── -->
    {#if playerLevel >= 3}
      <div class="w-full flex items-center gap-3 mt-2">
        <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
        <p class="font-mono text-xs tracking-widest uppercase" style="color: var(--color-outline);">Endless Mode</p>
        <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
      </div>
      <div class="obsidian-slab w-full rounded-xl px-5 py-4 flex items-center gap-4">
        <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style="background: rgba(240,192,64,0.1); border: 1px solid rgba(240,192,64,0.3);">
          <span class="font-mono text-xl">🗝</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Endless Key</p>
          <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">One Endless Mode run · Owned: {endlessKeys}</p>
          <span class="font-mono text-xs mt-1 block" style="color: #34d399;">{ENDLESS_KEY_GEM_COST.toLocaleString()} gems</span>
        </div>
        <button
          class="{gems >= ENDLESS_KEY_GEM_COST ? 'metal-stamp-gold' : 'obsidian-slab'} rounded-lg px-3 py-2 font-bold font-mono text-sm flex-shrink-0"
          style="{gems < ENDLESS_KEY_GEM_COST ? 'color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07); opacity: 0.45; cursor: not-allowed;' : ''}"
          onclick={handleBuyEndlessKey}
          disabled={gems < ENDLESS_KEY_GEM_COST}
        >Buy</button>
      </div>
    {/if}

    <p class="font-mono text-xs text-center" style="color: var(--color-outline); line-height: 1.6;">
      Sell characters from your Roster to earn Fate Shards.
    </p>

  </div>
{/if}

<!-- ── Spin view ─────────────────────────────────────────────────────────────── -->
{#if view === 'spin' && currentSlot}
  <StorySpinView
    stage={stage}
    onSessionComplete={handleStoryComplete}
    onCancel={handleSpinCancel}
  />
{/if}

<!-- ── Roster view ───────────────────────────────────────────────────────────── -->
{#if view === 'roster' || view === 'expanded'}
  <!-- Sticky header -->
  <header class="fixed top-0 left-0 right-0 z-30 flex items-center justify-between gap-4 px-4"
    style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);"
  >
    <div class="flex items-center gap-3">
      <button
        class="font-mono text-sm"
        style="color: var(--color-outline); background: none; border: none; cursor: pointer;"
        onclick={backToHub}
      >
        ←
      </button>
      <h2 class="font-bold" style="font-family: var(--font-cinzel); font-size: 20px; color: var(--color-on-surface);">
        Roster
      </h2>
      <span class="font-mono text-xs" style="color: var(--color-outline);">{roster.length}/{rosterCapacity}</span>
    </div>

    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined" style="font-size: 16px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">diamond</span>
      <span class="font-mono text-sm font-bold" style="color: var(--gold-bright);">{shards}</span>

      <!-- Roster upgrade inline button -->
      <button
        class="font-mono text-xs px-2 py-1 rounded ml-1"
        style="background: {canUpgradeRoster ? 'rgba(52,211,153,0.12)' : 'transparent'}; border: 1px solid {canUpgradeRoster ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.08)'}; color: {canUpgradeRoster ? '#34d399' : 'var(--color-outline)'}; cursor: {canUpgradeRoster ? 'pointer' : 'default'}; opacity: {canUpgradeRoster ? 1 : 0.5};"
        onclick={handleRosterUpgrade}
        disabled={!canUpgradeRoster}
        title="+5 slots — {nextUpgradeCost.toLocaleString()} gems"
      >
        +5 slots
      </button>

      <div class="flex gap-1 ml-1">
        {#each ['tier', 'race', 'archetype'] as sortOption}
          <button
            class="font-mono text-sm font-bold rounded px-2"
            style="min-height: 44px; border-radius: 4px; border: none; cursor: pointer; background: transparent; color: {sortBy === sortOption ? 'var(--gold-bright)' : 'var(--color-outline)'}; border-bottom: {sortBy === sortOption ? '2px solid #f0c040' : '2px solid transparent'}; transition: color 120ms, border-color 120ms;"
            onclick={() => sortBy = sortOption as 'tier' | 'race' | 'archetype'}
          >
            {sortOption.charAt(0).toUpperCase() + sortOption.slice(1)}
          </button>
        {/each}
      </div>
    </div>
  </header>
  {#if rosterUpgradeError}
    <div class="fixed top-16 left-0 right-0 z-20 px-4 pt-2">
      <div class="max-w-[960px] mx-auto rounded-lg px-4 py-2 text-center font-mono text-sm"
        style="background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.3); color: #ef4444;">
        {rosterUpgradeError}
      </div>
    </div>
  {/if}

  <div class="pt-20 pb-24 px-4">

    {#if rosterCapAlert}
      <div class="flex items-center justify-between gap-3 rounded-lg px-4 py-3 mb-4 max-w-[960px] mx-auto"
        style="background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.3);"
      >
        <p class="font-mono text-sm" style="color: var(--color-error, #ef4444);">
          Roster is full — sell a character to free a slot.
        </p>
        <button onclick={() => rosterCapAlert = false}
          style="background: none; border: none; cursor: pointer; color: var(--color-outline); font-size: 18px; line-height: 1; flex-shrink: 0;">
          ×
        </button>
      </div>
    {/if}

    {#if roster.length === 0}
      <div class="flex flex-col items-center justify-center gap-4 pt-16 text-center">
        <h3 class="font-bold" style="font-family: var(--font-cinzel); font-size: 20px; color: var(--color-on-surface);">Your Roster is Empty</h3>
        <p class="text-base" style="color: var(--color-on-surface-variant);">Use a spin from the hub to generate a character.</p>
        <button class="metal-stamp-gold rounded-xl py-3 font-bold font-mono text-sm"
          style="width: 100%; max-width: 320px;" onclick={backToHub}>
          Back to Hub
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 max-w-[960px] mx-auto">
        {#each sortedRoster as entry (entry.id)}
          <RosterCard {entry} onExpand={handleExpand} onSell={handleSell} />
        {/each}
      </div>
    {/if}
  </div>
{/if}

<!-- ── Expanded overlay ──────────────────────────────────────────────────────── -->
{#if view === 'expanded' && expandedEntry !== null}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    style="background: rgba(7,7,13,0.88); backdrop-filter: blur(8px);"
    onclick={closeExpanded}
    role="dialog"
    aria-modal="true"
    aria-label="Character sheet"
  >
    <div
      class="obsidian-slab w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-xl mx-4"
      style="animation: slideInBottom 200ms ease-out;"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between px-4 py-3" style="height: 48px; border-bottom: 1px solid rgba(255,223,150,0.08);">
        <h3 class="font-bold truncate" style="font-family: var(--font-cinzel); font-size: 20px; color: var(--color-on-surface);">
          {expandedEntry.name}
        </h3>
        <button
          class="text-xl font-bold ml-4 flex-shrink-0"
          style="background: none; border: none; cursor: pointer; color: var(--color-outline); line-height: 1;"
          onclick={closeExpanded}
          aria-label="Close"
        >×</button>
      </div>
      <div class="p-4">
        <CharacterCard
          results={expandedEntry.spins}
          name={expandedEntry.name}
          startedAt={expandedEntry.sessionStartedAt}
          readonly={true}
          onNewCharacter={() => {}}
        />
      </div>
    </div>
  </div>
{/if}

<!-- ── Worlds view ───────────────────────────────────────────────────────────── -->
{#if view === 'worlds' && currentSlot}
  <WorldsView
    slot={currentSlot}
    onEnterWorld={enterWorld}
    onBack={backToHub}
  />
{/if}

<!-- ── Battle view ────────────────────────────────────────────────────────────── -->
{#if view === 'battle' && currentSlot && activeWorld}
  <BattleView
    slot={currentSlot}
    world={activeWorld}
    onBattleComplete={handleBattleComplete}
    onBack={() => view = 'worlds'}
  />
{/if}

<!-- ── Inventory view ────────────────────────────────────────────────────────── -->
{#if view === 'inventory' && currentSlot}
  <header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-4 px-4"
    style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);">
    <button class="font-mono text-sm"
      style="color: var(--color-outline); background: none; border: none; cursor: pointer;"
      onclick={backToHub}>←</button>
    <h2 class="font-bold" style="font-family: var(--font-cinzel); font-size: 18px; color: var(--color-on-surface);">Inventory</h2>
    <div class="ml-auto flex items-center gap-3">
      <div class="flex items-center gap-1">
        <span class="material-symbols-outlined" style="font-size: 14px; color: #34d399; font-variation-settings: 'FILL' 1;">paid</span>
        <span class="font-mono text-sm font-bold" style="color: #34d399;">{gems.toLocaleString()}</span>
      </div>
    </div>
  </header>

  <div class="pt-20 pb-24 px-4 flex flex-col gap-5 max-w-xs mx-auto w-full">

    <!-- Endless Keys -->
    <div class="obsidian-slab rounded-xl px-5 py-4">
      <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: var(--color-outline);">Endless Keys</p>
      <div class="flex items-center gap-3">
        <span class="text-2xl">🗝</span>
        <span class="font-bold font-mono text-xl" style="color: var(--gold-bright);">{endlessKeys}</span>
        <span class="font-mono text-xs" style="color: var(--color-outline);">{endlessKeys === 1 ? 'key' : 'keys'} available</span>
      </div>
    </div>

    <!-- Stat Crystals -->
    <div class="obsidian-slab rounded-xl px-5 py-4">
      <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: var(--color-outline);">Stat Crystals</p>
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs" style="color: #9ca3af;">Common</span>
          <span class="font-mono text-sm font-bold" style="color: #9ca3af;">{statCrystalInventory.common}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs" style="color: #8b5cf6;">Elite</span>
          <span class="font-mono text-sm font-bold" style="color: #8b5cf6;">{statCrystalInventory.elite}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs" style="color: #f59e0b;">Legendary</span>
          <span class="font-mono text-sm font-bold" style="color: #f59e0b;">{statCrystalInventory.legendary}</span>
        </div>
      </div>
    </div>

    <!-- Power Crystals -->
    <div class="obsidian-slab rounded-xl px-5 py-4">
      <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: #fb923c;">Power Crystals</p>
      <div class="grid grid-cols-2 gap-1.5">
        {#each CRYSTAL_GRADES as g}
          {@const count = powerCrystalInventory[g] ?? 0}
          {@const gc = CRYSTAL_GRADE_COLORS[g]}
          <div class="flex items-center justify-between px-2 py-1 rounded" style="background: rgba(255,255,255,0.03);">
            <span class="font-mono text-xs" style="color: {gc};">{g}</span>
            <span class="font-mono text-sm font-bold" style="color: {count > 0 ? gc : 'var(--color-outline)'};">{count}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Weapon Crystals -->
    <div class="obsidian-slab rounded-xl px-5 py-4">
      <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: #818cf8;">Weapon Crystals</p>
      <div class="grid grid-cols-2 gap-1.5">
        {#each CRYSTAL_GRADES as g}
          {@const count = weaponCrystalInventory[g] ?? 0}
          {@const gc = CRYSTAL_GRADE_COLORS[g]}
          <div class="flex items-center justify-between px-2 py-1 rounded" style="background: rgba(255,255,255,0.03);">
            <span class="font-mono text-xs" style="color: {gc};">{g}</span>
            <span class="font-mono text-sm font-bold" style="color: {count > 0 ? gc : 'var(--color-outline)'};">{count}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Armor Crystals -->
    <div class="obsidian-slab rounded-xl px-5 py-4">
      <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: #2dd4bf;">Armor Crystals</p>
      <div class="grid grid-cols-2 gap-1.5">
        {#each CRYSTAL_GRADES as g}
          {@const count = armorCrystalInventory[g] ?? 0}
          {@const gc = CRYSTAL_GRADE_COLORS[g]}
          <div class="flex items-center justify-between px-2 py-1 rounded" style="background: rgba(255,255,255,0.03);">
            <span class="font-mono text-xs" style="color: {gc};">{g}</span>
            <span class="font-mono text-sm font-bold" style="color: {count > 0 ? gc : 'var(--color-outline)'};">{count}</span>
          </div>
        {/each}
      </div>
    </div>

  </div>
{/if}

<!-- ── Sell confirmation modal ───────────────────────────────────────────────── -->
{#if sellTarget !== null}
  <SellConfirmModal
    entry={sellTarget}
    onConfirm={confirmSell}
    onCancel={() => sellTarget = null}
  />
{/if}

<!-- ── Delete slot confirmation ───────────────────────────────────────────────── -->
{#if deleteConfirmId !== null}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.9); backdrop-filter: blur(12px);"
    onclick={() => deleteConfirmId = null}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="obsidian-slab w-full max-w-sm rounded-xl p-7 text-center"
      style="border: 1px solid rgba(220,38,38,0.3);"
      onclick={(e) => e.stopPropagation()}
    >
      <p class="font-bold mb-2" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Delete Save Slot {deleteConfirmId}?</p>
      <p class="font-mono text-sm mb-6" style="color: var(--color-outline);">
        This will permanently erase all characters, shards, and progress in this slot.
      </p>
      <div class="flex gap-3">
        <button
          onclick={() => deleteConfirmId = null}
          class="obsidian-slab flex-1 py-2.5 rounded-lg text-sm font-bold"
          style="font-family: var(--font-cinzel); color: #9a907b; border: 1px solid #4e4635;"
        >Cancel</button>
        <button
          onclick={doDeleteSlot}
          class="flex-1 py-2.5 rounded-lg text-sm font-bold"
          style="font-family: var(--font-cinzel); background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.4); color: #ef4444; cursor: pointer;"
        >Delete</button>
      </div>
    </div>
  </div>
{/if}
