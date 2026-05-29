<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth.svelte'
  import { presence } from '$lib/stores/presence.svelte'
  import { toast } from '$lib/toast.svelte'
  import { loadAllSlots } from '$lib/story/saveSlots'
  import type { StoryRosterEntry } from '$lib/story/types'

  type Friend = {
    _id: string
    username: string
    rivalsWins: number
    rivalsLosses: number
    gamesPlayed: number
  }

  type FriendRequest = {
    id: string
    requester: { id: string; username: string; rivalsWins: number }
    createdAt: string
  }

  let friends        = $state<Friend[]>([])
  let requests       = $state<FriendRequest[]>([])
  let loading        = $state(true)
  let addUsername    = $state('')
  let addError       = $state<string | null>(null)
  let addSuccess     = $state(false)
  let addLoading     = $state(false)
  let activeTab      = $state<'friends' | 'requests'>('friends')
  let removingId     = $state<string | null>(null)

  onMount(async () => {
    if (!auth.loggedIn && !auth.loading) { goto('/login'); return }
    await Promise.all([loadFriends(), loadRequests()])
    loading = false
    // Ensure the presence socket is up, then poll online status periodically.
    presence.connect()
    refreshPresence()
    presenceTimer = setInterval(refreshPresence, 10000)
  })

  onDestroy(() => {
    if (presenceTimer) clearInterval(presenceTimer)
  })

  async function loadFriends() {
    const res = await fetch('/api/friends', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      friends = data.friends ?? []
    }
  }

  async function loadRequests() {
    const res = await fetch('/api/friends/requests', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      requests = data.requests ?? []
    }
  }

  async function sendRequest() {
    if (!addUsername.trim()) return
    addLoading = true
    addError = null
    addSuccess = false
    const res = await fetch('/api/friends/request', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: addUsername.trim() }),
    })
    const data = await res.json()
    addLoading = false
    if (!res.ok) { addError = data.error ?? 'Failed to send request'; return }
    addSuccess = true
    addUsername = ''
    setTimeout(() => { addSuccess = false }, 2000)
  }

  async function acceptRequest(id: string) {
    const res = await fetch(`/api/friends/accept/${id}`, { method: 'POST', credentials: 'include' })
    if (res.ok) {
      requests = requests.filter(r => r.id !== id)
      await loadFriends()
    }
  }

  async function declineRequest(id: string) {
    await fetch(`/api/friends/decline/${id}`, { method: 'POST', credentials: 'include' })
    requests = requests.filter(r => r.id !== id)
  }

  async function removeFriend(friendId: string) {
    removingId = friendId
    await fetch(`/api/friends/${friendId}`, { method: 'DELETE', credentials: 'include' })
    friends = friends.filter(f => f._id !== friendId)
    removingId = null
  }

  // ── Online presence ────────────────────────────────────────────────────
  let presenceTimer: ReturnType<typeof setInterval> | null = null
  function refreshPresence() {
    const ids = friends.map(f => f._id)
    if (ids.length) presence.queryPresence(ids)
  }

  // ── Friend challenge flow ──────────────────────────────────────────────
  // Step 1: pick rivals (fresh spin) or character duel. Step 2 (character):
  // pick which of your roster characters to send.
  let challengeTarget = $state<Friend | null>(null)
  let challengeStep   = $state<'mode' | 'character'>('mode')
  let myRoster        = $state<StoryRosterEntry[]>([])

  function openChallenge(friend: Friend) {
    if (!presence.isOnline(friend._id)) {
      toast.error(`${friend.username} is offline`, { detail: 'They need to be in the app to receive a challenge.' })
      return
    }
    challengeTarget = friend
    challengeStep = 'mode'
  }

  function challengeRivals() {
    if (!challengeTarget) return
    presence.sendChallenge(challengeTarget._id, 'rivals')
    toast.success(`Challenge sent to ${challengeTarget.username}`, { detail: 'Waiting for them to accept…' })
    challengeTarget = null
  }

  function goToCharacterPick() {
    try {
      myRoster = loadAllSlots().flatMap(s => s?.roster ?? [])
    } catch { myRoster = [] }
    challengeStep = 'character'
  }

  function challengeWithCharacter(char: StoryRosterEntry) {
    if (!challengeTarget) return
    presence.sendChallenge(challengeTarget._id, 'character', { name: char.name, spins: char.spins })
    toast.success(`Duel sent to ${challengeTarget.username}`, { detail: `${char.name} awaits their fighter…` })
    challengeTarget = null
  }

  // Surface outgoing challenge outcomes (declined / offline / expired) as toasts.
  $effect(() => {
    const o = presence.outgoing
    if (!o) return
    if (o.status === 'declined') toast.show('Challenge declined', 'info')
    else if (o.status === 'unavailable') toast.error('Friend went offline')
    else if (o.status === 'expired') toast.show('Challenge expired — no response', 'info')
    presence.clearOutgoing()
  })

  function rank(wins: number): string {
    if (wins >= 100) return 'Legend'
    if (wins >= 50) return 'Veteran'
    if (wins >= 20) return 'Challenger'
    if (wins >= 5) return 'Fighter'
    return 'Rookie'
  }
</script>

<main class="min-h-screen" style="background: transparent; color: #e9dfeb;">

  <!-- Nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14"
    style="background: rgba(22,18,26,0.92); border-bottom: 1px solid rgba(167,139,250,0.18); backdrop-filter: blur(16px);"
  >
    <div class="flex items-center" style="min-width: 80px;">
      <a href="/" class="flex items-center gap-1 transition-all active:scale-95"
        style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
        <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
        <span>Menu</span>
      </a>
    </div>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #a78bfa; font-size: 18px; font-variation-settings: 'FILL' 1;">group</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #c4b5fd; letter-spacing: 0.18em;">FRIENDS</span>
    </div>
    <a href="/leaderboard" style="min-width: 80px; text-align: right; text-decoration: none;">
      <span class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: #f0c040; font-size: 10px;">Leaderboard</span>
    </a>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto">

    {#if !auth.loggedIn && !auth.loading}
      <div class="text-center py-16">
        <p class="text-sm mb-4" style="color: #9a907b;">Login to manage friends.</p>
        <a href="/login" class="px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest"
          style="font-family: 'Cinzel', serif; color: #f0c040; background: rgba(240,192,64,0.1); border: 1px solid rgba(240,192,64,0.3); text-decoration: none;">
          Log In
        </a>
      </div>
    {:else}

      <!-- Add friend -->
      <div class="obsidian-slab mb-6 p-4 rounded-xl">
        <p class="text-xs tracking-widest uppercase mb-3" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Add Friend</p>
        <div class="flex gap-2">
          <input
            bind:value={addUsername}
            type="text"
            placeholder="Enter username…"
            onkeydown={(e) => e.key === 'Enter' && sendRequest()}
            class="carved-groove flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
            style="color: #e9dfeb; font-family: 'JetBrains Mono', monospace; font-size: 12px;"
          />
          <button
            onclick={sendRequest}
            disabled={addLoading}
            class="px-4 py-2.5 rounded-lg text-sm font-bold tracking-widest uppercase transition-all active:scale-95 disabled:opacity-50"
            style="font-family: 'Cinzel', serif; color: #c4b5fd; background: rgba(167,139,250,0.12); border: 1px solid rgba(167,139,250,0.3); cursor: pointer;"
          >
            {addLoading ? '…' : 'Add'}
          </button>
        </div>
        {#if addError}
          <p class="text-xs mt-2" style="font-family: 'JetBrains Mono', monospace; color: #f87171;">{addError}</p>
        {:else if addSuccess}
          <p class="text-xs mt-2" style="font-family: 'JetBrains Mono', monospace; color: #34d399;">Request sent!</p>
        {/if}
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-5 p-1 rounded-xl" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
        {#each [{ id: 'friends', label: 'Friends', count: friends.length }, { id: 'requests', label: 'Requests', count: requests.length }] as tab}
          <button
            onclick={() => activeTab = tab.id as 'friends' | 'requests'}
            class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
            style="font-family: 'Cinzel', serif; background: {activeTab === tab.id ? 'rgba(167,139,250,0.12)' : 'transparent'}; color: {activeTab === tab.id ? '#c4b5fd' : '#4e4635'}; border: {activeTab === tab.id ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent'}; cursor: pointer;"
          >
            {tab.label}
            {#if tab.count > 0}
              <span class="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                style="background: {tab.id === 'requests' ? '#f43f5e' : 'rgba(167,139,250,0.3)'}; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 9px;">
                {tab.count}
              </span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Friends list -->
      {#if activeTab === 'friends'}
        {#if loading}
          <div class="flex flex-col gap-3">
            {#each [1,2,3] as _}
              <div class="animate-pulse rounded-xl h-16" style="background: rgba(255,255,255,0.04);"></div>
            {/each}
          </div>
        {:else if friends.length === 0}
          <div class="text-center py-12 flex flex-col items-center gap-3">
            <span class="material-symbols-outlined text-4xl" style="color: #4e4635; font-variation-settings: 'FILL' 1;">group_off</span>
            <p style="font-family: 'Cinzel', serif; color: #9a907b;">No friends yet</p>
            <p class="text-xs" style="color: #4e4635;">Add someone by username above.</p>
          </div>
        {:else}
          <div class="flex flex-col gap-3">
            {#each friends as friend}
              {@const online = presence.isOnline(friend._id)}
              <div class="flex items-center gap-3 rounded-xl px-4 py-3" style="background: linear-gradient(145deg, #241f29 0%, #14111a 100%); border: 1px solid rgba(167,139,250,0.12);">
                <!-- Avatar + info → tap to open profile -->
                <a href="/users/{friend.username}" class="flex items-center gap-3 flex-1 min-w-0 transition-all active:scale-[0.98]"
                  style="text-decoration: none; color: inherit;" title="View {friend.username}'s profile">
                  <div class="relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style="background: rgba(167,139,250,0.15); color: #c4b5fd; font-family: 'Cinzel', serif;">
                    {friend.username[0].toUpperCase()}
                    <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
                      style="background: {online ? '#34d399' : '#4e4635'}; border: 2px solid #1e1a22; box-shadow: {online ? '0 0 6px rgba(52,211,153,0.7)' : 'none'};"
                      title={online ? 'Online' : 'Offline'}></span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-semibold truncate" style="font-family: 'Cinzel', serif; color: #e9dfeb; font-size: 0.9rem;">{friend.username}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: {online ? '#34d399' : '#7c6fa0'};">{online ? 'Online' : rank(friend.rivalsWins)}</span>
                      {#if friend.rivalsWins > 0}
                        <span class="flex items-center gap-0.5 text-xs" style="color: #f0c040;">
                          <span class="material-symbols-outlined" style="font-size: 11px; font-variation-settings: 'FILL' 1;">workspace_premium</span>
                          {friend.rivalsWins}W
                        </span>
                      {/if}
                    </div>
                  </div>
                </a>
                <!-- Actions -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    onclick={() => openChallenge(friend)}
                    class="p-2 rounded-lg transition-all active:scale-95"
                    style="color: #f43f5e; background: rgba(244,63,94,0.06); border: 1px solid rgba(244,63,94,0.2); cursor: pointer;"
                    title="Challenge"
                  >
                    <span class="material-symbols-outlined" style="font-size: 16px; font-variation-settings: 'FILL' 1;">swords</span>
                  </button>
                  <button
                    onclick={() => removeFriend(friend._id)}
                    disabled={removingId === friend._id}
                    class="p-2 rounded-lg transition-all active:scale-95 disabled:opacity-40"
                    style="color: #4e4635; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); cursor: pointer;"
                    title="Remove"
                  >
                    <span class="material-symbols-outlined" style="font-size: 16px;">person_remove</span>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

      <!-- Requests list -->
      {:else}
        {#if requests.length === 0}
          <div class="text-center py-12 flex flex-col items-center gap-3">
            <span class="material-symbols-outlined text-4xl" style="color: #4e4635; font-variation-settings: 'FILL' 1;">inbox</span>
            <p style="font-family: 'Cinzel', serif; color: #9a907b;">No pending requests</p>
          </div>
        {:else}
          <div class="flex flex-col gap-3">
            {#each requests as req}
              <div class="flex items-center gap-3 rounded-xl px-4 py-3" style="background: rgba(244,63,94,0.04); border: 1px solid rgba(244,63,94,0.2);">
                <a href="/users/{req.requester.username}" class="flex items-center gap-3 flex-1 min-w-0 transition-all active:scale-[0.98]"
                  style="text-decoration: none; color: inherit;" title="View {req.requester.username}'s profile">
                  <div class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style="background: rgba(244,63,94,0.12); color: #f87171; font-family: 'Cinzel', serif;">
                    {req.requester.username[0].toUpperCase()}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-semibold" style="font-family: 'Cinzel', serif; color: #e9dfeb; font-size: 0.9rem;">{req.requester.username}</p>
                    {#if req.requester.rivalsWins > 0}
                      <p class="text-xs flex items-center gap-1 mt-0.5" style="color: #f0c040;">
                        <span class="material-symbols-outlined" style="font-size: 11px; font-variation-settings: 'FILL' 1;">workspace_premium</span>
                        {req.requester.rivalsWins} wins
                      </p>
                    {/if}
                  </div>
                </a>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    onclick={() => acceptRequest(req.id)}
                    class="px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all active:scale-95"
                    style="font-family: 'Cinzel', serif; color: #34d399; background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.3); cursor: pointer;"
                  >
                    Accept
                  </button>
                  <button
                    onclick={() => declineRequest(req.id)}
                    class="p-1.5 rounded-lg transition-all active:scale-95"
                    style="color: #6b7280; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); cursor: pointer;"
                  >
                    <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}

    {/if}
  </div>

  <!-- ── Challenge modal ─────────────────────────────────────────────────── -->
  {#if challengeTarget}
    <div class="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style="background: rgba(7,7,13,0.9); backdrop-filter: blur(10px);">
      <div class="obsidian-slab w-full max-w-sm rounded-2xl p-6 relative"
        style="border: 1px solid rgba(244,63,94,0.35); box-shadow: 0 0 70px rgba(0,0,0,0.95);">
        <button onclick={() => challengeTarget = null}
          class="absolute top-3 right-3 p-1.5 rounded-lg" style="color: #6b7280; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); cursor: pointer;">
          <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
        </button>

        {#if challengeStep === 'mode'}
          <p class="text-center mb-1" style="font-family: 'Cinzel', serif; font-size: 1.05rem; font-weight: 800; color: #ffdf96;">Challenge {challengeTarget.username}</p>
          <p class="text-center text-xs mb-5" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Choose a battle format</p>
          <div class="flex flex-col gap-3">
            <button onclick={challengeRivals}
              class="text-left px-4 py-3 rounded-xl transition-all active:scale-[0.98]"
              style="background: rgba(52,211,153,0.07); border: 1px solid rgba(52,211,153,0.3); cursor: pointer;">
              <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: #34d399;">Rivals Battle</p>
              <p class="text-xs mt-0.5" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Both spin fresh characters, then fight.</p>
            </button>
            <button onclick={goToCharacterPick}
              class="text-left px-4 py-3 rounded-xl transition-all active:scale-[0.98]"
              style="background: rgba(249,168,212,0.07); border: 1px solid rgba(249,168,212,0.3); cursor: pointer;">
              <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: #f9a8d4;">Character Duel</p>
              <p class="text-xs mt-0.5" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Your character vs one they pick.</p>
            </button>
          </div>
        {:else}
          <button onclick={() => challengeStep = 'mode'} class="text-xs mb-3 block" style="color: #6b7280; font-family: 'JetBrains Mono', monospace; background: none; border: none; cursor: pointer;">← Back</button>
          <p class="text-center mb-3" style="font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 800; color: #f9a8d4;">Pick your fighter</p>
          {#if myRoster.length === 0}
            <p class="text-center text-xs py-6" style="font-family: 'JetBrains Mono', monospace; color: #f87171;">
              No Story Mode characters yet. Build one in Story Mode first.
            </p>
          {:else}
            <div class="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {#each myRoster as char}
                <button onclick={() => challengeWithCharacter(char)}
                  class="flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all active:scale-[0.98]"
                  style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); cursor: pointer;">
                  <div class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                    style="background: rgba(249,168,212,0.15); color: #f9a8d4; font-family: 'Cinzel', serif;">{char.overallTier}</div>
                  <div class="flex-1 min-w-0">
                    <p class="font-semibold truncate text-sm" style="font-family: 'Cinzel', serif; color: #e9dfeb;">{char.name}</p>
                    <p class="text-xs truncate" style="font-family: 'JetBrains Mono', monospace; color: #6b7280;">{char.race} · {char.archetype}</p>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</main>
