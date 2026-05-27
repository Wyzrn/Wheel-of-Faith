<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte'
  import { storyHomeSignal } from '$lib/menuState.svelte'
  import {
    loadAllSlots, loadSaveSlot, saveSaveSlot, createSaveSlot, deleteSaveSlot,
    addCharacterToSlot, sellCharacterFromSlot, purchaseSpin, consumeSpin, consumeBonusSpin, sellBonusSpins,
    buyStatCrystal, buyStatCrystalWithShards, getDailyBought, applySpinRefresh, msUntilNextRefresh,
    upgradeRosterCapacity, rosterUpgradeCost, buyCrystalWithGems, buyCrystalWithShards,
    sellCrystal, sellStatCrystal, buyEndlessKey, consumeEndlessKey,
    buyHeroSpin, buyLegendSpin, consumeHeroSpin, consumeLegendSpin,
    recordWorldReplayStart, worldReplayCooldownMs, WORLD_REPLAY_COOLDOWN_MS,
    createTeamInSlot, updateTeamInSlot, deleteTeamInSlot, maxTeamSize,
    openCrystal, equipOpenedItem, useStatCrystal,
    SHARD_COST_PER_SPIN, STAGE_LABELS, MAX_DAILY_SPINS,
    STAT_CRYSTAL_COSTS, STAT_CRYSTAL_DAILY_LIMITS, STAT_CRYSTAL_SHARD_COSTS,
    CRYSTAL_BUY_PRICES_GEMS, CRYSTAL_BUY_PRICES_SHARDS, CRYSTAL_SELL_PRICES, CRYSTAL_GRADE_LIST,
    STAT_CRYSTAL_SELL_PRICES, ENDLESS_KEY_GEM_COST,
    HERO_SPIN_SHARD_COST, LEGEND_SPIN_SHARD_COST, BONUS_SPIN_SELL_PRICE,
    BOOSTABLE_STATS, BOOSTABLE_STAT_LABELS, STAT_CRYSTAL_BOOST,
    type StorySaveSlot, type SlotId, type StatCrystalType, type CrystalGrade, type BoostableStat,
    type OpenedItem,
  } from '$lib/story/saveSlots'
  import type { StoryTeam } from '$lib/story/types'
  import { getGemValue } from '$lib/story/shards'
  import { auth } from '$lib/stores/auth.svelte'
  import { getEffectiveMaxSpins, getEffectiveRosterCapacity } from '$lib/story/saveSlots'
  import { getStageTierLabel } from '$lib/story/raceTiers'
  import type { WorldGrade } from '$lib/story/worlds'
  import type { StoryRosterEntry } from '$lib/story/types'
  import { extendedTierFromScore, boostedTier } from '$lib/game/scoreTier'
  import { getArchetype } from '$lib/content/archetypes'
  import { powerRating } from '$lib/story/powerRating'
  import { quickEquipBestGear } from '$lib/story/saveSlots'
  import { toast } from '$lib/toast.svelte'
  import CharacterCompare from '../../components/CharacterCompare.svelte'
  import CharacterCard from '../../components/CharacterCard.svelte'
  import TierBadge from '../../components/TierBadge.svelte'
  import RosterCard from '../../components/story/RosterCard.svelte'
  import SellConfirmModal from '../../components/story/SellConfirmModal.svelte'
  import StorySpinView from '../../components/story/StorySpinView.svelte'
  import WorldsView from '../../components/story/WorldsView.svelte'
  import BattleView from '../../components/story/BattleView.svelte'
  import EndlessView from '../../components/story/EndlessView.svelte'

  // ── View state machine ─────────────────────────────────────────────────────
  type View = 'saveSlotSelect' | 'hub' | 'spin' | 'roster' | 'expanded' | 'shop' | 'worlds' | 'battle' | 'inventory' | 'teams' | 'endless'
  let view = $state<View>('saveSlotSelect')

  // ── Slot state ─────────────────────────────────────────────────────────────
  let slots = $state<(StorySaveSlot | null)[]>([null, null, null, null])
  let currentSlot = $state<StorySaveSlot | null>(null)
  let deleteConfirmId = $state<SlotId | null>(null)
  let activeWorld = $state<WorldGrade | null>(null)
  let activePlusLevel = $state(0)

  // ── Roster/sort/dialog state ───────────────────────────────────────────────
  // Roster sort + filter — persisted in localStorage so the player's preference
  // sticks across sessions (hospitality: don't re-ask what they already told us).
  type SortKey = 'tier' | 'power' | 'race' | 'archetype' | 'level' | 'recent'
  type ArchetypeFilter = 'all' | 'Combat' | 'Magic' | 'Stealth' | 'Support' | 'Chaos'
  const ROSTER_PREFS_KEY = 'wof_roster_prefs_v1'
  function loadRosterPrefs(): { sort: SortKey; filter: ArchetypeFilter } {
    if (typeof localStorage === 'undefined') return { sort: 'power', filter: 'all' }
    try {
      const raw = localStorage.getItem(ROSTER_PREFS_KEY)
      if (!raw) return { sort: 'power', filter: 'all' }
      const p = JSON.parse(raw)
      return { sort: p.sort ?? 'power', filter: p.filter ?? 'all' }
    } catch { return { sort: 'power', filter: 'all' } }
  }
  const _initialPrefs = loadRosterPrefs()
  let sortBy = $state<SortKey>(_initialPrefs.sort)
  let archetypeFilter = $state<ArchetypeFilter>(_initialPrefs.filter)
  $effect(() => {
    if (typeof localStorage === 'undefined') return
    try { localStorage.setItem(ROSTER_PREFS_KEY, JSON.stringify({ sort: sortBy, filter: archetypeFilter })) } catch { /* quota */ }
  })
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
    const snapshot = $state.snapshot(currentSlot) as StorySaveSlot
    const maxSpins = getEffectiveMaxSpins(auth.user?.gamepasses ?? [])
    const refreshed = applySpinRefresh(snapshot, maxSpins)
    if (refreshed !== snapshot) currentSlot = refreshed
    refreshMs = msUntilNextRefresh(refreshed, maxSpins)
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  let roster = $derived(currentSlot?.roster ?? [])
  let gems = $derived(currentSlot?.gems ?? 0)
  let shards = $derived(auth.loggedIn ? (auth.user?.shards ?? 0) : (currentSlot?.shards ?? 0))
  let stage = $derived(currentSlot?.stage ?? 1)
  let playerLevel = $derived(currentSlot?.playerLevel ?? 0)
  let spinsRemaining = $derived(currentSlot?.spinsRemaining ?? 0)
  let bonusSpins     = $derived(currentSlot?.bonusSpins ?? 0)
  let heroSpins      = $derived(currentSlot?.heroSpins ?? 0)
  let legendSpins    = $derived(currentSlot?.legendSpins ?? 0)
  let hasHeroSpins   = $derived(playerLevel >= 2 && heroSpins > 0)
  let hasLegendSpins = $derived(playerLevel >= 4 && legendSpins > 0)
  let hasAnySpin     = $derived(spinsRemaining > 0 || bonusSpins > 0 || hasHeroSpins || hasLegendSpins)
  let rosterCapacity = $derived(
    currentSlot ? getEffectiveRosterCapacity(currentSlot, auth.user?.gamepasses ?? []) : 5
  )
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

  // Filter first, then sort. Archetype filter compares against the archetype's
  // declared archetypeType (Combat / Magic / Stealth / Support / Chaos).
  let filteredRoster = $derived(
    archetypeFilter === 'all'
      ? roster
      : roster.filter(r => (getArchetype(r.archetype)?.archetypeType ?? 'Combat') === archetypeFilter)
  )
  let sortedRoster = $derived(
    [...filteredRoster].sort((a, b) => {
      if (sortBy === 'power')     return powerRating(b) - powerRating(a)
      if (sortBy === 'tier')      return b.overallScore - a.overallScore
      if (sortBy === 'level')     return (b.level ?? 1) - (a.level ?? 1)
      if (sortBy === 'recent')    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      if (sortBy === 'race')      return a.race.localeCompare(b.race)
      return a.archetype.localeCompare(b.archetype)
    })
  )

  let expandedEntry = $derived(
    expandedId !== null ? roster.find(r => r.id === expandedId) ?? null : null
  )

  // Quick-equip: hand-picks the single highest-grade unequipped item from each
  // pool (weapon/armor/power) and slots it onto the character. Toasts a summary
  // so the player can see what changed — hospitality means showing the action.
  // Compare picker — when active, clicking a roster card sets compareWithId.
  let comparePickerOpen = $state(false)
  let compareWithId     = $state<string | null>(null)
  let comparePair = $derived(
    expandedEntry && compareWithId
      ? { left: expandedEntry, right: roster.find(r => r.id === compareWithId) ?? null }
      : null
  )

  function quickEquip(characterId: string) {
    if (!currentSlot) return
    const snap = $state.snapshot(currentSlot) as StorySaveSlot
    const result = quickEquipBestGear(snap, characterId)
    if (result === 'char_not_found') { toast.error('Character not found'); return }
    if (result.equipped.length === 0) {
      toast.show('Nothing better to equip — your roster has everything available.', 'info')
      return
    }
    currentSlot = result.slot
    saveSaveSlot(result.slot)
    const detail = result.equipped.map(e => `${e.name} [${e.grade}]`).join(' · ')
    toast.reward(`Equipped ${result.equipped.length} item${result.equipped.length === 1 ? '' : 's'}`, detail)
  }

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

  // ── Story Home hotbar button → return to hub from anywhere ─────────────────
  $effect(() => {
    void storyHomeSignal.count  // only reactive dependency; reads below are untracked
    untrack(() => {
      if (currentSlot && view !== 'saveSlotSelect') {
        view = 'hub'
      }
    })
  })

  // ── Save slot actions ──────────────────────────────────────────────────────
  async function selectSlot(id: SlotId) {
    const existing = loadSaveSlot(id)
    let slot = existing ?? createSaveSlot(id)
    const maxSpins = getEffectiveMaxSpins(auth.user?.gamepasses ?? [])
    slot = applySpinRefresh(slot, maxSpins)
    // Migrate local slot shards to account on first load
    if (auth.loggedIn && slot.shards > 0) {
      await adjustShards(slot.shards)
      slot = { ...slot, shards: 0 }
    }
    saveSaveSlot(slot)
    currentSlot = slot
    slots = loadAllSlots()
    refreshMs = msUntilNextRefresh(slot, maxSpins)
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

  // ── Share slot ─────────────────────────────────────────────────────────────
  let shareSlotUrl  = $state<string | null>(null)
  let shareSlotId   = $state<SlotId | null>(null)
  let shareSlotSaving = $state(false)
  let shareSlotError  = $state<string | null>(null)

  async function shareSlot(id: SlotId) {
    const slot = slots[(id as number) - 1]
    if (!slot) return
    shareSlotSaving = true
    shareSlotError = null
    shareSlotId = id
    try {
      const res = await fetch('/api/story-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slotData: slot }),
      })
      if (res.status === 401) {
        shareSlotError = 'Log in to save a slot to your account.'
        return
      }
      if (!res.ok) throw new Error('Server error')
      const { url } = await res.json() as { url: string }
      shareSlotUrl = `${window.location.origin}${url}`
    } catch {
      shareSlotError = 'Failed to save. Try again.'
    } finally {
      shareSlotSaving = false
    }
  }

  function copyShareSlotUrl() {
    if (!shareSlotUrl) return
    navigator.clipboard.writeText(shareSlotUrl)
  }

  // ── Sync slots from server ─────────────────────────────────────────────────
  let isSyncing = $state(false)
  let syncMessage = $state<string | null>(null)

  async function syncSlots() {
    isSyncing = true
    syncMessage = null
    try {
      const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/?$/, '')
      const res = await fetch(`${API_URL}/api/story-slots/mine`, { credentials: 'include' })
      if (res.status === 401) { syncMessage = 'Log in to sync save slots.'; return }
      if (!res.ok) { syncMessage = 'Sync failed. Try again.'; return }
      const serverSlots = await res.json() as Array<{ slotData: StorySaveSlot }>
      let synced = 0
      const seen = new Set<SlotId>()
      // Server returns newest-first; take the most recent save per slot and override local
      for (const ss of serverSlots) {
        const data = ss.slotData
        const sid = data?.id as SlotId
        if (!sid || seen.has(sid)) continue
        seen.add(sid)
        saveSaveSlot(data)
        synced++
      }
      slots = loadAllSlots()
      // If currentSlot was overridden, reload it
      if (currentSlot && seen.has(currentSlot.id)) {
        currentSlot = loadSaveSlot(currentSlot.id)
      }
      syncMessage = synced > 0 ? `Synced ${synced} slot${synced > 1 ? 's' : ''} from your account.` : 'No linked slots found on your account.'
    } catch {
      syncMessage = 'Sync failed. Try again.'
    } finally {
      isSyncing = false
      setTimeout(() => { syncMessage = null }, 3500)
    }
  }

  // ── Hub actions ────────────────────────────────────────────────────────────
  type SpinType = 'refresh' | 'bonus' | 'hero' | 'legend'
  let spinTypeModal = $state(false)
  let lastSpinType = $state<SpinType>('refresh')

  function handleWheelClick() {
    if (!currentSlot || !hasAnySpin) return
    const available: SpinType[] = []
    if (spinsRemaining > 0) available.push('refresh')
    if (bonusSpins > 0) available.push('bonus')
    if (hasHeroSpins) available.push('hero')
    if (hasLegendSpins) available.push('legend')
    if (available.length === 1) {
      startSpin(available[0])
    } else {
      spinTypeModal = true
    }
  }

  function startSpin(type: SpinType) {
    if (!currentSlot) return
    spinTypeModal = false
    const snapshot = $state.snapshot(currentSlot) as StorySaveSlot
    let updated: StorySaveSlot | null = null
    if (type === 'bonus') updated = consumeBonusSpin(snapshot)
    else if (type === 'hero') updated = consumeHeroSpin(snapshot)
    else if (type === 'legend') updated = consumeLegendSpin(snapshot)
    else updated = consumeSpin(snapshot)
    if (!updated) return
    lastSpinType = type
    currentSlot = updated
    view = 'spin'
  }

  // ── Account shard helpers ─────────────────────────────────────────────────
  function withAcctShards(slot: StorySaveSlot): StorySaveSlot {
    if (!auth.loggedIn) return slot
    return { ...slot, shards: auth.user?.shards ?? 0 }
  }

  async function adjustShards(delta: number) {
    if (!auth.loggedIn || delta === 0) return
    auth.updateShopData((auth.user?.shards ?? 0) + delta, auth.user?.gamepasses ?? [])
    try {
      await fetch('/api/shop/shards/adjust', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      })
    } catch { /* optimistic update already applied */ }
  }

  // ── Shop ───────────────────────────────────────────────────────────────────
  function buySpin() {
    if (!currentSlot) return
    const slot = withAcctShards($state.snapshot(currentSlot) as StorySaveSlot)
    const updated = purchaseSpin(slot)
    if (!updated) return
    if (auth.loggedIn) {
      adjustShards(updated.shards - slot.shards)
      currentSlot = { ...updated, shards: 0 }
    } else {
      currentSlot = updated
    }
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
    let value = getGemValue(sellTarget.overallTier)
    if (auth.user?.gamepasses.includes('sell_bonus')) value = Math.ceil(value * 1.25)
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
    const snap = $state.snapshot(currentSlot) as StorySaveSlot
    if (lastSpinType === 'bonus') {
      currentSlot = { ...snap, bonusSpins: snap.bonusSpins + 1 }
    } else if (lastSpinType === 'hero') {
      currentSlot = { ...snap, heroSpins: (snap.heroSpins ?? 0) + 1 }
    } else if (lastSpinType === 'legend') {
      currentSlot = { ...snap, legendSpins: (snap.legendSpins ?? 0) + 1 }
    } else {
      currentSlot = { ...snap, spinsRemaining: snap.spinsRemaining + 1 }
    }
    view = 'hub'
  }

  // ── Level-up popup ─────────────────────────────────────────────────────────
  let levelUpPopup = $state<{ newLevel: number } | null>(null)

  const LEVEL_UNLOCKS: Record<number, { unlocks: string[]; statCap: string }> = {
    1: { unlocks: ['Team size increased to 3', 'Stat cap raised to SS+'], statCap: 'SS+' },
    2: { unlocks: ['Team size increased to 4', 'Hero Spins unlocked (100 shards each)', '2× stat multiplier + luck boost in battle'], statCap: 'SSS+' },
    3: { unlocks: ['Endless Mode unlocked', 'Stat cap raised to Z'], statCap: 'Z' },
    4: { unlocks: ['Legend Spins unlocked (500 shards each)', '4× stat multiplier + luck boost in battle', 'Stat cap raised to ZZZ'], statCap: 'ZZZ' },
    5: { unlocks: ['Stat cap removed — no more limits', 'All systems at maximum'], statCap: 'Uncapped' },
  }

  function checkLevelUp(oldLevel: number, updated: StorySaveSlot) {
    if (updated.playerLevel > oldLevel) levelUpPopup = { newLevel: updated.playerLevel }
  }

  // ── Worlds / battle ────────────────────────────────────────────────────────
  function enterWorld(world: WorldGrade) {
    activeWorld = world
    activePlusLevel = 0
    if (currentSlot?.worldProgress[world]?.beaten) {
      currentSlot = recordWorldReplayStart($state.snapshot(currentSlot) as StorySaveSlot, world)
    }
    view = 'battle'
  }

  function enterAbsolutePlus(level: number) {
    activeWorld = 'Absolute'
    activePlusLevel = level
    view = 'battle'
  }

  function enterEndless() {
    if (!currentSlot || endlessKeys <= 0) { view = 'shop'; return }
    const result = consumeEndlessKey($state.snapshot(currentSlot) as StorySaveSlot)
    if (!result) { view = 'shop'; return }
    currentSlot = result
    view = 'endless'
  }

  function handleEndlessExit(updated: StorySaveSlot) {
    currentSlot = updated
    view = 'hub'
  }

  function handleBattleComplete(updated: StorySaveSlot) {
    const oldLevel = currentSlot?.playerLevel ?? 0
    if (auth.loggedIn && currentSlot) {
      const delta = updated.shards - (currentSlot.shards ?? 0)
      if (delta > 0) adjustShards(delta)
      currentSlot = { ...updated, shards: 0 }
    } else {
      currentSlot = updated
    }
    checkLevelUp(oldLevel, updated)
    view = 'worlds'
  }

  function handleNextBattle(updated: StorySaveSlot) {
    const oldLevel = currentSlot?.playerLevel ?? 0
    if (auth.loggedIn && currentSlot) {
      const delta = updated.shards - (currentSlot.shards ?? 0)
      if (delta > 0) adjustShards(delta)
      currentSlot = { ...updated, shards: 0 }
    } else {
      currentSlot = updated
    }
    checkLevelUp(oldLevel, updated)
  }

  // ── Graded crystal purchases ───────────────────────────────────────────────
  let fCrystalBuyError = $state<string | null>(null)

  function handleBuyCrystalGems(type: 'power' | 'weapon' | 'armor', grade: CrystalGrade) {
    if (!currentSlot) return
    const result = buyCrystalWithGems($state.snapshot(currentSlot) as StorySaveSlot, type, grade)
    if (result === 'insufficient_gems') {
      fCrystalBuyError = 'Not enough gems.'
      setTimeout(() => { fCrystalBuyError = null }, 2500)
      return
    }
    currentSlot = result
    saveSaveSlot($state.snapshot(result) as StorySaveSlot)
  }

  function handleBuyCrystalShards(type: 'power' | 'weapon' | 'armor', grade: CrystalGrade) {
    if (!currentSlot) return
    const slot = withAcctShards($state.snapshot(currentSlot) as StorySaveSlot)
    const result = buyCrystalWithShards(slot, type, grade)
    if (result === 'insufficient_shards') {
      fCrystalBuyError = 'Not enough shards.'
      setTimeout(() => { fCrystalBuyError = null }, 2500)
      return
    }
    if (auth.loggedIn) {
      adjustShards((result as StorySaveSlot).shards - slot.shards)
      currentSlot = { ...(result as StorySaveSlot), shards: 0 }
    } else {
      currentSlot = result as StorySaveSlot
    }
    saveSaveSlot($state.snapshot(currentSlot) as StorySaveSlot)
  }

  function handleSellCrystal(type: 'power' | 'weapon' | 'armor', grade: CrystalGrade) {
    if (!currentSlot) return
    const result = sellCrystal($state.snapshot(currentSlot) as StorySaveSlot, type, grade)
    if (result === 'insufficient_crystals') return
    currentSlot = result
    saveSaveSlot($state.snapshot(result) as StorySaveSlot)
  }

  function handleSellStatCrystal(type: StatCrystalType) {
    if (!currentSlot) return
    const result = sellStatCrystal($state.snapshot(currentSlot) as StorySaveSlot, type)
    if (result === 'insufficient_crystals') return
    currentSlot = result
    saveSaveSlot($state.snapshot(result) as StorySaveSlot)
  }

  function handleSellBonusSpins(count: number) {
    if (!currentSlot) return
    const result = sellBonusSpins($state.snapshot(currentSlot) as StorySaveSlot, count)
    if (result === 'insufficient_spins') return
    currentSlot = result
    saveSaveSlot($state.snapshot(result) as StorySaveSlot)
  }

  function handleBuyStatCrystalShards(type: StatCrystalType) {
    if (!currentSlot) return
    const slot = withAcctShards($state.snapshot(currentSlot) as StorySaveSlot)
    const result = buyStatCrystalWithShards(slot, type)
    if (result === 'insufficient_shards') {
      crystalBuyError = 'Not enough shards.'
      setTimeout(() => { crystalBuyError = null }, 2500)
      return
    }
    if (auth.loggedIn) {
      adjustShards((result as StorySaveSlot).shards - slot.shards)
      currentSlot = { ...(result as StorySaveSlot), shards: 0 }
    } else {
      currentSlot = result as StorySaveSlot
    }
    saveSaveSlot($state.snapshot(currentSlot) as StorySaveSlot)
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

  let heroSpinBuyError = $state<string | null>(null)
  let legendSpinBuyError = $state<string | null>(null)

  function handleBuyHeroSpin() {
    if (!currentSlot) return
    const slot = withAcctShards($state.snapshot(currentSlot) as StorySaveSlot)
    const result = buyHeroSpin(slot)
    if (result === 'locked') {
      heroSpinBuyError = 'Reach Level 2 to unlock Hero Spins.'
      setTimeout(() => { heroSpinBuyError = null }, 2500)
      return
    }
    if (result === 'insufficient_shards') {
      heroSpinBuyError = `Need ${HERO_SPIN_SHARD_COST} fate shards.`
      setTimeout(() => { heroSpinBuyError = null }, 2500)
      return
    }
    if (auth.loggedIn) {
      adjustShards((result as StorySaveSlot).shards - slot.shards)
      currentSlot = { ...(result as StorySaveSlot), shards: 0 }
    } else {
      currentSlot = result as StorySaveSlot
    }
  }

  function handleBuyLegendSpin() {
    if (!currentSlot) return
    const slot = withAcctShards($state.snapshot(currentSlot) as StorySaveSlot)
    const result = buyLegendSpin(slot)
    if (result === 'locked') {
      legendSpinBuyError = 'Reach Level 4 to unlock Legend Spins.'
      setTimeout(() => { legendSpinBuyError = null }, 2500)
      return
    }
    if (result === 'insufficient_shards') {
      legendSpinBuyError = `Need ${LEGEND_SPIN_SHARD_COST} fate shards.`
      setTimeout(() => { legendSpinBuyError = null }, 2500)
      return
    }
    if (auth.loggedIn) {
      adjustShards((result as StorySaveSlot).shards - slot.shards)
      currentSlot = { ...(result as StorySaveSlot), shards: 0 }
    } else {
      currentSlot = result as StorySaveSlot
    }
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

  // ── Teams state ────────────────────────────────────────────────────────────
  let teams = $derived(currentSlot?.teams ?? [])
  let fWorldBeaten = $derived(currentSlot?.worldProgress?.['F']?.beaten ?? false)
  let teamMaxSize  = $derived(maxTeamSize(playerLevel, fWorldBeaten))

  type TeamFormMode = 'none' | 'create' | 'edit'
  let teamFormMode = $state<TeamFormMode>('none')
  let teamEditId   = $state<string | null>(null)
  let teamFormName = $state('')
  let teamFormIds  = $state<string[]>([])

  function openCreateTeam() {
    teamFormMode = 'create'
    teamEditId   = null
    teamFormName = ''
    teamFormIds  = []
  }

  function openEditTeam(team: StoryTeam) {
    teamFormMode = 'edit'
    teamEditId   = team.id
    teamFormName = team.name
    teamFormIds  = [...team.characterIds]
  }

  function cancelTeamForm() {
    teamFormMode = 'none'
    teamEditId   = null
  }

  function saveTeamForm() {
    if (!currentSlot || !teamFormName.trim() || teamFormIds.length === 0) return
    if (teamFormMode === 'create') {
      currentSlot = createTeamInSlot($state.snapshot(currentSlot) as StorySaveSlot, teamFormName.trim(), teamFormIds)
    } else if (teamFormMode === 'edit' && teamEditId) {
      currentSlot = updateTeamInSlot($state.snapshot(currentSlot) as StorySaveSlot, teamEditId, teamFormName.trim(), teamFormIds)
    }
    cancelTeamForm()
  }

  function handleDeleteTeam(teamId: string) {
    if (!currentSlot) return
    currentSlot = deleteTeamInSlot($state.snapshot(currentSlot) as StorySaveSlot, teamId)
  }

  function toggleTeamChar(id: string) {
    if (teamFormIds.includes(id)) {
      teamFormIds = teamFormIds.filter(x => x !== id)
    } else if (teamFormIds.length < teamMaxSize) {
      teamFormIds = [...teamFormIds, id]
    }
  }

  // ── Inventory constants ────────────────────────────────────────────────────
  const CRYSTAL_GRADES = ['F','E','D','C','B','A','S','SS','SSS','God'] as const
  const CRYSTAL_GRADE_COLORS: Record<string, string> = {
    F:'#6b7280', E:'#78716c', D:'#a3a3a3', C:'#4ade80', B:'#60a5fa',
    A:'#a78bfa', S:'#f59e0b', SS:'#f97316', SSS:'#ef4444', God:'#ffd700',
  }
  const CRYSTAL_GRADE_ORDER: Record<string, number> = {
    F:0, E:1, D:2, C:3, B:4, A:5, S:6, SS:7, SSS:8, God:9
  }

  // ── Inventory tabs ─────────────────────────────────────────────────────────
  type InvTab = 'crystals' | 'weapons' | 'armor' | 'powers'
  let invTab = $state<InvTab>('crystals')
  let invItemSortDesc = $state(true)  // true = highest grade first

  let openedWeapons = $derived(currentSlot?.inventory?.openedWeapons ?? [])
  let openedArmors  = $derived(currentSlot?.inventory?.openedArmors  ?? [])
  let openedPowers  = $derived(currentSlot?.inventory?.openedPowers  ?? [])

  // ── Stacked item view ──────────────────────────────────────────────────────
  interface StackedItem { name: string; grade: CrystalGrade; element?: string; count: number; ids: string[] }

  function stackItems(items: OpenedItem[]): StackedItem[] {
    const map = new Map<string, StackedItem>()
    for (const item of items) {
      const key = `${item.grade}||${item.name}`
      const existing = map.get(key)
      if (existing) { existing.count++; existing.ids.push(item.id) }
      else map.set(key, { name: item.name, grade: item.grade, element: item.element, count: 1, ids: [item.id] })
    }
    return [...map.values()]
  }

  function sortStacked(items: StackedItem[]): StackedItem[] {
    return [...items].sort((a, b) => {
      const diff = (CRYSTAL_GRADE_ORDER[b.grade] ?? 0) - (CRYSTAL_GRADE_ORDER[a.grade] ?? 0)
      if (diff !== 0) return invItemSortDesc ? diff : -diff
      return a.name.localeCompare(b.name)
    })
  }

  let stackedWeapons = $derived(sortStacked(stackItems(openedWeapons)))
  let stackedArmors  = $derived(sortStacked(stackItems(openedArmors)))
  let stackedPowers  = $derived(sortStacked(stackItems(openedPowers)))

  function equipFirstOfStack(type: 'weapon' | 'armor' | 'power', stack: StackedItem) {
    const list = type === 'weapon' ? openedWeapons : type === 'armor' ? openedArmors : openedPowers
    const item = list.find(i => i.id === stack.ids[0])
    if (item) openEquipModal(type, item)
  }

  // ── Open crystal ───────────────────────────────────────────────────────────
  let openCrystalError = $state<string | null>(null)

  type CrystalAnimPhase = 'pulse' | 'crack' | 'reveal'
  interface CrystalAnim {
    type: 'weapon' | 'armor' | 'power'
    grade: CrystalGrade
    phase: CrystalAnimPhase
    item: OpenedItem
  }
  let crystalAnim = $state<CrystalAnim | null>(null)

  function handleOpenCrystal(type: 'weapon' | 'armor' | 'power', grade: CrystalGrade) {
    if (!currentSlot) return
    const result = openCrystal($state.snapshot(currentSlot) as StorySaveSlot, type, grade)
    if (result === 'no_crystal') {
      openCrystalError = 'No crystals of that grade.'
      setTimeout(() => { openCrystalError = null }, 2500)
      return
    }
    currentSlot = result.slot
    saveSaveSlot($state.snapshot(result.slot) as StorySaveSlot)
    crystalAnim = { type, grade, phase: 'pulse', item: result.item }
    setTimeout(() => {
      crystalAnim = crystalAnim ? { ...crystalAnim, phase: 'crack' } : null
      setTimeout(() => {
        crystalAnim = crystalAnim ? { ...crystalAnim, phase: 'reveal' } : null
      }, 450)
    }, 1500)
  }

  function dismissCrystalAnim() {
    crystalAnim = null
  }

  function dismissAndEquipCrystal() {
    const anim = crystalAnim
    crystalAnim = null
    if (anim) openEquipModal(anim.type, anim.item)
  }

  // ── Equip opened item modal ────────────────────────────────────────────────
  let equipModal = $state<{ type: 'weapon' | 'armor' | 'power'; item: OpenedItem } | null>(null)

  function openEquipModal(type: 'weapon' | 'armor' | 'power', item: OpenedItem) {
    equipModal = { type, item }
  }

  function doEquip(charId: string) {
    if (!currentSlot || !equipModal) return
    const result = equipOpenedItem(
      $state.snapshot(currentSlot) as StorySaveSlot,
      charId,
      equipModal.item.id,
      equipModal.type,
    )
    if (typeof result !== 'string') {
      currentSlot = result
      saveSaveSlot($state.snapshot(result) as StorySaveSlot)
    }
    equipModal = null
  }

  // ── Use stat crystal modal ─────────────────────────────────────────────────
  type UseStatPhase = 'pickChar' | 'pickStat'
  let useStatModal = $state<{ type: StatCrystalType; phase: UseStatPhase; charId: string | null } | null>(null)
  let useStatError = $state<string | null>(null)
  let useStatQty   = $state(1)

  const LEVEL_MAX_SCORES = [54, 92, 99, 103, 115, Infinity] as const

  function openUseStatModal(type: StatCrystalType) {
    useStatModal = { type, phase: 'pickChar', charId: null }
    useStatQty = 1
  }

  function selectUseStatChar(charId: string) {
    if (!useStatModal) return
    useStatModal = { ...useStatModal, phase: 'pickStat', charId }
    useStatQty = 1
  }

  function clampStatQty(qty: number, stat: BoostableStat): number {
    if (!currentSlot || !useStatModal) return 0
    const available = currentSlot.inventory.statCrystals[useStatModal.type]
    const boost = STAT_CRYSTAL_BOOST[useStatModal.type]
    const maxScore = LEVEL_MAX_SCORES[Math.min(5, playerLevel)]
    const char = currentSlot.roster.find(r => r.id === useStatModal!.charId)
    const currentScore = char?.spins.find(r => r.category === stat)?.score ?? 0
    const roomLeft = maxScore === Infinity ? available : Math.max(0, Math.floor((maxScore - currentScore) / boost))
    return Math.max(0, Math.min(qty, available, roomLeft))
  }

  function doUseStat(stat: BoostableStat) {
    if (!currentSlot || !useStatModal || !useStatModal.charId) return
    const effectiveQty = clampStatQty(useStatQty, stat)
    if (effectiveQty === 0) {
      useStatError = 'This stat is already at your level cap. Beat more worlds to raise the limit.'
      setTimeout(() => { useStatError = null }, 3500)
      return
    }
    let updated = $state.snapshot(currentSlot) as StorySaveSlot
    for (let i = 0; i < effectiveQty; i++) {
      const result = useStatCrystal(updated, useStatModal.charId!, stat, useStatModal.type)
      if (typeof result === 'string') break
      updated = result
    }
    currentSlot = updated
    saveSaveSlot($state.snapshot(updated) as StorySaveSlot)
    useStatModal = null
    useStatQty = 1
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
                  <span>{slot.spinsRemaining} spin{slot.spinsRemaining === 1 ? '' : 's'}{(slot.bonusSpins ?? 0) > 0 ? ` +${slot.bonusSpins} bonus` : ''}</span>
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

          <!-- Action row for occupied slots -->
          {#if slot}
            <div style="border-top: 1px solid rgba(255,255,255,0.04);" class="px-5 py-2 flex items-center justify-between">
              <!-- Save: uploads this slot's data to the player's account so it
                   becomes the canonical version. Pressing "Sync Slots from
                   Account" later (on this or another device) pulls this saved
                   data back down and overrides the local slot. -->
              <button
                class="font-mono text-xs flex items-center gap-1"
                style="color: #34d399; background: none; border: none; cursor: pointer;"
                onclick={(e) => { e.stopPropagation(); shareSlot(slotId) }}
                title="Save this slot to your account — Sync Slots will load it back"
              >
                <span class="material-symbols-outlined" style="font-size: 13px;">cloud_upload</span>
                Save
              </button>
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

    <!-- Sync button -->
    <div class="flex flex-col items-center gap-2 w-full max-w-xs">
      <button
        onclick={syncSlots}
        disabled={isSyncing}
        class="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all active:scale-95"
        style="background: rgba(125,211,252,0.06); border: 1px solid rgba(125,211,252,0.2); color: #7dd3fc; cursor: pointer; opacity: {isSyncing ? 0.6 : 1};"
      >
        <span class="material-symbols-outlined {isSyncing ? 'animate-spin' : ''}" style="font-size: 15px;">sync</span>
        {isSyncing ? 'Syncing…' : 'Sync Slots from Account'}
      </button>
      {#if syncMessage}
        <p class="font-mono text-xs text-center" style="color: {syncMessage.startsWith('Log in') || syncMessage.startsWith('Sync failed') ? '#ef4444' : '#34d399'};">{syncMessage}</p>
      {/if}
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

    <!-- First-time onboarding hint — surfaces a clear next step when the roster
         is empty (i.e. brand-new save slot). Disappears as soon as the player
         spins their first character. -->
    {#if roster.length === 0 && hasAnySpin}
      <div class="w-full max-w-xs rounded-xl px-4 py-3"
        style="background: linear-gradient(135deg, rgba(240,192,64,0.10), rgba(240,192,64,0.03)); border: 1px solid rgba(240,192,64,0.32);">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined" style="font-size: 22px; color: #f0c040; font-variation-settings: 'FILL' 1;">tips_and_updates</span>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold mb-1" style="font-family: 'Cinzel', serif; color: #ffdf96;">Welcome to your save slot</p>
            <p class="text-xs" style="color: #9a907b; line-height: 1.5; font-family: 'JetBrains Mono', monospace;">
              Tap <span style="color: #f0c040;">Wheel</span> to spin your first character. Then explore
              <span style="color: #f0c040;">Worlds</span> to send them into battle and earn gems.
            </p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Hub menu options -->
    <div class="flex flex-col gap-3 w-full max-w-xs">

      <!-- Wheel (primary CTA) -->
      <div class="obsidian-slab rounded-xl overflow-hidden">
        <button
          class="w-full px-5 py-5 flex items-center gap-4 {hasAnySpin ? '' : 'opacity-40 cursor-not-allowed'}"
          style="background: none; border: none; cursor: {hasAnySpin ? 'pointer' : 'not-allowed'};"
          onclick={handleWheelClick}
          disabled={!hasAnySpin}
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
              {spinsRemaining}/{MAX_DAILY_SPINS} refresh
              {#if bonusSpins > 0}
                · <span style="color: #a78bfa;">{bonusSpins} bonus</span>
              {/if}
              {#if spinsRemaining < MAX_DAILY_SPINS && refreshMs > 0}
                · +1 in {formatRefreshTime(refreshMs)}
              {/if}
            </div>
          </div>
          {#if hasAnySpin}
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
              Spins · crystals · upgrades
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

      <!-- Endless Mode (unlocked at player level 3) -->
      {#if playerLevel >= 3}
        <div class="obsidian-slab rounded-xl overflow-hidden" style="border: 1px solid rgba(167,139,250,0.2);">
          <button
            class="w-full px-5 py-5 flex items-center gap-4 {endlessKeys > 0 ? '' : 'opacity-50'}"
            style="background: none; border: none; cursor: {endlessKeys > 0 ? 'pointer' : 'default'};"
            onclick={() => endlessKeys > 0 ? enterEndless() : view = 'shop'}
          >
            <div
              class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
              style="background: rgba(167,139,250,0.12); border: 1px solid rgba(167,139,250,0.3);"
            >
              <span class="material-symbols-outlined" style="font-size: 22px; color: #a78bfa; font-variation-settings: 'FILL' 1;">all_inclusive</span>
            </div>
            <div class="flex-1 text-left">
              <div class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Endless Mode</div>
              <div class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">
                {endlessKeys > 0 ? `${endlessKeys} key${endlessKeys === 1 ? '' : 's'} · Ready` : 'No keys — buy one in Shop'}
              </div>
            </div>
            <span class="font-mono text-xs px-2 py-1 rounded" style="background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.25); color: #a78bfa;">🗝 {endlessKeys}</span>
          </button>
        </div>
      {/if}

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
    <div class="obsidian-slab w-full rounded-xl px-5 py-4">
      <p class="font-mono text-xs mb-2" style="color: var(--color-outline);">Spin Credits</p>
      <div class="flex items-center justify-around gap-2 flex-wrap">
        <div class="text-center">
          <p class="font-mono text-xs" style="color: var(--color-outline);">Refresh</p>
          <p class="font-bold text-2xl" style="font-family: var(--font-cinzel); color: var(--gold-bright);">{spinsRemaining}</p>
          <p class="font-mono text-[10px]" style="color: var(--color-outline);">/ {MAX_DAILY_SPINS} daily</p>
        </div>
        <div style="width: 1px; height: 36px; background: rgba(255,255,255,0.06);"></div>
        <div class="text-center">
          <p class="font-mono text-xs" style="color: var(--color-outline);">Bonus</p>
          <p class="font-bold text-2xl" style="font-family: var(--font-cinzel); color: #a78bfa;">{bonusSpins}</p>
          <p class="font-mono text-[10px]" style="color: var(--color-outline);">drops &amp; milestones</p>
          {#if bonusSpins > 0}
            <button
              onclick={() => handleSellBonusSpins(1)}
              class="mt-1.5 px-2 py-0.5 rounded text-[10px] font-mono"
              style="background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.25); color: #a78bfa; cursor: pointer;"
              title="Sell 1 bonus spin for {BONUS_SPIN_SELL_PRICE} gems"
            >
              Sell +{BONUS_SPIN_SELL_PRICE.toLocaleString()}g
            </button>
          {/if}
        </div>
        {#if playerLevel >= 2}
          <div style="width: 1px; height: 36px; background: rgba(255,255,255,0.06);"></div>
          <div class="text-center">
            <p class="font-mono text-xs" style="color: #f97316;">Hero</p>
            <p class="font-bold text-2xl" style="font-family: var(--font-cinzel); color: #f97316;">{heroSpins}</p>
            <p class="font-mono text-[10px]" style="color: var(--color-outline);">2× power</p>
          </div>
        {/if}
        {#if playerLevel >= 4}
          <div style="width: 1px; height: 36px; background: rgba(255,255,255,0.06);"></div>
          <div class="text-center">
            <p class="font-mono text-xs" style="color: #fbbf24;">Legend</p>
            <p class="font-bold text-2xl" style="font-family: var(--font-cinzel); color: #fbbf24;">{legendSpins}</p>
            <p class="font-mono text-[10px]" style="color: var(--color-outline);">4× power</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Buy spin -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-5 flex items-center gap-4">
      <div class="flex-1">
        <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Buy Refresh Spin</p>
        <p class="font-mono text-xs mt-1" style="color: var(--color-outline);">Adds one spin to your daily refresh pool</p>
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

    <!-- ── Hero / Legend Spins section ───────────────────────────────────── -->
    <div class="w-full flex items-center gap-3 mt-2">
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
      <p class="font-mono text-xs tracking-widest uppercase" style="color: var(--color-outline);">Special Spins</p>
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
    </div>

    {#if heroSpinBuyError}
      <div class="w-full rounded-lg px-4 py-2 text-center font-mono text-sm"
        style="background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.3); color: #ef4444;">
        {heroSpinBuyError}
      </div>
    {/if}
    {#if legendSpinBuyError}
      <div class="w-full rounded-lg px-4 py-2 text-center font-mono text-sm"
        style="background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.3); color: #ef4444;">
        {legendSpinBuyError}
      </div>
    {/if}

    <!-- Hero Spin -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-5"
      style="border: 1px solid {playerLevel >= 2 ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.06)'}; opacity: {playerLevel >= 2 ? 1 : 0.4};">
      <div class="flex items-center gap-4">
        <div class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style="background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.3);">
          <span class="material-symbols-outlined" style="font-size: 20px; color: #f97316; font-variation-settings: 'FILL' 1;">military_tech</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: #f97316;">Hero Spin</p>
          <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">2× luck boost · 2× battle stats · {heroSpins} owned</p>
          <p class="font-mono text-xs mt-0.5" style="color: var(--gold-bright);">{HERO_SPIN_SHARD_COST} fate shards
            {#if playerLevel < 2}<span style="color: #f97316;"> · Unlocks at Level 2</span>{/if}
          </p>
        </div>
        <button
          class="{playerLevel >= 2 && shards >= HERO_SPIN_SHARD_COST ? 'metal-stamp-gold' : 'obsidian-slab'} rounded-lg px-4 py-2 font-bold font-mono text-sm flex-shrink-0"
          style="{playerLevel < 2 || shards < HERO_SPIN_SHARD_COST ? 'color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07); opacity: 0.5; cursor: not-allowed;' : ''}"
          onclick={handleBuyHeroSpin}
          disabled={playerLevel < 2 || shards < HERO_SPIN_SHARD_COST}
        >
          Buy
        </button>
      </div>
    </div>

    <!-- Legend Spin -->
    <div class="obsidian-slab w-full rounded-xl px-5 py-5"
      style="border: 1px solid {playerLevel >= 4 ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.06)'}; opacity: {playerLevel >= 4 ? 1 : 0.4};">
      <div class="flex items-center gap-4">
        <div class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style="background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3);">
          <span class="material-symbols-outlined" style="font-size: 20px; color: #fbbf24; font-variation-settings: 'FILL' 1;">star</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: #fbbf24;">Legend Spin</p>
          <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">4× luck boost · 4× battle stats · {legendSpins} owned</p>
          <p class="font-mono text-xs mt-0.5" style="color: var(--gold-bright);">{LEGEND_SPIN_SHARD_COST} fate shards
            {#if playerLevel < 4}<span style="color: #fbbf24;"> · Unlocks at Level 4</span>{/if}
          </p>
        </div>
        <button
          class="{playerLevel >= 4 && shards >= LEGEND_SPIN_SHARD_COST ? 'metal-stamp-gold' : 'obsidian-slab'} rounded-lg px-4 py-2 font-bold font-mono text-sm flex-shrink-0"
          style="{playerLevel < 4 || shards < LEGEND_SPIN_SHARD_COST ? 'color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07); opacity: 0.5; cursor: not-allowed;' : ''}"
          onclick={handleBuyLegendSpin}
          disabled={playerLevel < 4 || shards < LEGEND_SPIN_SHARD_COST}
        >
          Buy
        </button>
      </div>
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

    <!-- Stat crystals — all 3 types with gems + shards options -->
    <div class="obsidian-slab w-full rounded-xl px-4 py-4">
      {#each ([
        ['common',    'Common',    '#9ca3af', '+1 to any stat', dailyCommon,    commonCanBuy,    STAT_CRYSTAL_DAILY_LIMITS.common],
        ['elite',     'Elite',     '#8b5cf6', '+3 to any stat', dailyElite,     eliteCanBuy,     STAT_CRYSTAL_DAILY_LIMITS.elite],
        ['legendary', 'Legendary', '#f59e0b', '+5 to any stat', dailyLegendary, legendaryCanBuy, STAT_CRYSTAL_DAILY_LIMITS.legendary],
      ] as const) as [type, label, color, desc, dailyUsed, canBuyGems, limit], i}
        {@const canBuyShards = shards >= STAT_CRYSTAL_SHARD_COSTS[type]}
        {#if i > 0}<div style="height: 1px; background: rgba(255,255,255,0.05); margin: 8px 0;"></div>{/if}
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style="background: {color}18; border: 1px solid {color}30;">
            <span class="material-symbols-outlined" style="font-size: 16px; color: {color}; font-variation-settings: 'FILL' 1;">hexagon</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-xs" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{label}</p>
            <p class="font-mono" style="font-size: 10px; color: var(--color-outline);">{desc} · gems: {dailyUsed}/{limit}/day · shards: unlimited</p>
          </div>
          <div class="flex gap-1">
            <button onclick={() => handleBuyStatCrystal(type)} disabled={!canBuyGems}
              class="font-mono px-2 py-1 rounded flex flex-col items-center"
              style="font-size: 10px; background: {canBuyGems ? 'rgba(52,211,153,0.12)' : 'transparent'}; border: 1px solid {canBuyGems ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.07)'}; color: {canBuyGems ? '#34d399' : 'var(--color-outline)'}; cursor: {canBuyGems ? 'pointer' : 'not-allowed'}; opacity: {canBuyGems ? 1 : 0.4};">
              <span>💎</span>
              <span>{STAT_CRYSTAL_COSTS[type] >= 1_000_000 ? (STAT_CRYSTAL_COSTS[type]/1_000_000)+'M' : (STAT_CRYSTAL_COSTS[type]/1_000)+'k'}</span>
            </button>
            <button onclick={() => handleBuyStatCrystalShards(type)} disabled={!canBuyShards}
              class="font-mono px-2 py-1 rounded flex flex-col items-center"
              style="font-size: 10px; background: {canBuyShards ? 'rgba(240,192,64,0.12)' : 'transparent'}; border: 1px solid {canBuyShards ? 'rgba(240,192,64,0.35)' : 'rgba(255,255,255,0.07)'}; color: {canBuyShards ? 'var(--gold-bright)' : 'var(--color-outline)'}; cursor: {canBuyShards ? 'pointer' : 'not-allowed'}; opacity: {canBuyShards ? 1 : 0.4};">
              <span>◆</span>
              <span>{STAT_CRYSTAL_SHARD_COSTS[type] >= 1_000 ? (STAT_CRYSTAL_SHARD_COSTS[type]/1_000)+'k' : STAT_CRYSTAL_SHARD_COSTS[type]}</span>
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- ── Combat Crystals section ─────────────────────────────────────── -->
    <div class="w-full flex items-center gap-3 mt-2">
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
      <p class="font-mono text-xs tracking-widest uppercase" style="color: var(--color-outline);">Combat Crystals</p>
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
    </div>
    <p class="font-mono text-xs text-center" style="color: var(--color-outline); line-height: 1.6; margin-top: -8px;">
      Open these to unlock gear you can equip to any character. Higher grades drop from harder worlds.
    </p>

    <!-- Power Crystals — all grades -->
    {#snippet crystalShopSection(label: string, icon: string, iconColor: string, invMap: Record<string, number>, type: 'power' | 'weapon' | 'armor')}
      <div class="obsidian-slab w-full rounded-xl px-4 py-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined" style="font-size: 16px; color: {iconColor}; font-variation-settings: 'FILL' 1;">{icon}</span>
          <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{label} Crystals</p>
        </div>
        <div class="flex flex-col gap-1.5">
          {#each CRYSTAL_GRADE_LIST as g}
            {@const owned = invMap[g] ?? 0}
            {@const gemCost = CRYSTAL_BUY_PRICES_GEMS[g]}
            {@const shardCost = CRYSTAL_BUY_PRICES_SHARDS[g]}
            {@const canGems = gems >= gemCost}
            {@const canShards = shards >= shardCost}
            {@const gc = CRYSTAL_GRADE_COLORS[g]}
            <div class="flex items-center gap-2 px-2 py-1.5 rounded"
              style="background: rgba(255,255,255,0.02); border: 1px solid {gc}18;">
              <span class="font-mono text-xs font-bold w-8 shrink-0" style="color: {gc};">{g}</span>
              <span class="font-mono text-xs shrink-0" style="color: var(--color-outline);">×{owned}</span>
              <span class="font-mono text-xs shrink-0" style="color: #34d399;">{gemCost >= 1_000_000 ? (gemCost/1_000_000).toFixed(gemCost % 1_000_000 === 0 ? 0 : 1)+'M' : gemCost >= 1_000 ? (gemCost/1_000).toFixed(gemCost % 1_000 === 0 ? 0 : 0)+'k' : gemCost}g</span>
              <span class="font-mono text-xs shrink-0" style="color: var(--gold-bright);">{shardCost >= 1_000 ? (shardCost/1_000).toFixed(0)+'k' : shardCost}◆</span>
              <div class="ml-auto flex gap-1">
                <button onclick={() => handleBuyCrystalGems(type, g as CrystalGrade)} disabled={!canGems}
                  class="font-mono text-xs px-2 py-0.5 rounded"
                  style="background: {canGems ? 'rgba(52,211,153,0.12)' : 'transparent'}; border: 1px solid {canGems ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.07)'}; color: {canGems ? '#34d399' : 'var(--color-outline)'}; cursor: {canGems ? 'pointer' : 'not-allowed'}; opacity: {canGems ? 1 : 0.4};">💎</button>
                <button onclick={() => handleBuyCrystalShards(type, g as CrystalGrade)} disabled={!canShards}
                  class="font-mono text-xs px-2 py-0.5 rounded"
                  style="background: {canShards ? 'rgba(240,192,64,0.12)' : 'transparent'}; border: 1px solid {canShards ? 'rgba(240,192,64,0.35)' : 'rgba(255,255,255,0.07)'}; color: {canShards ? 'var(--gold-bright)' : 'var(--color-outline)'}; cursor: {canShards ? 'pointer' : 'not-allowed'}; opacity: {canShards ? 1 : 0.4};">◆</button>
              </div>
            </div>
          {/each}
        </div>
        <p class="font-mono text-xs mt-2" style="color: var(--color-outline);">💎 = buy with gems · ◆ = buy with shards</p>
      </div>
    {/snippet}

    {@render crystalShopSection('Power', 'flash_on', '#fb923c', powerCrystalInventory, 'power')}
    {@render crystalShopSection('Weapon', 'swords', '#818cf8', weaponCrystalInventory, 'weapon')}
    {@render crystalShopSection('Armor', 'shield', '#2dd4bf', armorCrystalInventory, 'armor')}

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
      Sell characters from your Roster to earn Gems.
    </p>

  </div>
{/if}

<!-- ── Spin view ─────────────────────────────────────────────────────────────── -->
{#if view === 'spin' && currentSlot}
  <StorySpinView
    stage={stage}
    spinClass={lastSpinType === 'hero' ? 'hero' : lastSpinType === 'legend' ? 'legend' : undefined}
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

      <!-- Sort selector — overflow-scrolls on mobile so we can fit 6 options
           without crowding. Hospitality: preferences persist via $effect in
           the script so the user never has to re-pick. -->
      <div class="flex gap-0.5 ml-1 overflow-x-auto" style="scrollbar-width: none;">
        {#each [
          { key: 'power',     label: 'Power' },
          { key: 'tier',      label: 'Tier' },
          { key: 'level',     label: 'Level' },
          { key: 'recent',    label: 'New' },
          { key: 'race',      label: 'Race' },
          { key: 'archetype', label: 'Class' },
        ] as opt}
          <button
            class="font-mono text-xs font-bold rounded px-2.5 whitespace-nowrap"
            style="min-height: 44px; border-radius: 4px; border: none; cursor: pointer; background: transparent; color: {sortBy === opt.key ? 'var(--gold-bright)' : 'var(--color-outline)'}; border-bottom: {sortBy === opt.key ? '2px solid #f0c040' : '2px solid transparent'}; transition: color 120ms, border-color 120ms;"
            onclick={() => sortBy = opt.key as SortKey}
          >
            {opt.label}
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

    <!-- Teams quick access -->
    <div class="flex items-center justify-between max-w-[960px] mx-auto mb-3">
      <p class="font-mono text-xs" style="color: var(--color-outline);">
        {teams.length} team{teams.length === 1 ? '' : 's'} · {sortedRoster.length} of {roster.length} shown
      </p>
      <button onclick={() => { view = 'teams'; cancelTeamForm() }}
        class="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-lg"
        style="background: rgba(240,192,64,0.07); border: 1px solid rgba(240,192,64,0.22); color: var(--gold-bright); cursor: pointer;">
        <span class="material-symbols-outlined" style="font-size: 14px; font-variation-settings: 'FILL' 1;">shield_person</span>
        Teams
      </button>
    </div>

    <!-- Archetype filter chips — quick way to find the kind of character you
         want for a specific battle. "All" is the default and resets the view. -->
    {#if roster.length > 4}
      <div class="flex gap-1.5 max-w-[960px] mx-auto mb-3 overflow-x-auto pb-1" style="scrollbar-width: none;">
        {#each [
          { key: 'all',     label: 'All',     color: '#f0c040' },
          { key: 'Combat',  label: '⚔ Combat',  color: '#f87171' },
          { key: 'Magic',   label: '✨ Magic',  color: '#a78bfa' },
          { key: 'Stealth', label: '◐ Stealth', color: '#48c8e0' },
          { key: 'Support', label: '✚ Support', color: '#34d399' },
          { key: 'Chaos',   label: '◈ Chaos',   color: '#fb923c' },
        ] as f}
          {@const active = archetypeFilter === f.key}
          <button
            onclick={() => archetypeFilter = f.key as ArchetypeFilter}
            class="font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap transition-all active:scale-95"
            style="background: {active ? `${f.color}1c` : 'rgba(255,255,255,0.03)'}; border: 1px solid {active ? `${f.color}66` : 'rgba(255,255,255,0.06)'}; color: {active ? f.color : '#9a907b'}; cursor: pointer;"
          >{f.label}</button>
        {/each}
      </div>
    {/if}

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
          <RosterCard {entry} onExpand={handleExpand} onSell={handleSell} goldFrame={auth.user?.gamepasses?.includes('gold_roster_frame') ?? false} />
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
      <div class="flex items-center justify-between gap-2 px-4 py-3" style="height: 48px; border-bottom: 1px solid rgba(255,223,150,0.08);">
        <h3 class="font-bold truncate" style="font-family: var(--font-cinzel); font-size: 20px; color: var(--color-on-surface);">
          {expandedEntry.name}
        </h3>
        <div class="flex items-center gap-2 flex-shrink-0">
          <!-- Compare: opens a picker for the second character. -->
          <button
            class="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
            style="background: rgba(167,139,250,0.10); border: 1px solid rgba(167,139,250,0.32); color: #a78bfa; cursor: pointer;"
            onclick={() => comparePickerOpen = true}
            data-fx="big"
            title="Compare side-by-side against another roster character"
          >
            <span class="material-symbols-outlined" style="font-size: 13px;">compare_arrows</span>
            Compare
          </button>
          <!-- Quick-equip: auto-picks highest-grade unequipped items. Subtle
               button, fires the action on tap with a confirming toast. -->
          <button
            class="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
            style="background: rgba(240,192,64,0.10); border: 1px solid rgba(240,192,64,0.32); color: #f0c040; cursor: pointer;"
            onclick={() => quickEquip(expandedEntry!.id)}
            data-fx="big"
            title="Auto-equip the best available gear from your inventory"
          >
            <span class="material-symbols-outlined" style="font-size: 13px; font-variation-settings: 'FILL' 1;">auto_fix_high</span>
            Quick-Equip
          </button>
          <button
            class="text-xl font-bold"
            style="background: none; border: none; cursor: pointer; color: var(--color-outline); line-height: 1;"
            onclick={closeExpanded}
            aria-label="Close"
          >×</button>
        </div>
      </div>
      <div class="p-4">
        <CharacterCard
          results={expandedEntry.spins}
          name={expandedEntry.name}
          startedAt={expandedEntry.sessionStartedAt}
          readonly={true}
          equippedItems={{ weapons: expandedEntry.equippedWeapons, armors: expandedEntry.equippedArmors, powers: expandedEntry.equippedPowers }}
          onNewCharacter={() => {}}
        />
      </div>
    </div>
  </div>
{/if}

<!-- Compare picker — choose the second character. Sits on top of the expanded
     view so closing returns to the character sheet. -->
{#if comparePickerOpen && expandedEntry}
  <div class="fixed inset-0 z-[60] flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.92); backdrop-filter: blur(12px);"
    onclick={() => comparePickerOpen = false} role="presentation">
    <div class="obsidian-slab w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl p-5"
      onclick={(e) => e.stopPropagation()}
      role="dialog" aria-modal="true" aria-labelledby="compare-pick-title"
      style="border: 1px solid rgba(167,139,250,0.32);">
      <h3 id="compare-pick-title" class="font-bold mb-1" style="font-family: 'Cinzel', serif; color: #ffdf96; font-size: 1rem;">Compare with</h3>
      <p class="text-xs mb-4" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Pick a roster character to stack against <span style="color: #ffdf96;">{expandedEntry.name}</span>.</p>
      <div class="flex flex-col gap-2">
        {#each roster.filter(r => r.id !== expandedEntry!.id) as r}
          <button onclick={() => { compareWithId = r.id; comparePickerOpen = false }}
            class="text-left rounded-lg px-3 py-2.5 flex items-center justify-between gap-3"
            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(167,139,250,0.18); cursor: pointer;">
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm truncate" style="font-family: 'Cinzel', serif; color: #ffdf96;">{r.name}</p>
              <p class="text-xs truncate" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">{r.race} · {r.archetype}</p>
            </div>
            <span class="font-mono text-xs font-bold px-2 py-0.5 rounded" style="background: rgba(240,192,64,0.10); color: #f0c040;">{r.overallTier}</span>
          </button>
        {:else}
          <p class="text-sm text-center py-4" style="color: #4e4635; font-style: italic;">No other characters to compare with yet.</p>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- Final compare overlay — shows stat-by-stat once a partner is picked. -->
{#if comparePair?.left && comparePair?.right}
  <CharacterCompare left={comparePair.left} right={comparePair.right} onClose={() => compareWithId = null} />
{/if}

<!-- ── Worlds view ───────────────────────────────────────────────────────────── -->
{#if view === 'worlds' && currentSlot}
  <WorldsView
    slot={currentSlot}
    onEnterWorld={enterWorld}
    onEnterAbsolutePlus={enterAbsolutePlus}
    onBack={backToHub}
  />
{/if}

<!-- ── Battle view ────────────────────────────────────────────────────────────── -->
{#if view === 'battle' && currentSlot && activeWorld}
  <BattleView
    slot={currentSlot}
    world={activeWorld}
    absolutePlusLevel={activePlusLevel}
    onBattleComplete={handleBattleComplete}
    onNextBattle={handleNextBattle}
    onBack={() => view = 'worlds'}
    onGoToTeams={() => { view = 'teams'; cancelTeamForm() }}
    gamepasses={auth.user?.gamepasses ?? []}
  />
{/if}

<!-- ── Endless view ───────────────────────────────────────────────────────────── -->
{#if view === 'endless' && currentSlot}
  <EndlessView
    slot={currentSlot}
    onExit={handleEndlessExit}
    gamepasses={auth.user?.gamepasses ?? []}
  />
{/if}

<!-- ── Teams view ─────────────────────────────────────────────────────────────── -->
{#if view === 'teams' && currentSlot}
  <header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-4 px-4"
    style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);">
    <button class="font-mono text-sm"
      style="color: var(--color-outline); background: none; border: none; cursor: pointer;"
      onclick={() => { view = 'hub'; cancelTeamForm() }}>←</button>
    <h2 class="font-bold flex-1" style="font-family: var(--font-cinzel); font-size: 18px; color: var(--color-on-surface);">Teams</h2>
    <span class="font-mono text-xs" style="color: var(--color-outline);">
      {teamMaxSize}/team
      {#if !fWorldBeaten}· Beat F World to unlock slot 2{:else if teamMaxSize < 4}· Lv {teamMaxSize - 1} → {teamMaxSize + 1} slots{/if}
    </span>
  </header>

  <div class="pt-20 pb-24 px-4 flex flex-col gap-4 max-w-md mx-auto w-full">

    {#if teamFormMode === 'none'}
      <!-- Team list -->
      {#if teams.length === 0}
        <div class="text-center pt-10">
          <span class="material-symbols-outlined" style="font-size: 40px; color: var(--color-outline); font-variation-settings: 'FILL' 1;">shield_person</span>
          <p class="font-mono text-sm mt-3" style="color: var(--color-outline);">No teams yet.</p>
          <p class="font-mono text-xs mt-1" style="color: var(--color-outline);">Create a team to use in battle.</p>
        </div>
      {:else}
        <div class="flex flex-col gap-3">
          {#each teams as team (team.id)}
            {@const members = team.characterIds.map(id => roster.find(r => r.id === id)).filter(Boolean)}
            <div class="obsidian-slab rounded-xl px-4 py-3"
              style="border: 1px solid rgba(240,192,64,0.15);">
              <div class="flex items-center gap-3 mb-2">
                <div class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  style="background: rgba(240,192,64,0.1); border: 1px solid rgba(240,192,64,0.25);">
                  <span class="material-symbols-outlined" style="font-size: 18px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">shield_person</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{team.name}</p>
                  <p class="font-mono text-xs" style="color: var(--color-outline);">{members.length} / {teamMaxSize} fighter{members.length === 1 ? '' : 's'}</p>
                </div>
                <div class="flex gap-2">
                  <button onclick={() => openEditTeam(team)}
                    class="font-mono text-xs px-2 py-1 rounded"
                    style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.2); color: var(--gold-bright); cursor: pointer;">
                    Edit
                  </button>
                  <button onclick={() => handleDeleteTeam(team.id)}
                    class="font-mono text-xs px-2 py-1 rounded"
                    style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; cursor: pointer;">
                    Delete
                  </button>
                </div>
              </div>
              {#if members.length > 0}
                <div class="flex flex-col gap-1 pl-12">
                  {#each members as member}
                    {#if member}
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-xs font-bold" style="color: var(--gold-bright);">{member.overallTier}</span>
                        <span class="font-mono text-xs" style="color: var(--color-on-surface);">{member.name}</span>
                        <span class="font-mono text-xs" style="color: var(--color-outline);">{member.race} · Lv {member.level}</span>
                      </div>
                    {/if}
                  {/each}
                </div>
              {:else}
                <p class="font-mono text-xs pl-12" style="color: #ef4444;">All members sold — edit team</p>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Create team button -->
      <button onclick={openCreateTeam}
        class="metal-stamp-gold w-full py-3 rounded-xl font-bold font-mono text-sm tracking-widest mt-2">
        + Create Team
      </button>

    {:else}
      <!-- Team form (create / edit) -->
      <div class="obsidian-slab rounded-xl px-5 py-5 flex flex-col gap-4"
        style="border: 1px solid rgba(240,192,64,0.2);">
        <h3 class="font-bold" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">
          {teamFormMode === 'create' ? 'Create Team' : 'Edit Team'}
        </h3>

        <!-- Name input -->
        <div>
          <label class="font-mono text-xs mb-1 block" style="color: var(--color-outline);">Team Name</label>
          <input
            type="text"
            bind:value={teamFormName}
            maxlength={24}
            placeholder="My Team"
            class="w-full px-3 py-2 rounded-lg font-mono text-sm"
            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(240,192,64,0.2); color: var(--color-on-surface); outline: none;"
          />
        </div>

        <!-- Character selector -->
        <div>
          <label class="font-mono text-xs mb-2 block" style="color: var(--color-outline);">
            Select Fighters ({teamFormIds.length}/{teamMaxSize})
          </label>
          {#if roster.length === 0}
            <p class="font-mono text-xs" style="color: var(--color-outline);">No characters in roster.</p>
          {:else}
            <div class="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {#each sortedRoster as char (char.id)}
                {@const sel = teamFormIds.includes(char.id)}
                {@const disabled = !sel && teamFormIds.length >= teamMaxSize}
                <button
                  onclick={() => toggleTeamChar(char.id)}
                  disabled={disabled}
                  class="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left"
                  style="background: {sel ? 'rgba(240,192,64,0.1)' : 'rgba(255,255,255,0.03)'}; border: 1px solid {sel ? 'rgba(240,192,64,0.4)' : 'rgba(255,255,255,0.06)'}; opacity: {disabled ? 0.35 : 1}; cursor: {disabled ? 'not-allowed' : 'pointer'}; transition: border-color 120ms, background 120ms;"
                >
                  <div class="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
                    style="background: {sel ? 'rgba(240,192,64,0.9)' : 'rgba(255,255,255,0.06)'}; border: 1px solid {sel ? 'rgba(240,192,64,1)' : 'rgba(255,255,255,0.12)'};">
                    {#if sel}
                      <span class="material-symbols-outlined" style="font-size: 14px; color: #000; font-variation-settings: 'FILL' 1;">check</span>
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-bold text-xs truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{char.name}</p>
                    <p class="font-mono text-xs" style="color: var(--color-outline);">{char.race} · Lv {char.level}</p>
                  </div>
                  <span class="font-mono text-xs font-bold" style="color: var(--gold-bright);">{char.overallTier}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Form buttons -->
        <div class="flex gap-3">
          <button onclick={cancelTeamForm}
            class="flex-1 obsidian-slab py-2.5 rounded-lg font-bold font-mono text-sm"
            style="border: 1px solid rgba(255,255,255,0.08); color: var(--color-outline); cursor: pointer;">
            Cancel
          </button>
          <button
            onclick={saveTeamForm}
            disabled={!teamFormName.trim() || teamFormIds.length === 0}
            class="{teamFormName.trim() && teamFormIds.length > 0 ? 'metal-stamp-gold' : 'obsidian-slab'} flex-1 py-2.5 rounded-lg font-bold font-mono text-sm"
            style="{!teamFormName.trim() || teamFormIds.length === 0 ? 'opacity: 0.4; cursor: not-allowed; color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07);' : ''}">
            Save Team
          </button>
        </div>
      </div>
    {/if}

  </div>
{/if}

<!-- ── Inventory view ────────────────────────────────────────────────────────── -->
{#if view === 'inventory' && currentSlot}
  <header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-4 px-4"
    style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);">
    <button class="font-mono text-sm"
      style="color: var(--color-outline); background: none; border: none; cursor: pointer;"
      onclick={backToHub}>←</button>
    <h2 class="font-bold flex-1" style="font-family: var(--font-cinzel); font-size: 18px; color: var(--color-on-surface);">Inventory</h2>
    <div class="flex items-center gap-1">
      <span class="material-symbols-outlined" style="font-size: 14px; color: #34d399; font-variation-settings: 'FILL' 1;">paid</span>
      <span class="font-mono text-sm font-bold" style="color: #34d399;">{gems.toLocaleString()}</span>
    </div>
  </header>

  <!-- Tab bar -->
  <div class="fixed top-16 left-0 right-0 z-20 flex"
    style="background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(255,255,255,0.06);">
    {#each ([['crystals','Crystals'],['weapons','Weapons'],['armor','Armor'],['powers','Powers']] as const) as [tab, label]}
      <button onclick={() => invTab = tab}
        class="flex-1 py-2.5 font-mono text-xs font-bold tracking-widest uppercase"
        style="background: none; border: none; cursor: pointer; border-bottom: 2px solid {invTab === tab ? 'var(--gold-bright)' : 'transparent'}; color: {invTab === tab ? 'var(--gold-bright)' : 'var(--color-outline)'}; transition: color 120ms, border-color 120ms;">
        {label}
      </button>
    {/each}
  </div>

  <div class="pt-32 pb-24 px-4 flex flex-col gap-4 max-w-sm mx-auto w-full">

    {#if openCrystalError}
      <div class="rounded-lg px-4 py-2 text-center font-mono text-sm"
        style="background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.3); color: #ef4444;">
        {openCrystalError}
      </div>
    {/if}

    <!-- ── Crystals tab ── -->
    {#if invTab === 'crystals'}

      <!-- Endless Keys (level 3+) -->
      {#if playerLevel >= 3}
        <div class="obsidian-slab rounded-xl px-5 py-4" style="border: 1px solid rgba(167,139,250,0.15);">
          <p class="font-mono text-xs mb-2 tracking-widest uppercase" style="color: #a78bfa;">Endless Keys</p>
          <div class="flex items-center gap-3">
            <span class="text-xl">🗝</span>
            <span class="font-bold font-mono text-xl" style="color: var(--gold-bright);">{endlessKeys}</span>
            <span class="font-mono text-xs" style="color: var(--color-outline);">{endlessKeys === 1 ? 'key' : 'keys'}</span>
          </div>
        </div>
      {/if}

      <!-- Stat Crystals -->
      <div class="obsidian-slab rounded-xl px-5 py-4">
        <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: var(--color-outline);">Stat Crystals</p>
        <div class="flex flex-col gap-2">
          {#each ([['common','Common','#9ca3af'],['elite','Elite','#8b5cf6'],['legendary','Legendary','#f59e0b']] as const) as [type, label, color]}
            {@const count = statCrystalInventory[type]}
            {@const boost = STAT_CRYSTAL_BOOST[type]}
            <div class="flex items-center justify-between px-3 py-2 rounded"
              style="background: rgba(255,255,255,0.03); border: 1px solid {color}18;">
              <div>
                <span class="font-mono text-xs font-bold" style="color: {color};">{label}</span>
                <span class="font-mono text-xs ml-2" style="color: var(--color-outline);">×{count} · +{boost} to stat</span>
              </div>
              <div class="flex gap-1">
                <button onclick={() => openUseStatModal(type)} disabled={count === 0}
                  class="font-mono text-xs px-2.5 py-1 rounded"
                  style="background: {count > 0 ? 'rgba(52,211,153,0.1)' : 'transparent'}; border: 1px solid {count > 0 ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.07)'}; color: {count > 0 ? '#34d399' : 'var(--color-outline)'}; cursor: {count > 0 ? 'pointer' : 'not-allowed'}; opacity: {count > 0 ? 1 : 0.4};">
                  Use
                </button>
                <button onclick={() => handleSellStatCrystal(type)} disabled={count === 0}
                  title="Sell for {STAT_CRYSTAL_SELL_PRICES[type].toLocaleString()} gems"
                  class="font-mono text-xs px-2.5 py-1 rounded"
                  style="background: {count > 0 ? 'rgba(239,68,68,0.08)' : 'transparent'}; border: 1px solid {count > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}; color: {count > 0 ? '#f87171' : 'var(--color-outline)'}; cursor: {count > 0 ? 'pointer' : 'not-allowed'}; opacity: {count > 0 ? 1 : 0.4};">
                  Sell
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>

      {#snippet crystalInventorySection(label: string, accentColor: string, openColor: string, invMap: Record<string, number>, type: 'power' | 'weapon' | 'armor')}
        <div class="obsidian-slab rounded-xl px-5 py-4">
          <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: {accentColor};">{label} Crystals</p>
          <div class="flex flex-col gap-2">
            {#each CRYSTAL_GRADES as g}
              {@const count = invMap[g] ?? 0}
              {#if count > 0}
                <div class="flex items-center gap-2 px-3 py-2 rounded"
                  style="background: rgba(255,255,255,0.03); border: 1px solid {CRYSTAL_GRADE_COLORS[g]}22;">
                  <span class="font-mono text-xs font-bold w-8 shrink-0" style="color: {CRYSTAL_GRADE_COLORS[g]};">{g}</span>
                  <span class="font-mono text-xs shrink-0" style="color: var(--color-outline);">×{count}</span>
                  <span class="font-mono text-xs shrink-0" style="color: #9a907b; font-size: 10px;">sell {(CRYSTAL_SELL_PRICES[g as CrystalGrade] >= 1_000_000 ? (CRYSTAL_SELL_PRICES[g as CrystalGrade]/1_000_000).toFixed(CRYSTAL_SELL_PRICES[g as CrystalGrade] % 1_000_000 === 0 ? 0 : 1)+'M' : CRYSTAL_SELL_PRICES[g as CrystalGrade] >= 1_000 ? (CRYSTAL_SELL_PRICES[g as CrystalGrade]/1_000)+'k' : String(CRYSTAL_SELL_PRICES[g as CrystalGrade]))}g</span>
                  <div class="ml-auto flex gap-1">
                    <button onclick={() => handleOpenCrystal(type, g as CrystalGrade)}
                      class="font-mono text-xs px-2.5 py-1 rounded"
                      style="background: {openColor}18; border: 1px solid {openColor}44; color: {openColor}; cursor: pointer;">
                      Open
                    </button>
                    <button onclick={() => handleSellCrystal(type, g as CrystalGrade)}
                      title="Sell 1 for {CRYSTAL_SELL_PRICES[g as CrystalGrade].toLocaleString()} gems"
                      class="font-mono text-xs px-2.5 py-1 rounded"
                      style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); color: #f87171; cursor: pointer;">
                      Sell
                    </button>
                  </div>
                </div>
              {/if}
            {/each}
            {#if !CRYSTAL_GRADES.some(g => (invMap[g] ?? 0) > 0)}
              <p class="font-mono text-xs" style="color: var(--color-outline);">None in inventory</p>
            {/if}
          </div>
        </div>
      {/snippet}

      {@render crystalInventorySection('Power',  '#fb923c', '#fb923c', powerCrystalInventory,  'power')}
      {@render crystalInventorySection('Weapon', '#818cf8', '#818cf8', weaponCrystalInventory, 'weapon')}
      {@render crystalInventorySection('Armor',  '#2dd4bf', '#2dd4bf', armorCrystalInventory,  'armor')}

    <!-- ── Weapons tab ── -->
    {:else if invTab === 'weapons'}
      {#if stackedWeapons.length === 0}
        <div class="text-center pt-12">
          <span class="material-symbols-outlined" style="font-size: 40px; color: var(--color-outline); font-variation-settings: 'FILL' 1;">swords</span>
          <p class="font-mono text-sm mt-3" style="color: var(--color-outline);">No weapons yet.</p>
          <p class="font-mono text-xs mt-1" style="color: var(--color-outline);">Open Weapon Crystals from the Crystals tab.</p>
        </div>
      {:else}
        <div class="flex items-center justify-between mb-2">
          <span class="font-mono text-xs" style="color: var(--color-outline);">{openedWeapons.length} total · {stackedWeapons.length} unique</span>
          <button onclick={() => invItemSortDesc = !invItemSortDesc}
            class="font-mono text-xs px-2 py-1 rounded flex items-center gap-1"
            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--color-outline); cursor: pointer;">
            Grade {invItemSortDesc ? '↓' : '↑'}
          </button>
        </div>
        <div class="flex flex-col gap-2">
          {#each stackedWeapons as stack (stack.grade + '||' + stack.name)}
            <div class="obsidian-slab rounded-xl px-4 py-3 flex items-center gap-3"
              style="border: 1px solid {CRYSTAL_GRADE_COLORS[stack.grade]}22;">
              <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style="background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.25);">
                <span class="material-symbols-outlined" style="font-size: 16px; color: #818cf8; font-variation-settings: 'FILL' 1;">swords</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <p class="font-bold text-sm truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{stack.name}</p>
                  {#if stack.count > 1}
                    <span class="font-mono text-xs font-bold flex-shrink-0 px-1.5 py-0.5 rounded-full"
                      style="background: rgba(129,140,248,0.15); border: 1px solid rgba(129,140,248,0.3); color: #818cf8;">×{stack.count}</span>
                  {/if}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-mono text-xs font-bold" style="color: {CRYSTAL_GRADE_COLORS[stack.grade]};">{stack.grade}</span>
                  {#if stack.element}<span class="font-mono text-xs" style="color: var(--color-outline);">· {stack.element}</span>{/if}
                </div>
              </div>
              <button onclick={() => equipFirstOfStack('weapon', stack)}
                class="metal-stamp-gold font-mono text-xs px-3 py-1.5 rounded-lg flex-shrink-0">
                Equip
              </button>
            </div>
          {/each}
        </div>
      {/if}

    <!-- ── Armor tab ── -->
    {:else if invTab === 'armor'}
      {#if stackedArmors.length === 0}
        <div class="text-center pt-12">
          <span class="material-symbols-outlined" style="font-size: 40px; color: var(--color-outline); font-variation-settings: 'FILL' 1;">shield</span>
          <p class="font-mono text-sm mt-3" style="color: var(--color-outline);">No armor yet.</p>
          <p class="font-mono text-xs mt-1" style="color: var(--color-outline);">Open Armor Crystals from the Crystals tab.</p>
        </div>
      {:else}
        <div class="flex items-center justify-between mb-2">
          <span class="font-mono text-xs" style="color: var(--color-outline);">{openedArmors.length} total · {stackedArmors.length} unique</span>
          <button onclick={() => invItemSortDesc = !invItemSortDesc}
            class="font-mono text-xs px-2 py-1 rounded flex items-center gap-1"
            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--color-outline); cursor: pointer;">
            Grade {invItemSortDesc ? '↓' : '↑'}
          </button>
        </div>
        <div class="flex flex-col gap-2">
          {#each stackedArmors as stack (stack.grade + '||' + stack.name)}
            <div class="obsidian-slab rounded-xl px-4 py-3 flex items-center gap-3"
              style="border: 1px solid {CRYSTAL_GRADE_COLORS[stack.grade]}22;">
              <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style="background: rgba(45,212,191,0.1); border: 1px solid rgba(45,212,191,0.25);">
                <span class="material-symbols-outlined" style="font-size: 16px; color: #2dd4bf; font-variation-settings: 'FILL' 1;">shield</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <p class="font-bold text-sm truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{stack.name}</p>
                  {#if stack.count > 1}
                    <span class="font-mono text-xs font-bold flex-shrink-0 px-1.5 py-0.5 rounded-full"
                      style="background: rgba(45,212,191,0.15); border: 1px solid rgba(45,212,191,0.3); color: #2dd4bf;">×{stack.count}</span>
                  {/if}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-mono text-xs font-bold" style="color: {CRYSTAL_GRADE_COLORS[stack.grade]};">{stack.grade}</span>
                  {#if stack.element}<span class="font-mono text-xs" style="color: var(--color-outline);">· {stack.element}</span>{/if}
                </div>
              </div>
              <button onclick={() => equipFirstOfStack('armor', stack)}
                class="metal-stamp-gold font-mono text-xs px-3 py-1.5 rounded-lg flex-shrink-0">
                Equip
              </button>
            </div>
          {/each}
        </div>
      {/if}

    <!-- ── Powers tab ── -->
    {:else if invTab === 'powers'}
      {#if stackedPowers.length === 0}
        <div class="text-center pt-12">
          <span class="material-symbols-outlined" style="font-size: 40px; color: var(--color-outline); font-variation-settings: 'FILL' 1;">flash_on</span>
          <p class="font-mono text-sm mt-3" style="color: var(--color-outline);">No powers yet.</p>
          <p class="font-mono text-xs mt-1" style="color: var(--color-outline);">Open Power Crystals from the Crystals tab.</p>
        </div>
      {:else}
        <div class="flex items-center justify-between mb-2">
          <span class="font-mono text-xs" style="color: var(--color-outline);">{openedPowers.length} total · {stackedPowers.length} unique</span>
          <button onclick={() => invItemSortDesc = !invItemSortDesc}
            class="font-mono text-xs px-2 py-1 rounded flex items-center gap-1"
            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--color-outline); cursor: pointer;">
            Grade {invItemSortDesc ? '↓' : '↑'}
          </button>
        </div>
        <div class="flex flex-col gap-2">
          {#each stackedPowers as stack (stack.grade + '||' + stack.name)}
            <div class="obsidian-slab rounded-xl px-4 py-3 flex items-center gap-3"
              style="border: 1px solid {CRYSTAL_GRADE_COLORS[stack.grade]}22;">
              <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style="background: rgba(251,146,60,0.1); border: 1px solid rgba(251,146,60,0.25);">
                <span class="material-symbols-outlined" style="font-size: 16px; color: #fb923c; font-variation-settings: 'FILL' 1;">flash_on</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <p class="font-bold text-sm truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{stack.name}</p>
                  {#if stack.count > 1}
                    <span class="font-mono text-xs font-bold flex-shrink-0 px-1.5 py-0.5 rounded-full"
                      style="background: rgba(251,146,60,0.15); border: 1px solid rgba(251,146,60,0.3); color: #fb923c;">×{stack.count}</span>
                  {/if}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-mono text-xs font-bold" style="color: {CRYSTAL_GRADE_COLORS[stack.grade]};">{stack.grade}</span>
                  {#if stack.element}<span class="font-mono text-xs" style="color: var(--color-outline);">· {stack.element}</span>{/if}
                </div>
              </div>
              <button onclick={() => equipFirstOfStack('power', stack)}
                class="metal-stamp-gold font-mono text-xs px-3 py-1.5 rounded-lg flex-shrink-0">
                Equip
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

  </div>
{/if}

<!-- ── Spin type selection modal ──────────────────────────────────────────── -->
{#if spinTypeModal && currentSlot}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px); padding-bottom: max(24px, calc(env(safe-area-inset-bottom,0px) + 24px));"
    onclick={() => spinTypeModal = false}
    role="dialog" aria-modal="true">
    <div class="w-full max-w-sm rounded-2xl overflow-hidden obsidian-slab"
      style="border: 1px solid rgba(240,192,64,0.25); animation: resultReveal 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;"
      onclick={(e) => e.stopPropagation()}>
      <div class="px-5 py-5">
        <p class="font-mono text-xs mb-1 tracking-widest uppercase" style="color: var(--color-outline);">Choose Spin Type</p>
        <h3 class="font-bold text-sm mb-4" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Which spin pool to use?</h3>
        <div class="flex flex-col gap-3">
          {#if spinsRemaining > 0}
            <button onclick={() => startSpin('refresh')}
              class="flex items-center gap-3 px-4 py-3.5 rounded-xl w-full text-left metal-stamp-gold"
              style="cursor: pointer;">
              <span class="material-symbols-outlined" style="font-size: 20px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">casino</span>
              <div class="flex-1">
                <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Refresh Spin</p>
                <p class="font-mono text-xs" style="color: var(--color-outline);">{spinsRemaining} remaining · restores every 3h</p>
              </div>
            </button>
          {/if}
          {#if bonusSpins > 0}
            <button onclick={() => startSpin('bonus')}
              class="flex items-center gap-3 px-4 py-3.5 rounded-xl w-full text-left"
              style="background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.3); cursor: pointer;">
              <span class="material-symbols-outlined" style="font-size: 20px; color: #a78bfa; font-variation-settings: 'FILL' 1;">stars</span>
              <div class="flex-1">
                <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: #a78bfa;">Bonus Spin</p>
                <p class="font-mono text-xs" style="color: var(--color-outline);">{bonusSpins} remaining · drops &amp; milestones</p>
              </div>
            </button>
          {/if}
          {#if hasHeroSpins}
            <button onclick={() => startSpin('hero')}
              class="flex items-center gap-3 px-4 py-3.5 rounded-xl w-full text-left"
              style="background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.3); cursor: pointer;">
              <span class="material-symbols-outlined" style="font-size: 20px; color: #f97316; font-variation-settings: 'FILL' 1;">military_tech</span>
              <div class="flex-1">
                <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: #f97316;">Hero Spin</p>
                <p class="font-mono text-xs" style="color: var(--color-outline);">{heroSpins} remaining · 2× luck + 2× battle stats</p>
              </div>
            </button>
          {/if}
          {#if hasLegendSpins}
            <button onclick={() => startSpin('legend')}
              class="flex items-center gap-3 px-4 py-3.5 rounded-xl w-full text-left"
              style="background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); cursor: pointer;">
              <span class="material-symbols-outlined" style="font-size: 20px; color: #fbbf24; font-variation-settings: 'FILL' 1;">star</span>
              <div class="flex-1">
                <p class="font-bold text-sm" style="font-family: var(--font-cinzel); color: #fbbf24;">Legend Spin</p>
                <p class="font-mono text-xs" style="color: var(--color-outline);">{legendSpins} remaining · 4× luck + 4× battle stats</p>
              </div>
            </button>
          {/if}
        </div>
        <button onclick={() => spinTypeModal = false}
          class="mt-4 w-full py-2.5 rounded-xl font-bold font-mono text-sm"
          style="border: 1px solid rgba(255,255,255,0.08); color: var(--color-outline); background: transparent; cursor: pointer;">
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Level-up popup ─────────────────────────────────────────────────────── -->
{#if levelUpPopup}
  {@const info = LEVEL_UNLOCKS[levelUpPopup.newLevel]}
  <div class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background: rgba(0,0,0,0.85); backdrop-filter: blur(12px);">
    <div class="w-full max-w-sm rounded-2xl overflow-hidden"
      style="background: linear-gradient(135deg, rgba(240,192,64,0.1), rgba(7,7,13,0.98)); border: 1px solid rgba(240,192,64,0.5); box-shadow: 0 0 60px rgba(240,192,64,0.2); animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
      <div class="px-6 py-7 text-center">
        <p class="font-mono text-xs tracking-widest uppercase mb-2" style="color: rgba(240,192,64,0.6);">Level Up!</p>
        <p style="font-family: var(--font-cinzel); font-size: 2.5rem; font-weight: 900; color: var(--gold-bright); filter: drop-shadow(0 0 20px rgba(240,192,64,0.6));">
          Level {levelUpPopup.newLevel}
        </p>
        {#if info}
          <div class="mt-5 text-left rounded-xl px-4 py-4" style="background: rgba(0,0,0,0.35); border: 1px solid rgba(240,192,64,0.12);">
            <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: var(--color-outline);">Unlocked</p>
            <div class="flex flex-col gap-2">
              {#each info.unlocks as unlock}
                <div class="flex items-start gap-2">
                  <span class="material-symbols-outlined flex-shrink-0 mt-0.5" style="font-size: 14px; color: #4ade80; font-variation-settings: 'FILL' 1;">check_circle</span>
                  <p class="font-mono text-xs" style="color: var(--color-on-surface);">{unlock}</p>
                </div>
              {/each}
            </div>
            <div class="mt-3 pt-3" style="border-top: 1px solid rgba(240,192,64,0.1);">
              <p class="font-mono text-xs" style="color: var(--color-outline);">New stat cap:
                <span style="color: var(--gold-bright); font-weight: bold;">{info.statCap}</span>
              </p>
            </div>
          </div>
        {/if}
        <button onclick={() => levelUpPopup = null}
          class="mt-5 w-full py-3.5 rounded-xl font-bold font-mono text-sm tracking-widest metal-stamp-gold">
          Continue
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Equip opened item modal ─────────────────────────────────────────────── -->
{#if equipModal && currentSlot}
  {@const et = equipModal.type}
  {@const item = equipModal.item}
  {@const typeLabel = et === 'power' ? 'Power' : et === 'weapon' ? 'Weapon' : 'Armor'}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px); padding-bottom: max(24px, calc(env(safe-area-inset-bottom,0px) + 24px));"
    onclick={() => equipModal = null}
    role="dialog" aria-modal="true">
    <div class="w-full max-w-md rounded-2xl overflow-hidden obsidian-slab"
      style="border: 1px solid rgba(240,192,64,0.25); animation: resultReveal 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;"
      onclick={(e) => e.stopPropagation()}>
      <div class="px-5 py-5">
        <p class="font-mono text-xs mb-1 tracking-widest uppercase" style="color: var(--color-outline);">Equip {typeLabel}</p>
        <h3 class="font-bold text-sm mb-1" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">
          {item.name}
          <span class="font-mono text-xs ml-2" style="color: {CRYSTAL_GRADE_COLORS[item.grade]};">{item.grade}</span>
        </h3>
        <p class="font-mono text-xs mb-4" style="color: var(--color-outline);">Select a character to add this item to. Items stack — nothing is replaced.</p>

        {#if roster.length === 0}
          <p class="font-mono text-xs" style="color: var(--color-outline);">No characters in roster.</p>
        {:else}
          <div class="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {#each sortedRoster as char (char.id)}
              {@const equippedList = et === 'weapon' ? char.equippedWeapons : et === 'armor' ? char.equippedArmors : char.equippedPowers}
              <button onclick={() => doEquip(char.id)}
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left"
                style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); cursor: pointer;">
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-xs truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{char.name}</p>
                  <p class="font-mono text-xs" style="color: var(--color-outline);">{char.race} · {char.overallTier} · Lv {char.level}</p>
                  {#if equippedList.length > 0}
                    <p class="font-mono text-[10px] mt-0.5" style="color: #f59e0b;">{equippedList.length} {typeLabel.toLowerCase()}{equippedList.length > 1 ? 's' : ''} equipped</p>
                  {/if}
                </div>
                <span class="font-mono text-xs flex-shrink-0" style="color: #34d399;">+ Add →</span>
              </button>
            {/each}
          </div>
        {/if}
        <button onclick={() => equipModal = null}
          class="mt-4 w-full py-2.5 rounded-xl font-bold font-mono text-sm"
          style="border: 1px solid rgba(255,255,255,0.08); color: var(--color-outline); background: transparent; cursor: pointer;">
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Use stat crystal modal ─────────────────────────────────────────────── -->
{#if useStatModal && currentSlot}
  {@const boost = STAT_CRYSTAL_BOOST[useStatModal.type]}
  {@const typeColors = { common: '#9ca3af', elite: '#8b5cf6', legendary: '#f59e0b' }}
  {@const color = typeColors[useStatModal.type]}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px); padding-bottom: max(24px, calc(env(safe-area-inset-bottom,0px) + 24px));"
    onclick={() => { useStatModal = null; useStatError = null }}
    role="dialog" aria-modal="true">
    <div class="w-full max-w-md rounded-2xl overflow-hidden obsidian-slab"
      style="border: 1px solid {color}33; animation: resultReveal 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;"
      onclick={(e) => e.stopPropagation()}>
      <div class="px-5 py-5">
        <p class="font-mono text-xs mb-1 tracking-widest uppercase" style="color: {color};">
          {useStatModal.type.charAt(0).toUpperCase() + useStatModal.type.slice(1)} Stat Crystal · +{boost}
        </p>

        {#if useStatError}
          <p class="font-mono text-xs mb-3" style="color: #ef4444;">{useStatError}</p>
        {/if}

        {#if useStatModal.phase === 'pickChar'}
          <h3 class="font-bold text-sm mb-3" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Select a character</h3>
          {#if roster.length === 0}
            <p class="font-mono text-xs" style="color: var(--color-outline);">No characters in roster.</p>
          {:else}
            <div class="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {#each sortedRoster as char (char.id)}
                <button onclick={() => selectUseStatChar(char.id)}
                  class="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left"
                  style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); cursor: pointer;">
                  <div class="flex-1 min-w-0">
                    <p class="font-bold text-xs truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{char.name}</p>
                    <p class="font-mono text-xs" style="color: var(--color-outline);">{char.race} · {char.overallTier} · Lv {char.level}</p>
                  </div>
                  <span class="font-mono text-xs flex-shrink-0" style="color: var(--gold-bright);">Select →</span>
                </button>
              {/each}
            </div>
          {/if}

        {:else}
          {@const selectedChar = roster.find(r => r.id === useStatModal?.charId)}
          {@const maxStatScore = LEVEL_MAX_SCORES[Math.min(5, playerLevel)]}
          {@const available = statCrystalInventory[useStatModal.type]}
          <h3 class="font-bold text-sm mb-1" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">
            {selectedChar?.name ?? '—'}
          </h3>
          <p class="font-mono text-xs mb-3" style="color: var(--color-outline);">Choose a stat to boost · +{boost} per crystal</p>

          <!-- Quantity input -->
          <div class="flex items-center gap-2 mb-3">
            <span class="font-mono text-xs" style="color: var(--color-outline);">Quantity:</span>
            <input
              type="number"
              min="1"
              max={available}
              value={useStatQty}
              oninput={(e) => {
                const v = parseInt((e.target as HTMLInputElement).value)
                useStatQty = isNaN(v) ? 1 : Math.max(1, Math.min(v, available))
              }}
              class="font-mono text-sm text-center rounded-lg px-2 py-1"
              style="width: 64px; background: rgba(255,255,255,0.06); border: 1px solid {color}44; color: var(--color-on-surface); outline: none;"
            />
            <span class="font-mono text-xs" style="color: var(--color-outline);">/ {available} available</span>
          </div>

          <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {#each BOOSTABLE_STATS as stat}
              {@const spinResult = selectedChar?.spins.find(r => r.category === stat)}
              {@const currentScore = spinResult?.score ?? 0}
              {@const atCap = currentScore >= maxStatScore}
              {@const effective = clampStatQty(useStatQty, stat)}
              {@const currentGrade = spinResult?.score != null ? extendedTierFromScore(spinResult.score) : (spinResult?.tier ?? null)}
              {@const newGrade = !atCap && spinResult?.score != null && effective > 0 ? boostedTier(spinResult.score, boost * effective).grade : null}
              <button onclick={() => doUseStat(stat)} disabled={atCap || effective === 0}
                class="px-3 py-2.5 rounded-xl text-left"
                style="background: rgba(255,255,255,0.03); border: 1px solid {atCap ? 'rgba(239,68,68,0.2)' : color + '22'}; cursor: {atCap || effective === 0 ? 'not-allowed' : 'pointer'}; opacity: {atCap || effective === 0 ? 0.5 : 1}; transition: border-color 120ms;">
                <div class="flex items-center gap-1.5 mb-0.5">
                  <p class="font-mono text-xs font-bold" style="color: {atCap ? '#6b7280' : color};">{BOOSTABLE_STAT_LABELS[stat]}</p>
                  {#if atCap}
                    <span class="font-mono text-[9px] px-1 py-0.5 rounded" style="background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);">CAP</span>
                  {:else if effective < useStatQty}
                    <span class="font-mono text-[9px] px-1 py-0.5 rounded" style="background: rgba(251,191,36,0.12); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3);">×{effective}</span>
                  {/if}
                </div>
                {#if currentGrade}
                  <p class="font-mono text-xs" style="color: var(--color-outline);">
                    {currentGrade}{#if newGrade && newGrade !== currentGrade} → <span style="color: #34d399;">{newGrade}</span>{/if}
                  </p>
                {/if}
              </button>
            {/each}
          </div>
          <button onclick={() => { if (useStatModal) useStatModal = { ...useStatModal, phase: 'pickChar', charId: null } }}
            class="mt-3 font-mono text-xs" style="color: var(--color-outline); background: none; border: none; cursor: pointer;">
            ← Back
          </button>
        {/if}

        <button onclick={() => { useStatModal = null; useStatError = null }}
          class="mt-4 w-full py-2.5 rounded-xl font-bold font-mono text-sm"
          style="border: 1px solid rgba(255,255,255,0.08); color: var(--color-outline); background: transparent; cursor: pointer;">
          Cancel
        </button>
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

<!-- ── Crystal opening animation overlay ─────────────────────────────────────── -->
{#if crystalAnim}
  {@const ca = crystalAnim}
  {@const gradeColor = CRYSTAL_GRADE_COLORS[ca.grade] ?? '#ffffff'}
  {@const typeColor = ca.type === 'power' ? '#fb923c' : ca.type === 'weapon' ? '#818cf8' : '#2dd4bf'}
  {@const typeIcon = ca.type === 'power' ? 'flash_on' : ca.type === 'weapon' ? 'swords' : 'shield'}
  <div class="fixed inset-0 z-[70] flex items-center justify-center"
    style="background: rgba(0,0,0,0.92); backdrop-filter: blur(20px);"
    onclick={ca.phase === 'reveal' ? dismissCrystalAnim : undefined}
    role="dialog" aria-modal="true">

    {#if ca.phase === 'pulse'}
      <!-- Pulsing crystal orb -->
      <div class="flex flex-col items-center gap-6">
        <div class="crystal-pulse-orb"
          style="--orb-color: {gradeColor}; --type-color: {typeColor};">
          <div class="crystal-orb-ring"></div>
          <div class="crystal-orb-ring crystal-orb-ring-2"></div>
          <div class="crystal-orb-core">
            <span class="material-symbols-outlined" style="font-size: 48px; color: {gradeColor}; font-variation-settings: 'FILL' 1;">{typeIcon}</span>
          </div>
        </div>
        <p class="font-mono text-sm tracking-widest uppercase" style="color: {gradeColor}; opacity: 0.8;">{ca.grade} Crystal</p>
      </div>

    {:else if ca.phase === 'crack'}
      <!-- Crack/shatter flash -->
      <div class="crystal-crack-flash"
        style="--orb-color: {gradeColor};">
        <div class="crystal-crack-shards">
          {#each [0,1,2,3,4,5,6,7] as i}
            <div class="crystal-shard" style="--i: {i}; --orb-color: {gradeColor};"></div>
          {/each}
        </div>
        <div class="crystal-crack-burst" style="--orb-color: {gradeColor};"></div>
      </div>

    {:else}
      <!-- Reveal -->
      <div class="crystal-reveal flex flex-col items-center gap-0 max-w-xs w-full mx-4"
        onclick={(e) => e.stopPropagation()}>
        <!-- Grade glow halo -->
        <div class="relative flex items-center justify-center mb-6">
          <div style="position:absolute; width:120px; height:120px; border-radius:50%; background: radial-gradient(circle, {gradeColor}30 0%, transparent 70%); filter: blur(12px);"></div>
          <div class="w-20 h-20 rounded-2xl flex items-center justify-center"
            style="background: {typeColor}18; border: 2px solid {typeColor}50; position: relative; z-index:1;">
            <span class="material-symbols-outlined" style="font-size: 40px; color: {typeColor}; font-variation-settings: 'FILL' 1;">{typeIcon}</span>
          </div>
        </div>

        <!-- Grade badge -->
        <div class="crystal-grade-badge font-mono text-xs font-bold px-3 py-1 rounded-full mb-3"
          style="background: {gradeColor}20; border: 1px solid {gradeColor}60; color: {gradeColor}; letter-spacing: 0.15em;">
          {ca.grade} Grade
        </div>

        <!-- Item name -->
        <h2 class="text-center font-bold mb-2 px-4"
          style="font-family: var(--font-cinzel); font-size: 22px; color: var(--color-on-surface); line-height: 1.3;">
          {ca.item.name}
        </h2>

        <!-- Element badge -->
        {#if ca.item.element}
          <span class="font-mono text-xs px-2.5 py-1 rounded-full mb-6"
            style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: var(--color-outline);">
            {ca.item.element}
          </span>
        {:else}
          <div class="mb-6"></div>
        {/if}

        <!-- Actions -->
        <div class="flex gap-2 w-full">
          <button onclick={dismissAndEquipCrystal}
            class="flex-1 py-3 rounded-xl font-bold font-mono text-sm"
            style="background: {gradeColor}28; border: 1px solid {gradeColor}70; color: {gradeColor}; cursor: pointer; transition: background 120ms; letter-spacing: 0.05em;">
            Equip Now
          </button>
          <button onclick={dismissCrystalAnim}
            class="flex-1 py-3 rounded-xl font-bold font-mono text-sm"
            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: var(--color-outline); cursor: pointer; transition: background 120ms; letter-spacing: 0.05em;">
            Save for Later
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<!-- ── Delete slot confirmation ───────────────────────────────────────────────── -->
<!-- ── Share slot modal ──────────────────────────────────────────────────────── -->
{#if shareSlotId !== null}
  <div class="fixed inset-0 z-50 flex items-center justify-center px-4"
    style="background: rgba(7,7,13,0.9); backdrop-filter: blur(12px);"
    onclick={() => { shareSlotId = null; shareSlotUrl = null; shareSlotError = null }}
    role="dialog" aria-modal="true">
    <div class="obsidian-slab w-full max-w-sm rounded-xl p-7 text-center"
      style="border: 1px solid rgba(240,192,64,0.25);"
      onclick={(e) => e.stopPropagation()}>
      <span class="material-symbols-outlined block text-4xl mb-3" style="color: #34d399; font-variation-settings: 'FILL' 1;">cloud_upload</span>
      <p class="font-bold mb-1" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Save Slot {shareSlotId}</p>
      {#if shareSlotSaving}
        <p class="font-mono text-sm my-4" style="color: #9a907b;">Saving to your account…</p>
      {:else if shareSlotError}
        <p class="font-mono text-sm my-4" style="color: #ef4444;">{shareSlotError}</p>
      {:else if shareSlotUrl}
        <div class="flex items-center justify-center gap-2 my-4">
          <span class="material-symbols-outlined" style="color: #34d399; font-size: 28px; font-variation-settings: 'FILL' 1;">check_circle</span>
          <p class="font-mono text-sm" style="color: #34d399;">Saved to your account!</p>
        </div>
        <p class="font-mono text-xs mb-3 px-2" style="color: #9a907b; line-height: 1.55;">
          Press <span style="color: #7dd3fc;">Sync Slots from Account</span> on any device to load this saved data.
        </p>
        <a href={shareSlotUrl} target="_blank" rel="noopener"
          class="block font-mono text-xs mb-4 px-3 py-2 rounded-lg text-center"
          style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #7dd3fc; text-decoration: none;">
          View online →
        </a>
      {:else}
        <p class="font-mono text-sm my-4" style="color: #9a907b;">Saving…</p>
      {/if}
      <button onclick={() => { shareSlotId = null; shareSlotUrl = null; shareSlotError = null }}
        class="w-full py-2.5 rounded-lg text-sm font-bold"
        style="font-family: var(--font-cinzel); color: #9a907b; border: 1px solid #4e4635; background: transparent; cursor: pointer;">
        Close
      </button>
    </div>
  </div>
{/if}

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

<style>
  /* ── Crystal opening animation ─────────────────────────────────────── */

  /* Pulse phase — pulsing orb */
  .crystal-pulse-orb {
    position: relative;
    width: 160px;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .crystal-orb-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--orb-color);
    opacity: 0.5;
    animation: crystalRingPulse 1.2s ease-in-out infinite;
  }

  .crystal-orb-ring-2 {
    inset: -20px;
    opacity: 0.2;
    animation-delay: 0.4s;
  }

  .crystal-orb-core {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, var(--orb-color)40, var(--orb-color)10 60%, transparent);
    border: 2px solid var(--orb-color);
    box-shadow: 0 0 30px var(--orb-color)60, 0 0 60px var(--orb-color)30, inset 0 0 20px var(--orb-color)20;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: crystalCoreFloat 1.2s ease-in-out infinite;
  }

  @keyframes crystalRingPulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50%       { transform: scale(1.15); opacity: 0.15; }
  }

  @keyframes crystalCoreFloat {
    0%, 100% { transform: scale(1); box-shadow: 0 0 30px var(--orb-color)60, 0 0 60px var(--orb-color)30; }
    50%       { transform: scale(1.06); box-shadow: 0 0 50px var(--orb-color)80, 0 0 90px var(--orb-color)40; }
  }

  /* Crack phase — shatter burst */
  .crystal-crack-flash {
    position: relative;
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .crystal-crack-burst {
    position: absolute;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle, white 0%, var(--orb-color) 30%, transparent 70%);
    animation: crystalBurst 0.45s ease-out forwards;
  }

  .crystal-crack-shards {
    position: absolute;
    inset: 0;
  }

  .crystal-shard {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6px;
    height: 18px;
    background: linear-gradient(to bottom, white, var(--orb-color));
    border-radius: 2px;
    transform-origin: 50% 100%;
    transform: rotate(calc(var(--i) * 45deg)) translateY(-60px);
    animation: crystalShardFly 0.45s ease-out forwards;
    animation-delay: calc(var(--i) * 10ms);
  }

  @keyframes crystalBurst {
    0%   { opacity: 1; transform: scale(0.2); }
    40%  { opacity: 1; transform: scale(1.4); }
    100% { opacity: 0; transform: scale(2); }
  }

  @keyframes crystalShardFly {
    0%   { opacity: 1; transform: rotate(calc(var(--i) * 45deg)) translateY(-10px) scaleY(1); }
    100% { opacity: 0; transform: rotate(calc(var(--i) * 45deg)) translateY(-90px) scaleY(0.4); }
  }

  /* Reveal phase — slide up */
  .crystal-reveal {
    animation: crystalRevealIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes crystalRevealIn {
    from { opacity: 0; transform: translateY(32px) scale(0.92); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .crystal-grade-badge {
    animation: crystalBadgePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
  }

  @keyframes crystalBadgePop {
    from { opacity: 0; transform: scale(0.7); }
    to   { opacity: 1; transform: scale(1); }
  }
</style>
