<script lang="ts">
  import { onMount } from 'svelte'
  import { auth } from '$lib/stores/auth.svelte'

  type Clan = { _id: string; name: string; tag: string; description: string; memberCount: number; totalWins?: number }
  type MyClan = Clan & { members: { username: string; rivalsWins: number }[]; leaderId: string }

  let view = $state<'mine' | 'browse' | 'create' | 'leaderboard'>('mine')
  let myClan = $state<MyClan | null>(null)
  let clans = $state<Clan[]>([])
  let leaderboard = $state<any[]>([])
  let loading = $state(true)
  let search = $state('')
  let createName = $state('')
  let createTag = $state('')
  let createDesc = $state('')
  let createError = $state<string | null>(null)
  let creating = $state(false)
  let joining = $state<string | null>(null)
  let leaveConfirm = $state(false)

  onMount(async () => {
    await loadMyClan()
    loading = false
  })

  async function loadMyClan() {
    if (!auth.loggedIn) return
    const res = await fetch('/api/clans/mine', { credentials: 'include' })
    if (res.ok) { const d = await res.json(); myClan = d.clan }
  }

  async function browseClans() {
    view = 'browse'
    const res = await fetch(`/api/clans?search=${encodeURIComponent(search)}`)
    if (res.ok) clans = (await res.json()).clans ?? []
  }

  async function loadLeaderboard() {
    view = 'leaderboard'
    if (leaderboard.length) return
    const res = await fetch('/api/clans/leaderboard')
    if (res.ok) leaderboard = (await res.json()).clans ?? []
  }

  async function createClan() {
    if (creating) return
    creating = true
    createError = null
    const res = await fetch('/api/clans', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createName, tag: createTag, description: createDesc }),
    })
    const data = await res.json()
    if (!res.ok) { createError = data.error ?? 'Failed'; creating = false; return }
    myClan = data.clan
    view = 'mine'
    creating = false
  }

  async function joinClan(id: string) {
    joining = id
    const res = await fetch(`/api/clans/${id}/join`, { method: 'POST', credentials: 'include' })
    if (res.ok) { await loadMyClan(); view = 'mine' }
    joining = null
  }

  async function leaveClan() {
    if (!myClan) return
    const res = await fetch(`/api/clans/${myClan._id}/leave`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { myClan = null; leaveConfirm = false }
  }

  let isLeader = $derived(myClan?.leaderId?.toString() === (auth.user?.id ?? ''))
</script>

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14" style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(240,192,64,0.2); backdrop-filter: blur(16px);">
    <a href="/" class="flex items-center gap-1 transition-all active:scale-95" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
      <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
      <span>Menu</span>
    </a>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">shield</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">CLANS</span>
    </div>
    <div style="min-width: 80px;"></div>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto">

    <!-- Tab bar -->
    <div class="flex gap-2 mb-6">
      <button onclick={() => view = 'mine'} class="flex-1 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-widest" style="background: {view === 'mine' ? 'rgba(240,192,64,0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid {view === 'mine' ? 'rgba(240,192,64,0.35)' : 'rgba(255,255,255,0.06)'}; color: {view === 'mine' ? '#f0c040' : '#9a907b'};">My Clan</button>
      <button onclick={browseClans} class="flex-1 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-widest" style="background: {view === 'browse' ? 'rgba(72,200,224,0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid {view === 'browse' ? 'rgba(72,200,224,0.35)' : 'rgba(255,255,255,0.06)'}; color: {view === 'browse' ? '#48c8e0' : '#9a907b'};">Browse</button>
      <button onclick={loadLeaderboard} class="flex-1 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-widest" style="background: {view === 'leaderboard' ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid {view === 'leaderboard' ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.06)'}; color: {view === 'leaderboard' ? '#a78bfa' : '#9a907b'};">Rankings</button>
    </div>

    {#if !auth.loggedIn}
      <div class="rounded-xl px-5 py-8 text-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
        <p style="color: #9a907b;"><a href="/login" style="color: #f0c040; text-decoration: underline;">Log in</a> to join or create a clan.</p>
      </div>

    {:else if view === 'mine'}
      {#if loading}
        <div class="animate-pulse rounded-2xl h-40" style="background: rgba(255,255,255,0.04);"></div>
      {:else if myClan}
        <div class="rounded-2xl px-5 py-5 mb-4" style="background: linear-gradient(135deg, rgba(240,192,64,0.08), rgba(240,192,64,0.03)); border: 1px solid rgba(240,192,64,0.3);">
          <div class="flex items-center gap-3 mb-3">
            <span class="font-mono font-black px-2.5 py-1 rounded-lg text-sm" style="background: rgba(240,192,64,0.15); border: 1px solid rgba(240,192,64,0.3); color: #f0c040;">[{myClan.tag}]</span>
            <h2 style="font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700; color: #ffdf96;">{myClan.name}</h2>
          </div>
          {#if myClan.description}
            <p class="text-xs mb-3" style="color: #9a907b;">{myClan.description}</p>
          {/if}
          <p class="font-mono text-xs mb-4" style="color: #4e4635;">{myClan.memberCount ?? myClan.members?.length ?? 0}/10 members</p>

          {#if myClan.members}
            <div class="flex flex-col gap-1.5 mb-4">
              {#each myClan.members as m}
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg" style="background: rgba(255,255,255,0.03);">
                  <span class="material-symbols-outlined" style="font-size: 14px; color: #4e4635; font-variation-settings: 'FILL' 1;">person</span>
                  <span class="font-mono text-xs flex-1" style="color: #e4e1ee;">{m.username}</span>
                  <span class="font-mono text-xs" style="color: #f0c040;">{m.rivalsWins}W</span>
                </div>
              {/each}
            </div>
          {/if}

          {#if !leaveConfirm}
            <button onclick={() => leaveConfirm = true} class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171;">Leave Clan</button>
          {:else}
            <div class="flex gap-2">
              <button onclick={leaveClan} class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171;">Confirm Leave</button>
              <button onclick={() => leaveConfirm = false} class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #9a907b;">Cancel</button>
            </div>
          {/if}
        </div>
      {:else}
        <div class="text-center py-8 mb-6">
          <span class="material-symbols-outlined text-5xl mb-3 block" style="color: #4e4635; font-variation-settings: 'FILL' 1;">shield</span>
          <p style="font-family: 'Cinzel', serif; color: #9a907b; margin-bottom: 8px;">You are not in a clan.</p>
          <div class="flex gap-3 justify-center mt-4">
            <button onclick={() => view = 'create'} class="px-5 py-2.5 rounded-lg font-bold text-sm" style="font-family: 'Cinzel', serif; background: rgba(240,192,64,0.12); border: 1px solid rgba(240,192,64,0.3); color: #f0c040;">Create Clan</button>
            <button onclick={browseClans} class="px-5 py-2.5 rounded-lg font-bold text-sm" style="font-family: 'Cinzel', serif; background: rgba(72,200,224,0.08); border: 1px solid rgba(72,200,224,0.2); color: #48c8e0;">Join Clan</button>
          </div>
        </div>
      {/if}

    {:else if view === 'create'}
      <div class="rounded-2xl px-5 py-5" style="background: linear-gradient(180deg, #13121c, #0c0b14); border: 1px solid rgba(78,70,53,0.35);">
        <h2 class="mb-5" style="font-family: 'Cinzel', serif; font-size: 1.1rem; color: #ffdf96;">Create a Clan</h2>
        {#if createError}
          <p class="text-xs mb-3 px-3 py-2 rounded-lg" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171;">{createError}</p>
        {/if}
        <div class="flex flex-col gap-3">
          <div>
            <label class="font-mono text-xs block mb-1" style="color: #9a907b;">Clan Name (3–32 chars)</label>
            <input bind:value={createName} maxlength={32} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e4e1ee; outline: none;" placeholder="The Chosen Few" />
          </div>
          <div>
            <label class="font-mono text-xs block mb-1" style="color: #9a907b;">Tag (2–5 letters/numbers)</label>
            <input bind:value={createTag} maxlength={5} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm uppercase" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e4e1ee; outline: none;" placeholder="TCF" />
          </div>
          <div>
            <label class="font-mono text-xs block mb-1" style="color: #9a907b;">Description (optional)</label>
            <textarea bind:value={createDesc} maxlength={200} rows={2} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e4e1ee; outline: none; resize: none;" placeholder="We spin. We win."></textarea>
          </div>
          <div class="flex gap-3 mt-2">
            <button onclick={createClan} disabled={creating || !createName || !createTag} class="flex-1 py-3 rounded-lg font-bold text-sm disabled:opacity-40" style="font-family: 'Cinzel', serif; background: rgba(240,192,64,0.15); border: 1px solid rgba(240,192,64,0.35); color: #f0c040;">{creating ? 'Creating...' : 'Create'}</button>
            <button onclick={() => view = 'mine'} class="px-4 py-3 rounded-lg font-mono text-xs" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #9a907b;">Cancel</button>
          </div>
        </div>
      </div>

    {:else if view === 'browse'}
      <div class="flex gap-2 mb-4">
        <input bind:value={search} onkeydown={(e) => e.key === 'Enter' && browseClans()} class="flex-1 px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e4e1ee; outline: none;" placeholder="Search clans..." />
        <button onclick={browseClans} class="px-4 py-2.5 rounded-lg font-mono text-xs font-bold" style="background: rgba(72,200,224,0.12); border: 1px solid rgba(72,200,224,0.25); color: #48c8e0;">Search</button>
      </div>
      <div class="flex flex-col gap-3">
        {#each clans as clan}
          <div class="rounded-xl px-4 py-3 flex items-center gap-3" style="background: linear-gradient(180deg, #13121c, #0c0b14); border: 1px solid rgba(78,70,53,0.3);">
            <span class="font-mono font-black px-2 py-0.5 rounded text-xs shrink-0" style="background: rgba(240,192,64,0.1); border: 1px solid rgba(240,192,64,0.2); color: #f0c040;">[{clan.tag}]</span>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm truncate" style="font-family: 'Cinzel', serif; color: #e4e1ee;">{clan.name}</p>
              <p class="font-mono text-xs" style="color: #4e4635;">{clan.memberCount}/10 members</p>
            </div>
            {#if !myClan}
              <button onclick={() => joinClan(clan._id)} disabled={joining === clan._id || clan.memberCount >= 10} class="px-3 py-1.5 rounded-lg font-mono text-xs font-bold shrink-0 disabled:opacity-40" style="background: rgba(72,200,224,0.1); border: 1px solid rgba(72,200,224,0.25); color: #48c8e0;">{joining === clan._id ? '...' : clan.memberCount >= 10 ? 'Full' : 'Join'}</button>
            {/if}
          </div>
        {:else}
          <p class="text-center py-8 font-mono text-xs" style="color: #4e4635;">No clans found.</p>
        {/each}
      </div>

    {:else if view === 'leaderboard'}
      <div class="flex flex-col gap-2">
        {#each leaderboard as clan, i}
          <div class="flex items-center gap-3 rounded-xl px-4 py-3" style="background: linear-gradient(180deg, #161520, #0c0b14); border: 1px solid rgba(167,139,250,0.1);">
            <div class="shrink-0 w-8 flex items-center justify-center">
              {#if i < 3}<span style="font-size: 1.2rem;">{['🥇','🥈','🥉'][i]}</span>{:else}<span style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #4e4635; font-weight: 700;">#{i+1}</span>{/if}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs font-bold px-1.5 py-0.5 rounded" style="background: rgba(167,139,250,0.12); border: 1px solid rgba(167,139,250,0.2); color: #a78bfa;">[{clan.tag}]</span>
                <p class="font-semibold text-sm truncate" style="font-family: 'Cinzel', serif; color: #e4e1ee;">{clan.name}</p>
              </div>
              <p class="font-mono text-xs mt-0.5" style="color: #4e4635;">{clan.memberCount}/10 members</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-black" style="font-family: 'JetBrains Mono', monospace; font-size: 1rem; color: #a78bfa;">{clan.totalWins}</p>
              <p class="font-mono text-xs" style="color: #4e4635;">total wins</p>
            </div>
          </div>
        {:else}
          <p class="text-center py-10 font-mono text-xs" style="color: #4e4635;">No clans yet. Be the first!</p>
        {/each}
      </div>
    {/if}
  </div>
</main>
