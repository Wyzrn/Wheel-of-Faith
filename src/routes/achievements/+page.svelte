<script lang="ts">
  import { apiUrl } from '$lib/api'
  import { onMount } from 'svelte'
  import { auth } from '$lib/stores/auth.svelte'
  import { toast } from '$lib/toast.svelte'
  import {
    ACHIEVEMENTS, buildContext, evaluateAll, colorForTier,
    pendingRewardUnlocks, markRewardsCredited,
    type AchievementState, type AchievementTier,
  } from '$lib/achievements'

  let states = $state<AchievementState[]>([])
  let filter = $state<'all' | AchievementTier>('all')

  // Compute derived counters from the current state snapshot
  let unlockedCount = $derived(states.filter(s => s.condition.met).length)
  let totalRewards  = $derived(states.filter(s => s.condition.met).reduce((s, a) => s + (a.reward ?? 0), 0))
  let unmet = $derived(states.filter(s => !s.condition.met))
  let nextUp = $derived(
    [...unmet].sort((a, b) =>
      // Best "close to unlock" — highest progress fraction first, then bronze before mythic
      (b.condition.progress / b.condition.threshold) - (a.condition.progress / a.condition.threshold)
    ).slice(0, 3)
  )

  let filteredStates = $derived(
    filter === 'all' ? states : states.filter(s => s.tier === filter)
  )

  onMount(async () => {
    const ctx = buildContext(auth.user)
    const { states: s, newlyUnlocked } = evaluateAll(ctx)
    states = s

    // Hospitality: when the user lands on this page AND there are achievements
    // they just unlocked (since their last visit), each one gets a celebration
    // toast. No "claim" button needed — the badge just appears.
    for (const a of newlyUnlocked) {
      toast.reward(`Achievement unlocked: ${a.name}`, `+${a.reward ?? 0} Fate Shards · ${a.description}`)
    }

    await creditPendingAchievementRewards()
  })

  // Credits any unlocked-but-not-yet-credited achievement rewards to the
  // signed-in user's shard balance. Runs on every visit so unlocks earned
  // while logged-out (or while the previous credit attempt was offline)
  // eventually pay out — exactly once each.
  async function creditPendingAchievementRewards() {
    if (!auth.loggedIn || !auth.user) return
    const pending = pendingRewardUnlocks()
    if (pending.length === 0) return
    const delta = pending.reduce((s, p) => s + p.reward, 0)
    if (delta <= 0) return
    // Optimistic local update first so the header shard counter reflects it.
    auth.updateShopData((auth.user.shards ?? 0) + delta, auth.user.gamepasses ?? [])
    try {
      const res = await fetch(apiUrl('/api/shop/shards/adjust'), {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      })
      if (!res.ok) {
        // Roll back optimistic update; leave records uncredited so we retry next visit.
        auth.updateShopData((auth.user.shards ?? 0) - delta, auth.user.gamepasses ?? [])
        return
      }
      markRewardsCredited(pending.map(p => p.id))
    } catch {
      auth.updateShopData((auth.user.shards ?? 0) - delta, auth.user.gamepasses ?? [])
    }
  }

  const TIER_LABEL: Record<AchievementTier, string> = {
    bronze: 'Bronze', silver: 'Silver', gold: 'Gold', mythic: 'Mythic',
  }
  const TIER_ORDER: AchievementTier[] = ['bronze', 'silver', 'gold', 'mythic']
</script>

<main class="min-h-screen pt-16 pb-24 px-4" style="background: transparent;">
  <div class="max-w-2xl mx-auto">

    <!-- Header -->
    <div class="flex items-end gap-3 mb-2">
      <span class="material-symbols-outlined" style="font-size: 28px; color: #f0c040; font-variation-settings: 'FILL' 1;">workspace_premium</span>
      <h1 class="font-bold" style="font-family: 'Cinzel', serif; font-size: 1.6rem; color: #ffdf96; letter-spacing: 0.1em;">Achievements</h1>
    </div>
    <p class="text-xs mb-5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
      {unlockedCount} of {ACHIEVEMENTS.length} unlocked · {totalRewards.toLocaleString()} Fate Shards earned
    </p>

    <!-- Next up — three closest-to-unlock to give chase-points -->
    {#if nextUp.length > 0}
      <section class="mb-6">
        <p class="text-xs tracking-[0.18em] uppercase mb-2" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Closest to unlock</p>
        <div class="flex flex-col gap-2">
          {#each nextUp as a}
            {@const color = colorForTier(a.tier)}
            {@const pct = a.condition.threshold > 0 ? Math.round((a.condition.progress / a.condition.threshold) * 100) : 0}
            <div class="rounded-xl px-4 py-3" style="background: linear-gradient(135deg, {color}0e, {color}03); border: 1px solid {color}33;">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined" style="font-size: 22px; color: {color}; font-variation-settings: 'FILL' 0;">{a.icon}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: #ffdf96;">{a.name}</p>
                  <p class="text-xs mt-0.5" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; line-height: 1.4;">{a.description}</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="font-mono text-xs font-bold" style="color: {color};">{a.condition.progress}/{a.condition.threshold}</p>
                  <p class="font-mono text-[10px]" style="color: #4e4635;">+{a.reward ?? 0} ◆</p>
                </div>
              </div>
              <!-- Progress bar -->
              <div class="mt-2 h-1 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.05);">
                <div style="height: 100%; width: {pct}%; background: {color}; transition: width 0.4s ease;"></div>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Tier filter chips -->
    <div class="flex gap-1.5 mb-4 overflow-x-auto pb-1" style="scrollbar-width: none;">
      {#each ['all', ...TIER_ORDER] as t}
        {@const active = filter === t}
        {@const color = t === 'all' ? '#f0c040' : colorForTier(t as AchievementTier)}
        {@const label = t === 'all' ? 'All' : TIER_LABEL[t as AchievementTier]}
        <button
          onclick={() => filter = t as any}
          class="font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap transition-all active:scale-95"
          style="background: {active ? `${color}1c` : 'rgba(255,255,255,0.03)'}; border: 1px solid {active ? `${color}66` : 'rgba(255,255,255,0.06)'}; color: {active ? color : '#9a907b'}; cursor: pointer;"
        >{label}</button>
      {/each}
    </div>

    <!-- Achievement grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {#each filteredStates as a}
        {@const color = colorForTier(a.tier)}
        {@const met = a.condition.met}
        <div class="rounded-xl px-4 py-3" style="background: {met
          ? `linear-gradient(135deg, ${color}14, ${color}04)`
          : 'linear-gradient(180deg, #13121c, #1e1a22)'};
          border: 1px solid {met ? `${color}55` : 'rgba(78,70,53,0.3)'};
          box-shadow: {met ? `0 0 12px ${color}20` : 'none'};
          opacity: {met ? 1 : 0.7};">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined shrink-0" style="font-size: 26px; color: {met ? color : '#4e4635'}; font-variation-settings: 'FILL' {met ? 1 : 0}; filter: {met ? `drop-shadow(0 0 6px ${color}88)` : 'none'};">{met ? a.icon : 'lock'}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap mb-1">
                <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: {met ? '#ffdf96' : '#9a907b'};">{a.name}</p>
                <span class="font-mono text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest"
                  style="background: {color}1a; border: 1px solid {color}44; color: {color};">{TIER_LABEL[a.tier]}</span>
              </div>
              <p class="text-xs mb-2" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; line-height: 1.4;">{a.description}</p>
              <!-- Progress / Reward -->
              <div class="flex items-center gap-2 flex-wrap">
                {#if met}
                  <span class="font-mono text-[10px] flex items-center gap-1" style="color: #34d399;">
                    <span class="material-symbols-outlined" style="font-size: 11px; font-variation-settings: 'FILL' 1;">check_circle</span>
                    Unlocked
                  </span>
                {:else}
                  <span class="font-mono text-[10px]" style="color: {color};">{a.condition.progress}/{a.condition.threshold}</span>
                {/if}
                {#if a.reward}
                  <span class="font-mono text-[10px] flex items-center gap-0.5" style="color: #f0c040;">
                    <span class="material-symbols-outlined" style="font-size: 11px; font-variation-settings: 'FILL' 1;">diamond</span>
                    +{a.reward}
                  </span>
                {/if}
              </div>
              {#if !met}
                {@const pct = a.condition.threshold > 0 ? Math.round((a.condition.progress / a.condition.threshold) * 100) : 0}
                <div class="mt-2 h-0.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.04);">
                  <div style="height: 100%; width: {pct}%; background: {color}; transition: width 0.4s ease;"></div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</main>
