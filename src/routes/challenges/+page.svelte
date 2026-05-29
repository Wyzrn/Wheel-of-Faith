<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { auth } from '$lib/stores/auth.svelte'
  import { toast } from '$lib/toast.svelte'

  type ChallengeStatus = 'locked' | 'ready' | 'claimed'
  type Challenge = {
    type: string
    name: string
    description: string
    reward: number
    icon: string
    threshold: number
    progress: number
    status: ChallengeStatus
    completed: boolean
  }

  let challenges = $state<Challenge[]>([])
  let loading = $state(true)
  let claiming = $state<string | null>(null)
  let nowMs = $state(Date.now())
  let tickInterval: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    const res = await fetch('/api/challenges/daily', { credentials: 'include' })
    if (res.ok) challenges = (await res.json()).challenges ?? []
    loading = false
  }

  onMount(async () => {
    await refresh()
    tickInterval = setInterval(() => { nowMs = Date.now() }, 1000)
  })

  onDestroy(() => { if (tickInterval) clearInterval(tickInterval) })

  // Countdown to next UTC midnight (reset point). One $derived chain — cheap.
  let resetCountdown = $derived.by(() => {
    const next = new Date()
    next.setUTCHours(24, 0, 0, 0)
    const ms = Math.max(0, next.getTime() - nowMs)
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    const s = Math.floor((ms % 60_000) / 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  })

  async function claim(type: string) {
    if (claiming) return
    claiming = type
    try {
      const res = await fetch(`/api/challenges/${type}/claim`, { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        challenges = challenges.map(c => c.type === type ? { ...c, status: 'claimed', completed: true, progress: c.threshold } : c)
        auth.updateShopData(data.shards, auth.user?.gamepasses ?? [])
        toast.reward('Challenge claimed!', `+${data.reward} Fate Shards`)
      } else if (res.status === 403) {
        toast.error(data.error ?? 'Complete the task first to claim this reward.')
      } else {
        toast.error(data.error ?? 'Could not claim — try again.')
      }
    } finally {
      claiming = null
    }
  }

  function statusLabel(s: ChallengeStatus): string {
    return s === 'claimed' ? 'Done' : s === 'ready' ? 'Claim' : 'Locked'
  }
</script>

<main class="min-h-screen" style="background: transparent; color: #e9dfeb;">
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14" style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(240,192,64,0.2); backdrop-filter: blur(16px);">
    <a href="/" class="flex items-center gap-1 transition-all active:scale-95" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
      <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
      <span>Menu</span>
    </a>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">task_alt</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">DAILY CHALLENGES</span>
    </div>
    <button onclick={refresh} class="flex items-center gap-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 4px 6px; border-radius: 6px; background: transparent; border: none; cursor: pointer;" aria-label="Refresh">
      <span class="material-symbols-outlined" style="font-size: 15px;">refresh</span>
    </button>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto">
    <div class="text-center mb-6">
      <p class="font-mono text-xs tracking-widest uppercase mb-1" style="color: #9a907b;">Resets in <span style="color: #f0c040;">{resetCountdown}</span> (UTC)</p>
      <h1 style="font-family: 'Cinzel', serif; font-size: 1.7rem; font-weight: 700; color: #ffdf96;">Daily Challenges</h1>
      <p class="text-sm mt-1" style="color: #9a907b;">A fresh set rolls every UTC midnight. Finish them in-game to claim Fate Shards.</p>
      {#if auth.loggedIn && auth.user?.dailyStreak}
        <div class="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full" style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.2);">
          <span class="material-symbols-outlined" style="font-size: 14px; color: #f0c040; font-variation-settings: 'FILL' 1;">local_fire_department</span>
          <span class="font-mono text-xs font-bold" style="color: #f0c040;">{auth.user.dailyStreak}-day streak</span>
        </div>
      {/if}
    </div>

    <!-- Claim feedback now surfaced via the global Toaster. -->


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
          {@const isClaimed = ch.status === 'claimed'}
          {@const isReady   = ch.status === 'ready'}
          {@const isLocked  = ch.status === 'locked'}
          {@const accent = isClaimed ? '#34d399' : isReady ? '#f0c040' : '#9a907b'}
          {@const bg = isClaimed
            ? 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(52,211,153,0.03))'
            : isReady
              ? 'linear-gradient(135deg, rgba(240,192,64,0.10), rgba(240,192,64,0.03))'
              : 'linear-gradient(180deg, #13121c, #0c0b14)'}
          {@const showProgress = ch.threshold > 1 && !isClaimed}
          {@const pct = ch.threshold > 0 ? Math.min(100, Math.round((ch.progress / ch.threshold) * 100)) : 0}
          <div class="rounded-2xl px-5 py-4" style="background: {bg}; border: 1px solid {accent}33;">
            <div class="flex items-center gap-4">
              <span class="material-symbols-outlined flex-shrink-0" style="font-size: 28px; color: {accent}; font-variation-settings: 'FILL' {isClaimed || isReady ? 1 : 0};">
                {isClaimed ? 'check_circle' : isLocked ? 'lock' : ch.icon}
              </span>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm" style="font-family: 'Cinzel', serif; color: {accent};">{ch.name}</p>
                <p class="text-xs mt-0.5" style="color: #9a907b; line-height: 1.4;">{ch.description}</p>
                <div class="flex items-center gap-3 mt-1.5">
                  <div class="flex items-center gap-1">
                    <span class="material-symbols-outlined" style="font-size: 12px; color: #f0c040; font-variation-settings: 'FILL' 1;">diamond</span>
                    <span class="font-mono text-xs font-bold" style="color: #f0c040;">+{ch.reward}</span>
                  </div>
                  {#if showProgress}
                    <span class="font-mono text-xs" style="color: {accent};">{ch.progress}/{ch.threshold}</span>
                  {/if}
                </div>
                {#if showProgress}
                  <div class="mt-2 h-1 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.05);">
                    <div style="height: 100%; width: {pct}%; background: {accent}; transition: width 0.3s ease;"></div>
                  </div>
                {/if}
              </div>
              {#if isClaimed}
                <span class="font-mono text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0" style="background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.25); color: #34d399;">Done</span>
              {:else if auth.loggedIn && isReady}
                <button
                  onclick={() => claim(ch.type)}
                  disabled={claiming === ch.type}
                  class="font-mono text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-40 transition-all active:scale-95"
                  style="background: rgba(240,192,64,0.18); border: 1px solid rgba(240,192,64,0.45); color: #f0c040;"
                >
                  {claiming === ch.type ? '...' : 'Claim'}
                </button>
              {:else if auth.loggedIn && isLocked}
                <span class="font-mono text-xs px-3 py-1.5 rounded-lg flex-shrink-0" style="background: rgba(154,144,123,0.08); border: 1px solid rgba(154,144,123,0.2); color: #9a907b;">{statusLabel(ch.status)}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</main>
