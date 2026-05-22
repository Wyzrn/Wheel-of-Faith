<script lang="ts">
  import { onMount } from 'svelte'
  import { auth } from '$lib/stores/auth.svelte'

  type Challenge = {
    type: string
    name: string
    description: string
    reward: number
    icon: string
    completed: boolean
  }

  let challenges = $state<Challenge[]>([])
  let loading = $state(true)
  let claiming = $state<string | null>(null)
  let claimResult = $state<{ type: string; reward: number } | null>(null)

  onMount(async () => {
    const res = await fetch('/api/challenges/daily', { credentials: 'include' })
    if (res.ok) challenges = (await res.json()).challenges ?? []
    loading = false
  })

  async function claim(type: string) {
    if (claiming) return
    claiming = type
    const res = await fetch(`/api/challenges/${type}/claim`, { method: 'POST', credentials: 'include' })
    const data = await res.json()
    if (res.ok) {
      challenges = challenges.map(c => c.type === type ? { ...c, completed: true } : c)
      claimResult = { type, reward: data.reward }
      auth.updateShopData(data.shards, auth.user?.gamepasses ?? [])
      setTimeout(() => { claimResult = null }, 3000)
    }
    claiming = null
  }
</script>

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14" style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(240,192,64,0.2); backdrop-filter: blur(16px);">
    <a href="/" class="flex items-center gap-1 transition-all active:scale-95" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
      <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
      <span>Menu</span>
    </a>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">task_alt</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">DAILY CHALLENGES</span>
    </div>
    <div style="min-width: 80px;"></div>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto">
    <div class="text-center mb-8">
      <p class="font-mono text-xs tracking-widest uppercase mb-1" style="color: #9a907b;">Resets at midnight UTC</p>
      <h1 style="font-family: 'Cinzel', serif; font-size: 1.7rem; font-weight: 700; color: #ffdf96;">Daily Challenges</h1>
      <p class="text-sm mt-1" style="color: #9a907b;">Complete tasks to earn Fate Shards.</p>
    </div>

    {#if claimResult}
      <div class="mb-4 rounded-xl px-5 py-3 text-center" style="background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3);">
        <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: #34d399;">+{claimResult.reward} Fate Shards claimed!</p>
      </div>
    {/if}

    {#if !auth.loggedIn}
      <div class="rounded-xl px-5 py-4 text-center mb-6" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
        <p class="text-sm" style="color: #9a907b;"><a href="/login" style="color: #f0c040; text-decoration: underline;">Log in</a> to claim shard rewards.</p>
      </div>
    {/if}

    {#if loading}
      <div class="flex flex-col gap-4">
        {#each [1,2,3] as _}
          <div class="animate-pulse rounded-2xl h-28" style="background: rgba(255,255,255,0.04);"></div>
        {/each}
      </div>
    {:else}
      <div class="flex flex-col gap-4">
        {#each challenges as ch}
          <div class="rounded-2xl px-5 py-4" style="background: {ch.completed ? 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(52,211,153,0.03))' : 'linear-gradient(180deg, #13121c, #0c0b14)'}; border: 1px solid {ch.completed ? 'rgba(52,211,153,0.3)' : 'rgba(78,70,53,0.35)'};">
            <div class="flex items-center gap-4">
              <span class="material-symbols-outlined flex-shrink-0" style="font-size: 28px; color: {ch.completed ? '#34d399' : '#f0c040'}; font-variation-settings: 'FILL' {ch.completed ? 1 : 0};">{ch.completed ? 'check_circle' : ch.icon}</span>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm" style="font-family: 'Cinzel', serif; color: {ch.completed ? '#34d399' : '#ffdf96'};">{ch.name}</p>
                <p class="text-xs mt-0.5" style="color: #9a907b; line-height: 1.4;">{ch.description}</p>
                <div class="flex items-center gap-1 mt-1.5">
                  <span class="material-symbols-outlined" style="font-size: 12px; color: #f0c040; font-variation-settings: 'FILL' 1;">diamond</span>
                  <span class="font-mono text-xs font-bold" style="color: #f0c040;">+{ch.reward} shards</span>
                </div>
              </div>
              {#if ch.completed}
                <span class="font-mono text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0" style="background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.25); color: #34d399;">Done</span>
              {:else if auth.loggedIn}
                <button
                  onclick={() => claim(ch.type)}
                  disabled={claiming === ch.type}
                  class="font-mono text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-40"
                  style="background: rgba(240,192,64,0.12); border: 1px solid rgba(240,192,64,0.3); color: #f0c040;"
                >
                  {claiming === ch.type ? '...' : 'Claim'}
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</main>
