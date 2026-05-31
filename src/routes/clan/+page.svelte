<script lang="ts">
  import { apiUrl } from '$lib/api'
  import { onMount, onDestroy, tick } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth.svelte'
  import { toast } from '$lib/toast.svelte'

  type ClanRole = 'leader' | 'coLeader' | 'elder' | 'member' | 'none'
  type ClanMember = { _id: string; username: string; rivalsWins: number; gamesPlayed?: number; role: ClanRole }
  type JoinRequest = { userId: string; username: string; rivalsWins: number; requestedAt: string }
  type ClanMessage = { _id?: string; authorId: string; authorUsername: string; text: string; sentAt: string; kind?: 'chat' | 'system' }
  type BrowseClan = {
    _id: string; name: string; tag: string; description: string; motd: string; badge: string
    joinType: 'open' | 'invite' | 'closed'; minWinsRequired: number; maxMembers: number
    memberCount: number; level: number; clanXp: number; totalWins?: number
  }
  type MyClan = BrowseClan & { members: ClanMember[]; role: ClanRole; joinRequests: JoinRequest[]; leaderId: string }

  // ── State ──────────────────────────────────────────────────────────────────
  let view = $state<'mine' | 'browse' | 'create' | 'leaderboard' | 'requests' | 'settings' | 'chat' | 'topChars'>('mine')

  // Top Characters tab — top 10 across all current clan members.
  type TopChar = {
    shareId: string; name: string; race: string; archetype: string
    overall_score: number; overall_tier: string; rivals_wins: number
    ownerId: string; ownerUsername: string
  }
  let topChars = $state<TopChar[]>([])
  let topCharsLoading = $state(false)
  async function loadTopCharacters() {
    if (!myClan) return
    topCharsLoading = true
    try {
      const res = await fetch(apiUrl(`/api/clans/${myClan._id}/top-characters`), { credentials: 'include' })
      if (res.ok) {
        const d = await res.json()
        topChars = d.characters ?? []
      } else {
        topChars = []
      }
    } catch { topChars = [] }
    finally { topCharsLoading = false }
  }

  // Chat state
  let chatMessages = $state<ClanMessage[]>([])
  let chatInput    = $state('')
  let chatSending  = $state(false)
  let chatLoading  = $state(false)
  let chatEl: HTMLDivElement | null = $state(null)
  let chatPoll: ReturnType<typeof setInterval> | null = null
  let myClan = $state<MyClan | null>(null)
  let clans = $state<BrowseClan[]>([])
  let leaderboard = $state<BrowseClan[]>([])
  let loading = $state(true)
  let actionPending = $state<string | null>(null)

  // Browse filters
  let search = $state('')
  let joinTypeFilter = $state<'any' | 'open' | 'invite' | 'closed'>('any')

  // Create form
  let createName = $state('')
  let createTag = $state('')
  let createDesc = $state('')
  let createMotd = $state('')
  let createBadge = $state('⚔')
  let createJoinType = $state<'open' | 'invite' | 'closed'>('open')
  let createMinWins = $state(0)
  let createError = $state<string | null>(null)
  let creating = $state(false)

  // Settings form (mirrors myClan but locally editable)
  let settingsDesc = $state('')
  let settingsMotd = $state('')
  let settingsBadge = $state('⚔')
  let settingsJoinType = $state<'open' | 'invite' | 'closed'>('open')
  let settingsMinWins = $state(0)

  let leaveConfirm = $state(false)
  let disbandConfirm = $state(false)

  const BADGE_CHOICES = ['⚔', '🛡', '🐉', '🔥', '⚡', '🌙', '✨', '👑', '🦅', '🐺', '💀', '⚓']

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(async () => {
    await loadMyClan()
    loading = false
    if (auth.loggedIn) {
      fetch(apiUrl('/api/challenges/progress'), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'clan_visit' }),
      }).catch(() => {})
    }
  })

  // ── Data loaders ───────────────────────────────────────────────────────────
  async function loadMyClan() {
    if (!auth.loggedIn) return
    const res = await fetch(apiUrl('/api/clans/mine'), { credentials: 'include' })
    if (res.ok) {
      const d = await res.json()
      myClan = d.clan
      if (myClan) {
        settingsDesc = myClan.description
        settingsMotd = myClan.motd
        settingsBadge = myClan.badge || '⚔'
        settingsJoinType = myClan.joinType
        settingsMinWins = myClan.minWinsRequired
      }
    }
  }

  async function browseClans() {
    view = 'browse'
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (joinTypeFilter !== 'any') params.set('joinType', joinTypeFilter)
    const res = await fetch(apiUrl(`/api/clans?${params}`))
    if (res.ok) clans = (await res.json()).clans ?? []
  }

  async function loadLeaderboard() {
    view = 'leaderboard'
    if (leaderboard.length) return
    const res = await fetch(apiUrl('/api/clans/leaderboard'))
    if (res.ok) leaderboard = (await res.json()).clans ?? []
  }

  // Toast helper — delegates to the global toast store so messages get the
  // same visual treatment as the rest of the app.
  function showToast(kind: 'ok' | 'err', message: string) {
    if (kind === 'ok') toast.success(message)
    else toast.error(message)
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function createClan() {
    if (creating) return
    creating = true
    createError = null
    const res = await fetch(apiUrl('/api/clans'), {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createName, tag: createTag, description: createDesc, motd: createMotd,
        badge: createBadge, joinType: createJoinType, minWinsRequired: createMinWins,
      }),
    })
    const data = await res.json()
    if (!res.ok) { createError = data.error ?? 'Failed'; creating = false; return }
    await loadMyClan()
    view = 'mine'
    creating = false
    showToast('ok', 'Clan founded')
  }

  async function joinClan(c: BrowseClan) {
    actionPending = c._id
    const endpoint = c.joinType === 'invite' ? `/api/clans/${c._id}/request` : `/api/clans/${c._id}/join`
    const res = await fetch(endpoint, { method: 'POST', credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    actionPending = null
    if (!res.ok) { showToast('err', data.error ?? 'Failed'); return }
    if (c.joinType === 'invite') {
      showToast('ok', 'Join request sent')
    } else {
      await loadMyClan(); view = 'mine'; showToast('ok', `Joined ${c.name}`)
    }
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  async function loadChat() {
    if (!myClan) return
    chatLoading = true
    try {
      const res = await fetch(apiUrl(`/api/clans/${myClan._id}/messages`), { credentials: 'include' })
      if (res.ok) {
        const d = await res.json()
        chatMessages = d.messages ?? []
        await tick()
        if (chatEl) chatEl.scrollTop = chatEl.scrollHeight
      }
    } finally { chatLoading = false }
  }
  async function sendChat() {
    if (!myClan || !chatInput.trim() || chatSending) return
    chatSending = true
    const text = chatInput.trim().slice(0, 240)
    try {
      const res = await fetch(apiUrl(`/api/clans/${myClan._id}/messages`), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        chatInput = ''
        await loadChat()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? 'Could not send message')
      }
    } finally { chatSending = false }
  }
  function openChat() {
    view = 'chat'
    loadChat()
    // Poll every 8s while the chat is open — light enough not to hammer the
    // server, fast enough to feel like a message wall. Stops on view change.
    if (chatPoll) clearInterval(chatPoll)
    chatPoll = setInterval(loadChat, 8000)
  }
  $effect(() => {
    if (view !== 'chat' && chatPoll) { clearInterval(chatPoll); chatPoll = null }
  })
  onDestroy(() => { if (chatPoll) clearInterval(chatPoll) })

  // Challenge a clan member — creates a Rivals room and auto-posts the join
  // code to clan chat as a system message so other members can drop in.
  async function challengeMember(memberId: string, memberName: string) {
    if (!myClan) return
    // Open Rivals page with a flag — the rivals page will create-room +
    // post the code back to clan chat once the room exists.
    try {
      sessionStorage.setItem('wof_clan_challenge', JSON.stringify({
        clanId: myClan._id,
        targetUsername: memberName,
      }))
    } catch { /* ignore */ }
    toast.success(`Challenging ${memberName}…`, { detail: 'Share the room code in chat once it appears.' })
    goto('/rivals?challenge=create')
  }

  async function leaveClan() {
    if (!myClan) return
    const res = await fetch(apiUrl(`/api/clans/${myClan._id}/leave`), { method: 'DELETE', credentials: 'include' })
    if (res.ok) { myClan = null; leaveConfirm = false; showToast('ok', 'Left clan') }
    else { const d = await res.json(); showToast('err', d.error ?? 'Failed') }
  }

  async function disbandClan() {
    if (!myClan) return
    const res = await fetch(apiUrl(`/api/clans/${myClan._id}`), { method: 'DELETE', credentials: 'include' })
    if (res.ok) { myClan = null; disbandConfirm = false; showToast('ok', 'Clan disbanded') }
    else { const d = await res.json(); showToast('err', d.error ?? 'Failed') }
  }

  async function memberAction(action: 'promote' | 'demote' | 'kick', userId: string) {
    if (!myClan) return
    actionPending = `${action}-${userId}`
    const res = await fetch(apiUrl(`/api/clans/${myClan._id}/${action}/${userId}`), { method: 'POST', credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    actionPending = null
    if (!res.ok) { showToast('err', data.error ?? `${action} failed`); return }
    showToast('ok', `${action}d`)
    await loadMyClan()
  }

  async function transferLeadership(userId: string) {
    if (!myClan) return
    if (!confirm('Transfer leadership? You become co-leader.')) return
    actionPending = `transfer-${userId}`
    const res = await fetch(apiUrl(`/api/clans/${myClan._id}/transfer/${userId}`), { method: 'POST', credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    actionPending = null
    if (!res.ok) { showToast('err', data.error ?? 'Transfer failed'); return }
    showToast('ok', 'Leadership transferred')
    await loadMyClan()
  }

  async function respondRequest(userId: string, action: 'accept' | 'decline') {
    if (!myClan) return
    actionPending = `req-${action}-${userId}`
    const res = await fetch(apiUrl(`/api/clans/${myClan._id}/requests/${userId}/${action}`), { method: 'POST', credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    actionPending = null
    if (!res.ok) { showToast('err', data.error ?? `${action} failed`); return }
    showToast('ok', action === 'accept' ? 'Request accepted' : 'Declined')
    await loadMyClan()
  }

  async function saveSettings() {
    if (!myClan) return
    actionPending = 'settings'
    const res = await fetch(apiUrl(`/api/clans/${myClan._id}`), {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: settingsDesc, motd: settingsMotd, badge: settingsBadge,
        joinType: settingsJoinType, minWinsRequired: settingsMinWins,
      }),
    })
    actionPending = null
    if (!res.ok) { const d = await res.json(); showToast('err', d.error ?? 'Save failed'); return }
    showToast('ok', 'Saved')
    view = 'mine'
    await loadMyClan()
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  let canEdit = $derived(myClan?.role === 'leader' || myClan?.role === 'coLeader')
  // Join-request inbox is now restricted to leader + co-leader (matches the
  // server's new gating in clans.ts — elders no longer gatekeep membership).
  let canSeeRequests = $derived(myClan?.role === 'leader' || myClan?.role === 'coLeader')
  let canManageMembers = $derived(myClan?.role === 'leader' || myClan?.role === 'coLeader' || myClan?.role === 'elder')
  let isLeader = $derived(myClan?.role === 'leader')

  // Per-action permission helpers — actor (myClan.role) acts on target (m.role).
  // Promote ceiling: the resulting tier cannot exceed the actor's own rank.
  //   member → elder    (anyone elder+)
  //   elder  → coLeader (coLeader or leader only)
  //   coLeader → leader (transfer flow, separate from promote)
  // Demote: actor must outrank target.
  // Kick: actor must outrank target.
  const RANK: Record<ClanRole, number> = { none: 0, member: 1, elder: 2, coLeader: 3, leader: 4 }
  function canPromote(target: ClanRole): boolean {
    const me = myClan?.role
    if (!me) return false
    const newTier: ClanRole | null =
      target === 'member' ? 'elder' :
      target === 'elder'  ? 'coLeader' : null
    if (!newTier) return false
    if (RANK[me] < 2) return false              // must be elder+ to promote
    if (RANK[me] <= RANK[target]) return false  // can't act on equal-or-higher
    if (RANK[newTier] > RANK[me]) return false  // promotion ceiling
    return true
  }
  function canDemote(target: ClanRole): boolean {
    const me = myClan?.role
    if (!me) return false
    if (RANK[me] < 2) return false
    if (RANK[me] <= RANK[target]) return false
    if (target === 'member') return false       // members can't be demoted
    return true
  }
  function canKick(target: ClanRole): boolean {
    const me = myClan?.role
    if (!me) return false
    if (RANK[me] < 2) return false
    return RANK[me] > RANK[target]
  }

  // Role badge styles
  const ROLE_META: Record<ClanRole, { label: string; color: string; icon: string }> = {
    leader:   { label: 'Leader',    color: '#f0c040', icon: 'workspace_premium' },
    coLeader: { label: 'Co-Leader', color: '#a78bfa', icon: 'military_tech' },
    elder:    { label: 'Elder',     color: '#5ad6ef', icon: 'shield' },
    member:   { label: 'Member',    color: '#9a907b', icon: 'person' },
    none:     { label: '—',         color: '#4e4635', icon: 'person' },
  }

  const JOIN_META: Record<string, { label: string; icon: string; color: string }> = {
    open:   { label: 'Open',         icon: 'lock_open',   color: '#34d399' },
    invite: { label: 'Invite Only',  icon: 'mail',        color: '#f0c040' },
    closed: { label: 'Closed',       icon: 'lock',        color: '#9a907b' },
  }

  function relTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime()
    const m = Math.floor(ms / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }
</script>

<main class="min-h-screen" style="background: transparent; color: #e9dfeb;">
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14" style="background: rgba(22,18,26,0.92); border-bottom: 2px solid rgba(240,192,82,0.45); backdrop-filter: blur(16px); box-shadow: 0 4px 20px rgba(90,214,239,0.12);">
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

    <!-- Toast — now rendered globally by <Toaster /> in +layout.svelte. -->

    <!-- Tab bar -->
    <div class="flex gap-1.5 mb-5">
      <button onclick={() => { view = 'mine'; loadMyClan() }} data-fx="big" class="flex-1 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest" style="background: {view === 'mine' ? 'rgba(240,192,64,0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid {view === 'mine' ? 'rgba(240,192,64,0.35)' : 'rgba(255,255,255,0.06)'}; color: {view === 'mine' ? '#f0c040' : '#9a907b'};">My Clan</button>
      <button onclick={browseClans} data-fx="big" class="flex-1 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest" style="background: {view === 'browse' ? 'rgba(90,214,239,0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid {view === 'browse' ? 'rgba(90,214,239,0.35)' : 'rgba(255,255,255,0.06)'}; color: {view === 'browse' ? '#5ad6ef' : '#9a907b'};">Browse</button>
      <button onclick={loadLeaderboard} data-fx="big" class="flex-1 py-2 rounded-lg font-mono text-[10px] font-bold uppercase tracking-widest" style="background: {view === 'leaderboard' ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid {view === 'leaderboard' ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.06)'}; color: {view === 'leaderboard' ? '#a78bfa' : '#9a907b'};">Top</button>
    </div>

    {#if !auth.loggedIn}
      <div class="rounded-xl px-5 py-8 text-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
        <p style="color: #9a907b;"><a href="/login" style="color: #f0c040; text-decoration: underline;">Log in</a> to join or create a clan.</p>
      </div>

    {:else if view === 'mine'}
      {#if loading}
        <div class="animate-pulse rounded-2xl h-48" style="background: rgba(255,255,255,0.04);"></div>
      {:else if myClan}
        <!-- Clan home -->
        <div class="rounded-2xl px-5 py-5 mb-4" style="background: linear-gradient(135deg, rgba(240,192,64,0.08), rgba(240,192,64,0.03)); border: 1px solid rgba(240,192,64,0.3);">
          <div class="flex items-start gap-3 mb-3">
            <div class="shrink-0 flex items-center justify-center rounded-xl" style="width: 56px; height: 56px; background: linear-gradient(135deg, rgba(240,192,64,0.15), rgba(240,192,64,0.05)); border: 1px solid rgba(240,192,64,0.3); font-size: 28px;">{myClan.badge || '⚔'}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono font-black px-2 py-0.5 rounded text-xs" style="background: rgba(240,192,64,0.15); border: 1px solid rgba(240,192,64,0.3); color: #f0c040;">[{myClan.tag}]</span>
                <h2 style="font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700; color: #ffdf96;">{myClan.name}</h2>
              </div>
              <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                <span class="font-mono text-[10px] px-1.5 py-0.5 rounded" style="background: {JOIN_META[myClan.joinType].color}22; border: 1px solid {JOIN_META[myClan.joinType].color}44; color: {JOIN_META[myClan.joinType].color};">{JOIN_META[myClan.joinType].label}</span>
                <span class="font-mono text-[10px]" style="color: #9a907b;">Lv {myClan.level}</span>
                <span class="font-mono text-[10px]" style="color: #9a907b;">{myClan.memberCount}/{myClan.maxMembers}</span>
                {#if myClan.minWinsRequired > 0}
                  <span class="font-mono text-[10px]" style="color: #9a907b;">≥ {myClan.minWinsRequired} wins</span>
                {/if}
              </div>
            </div>
          </div>

          {#if myClan.motd}
            <div class="rounded-lg px-3 py-2 mb-3" style="background: rgba(0,0,0,0.25); border-left: 2px solid #f0c040;">
              <p class="text-xs" style="color: #ffdf96; font-style: italic;">"{myClan.motd}"</p>
            </div>
          {/if}
          {#if myClan.description}
            <p class="text-xs mb-3" style="color: #9a907b; line-height: 1.5;">{myClan.description}</p>
          {/if}

          <!-- Your role banner -->
          <div class="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style="background: rgba(0,0,0,0.2); border: 1px solid {ROLE_META[myClan.role].color}33;">
            <span class="material-symbols-outlined" style="font-size: 16px; color: {ROLE_META[myClan.role].color}; font-variation-settings: 'FILL' 1;">{ROLE_META[myClan.role].icon}</span>
            <span class="font-mono text-xs" style="color: #9a907b;">Your role:</span>
            <span class="font-mono text-xs font-bold" style="color: {ROLE_META[myClan.role].color};">{ROLE_META[myClan.role].label}</span>
          </div>

          <!-- Action row: chat / settings / requests -->
          <div class="flex gap-2 mb-3 flex-wrap">
            <button onclick={openChat} data-fx="big" class="text-xs px-3 py-1.5 rounded-lg font-mono font-bold" style="background: rgba(52,211,153,0.10); border: 1px solid rgba(52,211,153,0.30); color: #34d399;">
              <span class="material-symbols-outlined" style="font-size: 13px; vertical-align: -2px;">chat</span>
              Chat
            </button>
            {#if canEdit}
              <button onclick={() => view = 'settings'} data-fx="big" class="text-xs px-3 py-1.5 rounded-lg font-mono font-bold" style="background: rgba(167,139,250,0.10); border: 1px solid rgba(167,139,250,0.30); color: #a78bfa;">
                <span class="material-symbols-outlined" style="font-size: 13px; vertical-align: -2px;">tune</span>
                Settings
              </button>
            {/if}
            {#if canSeeRequests && myClan.joinType === 'invite' && myClan.joinRequests.length > 0}
              <button onclick={() => view = 'requests'} data-fx="big" class="text-xs px-3 py-1.5 rounded-lg font-mono font-bold relative" style="background: rgba(90,214,239,0.10); border: 1px solid rgba(90,214,239,0.30); color: #5ad6ef;">
                <span class="material-symbols-outlined" style="font-size: 13px; vertical-align: -2px;">mail</span>
                Pending Requests
                <span class="absolute -top-1 -right-1 px-1.5 rounded-full text-[9px] font-bold" style="background: #f0c040; color: #1a0e00;">{myClan.joinRequests.length}</span>
              </button>
            {/if}
            <!-- Top Characters tab — visible to every member. -->
            <button onclick={() => { view = 'topChars'; loadTopCharacters() }} data-fx="big" class="text-xs px-3 py-1.5 rounded-lg font-mono font-bold" style="background: rgba(240,192,64,0.10); border: 1px solid rgba(240,192,64,0.30); color: #f0c040;">
              <span class="material-symbols-outlined" style="font-size: 13px; vertical-align: -2px;">workspace_premium</span>
              Top Characters
            </button>
          </div>

          <!-- Member list -->
          <div class="flex flex-col gap-1.5 mb-4">
            {#each myClan.members as m}
              {@const meta = ROLE_META[m.role]}
              <div class="flex items-center gap-2 px-3 py-2 rounded-lg" style="background: rgba(255,255,255,0.03); border: 1px solid {meta.color}1a;">
                <span class="material-symbols-outlined" style="font-size: 14px; color: {meta.color}; font-variation-settings: 'FILL' 1;">{meta.icon}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <!-- Member name links to their public profile (helps team-up
                         decisions before challenging). -->
                    <a href={`/users/${encodeURIComponent(m.username)}`}
                      class="font-mono text-xs truncate"
                      style="color: #e9dfeb; text-decoration: none;"
                      onclick={(e) => e.stopPropagation()}>{m.username}</a>
                    <span class="font-mono text-[9px] px-1 rounded" style="background: {meta.color}1f; color: {meta.color};">{meta.label}</span>
                  </div>
                  <span class="font-mono text-[10px]" style="color: #4e4635;">{m.rivalsWins}W</span>
                </div>
                <!-- Action buttons row — Challenge always shown (if not self),
                     management buttons gated on role. -->
                {#if m._id !== auth.user?.id}
                  <div class="flex gap-1">
                    <!-- Challenge: opens Rivals page in create-room mode. The
                         player then shares the room code with the target via
                         clan chat. -->
                    <button onclick={() => challengeMember(m._id, m.username)}
                      data-fx="big"
                      class="text-[10px] px-2 py-1 rounded font-mono font-bold"
                      style="background: rgba(244,113,113,0.10); border: 1px solid rgba(244,113,113,0.32); color: #f87171;"
                      title="Challenge {m.username} to a Rivals battle">
                      ⚔
                    </button>
                    <!-- Transfer leadership: leader-only and target must be co-leader.
                         Promote / Demote / Kick driven by per-target helpers so any
                         role with the necessary permission sees the button. -->
                    {#if isLeader && m.role === 'coLeader'}
                      <button onclick={() => transferLeadership(m._id)} disabled={actionPending !== null} class="text-[10px] px-2 py-1 rounded font-mono" style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.25); color: #f0c040;" title="Transfer leadership">👑</button>
                    {/if}
                    {#if canPromote(m.role)}
                      <button onclick={() => memberAction('promote', m._id)} disabled={actionPending !== null} class="text-[10px] px-2 py-1 rounded font-mono" style="background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.25); color: #34d399;" title="Promote">↑</button>
                    {/if}
                    {#if canDemote(m.role)}
                      <button onclick={() => memberAction('demote', m._id)} disabled={actionPending !== null} class="text-[10px] px-2 py-1 rounded font-mono" style="background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.25); color: #a78bfa;" title="Demote">↓</button>
                    {/if}
                    {#if canKick(m.role)}
                      <button onclick={() => memberAction('kick', m._id)} disabled={actionPending !== null} class="text-[10px] px-2 py-1 rounded font-mono" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #f87171;" title="Kick">×</button>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          <!-- Leave / Disband -->
          {#if isLeader && myClan.memberCount > 1}
            {#if !disbandConfirm}
              <div class="flex gap-2">
                <button onclick={() => leaveConfirm = true} class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171;">Leave Clan</button>
                <button onclick={() => disbandConfirm = true} class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.28); color: #f87171;">Disband</button>
              </div>
            {:else}
              <div class="flex gap-2">
                <button onclick={disbandClan} class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(239,68,68,0.18); border: 1px solid rgba(239,68,68,0.35); color: #f87171;">⚠ Confirm Disband</button>
                <button onclick={() => disbandConfirm = false} class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #9a907b;">Cancel</button>
              </div>
            {/if}
          {:else if !leaveConfirm}
            <button onclick={() => leaveConfirm = true} class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171;">Leave Clan</button>
          {:else}
            <div class="flex gap-2">
              <button onclick={leaveClan} class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171;">Confirm Leave</button>
              <button onclick={() => leaveConfirm = false} class="font-mono text-xs px-3 py-1.5 rounded-lg" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #9a907b;">Cancel</button>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Not in a clan: create / browse CTAs -->
        <div class="text-center py-8 mb-6">
          <span class="material-symbols-outlined text-5xl mb-3 block" style="color: #4e4635; font-variation-settings: 'FILL' 1;">shield</span>
          <p style="font-family: 'Cinzel', serif; color: #9a907b; margin-bottom: 8px;">You are not in a clan.</p>
          <div class="flex gap-3 justify-center mt-4">
            <button onclick={() => view = 'create'} data-fx="big" class="px-5 py-2.5 rounded-lg font-bold text-sm" style="font-family: 'Cinzel', serif; background: rgba(240,192,64,0.12); border: 1px solid rgba(240,192,64,0.3); color: #f0c040;">Create Clan</button>
            <button onclick={browseClans} data-fx="big" class="px-5 py-2.5 rounded-lg font-bold text-sm" style="font-family: 'Cinzel', serif; background: rgba(90,214,239,0.08); border: 1px solid rgba(90,214,239,0.2); color: #5ad6ef;">Browse Clans</button>
          </div>
        </div>
      {/if}

    {:else if view === 'create'}
      <div class="rounded-2xl px-5 py-5" style="background: linear-gradient(180deg, #13121c, #1e1a22); border: 1px solid rgba(78,70,53,0.35);">
        <h2 class="mb-5" style="font-family: 'Cinzel', serif; font-size: 1.1rem; color: #ffdf96;">Found a Clan</h2>
        {#if createError}
          <p class="text-xs mb-3 px-3 py-2 rounded-lg" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171;">{createError}</p>
        {/if}
        <div class="flex flex-col gap-3">
          <div>
            <label for="cl-name" class="font-mono text-xs block mb-1" style="color: #9a907b;">Clan Name (3–32 chars)</label>
            <input id="cl-name" bind:value={createName} maxlength={32} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none;" placeholder="The Chosen Few" />
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label for="cl-tag" class="font-mono text-xs block mb-1" style="color: #9a907b;">Tag (2–5 chars)</label>
              <input id="cl-tag" bind:value={createTag} maxlength={5} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm uppercase" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none;" placeholder="TCF" />
            </div>
            <div>
              <label for="cl-badge" class="font-mono text-xs block mb-1" style="color: #9a907b;">Badge</label>
              <div id="cl-badge" class="flex flex-wrap gap-1.5 max-w-[200px]">
                {#each BADGE_CHOICES as b}
                  <button type="button" onclick={() => createBadge = b}
                    class="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                    style="background: {createBadge === b ? 'rgba(240,192,64,0.20)' : 'rgba(255,255,255,0.04)'}; border: 1px solid {createBadge === b ? 'rgba(240,192,64,0.50)' : 'rgba(255,255,255,0.08)'};">{b}</button>
                {/each}
              </div>
            </div>
          </div>
          <div>
            <label for="cl-motd" class="font-mono text-xs block mb-1" style="color: #9a907b;">Motto / MOTD (optional, 80 chars)</label>
            <input id="cl-motd" bind:value={createMotd} maxlength={80} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none;" placeholder="We spin. We win." />
          </div>
          <div>
            <label for="cl-desc" class="font-mono text-xs block mb-1" style="color: #9a907b;">Description (optional, 200 chars)</label>
            <textarea id="cl-desc" bind:value={createDesc} maxlength={200} rows={2} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none; resize: none;" placeholder="Long-form clan blurb…"></textarea>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label for="cl-jt" class="font-mono text-xs block mb-1" style="color: #9a907b;">Join Type</label>
              <select id="cl-jt" bind:value={createJoinType} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none;">
                <option value="open">Open — anyone qualified can join</option>
                <option value="invite">Invite Only — approve requests</option>
                <option value="closed">Closed — no new members</option>
              </select>
            </div>
            <div>
              <label for="cl-mw" class="font-mono text-xs block mb-1" style="color: #9a907b;">Min Wins</label>
              <input id="cl-mw" type="number" bind:value={createMinWins} min={0} max={9999} class="w-24 px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none;" />
            </div>
          </div>
          <div class="flex gap-3 mt-2">
            <button onclick={createClan} disabled={creating || !createName || !createTag} data-fx="big" class="flex-1 py-3 rounded-lg font-bold text-sm disabled:opacity-40" style="font-family: 'Cinzel', serif; background: rgba(240,192,64,0.15); border: 1px solid rgba(240,192,64,0.35); color: #f0c040;">{creating ? 'Founding…' : 'Found Clan'}</button>
            <button onclick={() => view = 'mine'} class="px-4 py-3 rounded-lg font-mono text-xs" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #9a907b;">Cancel</button>
          </div>
        </div>
      </div>

    {:else if view === 'browse'}
      <!-- Filters -->
      <div class="flex flex-col gap-2 mb-4">
        <div class="flex gap-2">
          <input bind:value={search} onkeydown={(e) => e.key === 'Enter' && browseClans()} class="flex-1 px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none;" placeholder="Search clans..." />
          <button onclick={browseClans} data-fx="big" class="px-4 py-2.5 rounded-lg font-mono text-xs font-bold" style="background: rgba(90,214,239,0.12); border: 1px solid rgba(90,214,239,0.25); color: #5ad6ef;">Search</button>
        </div>
        <div class="flex gap-1.5">
          {#each ['any', 'open', 'invite', 'closed'] as jt}
            <button onclick={() => { joinTypeFilter = jt as any; browseClans() }}
              class="flex-1 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider"
              style="background: {joinTypeFilter === jt ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)'}; border: 1px solid {joinTypeFilter === jt ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.06)'}; color: {joinTypeFilter === jt ? '#a78bfa' : '#9a907b'};">
              {jt === 'any' ? 'All' : JOIN_META[jt].label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Clan list -->
      <div class="flex flex-col gap-2">
        {#each clans as clan}
          {@const jt = JOIN_META[clan.joinType]}
          <!-- Clan tile is now a link to /clans/[id]. Join action moved to
               the public clan page so the click intent stays predictable. -->
          <a href={`/clans/${clan._id}`} data-fx="big"
            class="rounded-xl px-3 py-3 flex items-center gap-3 transition-all active:scale-98"
            style="background: linear-gradient(180deg, #13121c, #1e1a22); border: 1px solid rgba(78,70,53,0.3); text-decoration: none;">
            <div class="shrink-0 flex items-center justify-center rounded-lg" style="width: 38px; height: 38px; background: linear-gradient(135deg, rgba(240,192,64,0.10), rgba(240,192,64,0.03)); border: 1px solid rgba(240,192,64,0.18); font-size: 18px;">{clan.badge || '⚔'}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-mono font-black text-[10px] px-1.5 py-0.5 rounded" style="background: rgba(240,192,64,0.10); border: 1px solid rgba(240,192,64,0.20); color: #f0c040;">[{clan.tag}]</span>
                <p class="font-semibold text-sm truncate" style="font-family: 'Cinzel', serif; color: #e9dfeb;">{clan.name}</p>
              </div>
              <div class="flex gap-2 items-center mt-1 flex-wrap">
                <span class="font-mono text-[10px]" style="color: #4e4635;">Lv {clan.level} · {clan.memberCount}/{clan.maxMembers}</span>
                <span class="font-mono text-[10px]" style="color: {jt.color};">{jt.label}</span>
                {#if clan.minWinsRequired > 0}
                  <span class="font-mono text-[10px]" style="color: #9a907b;">≥{clan.minWinsRequired}W</span>
                {/if}
              </div>
            </div>
            <span class="material-symbols-outlined shrink-0" style="font-size: 18px; color: #4e4635;">chevron_right</span>
          </a>
        {:else}
          <p class="text-center py-8 font-mono text-xs" style="color: #4e4635;">No clans found.</p>
        {/each}
      </div>

    {:else if view === 'leaderboard'}
      <div class="flex flex-col gap-2">
        {#each leaderboard as clan, i}
          <!-- Leaderboard tile → public clan page. -->
          <a href={`/clans/${clan._id}`} data-fx="big"
            class="flex items-center gap-3 rounded-xl px-3 py-3 transition-all active:scale-98"
            style="background: linear-gradient(145deg, #241f29 0%, #14111a 100%); border: 1px solid rgba(167,139,250,0.1); text-decoration: none;">
            <div class="shrink-0 w-8 flex items-center justify-center">
              {#if i < 3}<span style="font-size: 1.2rem;">{['🥇','🥈','🥉'][i]}</span>{:else}<span style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #4e4635; font-weight: 700;">#{i+1}</span>{/if}
            </div>
            <div class="shrink-0 flex items-center justify-center rounded-lg" style="width: 34px; height: 34px; background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.18); font-size: 16px;">{clan.badge || '⚔'}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style="background: rgba(167,139,250,0.12); border: 1px solid rgba(167,139,250,0.2); color: #a78bfa;">[{clan.tag}]</span>
                <p class="font-semibold text-sm truncate" style="font-family: 'Cinzel', serif; color: #e9dfeb;">{clan.name}</p>
              </div>
              <p class="font-mono text-[10px] mt-0.5" style="color: #4e4635;">Lv {clan.level} · {clan.memberCount} members</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-black" style="font-family: 'JetBrains Mono', monospace; font-size: 1rem; color: #a78bfa;">{clan.totalWins}</p>
              <p class="font-mono text-[10px]" style="color: #4e4635;">total wins</p>
            </div>
          </a>
        {:else}
          <p class="text-center py-10 font-mono text-xs" style="color: #4e4635;">No clans yet. Be the first!</p>
        {/each}
      </div>

    {:else if view === 'chat' && myClan}
      <!-- Clan chat — embedded message wall, polls every 8s while open. -->
      <button onclick={() => view = 'mine'} class="mb-4 font-mono text-xs" style="color: #9a907b; background: none; border: none; cursor: pointer;">← Back to clan</button>
      <div class="flex items-center gap-2 mb-3">
        <span class="material-symbols-outlined" style="font-size: 18px; color: #34d399; font-variation-settings: 'FILL' 1;">chat</span>
        <h2 style="font-family: 'Cinzel', serif; font-size: 1.05rem; color: #ffdf96;">[{myClan.tag}] Chat</h2>
        {#if chatLoading}<span class="font-mono text-[10px]" style="color: #4e4635;">syncing…</span>{/if}
      </div>
      <div bind:this={chatEl} class="rounded-xl px-4 py-3 mb-3" style="background: #1e1a22; border: 1px solid rgba(52,211,153,0.18); height: 52vh; max-height: 480px; overflow-y: auto; box-shadow: inset 0 2px 12px rgba(0,0,0,0.55);">
        {#if chatMessages.length === 0}
          <p class="text-sm text-center py-8" style="color: #4e4635; font-style: italic;">No messages yet. Say hello.</p>
        {/if}
        {#each chatMessages as msg, i}
          {@const isSelf = msg.authorId === auth.user?.id}
          {@const isSystem = msg.kind === 'system'}
          {@const dt = new Date(msg.sentAt)}
          {@const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {@const prevAuthor = i > 0 ? chatMessages[i - 1].authorId : null}
          {@const showAuthor = prevAuthor !== msg.authorId || isSystem}
          {#if isSystem}
            <div class="flex justify-center my-2">
              <p class="font-mono text-[10px] px-3 py-1 rounded-full" style="background: rgba(240,192,64,0.10); border: 1px solid rgba(240,192,64,0.25); color: #f0c040;">{msg.text}</p>
            </div>
          {:else}
            <div class="mb-1 flex flex-col" style="align-items: {isSelf ? 'flex-end' : 'flex-start'};">
              {#if showAuthor}
                <p class="font-mono text-[10px] mb-0.5" style="color: {isSelf ? '#a78bfa' : '#5ad6ef'};">
                  {msg.authorUsername} <span style="color: #4e4635;">· {time}</span>
                </p>
              {/if}
              <p class="rounded-2xl px-3 py-1.5 text-xs max-w-[80%] break-words"
                style="background: {isSelf ? 'rgba(167,139,250,0.10)' : 'rgba(90,214,239,0.08)'}; border: 1px solid {isSelf ? 'rgba(167,139,250,0.25)' : 'rgba(90,214,239,0.2)'}; color: #e9dfeb;">
                {msg.text}
              </p>
            </div>
          {/if}
        {/each}
      </div>
      <div class="flex gap-2">
        <input
          bind:value={chatInput}
          onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
          maxlength={240}
          placeholder="Message your clan…"
          class="flex-1 px-3 py-2.5 rounded-lg font-mono text-sm"
          style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); color: #e9dfeb; outline: none;"
        />
        <button onclick={sendChat} disabled={!chatInput.trim() || chatSending} data-fx="big"
          class="px-4 py-2.5 rounded-lg font-mono text-xs font-bold disabled:opacity-40"
          style="background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.32); color: #34d399; cursor: pointer;">
          {chatSending ? '…' : 'Send'}
        </button>
      </div>

    {:else if view === 'requests' && myClan}
      <button onclick={() => view = 'mine'} class="mb-4 font-mono text-xs" style="color: #9a907b; background: none; border: none; cursor: pointer;">← Back to clan</button>
      <h2 class="mb-4" style="font-family: 'Cinzel', serif; font-size: 1.1rem; color: #ffdf96;">Join Requests ({myClan.joinRequests.length})</h2>
      <div class="flex flex-col gap-2">
        {#each myClan.joinRequests as r}
          <div class="rounded-xl px-3 py-3 flex items-center gap-3" style="background: linear-gradient(180deg, #13121c, #1e1a22); border: 1px solid rgba(78,70,53,0.3);">
            <span class="material-symbols-outlined" style="font-size: 18px; color: #9a907b; font-variation-settings: 'FILL' 1;">person</span>
            <div class="flex-1 min-w-0">
              <p class="font-mono text-sm" style="color: #e9dfeb;">{r.username}</p>
              <p class="font-mono text-[10px]" style="color: #4e4635;">{r.rivalsWins}W · {relTime(r.requestedAt)}</p>
            </div>
            <button onclick={() => respondRequest(r.userId, 'accept')} disabled={actionPending !== null} data-fx="big" class="px-3 py-1.5 rounded-lg font-mono text-xs font-bold disabled:opacity-40" style="background: rgba(52,211,153,0.10); border: 1px solid rgba(52,211,153,0.30); color: #34d399;">Accept</button>
            <button onclick={() => respondRequest(r.userId, 'decline')} disabled={actionPending !== null} class="px-3 py-1.5 rounded-lg font-mono text-xs disabled:opacity-40" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.20); color: #f87171;">×</button>
          </div>
        {:else}
          <p class="text-center py-8 font-mono text-xs" style="color: #4e4635;">No pending requests.</p>
        {/each}
      </div>

    {:else if view === 'topChars' && myClan}
      <button onclick={() => view = 'mine'} class="mb-4 font-mono text-xs" style="color: #9a907b; background: none; border: none; cursor: pointer;">← Back to clan</button>
      <h2 class="mb-1" style="font-family: 'Cinzel', serif; font-size: 1.1rem; color: #ffdf96;">Top Characters</h2>
      <p class="mb-4 font-mono text-[10px]" style="color: #4e4635;">Highest overall_score across every {myClan.tag} member's roster.</p>
      {#if topCharsLoading}
        <p class="text-center py-8 font-mono text-xs" style="color: #4e4635;">Loading…</p>
      {:else if topChars.length === 0}
        <p class="text-center py-8 font-mono text-xs" style="color: #4e4635;">No saved characters in this clan yet.</p>
      {:else}
        <div class="flex flex-col gap-2">
          {#each topChars as c, i (c.shareId)}
            <div class="rounded-xl px-3 py-3 flex items-center gap-3" style="background: linear-gradient(180deg, #13121c, #1e1a22); border: 1px solid rgba(240,192,64,0.18);">
              <span class="font-mono text-sm font-bold w-6 text-center" style="color: {i === 0 ? '#f0c040' : i < 3 ? '#a78bfa' : '#4e4635'};">#{i + 1}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <a href={`/character/${c.shareId}`} class="font-mono text-xs truncate" style="color: #ffdf96; text-decoration: none;">{c.name}</a>
                  <span class="font-mono text-[9px] px-1 rounded" style="background: rgba(240,192,64,0.18); color: #f0c040;">{c.overall_tier}</span>
                  {#if c.rivals_wins > 0}
                    <span class="font-mono text-[9px]" style="color: #f0c040;" title="Rivals wins">🏆 {c.rivals_wins}</span>
                  {/if}
                </div>
                <p class="font-mono text-[10px] truncate" style="color: #9a907b;">
                  {c.race} · {c.archetype} ·
                  <a href={`/users/${encodeURIComponent(c.ownerUsername)}`}
                     class="hover:underline"
                     style="color: #a78bfa; text-decoration: none;"
                     onclick={(e) => e.stopPropagation()}>@{c.ownerUsername}</a>
                </p>
              </div>
              <span class="font-mono text-xs font-bold shrink-0" style="color: #ffdf96;" title="Overall score">{c.overall_score}</span>
              {#if c.ownerId !== auth.user?.id}
                <button onclick={() => challengeMember(c.ownerId, c.ownerUsername)}
                  data-fx="big"
                  class="text-[10px] px-2 py-1.5 rounded font-mono font-bold shrink-0"
                  style="background: rgba(244,113,113,0.10); border: 1px solid rgba(244,113,113,0.32); color: #f87171;"
                  title="Challenge {c.ownerUsername} to a Rivals battle">
                  ⚔ Challenge
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

    {:else if view === 'settings' && myClan && canEdit}
      <button onclick={() => view = 'mine'} class="mb-4 font-mono text-xs" style="color: #9a907b; background: none; border: none; cursor: pointer;">← Back</button>
      <div class="rounded-2xl px-5 py-5" style="background: linear-gradient(180deg, #13121c, #1e1a22); border: 1px solid rgba(78,70,53,0.35);">
        <h2 class="mb-5" style="font-family: 'Cinzel', serif; font-size: 1.1rem; color: #ffdf96;">Clan Settings</h2>
        <div class="flex flex-col gap-3">
          <div>
            <label for="s-badge" class="font-mono text-xs block mb-1" style="color: #9a907b;">Badge</label>
            <div id="s-badge" class="flex flex-wrap gap-1.5">
              {#each BADGE_CHOICES as b}
                <button type="button" onclick={() => settingsBadge = b}
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                  style="background: {settingsBadge === b ? 'rgba(240,192,64,0.20)' : 'rgba(255,255,255,0.04)'}; border: 1px solid {settingsBadge === b ? 'rgba(240,192,64,0.50)' : 'rgba(255,255,255,0.08)'};">{b}</button>
              {/each}
            </div>
          </div>
          <div>
            <label for="s-motd" class="font-mono text-xs block mb-1" style="color: #9a907b;">Motto / MOTD</label>
            <input id="s-motd" bind:value={settingsMotd} maxlength={80} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none;" />
          </div>
          <div>
            <label for="s-desc" class="font-mono text-xs block mb-1" style="color: #9a907b;">Description</label>
            <textarea id="s-desc" bind:value={settingsDesc} maxlength={200} rows={2} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none; resize: none;"></textarea>
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label for="s-jt" class="font-mono text-xs block mb-1" style="color: #9a907b;">Join Type</label>
              <select id="s-jt" bind:value={settingsJoinType} class="w-full px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none;">
                <option value="open">Open</option>
                <option value="invite">Invite Only</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label for="s-mw" class="font-mono text-xs block mb-1" style="color: #9a907b;">Min Wins</label>
              <input id="s-mw" type="number" bind:value={settingsMinWins} min={0} max={9999} class="w-24 px-3 py-2.5 rounded-lg font-mono text-sm" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e9dfeb; outline: none;" />
            </div>
          </div>
          <div class="flex gap-3 mt-2">
            <button onclick={saveSettings} disabled={actionPending !== null} data-fx="big" class="flex-1 py-3 rounded-lg font-bold text-sm disabled:opacity-40" style="font-family: 'Cinzel', serif; background: rgba(240,192,64,0.15); border: 1px solid rgba(240,192,64,0.35); color: #f0c040;">Save</button>
            <button onclick={() => view = 'mine'} class="px-4 py-3 rounded-lg font-mono text-xs" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #9a907b;">Cancel</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</main>
