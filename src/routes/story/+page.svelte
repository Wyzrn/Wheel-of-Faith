<script lang="ts">
  import { onMount } from 'svelte'
  import { loadRoster, saveRoster, loadShards, saveShards, addToRoster, MAX_ROSTER_SIZE } from '$lib/story/store'
  import { getShardValue } from '$lib/story/shards'
  import type { StoryRosterEntry } from '$lib/story/types'
  import CharacterCard from '../../components/CharacterCard.svelte'
  import TierBadge from '../../components/TierBadge.svelte'
  import RosterCard from '../../components/story/RosterCard.svelte'
  import SellConfirmModal from '../../components/story/SellConfirmModal.svelte'
  import StorySpinView from '../../components/story/StorySpinView.svelte'

  // ── View state machine ─────────────────────────────────────────────────────
  let view = $state<'entry' | 'spin' | 'roster' | 'expanded'>('entry')

  // ── Roster + shards reactive state ─────────────────────────────────────────
  let roster = $state<StoryRosterEntry[]>([])
  let shards = $state(0)

  // ── Roster cap alert ───────────────────────────────────────────────────────
  let rosterCapAlert = $state(false)

  // ── Sort + dialog state ────────────────────────────────────────────────────
  let sortBy = $state<'tier' | 'race' | 'archetype'>('tier')
  let expandedId = $state<string | null>(null)
  let sellTarget = $state<StoryRosterEntry | null>(null)

  // ── Derived values ─────────────────────────────────────────────────────────
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
    roster = loadRoster()
    shards = loadShards()
  })

  // ── Persistence effects ────────────────────────────────────────────────────
  $effect(() => { saveRoster($state.snapshot(roster)) })
  $effect(() => { saveShards(shards) })

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleExpand(id: string) {
    expandedId = id
    view = 'expanded'
  }

  function handleSell(entry: StoryRosterEntry) {
    sellTarget = entry
  }

  function confirmSell() {
    if (!sellTarget) return
    const value = getShardValue(sellTarget.overallTier)
    roster = roster.filter(r => r.id !== sellTarget!.id)
    shards += value
    sellTarget = null
  }

  function closeExpanded() {
    expandedId = null
    view = 'roster'
  }

  // ── Session complete handler ────────────────────────────────────────────────
  function handleStoryComplete(entry: StoryRosterEntry) {
    const updated = addToRoster($state.snapshot(roster), entry)
    if (updated === null) {
      // Roster at cap — show inline banner and navigate to roster
      rosterCapAlert = true
      view = 'roster'
      return
    }
    roster = updated
    view = 'roster'
  }
</script>

<!-- ── Entry view ──────────────────────────────────────────────────────────── -->
{#if view === 'entry'}
  <div class="min-h-screen flex flex-col items-center justify-center px-4 pt-16 pb-24">
    <div class="obsidian-slab w-full max-w-xs rounded-2xl p-8 flex flex-col items-center gap-5 text-center relative overflow-hidden">

      <!-- Title -->
      <h1
        class="gold-emboss font-bold tracking-widest"
        style="font-family: var(--font-cinzel); font-size: 28px; line-height: 1.2;"
      >
        STORY MODE
      </h1>

      <!-- Subtitle -->
      <p class="text-base" style="color: var(--color-on-surface-variant); line-height: 1.5;">
        Build your roster. Survive the Void.
      </p>

      <!-- Shard balance -->
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-sm" style="color: var(--gold-bright); font-variation-settings: 'FILL' 1; font-size: 18px;">diamond</span>
        <span class="font-mono text-sm font-bold" style="color: var(--gold-bright);">{shards}</span>
        <span class="font-mono text-sm" style="color: var(--color-outline);">Fate Shards</span>
      </div>

      <!-- Roster count -->
      <p class="font-mono text-sm" style="color: var(--color-outline);">
        {roster.length} / 50 characters
      </p>

      <!-- Primary CTA or Roster Full message -->
      {#if roster.length >= MAX_ROSTER_SIZE}
        <p class="font-mono text-sm" style="color: var(--color-outline);">
          Roster Full — Sell a character to generate more
        </p>
      {:else}
        <button
          class="metal-stamp-gold w-full rounded-xl py-3 font-bold font-mono text-sm tracking-wider"
          style="max-width: 280px;"
          onclick={() => view = 'spin'}
        >
          Enter Story Mode
        </button>
      {/if}

      <!-- View Roster link -->
      {#if roster.length > 0}
        <button
          class="text-sm font-mono underline-offset-2 hover:underline"
          style="color: var(--color-on-surface-variant); background: none; border: none; cursor: pointer;"
          onclick={() => view = 'roster'}
        >
          View Roster
        </button>
      {/if}
    </div>
  </div>
{/if}

<!-- ── Spin view ───────────────────────────────────────────────────────────── -->
{#if view === 'spin'}
  <StorySpinView onSessionComplete={handleStoryComplete} onCancel={() => view = 'entry'} />
{/if}

<!-- ── Roster view ─────────────────────────────────────────────────────────── -->
{#if view === 'roster' || view === 'expanded'}
  <!-- Sticky header -->
  <header class="fixed top-0 left-0 right-0 z-30 flex items-center justify-between gap-4 px-4"
    style="
      height: 64px;
      background: rgba(7,7,13,0.97);
      border-bottom: 1px solid rgba(240,192,64,0.15);
      backdrop-filter: blur(20px);
    "
  >
    <div class="flex items-center gap-3">
      <button
        class="font-mono text-sm"
        style="color: var(--color-outline); background: none; border: none; cursor: pointer;"
        onclick={() => view = 'entry'}
        aria-label="Back to entry"
      >
        ←
      </button>
      <h2
        class="font-bold"
        style="font-family: var(--font-cinzel); font-size: 20px; color: var(--color-on-surface);"
      >
        Your Roster
      </h2>
    </div>

    <div class="flex items-center gap-2">
      <!-- Shard balance in header -->
      <span class="material-symbols-outlined" style="font-size: 16px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">diamond</span>
      <span class="font-mono text-sm font-bold" style="color: var(--gold-bright);">{shards}</span>

      <!-- Sort controls -->
      <div class="flex gap-1 ml-2">
        {#each ['tier', 'race', 'archetype'] as sortOption}
          <button
            class="font-mono text-sm font-bold rounded px-2"
            style="
              min-height: 44px;
              border-radius: 4px;
              border: none;
              cursor: pointer;
              background: {sortBy === sortOption ? 'transparent' : 'var(--color-surface-container-highest)'};
              color: {sortBy === sortOption ? 'var(--gold-bright)' : 'var(--color-outline)'};
              border-bottom: {sortBy === sortOption ? '2px solid #f0c040' : '2px solid transparent'};
              transition: color 120ms, border-color 120ms;
            "
            onclick={() => sortBy = sortOption as 'tier' | 'race' | 'archetype'}
          >
            {sortOption.charAt(0).toUpperCase() + sortOption.slice(1)}
          </button>
        {/each}
      </div>
    </div>
  </header>

  <!-- Roster content (with top padding for sticky header) -->
  <div class="pt-20 pb-24 px-4">

    <!-- Roster is full cap alert banner -->
    {#if rosterCapAlert}
      <div
        class="flex items-center justify-between gap-3 rounded-lg px-4 py-3 mb-4 max-w-[960px] mx-auto"
        style="background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.3);"
      >
        <p class="font-mono text-sm" style="color: var(--color-error, #ef4444);">
          Roster is full — your new character could not be added. Sell a character to free space.
        </p>
        <button
          onclick={() => rosterCapAlert = false}
          style="
            background: none;
            border: none;
            cursor: pointer;
            color: var(--color-outline);
            font-size: 18px;
            line-height: 1;
            flex-shrink: 0;
          "
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    {/if}

    {#if roster.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center gap-4 pt-16 text-center">
        <h3
          class="font-bold"
          style="font-family: var(--font-cinzel); font-size: 20px; color: var(--color-on-surface);"
        >
          Your Roster is Empty
        </h3>
        <p class="text-base" style="color: var(--color-on-surface-variant);">
          Generate a new character to begin your story.
        </p>
        <button
          class="metal-stamp-gold rounded-xl py-3 font-bold font-mono text-sm"
          style="width: 100%; max-width: 320px;"
          onclick={() => view = 'spin'}
        >
          Generate New Character
        </button>
      </div>
    {:else}
      <!-- Roster grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 max-w-[960px] mx-auto">
        {#each sortedRoster as entry (entry.id)}
          <RosterCard {entry} onExpand={handleExpand} onSell={handleSell} />
        {/each}
      </div>

      <!-- Generate New Character CTA below grid -->
      <div class="flex flex-col items-center mt-6 gap-2">
        {#if roster.length >= MAX_ROSTER_SIZE}
          <button
            class="rounded-xl py-3 font-bold font-mono text-sm"
            style="width: 100%; max-width: 320px; background: var(--color-surface-container-highest); color: var(--color-outline); border: none; cursor: not-allowed; opacity: 0.4;"
            disabled
          >
            Generate New Character
          </button>
          <p class="font-mono text-sm" style="color: var(--color-outline);">
            Sell a character to free a roster slot
          </p>
        {:else}
          <button
            class="metal-stamp-gold rounded-xl py-3 font-bold font-mono text-sm"
            style="width: 100%; max-width: 320px;"
            onclick={() => view = 'spin'}
          >
            Generate New Character
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<!-- ── Expanded overlay (rendered on top of roster) ───────────────────────── -->
{#if view === 'expanded' && expandedEntry !== null}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    style="background: rgba(7,7,13,0.88); backdrop-filter: blur(8px);"
    onclick={closeExpanded}
    role="dialog"
    aria-modal="true"
    aria-label="Character sheet"
  >
    <!-- Panel -->
    <div
      class="obsidian-slab w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-xl mx-4"
      style="animation: slideInBottom 200ms ease-out;"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Panel header -->
      <div class="flex items-center justify-between px-4 py-3" style="height: 48px; border-bottom: 1px solid rgba(255,223,150,0.08);">
        <h3
          class="font-bold truncate"
          style="font-family: var(--font-cinzel); font-size: 20px; color: var(--color-on-surface);"
        >
          {expandedEntry.name}
        </h3>
        <button
          class="text-xl font-bold ml-4 flex-shrink-0"
          style="background: none; border: none; cursor: pointer; color: var(--color-outline); line-height: 1;"
          onclick={closeExpanded}
          aria-label="Close character sheet"
        >
          ×
        </button>
      </div>

      <!-- CharacterCard readonly -->
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

<!-- ── Sell confirmation modal ────────────────────────────────────────────── -->
{#if sellTarget !== null}
  <SellConfirmModal
    entry={sellTarget}
    onConfirm={confirmSell}
    onCancel={() => sellTarget = null}
  />
{/if}
