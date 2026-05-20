<script lang="ts">
  import { onMount } from 'svelte'
  import {
    loadAllSlots, loadSaveSlot, saveSaveSlot, createSaveSlot, deleteSaveSlot,
    addCharacterToSlot, sellCharacterFromSlot, purchaseSpin, consumeSpin,
    buyStatCrystal, getDailyBought,
    SHARD_COST_PER_SPIN, STAGE_LABELS, STAGE_ROSTER_THRESHOLDS,
    STAT_CRYSTAL_COSTS, STAT_CRYSTAL_DAILY_LIMITS,
    type StorySaveSlot, type SlotId, type StatCrystalType,
  } from '$lib/story/saveSlots'
  import { getShardValue } from '$lib/story/shards'
  import { getStageTierLabel } from '$lib/story/raceTiers'
  import type { StoryRosterEntry } from '$lib/story/types'
  import CharacterCard from '../../components/CharacterCard.svelte'
  import TierBadge from '../../components/TierBadge.svelte'
  import RosterCard from '../../components/story/RosterCard.svelte'
  import SellConfirmModal from '../../components/story/SellConfirmModal.svelte'
  import StorySpinView from '../../components/story/StorySpinView.svelte'

  // ── View state machine ─────────────────────────────────────────────────────
  // saveSlotSelect → hub → spin | roster | expanded | shop
  type View = 'saveSlotSelect' | 'hub' | 'spin' | 'roster' | 'expanded' | 'shop'
  let view = $state<View>('saveSlotSelect')

  // ── Slot state ─────────────────────────────────────────────────────────────
  let slots = $state<(StorySaveSlot | null)[]>([null, null, null, null])
  let currentSlot = $state<StorySaveSlot | null>(null)
  let deleteConfirmId = $state<SlotId | null>(null)

  // ── Roster/sort/dialog state ───────────────────────────────────────────────
  let sortBy = $state<'tier' | 'race' | 'archetype'>('tier')
  let expandedId = $state<string | null>(null)
  let sellTarget = $state<StoryRosterEntry | null>(null)
  let rosterCapAlert = $state(false)

  // ── Derived values ─────────────────────────────────────────────────────────
  let roster = $derived(currentSlot?.roster ?? [])
  let gems = $derived(currentSlot?.gems ?? 0)
  let shards = $derived(currentSlot?.shards ?? 0)
  let stage = $derived(currentSlot?.stage ?? 1)
  let spinsRemaining = $derived(currentSlot?.spinsRemaining ?? 0)
  let statCrystalInventory = $derived(currentSlot?.inventory?.statCrystals ?? { common: 0, elite: 0, legendary: 0 })

  // Daily bought counts (re-derived on slot change so they update when a purchase is made)
  let dailyCommon    = $derived(currentSlot ? getDailyBought(currentSlot, 'common')    : 0)
  let dailyElite     = $derived(currentSlot ? getDailyBought(currentSlot, 'elite')     : 0)
  let dailyLegendary = $derived(currentSlot ? getDailyBought(currentSlot, 'legendary') : 0)

  let commonCanBuy    = $derived(gems >= STAT_CRYSTAL_COSTS.common    && dailyCommon    < STAT_CRYSTAL_DAILY_LIMITS.common)
  let eliteCanBuy     = $derived(gems >= STAT_CRYSTAL_COSTS.elite     && dailyElite     < STAT_CRYSTAL_DAILY_LIMITS.elite)
  let legendaryCanBuy = $derived(gems >= STAT_CRYSTAL_COSTS.legendary && dailyLegendary < STAT_CRYSTAL_DAILY_LIMITS.legendary)

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

  let nextStageThreshold = $derived(
    stage < 6 ? STAGE_ROSTER_THRESHOLDS[stage] : null
  )

  let stageProgress = $derived(
    nextStageThreshold !== null
      ? Math.min(1, roster.length / nextStageThreshold)
      : 1
  )

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(() => {
    slots = loadAllSlots()
  })

  // ── Persist current slot on every change ──────────────────────────────────
  $effect(() => {
    if (currentSlot) saveSaveSlot($state.snapshot(currentSlot) as StorySaveSlot)
  })

  // ── Save slot actions ──────────────────────────────────────────────────────
  function selectSlot(id: SlotId) {
    const existing = loadSaveSlot(id)
    if (existing) {
      currentSlot = existing
    } else {
      const fresh = createSaveSlot(id)
      saveSaveSlot(fresh)
      currentSlot = fresh
    }
    slots = loadAllSlots()
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
    // Spin was cancelled mid-session — return spin credit
    if (!currentSlot) { view = 'hub'; return }
    currentSlot = {
      ...($state.snapshot(currentSlot) as StorySaveSlot),
      spinsRemaining: currentSlot.spinsRemaining + 1,
    }
    view = 'hub'
  }

  function backToHub() {
    view = 'hub'
    rosterCapAlert = false
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
                  <span
                    class="font-bold text-sm truncate"
                    style="font-family: var(--font-cinzel); color: var(--color-on-surface);"
                  >
                    Stage {slot.stage} — {getStageTierLabel(slot.stage)}
                  </span>
                </div>
                <div class="flex items-center gap-3 font-mono text-xs" style="color: var(--color-outline);">
                  <span>{slot.roster.length} chars</span>
                  <span>·</span>
                  <span style="color: var(--gold-bright);">{slot.shards} shards</span>
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
        <!-- Stage -->
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined" style="font-size: 16px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">stars</span>
          <span class="font-mono text-sm font-bold" style="color: var(--color-on-surface);">S{stage}</span>
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
              {spinsRemaining} spin{spinsRemaining === 1 ? '' : 's'} remaining
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
              {roster.length} / 50 characters
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

      <!-- Levels (progression display) -->
      <div class="obsidian-slab rounded-xl overflow-hidden">
        <div class="px-5 py-5 flex items-center gap-4">
          <div
            class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.15);"
          >
            <span class="material-symbols-outlined" style="font-size: 22px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">map</span>
          </div>
          <div class="flex-1">
            <div class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Levels</div>
            <div class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">
              {#if nextStageThreshold !== null}
                {roster.length}/{nextStageThreshold} chars to unlock {STAGE_LABELS[stage]} tier
              {:else}
                All tiers unlocked — Stage 6 / Godlike
              {/if}
            </div>
            <!-- Progress bar -->
            <div class="mt-2 rounded-full overflow-hidden" style="height: 3px; background: rgba(255,255,255,0.07);">
              <div
                class="h-full rounded-full"
                style="width: {Math.round(stageProgress * 100)}%; background: var(--gold-bright); transition: width 0.4s ease;"
              ></div>
            </div>
          </div>
          <span class="font-mono text-xs font-bold" style="color: var(--color-outline);">S{stage}</span>
        </div>
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

    <!-- Error toast -->
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
    </div>

    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined" style="font-size: 16px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">diamond</span>
      <span class="font-mono text-sm font-bold" style="color: var(--gold-bright);">{shards}</span>

      <div class="flex gap-1 ml-2">
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
