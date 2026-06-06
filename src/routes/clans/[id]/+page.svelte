<script lang="ts">
  import { apiUrl } from '$lib/api'
  // Public clan profile — anyone can view (no auth required). Reached by
  // clicking a clan in /clan browse or leaderboard. Shows roster, badge,
  // motd, join type, total wins. Members can hit "Request" / "Join" from
  // here without going back to the browse list.
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { auth } from '$lib/stores/auth.svelte'
  import { toast } from '$lib/toast.svelte'

  type ClanRole = 'leader' | 'coLeader' | 'elder' | 'member' | 'none'
  type Member = { _id: string; username: string; rivalsWins: number; role: ClanRole }
  type PublicClan = {
    _id: string; name: string; tag: string; description: string; motd: string; badge: string
    joinType: 'open' | 'invite' | 'closed'; minWinsRequired: number; maxMembers: number
    memberCount: number; level: number; clanXp: number; totalWins: number
    createdAt: string; members: Member[]
  }

  let clan = $state<PublicClan | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let myClanId = $state<string | null>(null)
  let myClanName = $state<string | null>(null)
  let alreadyRequested = $state(false)
  let actionPending = $state(false)
  // Persistent error from the last join/request attempt. Surfaced as an
  // inline pill so the player can actually read the rejection reason —
  // the toast vanishes too fast for "save a character first" type
  // messages to register.
  let joinError = $state<string | null>(null)

  onMount(async () => {
    const id = $page.params.id
    try {
      const res = await fetch(apiUrl(`/api/clans/public/${id}`))
      if (!res.ok) { error = 'Clan not found'; return }
      const d = await res.json()
      clan = d.clan
      if (auth.loggedIn) {
        const [mineRes, appsRes] = await Promise.all([
          fetch(apiUrl('/api/clans/mine'), { credentials: 'include' }),
          fetch(apiUrl('/api/clans/my-applications'), { credentials: 'include' }),
        ])
        if (mineRes.ok) {
          const m = await mineRes.json()
          myClanId = m.clan?._id ?? null
          myClanName = m.clan?.name ?? null
        }
        if (appsRes.ok) {
          const a = await appsRes.json()
          alreadyRequested = Array.isArray(a.applications) && a.applications.some((x: any) => x.clanId === id)
        }
      }
    } catch {
      error = 'Could not load clan.'
    } finally { loading = false }
  })

  async function cancelRequest() {
    if (!clan || actionPending) return
    actionPending = true
    const res = await fetch(apiUrl(`/api/clans/${clan._id}/request`), { method: 'DELETE', credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    actionPending = false
    if (!res.ok) { toast.error(data.error ?? 'Failed to cancel'); return }
    alreadyRequested = false
    toast.success('Request cancelled')
  }

  async function join() {
    if (!clan || actionPending) return
    actionPending = true
    // Must wrap with apiUrl() so the itch.io build (cross-origin to the
    // Heroku backend) hits the right host. Plain `/api/...` worked on the
    // Heroku-served site but on itch the relative URL pointed at the
    // itch CDN, returning a 403 instead of the API JSON.
    const endpoint = clan.joinType === 'invite'
      ? apiUrl(`/api/clans/${clan._id}/request`)
      : apiUrl(`/api/clans/${clan._id}/join`)
    const res = await fetch(endpoint, { method: 'POST', credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    actionPending = false
    if (!res.ok) {
      const msg = data.error ?? `Server rejected the request (HTTP ${res.status}).`
      joinError = msg
      toast.error(msg)
      return
    }
    joinError = null
    if (clan.joinType === 'invite') {
      alreadyRequested = true
      toast.success('Join request sent')
    } else {
      toast.success(`Joined ${clan.name}`)
      myClanId = clan._id
      myClanName = clan.name
    }
  }

  const ROLE_META: Record<ClanRole, { label: string; color: string; icon: string }> = {
    leader:   { label: 'Leader',    color: '#f0c040', icon: 'workspace_premium' },
    coLeader: { label: 'Co-Leader', color: '#a78bfa', icon: 'military_tech' },
    elder:    { label: 'Elder',     color: '#5ad6ef', icon: 'shield' },
    member:   { label: 'Member',    color: '#9a907b', icon: 'person' },
    none:     { label: '—',         color: '#4e4635', icon: 'person' },
  }
  const JOIN_META: Record<string, { label: string; color: string }> = {
    open:   { label: 'Open',         color: '#34d399' },
    invite: { label: 'Invite Only',  color: '#f0c040' },
    closed: { label: 'Closed',       color: '#9a907b' },
  }
</script>

<main class="min-h-screen" style="background: transparent; color: #e9dfeb;">
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14" style="background: rgba(22,18,26,0.92); border-bottom: 2px solid rgba(240,192,82,0.45); backdrop-filter: blur(16px); box-shadow: 0 4px 20px rgba(90,214,239,0.12);">
    <a href="/clan" class="flex items-center gap-1 transition-all active:scale-95" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
      <span class="material-symbols-outlined" style="font-size: 15px;">arrow_back</span>
      <span>Clans</span>
    </a>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">shield</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">CLAN</span>
    </div>
    <div style="min-width: 80px;"></div>
  </nav>

  <div class="pt-20 pb-24 px-4 max-w-lg mx-auto">

    {#if loading}
      <div class="animate-pulse rounded-2xl h-48 mb-4" style="background: rgba(255,255,255,0.04);"></div>
      <div class="animate-pulse rounded-2xl h-32" style="background: rgba(255,255,255,0.04);"></div>
    {:else if error}
      <p class="text-center py-12 font-mono text-sm" style="color: #f87171;">{error}</p>
    {:else if clan}
      {@const jt = JOIN_META[clan.joinType]}
      <!-- Header card -->
      <div class="rounded-2xl px-5 py-5 mb-5" style="background: linear-gradient(135deg, rgba(240,192,64,0.08), rgba(240,192,64,0.03)); border: 1px solid rgba(240,192,64,0.30); box-shadow: 0 0 32px rgba(240,192,64,0.10);">
        <div class="flex items-start gap-3 mb-3">
          <div class="shrink-0 flex items-center justify-center rounded-xl"
            style="width: 64px; height: 64px; background: linear-gradient(135deg, rgba(240,192,64,0.18), rgba(240,192,64,0.05)); border: 1px solid rgba(240,192,64,0.32); font-size: 30px;">{clan.badge || '⚔'}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono font-black px-2 py-0.5 rounded text-xs" style="background: rgba(240,192,64,0.15); border: 1px solid rgba(240,192,64,0.3); color: #f0c040;">[{clan.tag}]</span>
              <h1 style="font-family: 'Cinzel', serif; font-size: 1.2rem; font-weight: 700; color: #ffdf96;">{clan.name}</h1>
            </div>
            <div class="flex items-center gap-2 mt-1.5 flex-wrap">
              <span class="font-mono text-[10px] px-1.5 py-0.5 rounded" style="background: {jt.color}22; border: 1px solid {jt.color}44; color: {jt.color};">{jt.label}</span>
              <span class="font-mono text-[10px]" style="color: #9a907b;">Lv {clan.level}</span>
              <span class="font-mono text-[10px]" style="color: #9a907b;">{clan.memberCount}/{clan.maxMembers}</span>
              {#if clan.minWinsRequired > 0}
                <span class="font-mono text-[10px]" style="color: #9a907b;">≥ {clan.minWinsRequired} wins</span>
              {/if}
            </div>
          </div>
        </div>

        {#if clan.motd}
          <div class="rounded-lg px-3 py-2 mb-3" style="background: rgba(0,0,0,0.25); border-left: 2px solid #f0c040;">
            <p class="text-xs" style="color: #ffdf96; font-style: italic;">"{clan.motd}"</p>
          </div>
        {/if}
        {#if clan.description}
          <p class="text-xs mb-3" style="color: #9a907b; line-height: 1.5;">{clan.description}</p>
        {/if}

        <!-- Stats row -->
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="rounded-lg px-2 py-2 text-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
            <p class="font-mono text-[9px] uppercase tracking-widest mb-0.5" style="color: #4e4635;">Total Wins</p>
            <p class="font-bold" style="font-family: 'Cinzel', serif; color: #a78bfa;">{clan.totalWins.toLocaleString()}</p>
          </div>
          <div class="rounded-lg px-2 py-2 text-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
            <p class="font-mono text-[9px] uppercase tracking-widest mb-0.5" style="color: #4e4635;">Clan XP</p>
            <p class="font-bold" style="font-family: 'Cinzel', serif; color: #f0c040;">{clan.clanXp.toLocaleString()}</p>
          </div>
          <div class="rounded-lg px-2 py-2 text-center" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
            <p class="font-mono text-[9px] uppercase tracking-widest mb-0.5" style="color: #4e4635;">Members</p>
            <p class="font-bold" style="font-family: 'Cinzel', serif; color: #34d399;">{clan.memberCount}</p>
          </div>
        </div>

        <!-- Join CTA — always shows SOMETHING explaining the state so the
             button never silently disappears (a playtest pain point). -->
        {#if !auth.loggedIn}
          <a href="/login" class="block w-full py-2.5 rounded-xl font-mono text-xs text-center"
            style="background: rgba(90,214,239,0.08); border: 1px solid rgba(90,214,239,0.25); color: #5ad6ef; text-decoration: none;">
            Log in to join a clan →
          </a>
        {:else if myClanId === clan._id}
          <a href="/clan" class="block w-full py-2.5 rounded-xl font-mono text-xs text-center"
            style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.22); color: #f0c040; text-decoration: none;">
            You're a member — open clan home →
          </a>
        {:else if myClanId}
          <div class="w-full py-2.5 rounded-xl font-mono text-xs text-center"
            style="background: rgba(154,144,123,0.08); border: 1px solid rgba(154,144,123,0.25); color: #9a907b;">
            You're already in {myClanName ? `[${myClanName}]` : 'a clan'}. Leave it first to join another.
          </div>
        {:else if clan.joinType === 'closed'}
          <div class="w-full py-2.5 rounded-xl font-mono text-xs text-center"
            style="background: rgba(154,144,123,0.08); border: 1px solid rgba(154,144,123,0.25); color: #9a907b;">
            This clan is closed to new members.
          </div>
        {:else if clan.memberCount >= clan.maxMembers}
          <div class="w-full py-2.5 rounded-xl font-mono text-xs text-center"
            style="background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); color: #f87171;">
            This clan is full ({clan.memberCount}/{clan.maxMembers}).
          </div>
        {:else if alreadyRequested}
          <div class="flex gap-2 items-stretch">
            <div class="flex-1 py-2.5 rounded-xl font-mono text-xs text-center"
              style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.25); color: #f0c040;">
              Request pending — leader review
            </div>
            <button onclick={cancelRequest} disabled={actionPending}
              class="px-3 rounded-xl font-mono text-[10px] uppercase tracking-wider"
              style="background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); color: #f87171; cursor: pointer;">
              {actionPending ? '…' : 'Cancel'}
            </button>
          </div>
        {:else}
          <button onclick={join} disabled={actionPending} data-fx="big"
            class="w-full py-3 rounded-xl font-bold font-mono text-sm tracking-widest"
            style="background: rgba(52,211,153,0.10); border: 1.5px solid rgba(52,211,153,0.40); color: #34d399; cursor: pointer;">
            {actionPending ? '…' : clan.joinType === 'invite' ? 'Request to Join' : 'Join Clan'}
          </button>
        {/if}
        {#if joinError}
          <div class="mt-2 px-3 py-2 rounded-lg font-mono text-[11px] leading-relaxed"
            style="background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.30); color: #f87171;">
            {joinError}
          </div>
        {/if}
      </div>

      <!-- Member roster -->
      <p class="font-mono text-[10px] tracking-[0.22em] uppercase mb-3 px-1" style="color: #9a907b;">Roster</p>
      <div class="flex flex-col gap-1.5">
        {#each clan.members as m}
          {@const meta = ROLE_META[m.role]}
          <a href={`/users/${encodeURIComponent(m.username)}`}
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:brightness-110"
            style="background: rgba(255,255,255,0.03); border: 1px solid {meta.color}1a; text-decoration: none;">
            <span class="material-symbols-outlined" style="font-size: 16px; color: {meta.color}; font-variation-settings: 'FILL' 1;">{meta.icon}</span>
            <div class="flex-1 min-w-0">
              <p class="font-mono text-sm truncate" style="color: #e9dfeb;">{m.username}</p>
              <p class="font-mono text-[10px]" style="color: {meta.color};">{meta.label} · {m.rivalsWins}W</p>
            </div>
            <span class="material-symbols-outlined" style="font-size: 16px; color: #4e4635;">chevron_right</span>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</main>
