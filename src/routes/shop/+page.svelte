<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { auth } from '$lib/stores/auth.svelte'
  import { shop, gamepasses } from '$lib/stores/shop.svelte'
  import { SHARD_PACKS, GAMEPASSES, CATEGORY_LABELS, type GamepassCategory } from '$lib/shop/gamepasses'

  let isSuccess = $derived($page.url.searchParams.get('success') === '1')
  let successShards = $state(0)
  let showSuccess = $state(false)
  let confirmId   = $state<string | null>(null)
  let buyResult   = $state<string | null>(null)

  const CATEGORIES: GamepassCategory[] = ['combat', 'spinning', 'roster', 'prestige']

  onMount(async () => {
    if (isSuccess && auth.loggedIn) {
      const shardsBeforeRefresh = auth.user?.shards ?? 0
      await shop.refresh()
      successShards = (auth.user?.shards ?? 0) - shardsBeforeRefresh
      showSuccess = true
      setTimeout(() => showSuccess = false, 5000)
    } else if (auth.loggedIn) {
      await shop.refresh()
    }
    // Fire-and-forget: mark today's 'shop_visit' daily challenge progress.
    // Server validates the user is authenticated; idempotent for the day.
    if (auth.loggedIn) {
      fetch('/api/challenges/progress', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'shop_visit' }),
      }).catch(() => { /* network — silently ignore */ })
    }
  })

  async function handleBuyGamepass(id: string) {
    confirmId = null
    buyResult = null
    const err = await shop.buyGamepass(id as any)
    buyResult = err ? err : 'Purchased!'
    setTimeout(() => { buyResult = null }, 3000)
  }

  const CATEGORY_ICONS: Record<GamepassCategory, string> = {
    combat:   'swords',
    spinning: 'casino',
    roster:   'group',
    prestige: 'workspace_premium',
  }
</script>

<div class="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">

  <!-- Header -->
  <div class="text-center mb-8">
    <p class="font-mono text-xs tracking-widest uppercase mb-1" style="color: #9a907b; letter-spacing: 0.18em;">Wheel of Fate</p>
    <h1 class="font-bold mb-2" style="font-family: 'Cinzel', serif; font-size: 1.7rem; color: #ffdf96; text-shadow: 0 0 20px rgba(240,192,64,0.35);">
      The Arcane Shop
    </h1>
    <p class="text-sm" style="color: #9a907b;">Spend Fate Shards. Bend the wheel to your will.</p>
  </div>

  <!-- Success banner -->
  {#if showSuccess}
    <div class="mb-6 rounded-xl px-5 py-4 text-center"
      style="background: linear-gradient(135deg, rgba(52,211,153,0.12), rgba(16,185,129,0.06)); border: 1px solid rgba(52,211,153,0.3); box-shadow: 0 0 30px rgba(52,211,153,0.1);">
      <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: #34d399;">
        +{successShards.toLocaleString()} Fate Shards Received!
      </p>
      <p class="text-xs mt-1" style="color: #9a907b;">Your purchase has been credited to your account.</p>
    </div>
  {/if}

  <!-- Account shard balance -->
  {#if auth.loggedIn}
    <div class="obsidian-slab rounded-xl px-5 py-4 mb-6 flex items-center justify-between"
      style="border: 1px solid rgba(240,192,64,0.18);">
      <div>
        <p class="font-mono text-xs uppercase tracking-widest mb-0.5" style="color: #9a907b;">Account Shards</p>
        <p class="font-bold text-2xl" style="font-family: 'Cinzel', serif; color: #f0c040;">
          {(auth.user?.shards ?? 0).toLocaleString()}
        </p>
        <p class="font-mono text-xs mt-0.5" style="color: #4e4635;">Gamepasses owned: {auth.user?.gamepasses?.length ?? 0}</p>
      </div>
      <span class="material-symbols-outlined" style="font-size: 40px; color: #f0c040; font-variation-settings: 'FILL' 1; opacity: 0.7;">diamond</span>
    </div>
  {:else}
    <div class="rounded-xl px-5 py-4 mb-6 text-center"
      style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
      <p class="text-sm" style="color: #9a907b;">
        <a href="/login" style="color: #f0c040; text-decoration: underline;">Log in</a> to purchase shards and gamepasses.
      </p>
    </div>
  {/if}

  <!-- Buy result toast -->
  {#if buyResult}
    <div class="mb-4 rounded-lg px-4 py-3 text-center text-sm font-semibold font-mono"
      style="background: {buyResult === 'Purchased!' ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)'}; border: 1px solid {buyResult === 'Purchased!' ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}; color: {buyResult === 'Purchased!' ? '#34d399' : '#f87171'};">
      {buyResult}
    </div>
  {/if}

  <!-- ── Shard Packs ─────────────────────────────────────────────────────────── -->
  <div class="mb-2 flex items-center gap-2">
    <span class="material-symbols-outlined" style="font-size: 18px; color: #f0c040; font-variation-settings: 'FILL' 1;">diamond</span>
    <h2 style="font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.1em;">SHARD PACKS</h2>
  </div>
  <p class="font-mono text-xs mb-4" style="color: #9a907b;">Real-money purchases. Shards are credited instantly after checkout.</p>

  <div class="flex flex-col gap-3 mb-8">
    {#each SHARD_PACKS as pack}
      <div class="obsidian-slab rounded-xl px-5 py-4 flex items-center justify-between gap-4"
        style="border: 1px solid rgba(240,192,64,0.14);">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined" style="font-size: 28px; color: #f0c040; font-variation-settings: 'FILL' 1;">diamond</span>
          <div>
            <p class="font-semibold text-sm" style="font-family: 'Cinzel', serif; color: #e9dfeb;">{pack.name}</p>
            <p class="font-mono text-xs" style="color: #f0c040;">{pack.shards.toLocaleString()} shards</p>
            {#if pack.tag}
              <span class="font-mono text-xs px-1.5 py-0.5 rounded" style="background: rgba(90,214,239,0.15); border: 1px solid rgba(90,214,239,0.3); color: #5ad6ef;">{pack.tag}</span>
            {/if}
          </div>
        </div>
        <button
          onclick={() => shop.buyShardPack(pack.id)}
          disabled={!auth.loggedIn || shop.buying}
          class="metal-stamp-gold px-4 py-2.5 rounded-lg font-bold text-sm flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          style="font-family: 'Cinzel', serif; letter-spacing: 0.08em; min-width: 72px; text-align: center;"
        >
          {pack.priceDisplay}
        </button>
      </div>
    {/each}
  </div>

  <!-- ── Gamepasses ─────────────────────────────────────────────────────────── -->
  <div class="mb-2 flex items-center gap-2">
    <span class="material-symbols-outlined" style="font-size: 18px; color: #5ad6ef; font-variation-settings: 'FILL' 1;">workspace_premium</span>
    <h2 style="font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.1em;">GAMEPASSES</h2>
  </div>
  <p class="font-mono text-xs mb-4" style="color: #9a907b;">Permanent upgrades. Purchased with Fate Shards. Active on all save slots.</p>

  {#each CATEGORIES as cat}
    {@const catPasses = GAMEPASSES.filter(g => g.category === cat)}
    <div class="mb-6">
      <!-- Category header -->
      <div class="flex items-center gap-2 mb-3">
        <span class="material-symbols-outlined" style="font-size: 15px; color: #9a907b; font-variation-settings: 'FILL' 1;">{CATEGORY_ICONS[cat]}</span>
        <p class="font-mono text-xs tracking-widest uppercase" style="color: #9a907b;">{CATEGORY_LABELS[cat]}</p>
      </div>

      <div class="flex flex-col gap-2.5">
        {#each catPasses as gp}
          {@const owned = gamepasses.has(gp.id as any)}
          {@const count = gamepasses.count(gp.id as any)}
          {@const canAfford = (auth.user?.shards ?? 0) >= gp.costShards}
          {@const alreadyOwned = owned && !gp.stackable}

          <div class="rounded-xl px-4 py-3.5 relative overflow-hidden"
            style="background: {gp.comingSoon ? 'linear-gradient(180deg, #0e0d15, #09080f)' : owned ? 'linear-gradient(135deg, rgba(240,192,64,0.08), rgba(240,192,64,0.03))' : 'linear-gradient(180deg, #13121c, #1e1a22)'}; border: 1px solid {gp.comingSoon ? 'rgba(48,44,64,0.6)' : owned ? 'rgba(240,192,64,0.28)' : 'rgba(78,70,53,0.3)'}; opacity: {gp.comingSoon ? '0.6' : '1'};">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3 flex-1 min-w-0">
                <span class="material-symbols-outlined mt-0.5 flex-shrink-0"
                  style="font-size: 20px; color: {gp.comingSoon ? '#3a3550' : owned ? '#f0c040' : '#4e4635'}; font-variation-settings: 'FILL' {owned ? 1 : 0};">{gp.icon}</span>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="font-semibold text-sm" style="font-family: 'Cinzel', serif; color: {gp.comingSoon ? '#4a4465' : owned ? '#ffdf96' : '#e9dfeb'};">{gp.name}</p>
                    {#if owned && !gp.comingSoon}
                      <span class="font-mono text-xs px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.15); border: 1px solid rgba(240,192,64,0.3); color: #f0c040;">
                        {gp.stackable && count > 1 ? `OWNED ×${count}` : 'OWNED'}
                      </span>
                    {/if}
                    {#if gp.comingSoon}
                      <span class="font-mono text-xs px-1.5 py-0.5 rounded" style="background: rgba(48,44,64,0.5); border: 1px solid rgba(58,53,80,0.6); color: #4a4465;">UNAVAILABLE</span>
                    {/if}
                  </div>
                  <p class="text-xs mt-0.5" style="color: {gp.comingSoon ? '#2e2b45' : '#9a907b'}; line-height: 1.4;">{gp.description}</p>
                  <p class="font-mono text-xs mt-1.5" style="color: {gp.comingSoon ? '#2e2b45' : '#5ad6ef'};">{gp.comingSoon ? 'Not yet available' : gp.effect}</p>
                </div>
              </div>

              <!-- Buy button -->
              <div class="flex flex-col items-end gap-1 flex-shrink-0">
                {#if gp.comingSoon}
                  <div class="px-3 py-2 rounded-lg"
                    style="background: rgba(30,28,48,0.4); border: 1px solid rgba(48,44,64,0.5);">
                    <span class="font-mono text-xs font-bold" style="color: #2e2b45;">—</span>
                  </div>
                {:else if alreadyOwned}
                  <div class="flex items-center gap-1 px-3 py-2 rounded-lg"
                    style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.2);">
                    <span class="material-symbols-outlined" style="font-size: 14px; color: #f0c040; font-variation-settings: 'FILL' 1;">check_circle</span>
                    <span class="font-mono text-xs font-bold" style="color: #f0c040;">Active</span>
                  </div>
                {:else if confirmId === gp.id}
                  <div class="flex gap-1.5">
                    <button onclick={() => handleBuyGamepass(gp.id)}
                      disabled={shop.buying}
                      class="px-2.5 py-1.5 rounded-lg font-bold text-xs font-mono disabled:opacity-40"
                      style="background: rgba(240,192,64,0.2); border: 1px solid rgba(240,192,64,0.4); color: #f0c040;">
                      Confirm
                    </button>
                    <button onclick={() => { confirmId = null }}
                      class="px-2 py-1.5 rounded-lg font-bold text-xs font-mono"
                      style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #9a907b;">
                      ✕
                    </button>
                  </div>
                {:else}
                  <button
                    onclick={() => { if (!auth.loggedIn) return; confirmId = gp.id }}
                    disabled={!auth.loggedIn || !canAfford || shop.buying}
                    class="px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed"
                    style="background: {canAfford && auth.loggedIn ? 'linear-gradient(135deg, rgba(240,192,64,0.18), rgba(240,192,64,0.08))' : 'rgba(255,255,255,0.03)'}; border: 1px solid {canAfford && auth.loggedIn ? 'rgba(240,192,64,0.35)' : 'rgba(78,70,53,0.3)'}; color: {canAfford && auth.loggedIn ? '#f0c040' : '#4e4635'}; transition: all 0.15s;"
                  >
                    <span class="material-symbols-outlined" style="font-size: 12px; font-variation-settings: 'FILL' 1;">diamond</span>
                    {gp.costShards.toLocaleString()}
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}

</div>

<style>
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
</style>
