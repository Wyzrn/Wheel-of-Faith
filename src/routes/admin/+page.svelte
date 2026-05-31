<script lang="ts">
  import { apiUrl } from '$lib/api'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth.svelte'
  import { toast } from '$lib/toast.svelte'
  import { GAMEPASSES } from '$lib/shop/gamepasses'

  // ── Access gate ────────────────────────────────────────────────────────────
  // The server is the real authority — every /admin/* call re-checks the
  // username allowlist — but we hide the UI client-side so non-admins don't
  // see a broken page after a stale cache or while auth is still loading.
  let authChecked = $state(false)
  onMount(async () => {
    if (auth.loading) await auth.init()
    authChecked = true
    if (!auth.user?.isAdmin) {
      toast.error('Admin access required')
      goto('/')
    }
  })

  type Tab = 'users' | 'characters'
  let tab = $state<Tab>('users')

  // ── Users panel ────────────────────────────────────────────────────────────
  interface AdminUser {
    _id: string
    username: string
    email?: string
    shards: number
    gamepasses: string[]
    createdAt: string
  }
  let userQuery   = $state('')
  let users       = $state<AdminUser[]>([])
  let usersLoading = $state(false)
  let expandedUserId = $state<string | null>(null)
  let shardsDelta = $state<number>(0)
  let setShards   = $state<string>('')
  let grantPick   = $state<string>('')
  let userBusy    = $state(false)

  async function searchUsers() {
    usersLoading = true
    try {
      const url = '/api/admin/users' + (userQuery ? `?q=${encodeURIComponent(userQuery)}` : '')
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      users = data.users ?? []
    } catch (err) {
      toast.error(`User search failed: ${err}`)
    } finally { usersLoading = false }
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    userBusy = true
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `${res.status}`)
      const updated = data.user
      users = users.map(u => u._id === id ? { ...u, ...updated, _id: u._id } : u)
      toast.success('Updated')
    } catch (err) {
      toast.error(`Update failed: ${err}`)
    } finally { userBusy = false }
  }

  function applyShardsDelta(id: string) {
    if (!shardsDelta) return
    patchUser(id, { shardsDelta })
    shardsDelta = 0
  }
  function applySetShards(id: string) {
    const n = Number(setShards)
    if (!Number.isFinite(n)) return
    patchUser(id, { setShards: n })
    setShards = ''
  }
  function grantGamepass(id: string) {
    if (!grantPick) return
    patchUser(id, { grantGamepass: grantPick })
    grantPick = ''
  }
  function revokeGamepass(id: string, pass: string) {
    patchUser(id, { revokeGamepass: pass })
  }

  // ── Characters panel ───────────────────────────────────────────────────────
  interface AdminCharSummary {
    _id: string
    shareId: string
    userId?: string
    name: string
    race: string
    archetype: string
    overall_score: number
    overall_tier: string
    created_at: string
  }
  interface AdminCharFull extends AdminCharSummary {
    spins: any[]
    elementWeaknesses?: string[]
  }

  let charQuery = $state('')
  let characters = $state<AdminCharSummary[]>([])
  let charsLoading = $state(false)
  let activeChar = $state<AdminCharFull | null>(null)
  let charBusy = $state(false)
  let editSpins = $state<any[]>([])
  let editName = $state('')
  let editRace = $state('')
  let editArch = $state('')
  let editWeak = $state('')
  let editOverall = $state<string>('')
  let editTier = $state<string>('')

  async function searchCharacters() {
    charsLoading = true
    try {
      const url = '/api/admin/characters' + (charQuery ? `?q=${encodeURIComponent(charQuery)}` : '')
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      characters = data.characters ?? []
    } catch (err) {
      toast.error(`Character search failed: ${err}`)
    } finally { charsLoading = false }
  }

  async function openCharacter(shareId: string) {
    charBusy = true
    try {
      const res = await fetch(apiUrl(`/api/admin/characters/${shareId}`), { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `${res.status}`)
      activeChar = data.character
      editSpins = (activeChar?.spins ?? []).map((s) => ({ ...s }))
      editName  = activeChar?.name ?? ''
      editRace  = activeChar?.race ?? ''
      editArch  = activeChar?.archetype ?? ''
      editWeak  = (activeChar?.elementWeaknesses ?? []).join(', ')
      editOverall = String(activeChar?.overall_score ?? '')
      editTier  = activeChar?.overall_tier ?? ''
    } catch (err) {
      toast.error(`Load failed: ${err}`)
    } finally { charBusy = false }
  }

  function closeCharacter() { activeChar = null }

  // Build a sparse patch: only spin indexes whose category/label/score/tier
  // changed from the originally-loaded version get sent. Keeps the payload
  // small and avoids overwriting fields the admin didn't touch.
  function buildSpinPatches() {
    if (!activeChar) return []
    const out: Array<{ index: number; patch: Record<string, unknown> }> = []
    activeChar.spins.forEach((orig: any, i: number) => {
      const cur = editSpins[i]
      if (!cur) return
      const patch: Record<string, unknown> = {}
      const fields: Array<keyof typeof cur> = ['category', 'resultLabel', 'score', 'tier', 'displayLabel']
      for (const f of fields) {
        if (cur[f] !== orig?.[f]) patch[f as string] = cur[f]
      }
      if (Object.keys(patch).length) out.push({ index: i, patch })
    })
    return out
  }

  async function saveCharacter(opts: { recompute: boolean }) {
    if (!activeChar) return
    charBusy = true
    try {
      const body: Record<string, unknown> = {
        name: editName,
        race: editRace,
        archetype: editArch,
        elementWeaknesses: editWeak.split(',').map((e) => e.trim()).filter(Boolean),
        spinPatches: buildSpinPatches(),
      }
      if (opts.recompute) {
        body.recomputeOverall = true
      } else {
        const n = Number(editOverall)
        if (Number.isFinite(n)) body.overall_score = n
        if (editTier) body.overall_tier = editTier
      }
      const res = await fetch(apiUrl(`/api/admin/characters/${activeChar.shareId}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `${res.status}`)
      activeChar = data.character
      editSpins = (activeChar?.spins ?? []).map((s: any) => ({ ...s }))
      editOverall = String(activeChar?.overall_score ?? '')
      editTier  = activeChar?.overall_tier ?? ''
      // Refresh the summary row in the list so the table reflects new score/tier.
      characters = characters.map(c => c.shareId === activeChar!.shareId
        ? { ...c, name: activeChar!.name, race: activeChar!.race, archetype: activeChar!.archetype,
            overall_score: activeChar!.overall_score, overall_tier: activeChar!.overall_tier }
        : c)
      toast.success('Character saved')
    } catch (err) {
      toast.error(`Save failed: ${err}`)
    } finally { charBusy = false }
  }
</script>

{#if !authChecked}
  <div class="empty">Checking access…</div>
{:else if !auth.user?.isAdmin}
  <div class="empty">Forbidden.</div>
{:else}
  <div class="wrap">
    <header>
      <h1>Developer Sandbox</h1>
      <p class="sub">Signed in as <strong>{auth.user.username}</strong> · changes persist immediately.</p>
      <div class="tabs">
        <button class:active={tab === 'users'} onclick={() => tab = 'users'}>Users</button>
        <button class:active={tab === 'characters'} onclick={() => tab = 'characters'}>Characters</button>
      </div>
    </header>

    {#if tab === 'users'}
      <section class="panel">
        <div class="search-row">
          <input
            type="text"
            placeholder="Search username (blank = newest 25)"
            bind:value={userQuery}
            onkeydown={(e) => { if (e.key === 'Enter') searchUsers() }}
          />
          <button onclick={searchUsers} disabled={usersLoading}>
            {usersLoading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {#if users.length === 0}
          <div class="empty">No users loaded. Hit Search.</div>
        {:else}
          <ul class="rows">
            {#each users as u (u._id)}
              <li class="row" class:expanded={expandedUserId === u._id}>
                <button class="row-head" onclick={() => expandedUserId = expandedUserId === u._id ? null : u._id}>
                  <span class="name">{u.username}</span>
                  <span class="meta">{u.shards.toLocaleString()} shards · {u.gamepasses.length} passes</span>
                </button>
                {#if expandedUserId === u._id}
                  <div class="row-body">
                    <div class="field-row">
                      <label>Adjust shards by</label>
                      <input type="number" bind:value={shardsDelta} placeholder="e.g. 5000 or -1000" />
                      <button onclick={() => applyShardsDelta(u._id)} disabled={userBusy}>Apply Δ</button>
                    </div>
                    <div class="field-row">
                      <label>Set shards to</label>
                      <input type="number" min="0" bind:value={setShards} placeholder="exact amount" />
                      <button onclick={() => applySetShards(u._id)} disabled={userBusy}>Set</button>
                    </div>
                    <div class="field-row">
                      <label>Grant gamepass</label>
                      <select bind:value={grantPick}>
                        <option value="">— pick —</option>
                        {#each GAMEPASSES as gp (gp.id)}
                          <option value={gp.id}>{gp.name} ({gp.id})</option>
                        {/each}
                      </select>
                      <button onclick={() => grantGamepass(u._id)} disabled={userBusy || !grantPick}>Grant</button>
                    </div>
                    {#if u.gamepasses.length > 0}
                      <div class="passes">
                        <div class="passes-label">Owned:</div>
                        <div class="passes-list">
                          {#each u.gamepasses as gp}
                            <button class="pass-pill" onclick={() => revokeGamepass(u._id, gp)} disabled={userBusy} title="Click to revoke">
                              {gp} ✕
                            </button>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {:else}
      <section class="panel">
        <div class="search-row">
          <input
            type="text"
            placeholder="Search name / shareId / race / archetype"
            bind:value={charQuery}
            onkeydown={(e) => { if (e.key === 'Enter') searchCharacters() }}
          />
          <button onclick={searchCharacters} disabled={charsLoading}>
            {charsLoading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {#if !activeChar}
          {#if characters.length === 0}
            <div class="empty">No characters loaded.</div>
          {:else}
            <ul class="rows">
              {#each characters as c (c._id)}
                <li class="row">
                  <button class="row-head" onclick={() => openCharacter(c.shareId)} disabled={charBusy}>
                    <span class="name">{c.name}</span>
                    <span class="meta">{c.race} · {c.archetype} · {c.overall_tier} ({c.overall_score})</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        {:else}
          <div class="char-edit">
            <div class="char-head">
              <button class="back" onclick={closeCharacter}>← Back to results</button>
              <span class="share">shareId: <code>{activeChar.shareId}</code></span>
            </div>

            <div class="grid">
              <label>Name <input type="text" bind:value={editName} /></label>
              <label>Race <input type="text" bind:value={editRace} /></label>
              <label>Archetype <input type="text" bind:value={editArch} /></label>
              <label>Element weaknesses (csv) <input type="text" bind:value={editWeak} placeholder="Fire, Ice" /></label>
              <label>Overall score <input type="number" bind:value={editOverall} /></label>
              <label>Overall tier <input type="text" bind:value={editTier} /></label>
            </div>

            <h3>Spins ({editSpins.length})</h3>
            <div class="spins-table">
              <div class="spin-row spin-head">
                <span class="spin-i">#</span>
                <span>category</span>
                <span>resultLabel</span>
                <span>tier</span>
                <span>score</span>
                <span>displayLabel</span>
              </div>
              {#each editSpins as s, i (i)}
                <div class="spin-row">
                  <span class="spin-i">{i}</span>
                  <input type="text" bind:value={s.category} />
                  <input type="text" bind:value={s.resultLabel} />
                  <input type="text" bind:value={s.tier} />
                  <input type="number" bind:value={s.score} />
                  <input type="text" bind:value={s.displayLabel} />
                </div>
              {/each}
            </div>

            <div class="save-bar">
              <button onclick={() => saveCharacter({ recompute: true })} disabled={charBusy} class="primary">
                Save + recompute overall
              </button>
              <button onclick={() => saveCharacter({ recompute: false })} disabled={charBusy}>
                Save (keep manual overall)
              </button>
            </div>
          </div>
        {/if}
      </section>
    {/if}
  </div>
{/if}

<style>
  .wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px 20px 120px;
    color: #e5e7eb;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  header { margin-bottom: 24px; }
  h1 {
    font-size: 1.9rem; margin: 0 0 4px;
    background: linear-gradient(90deg, #f59e0b, #ef4444);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .sub { color: #9ca3af; font-size: 0.85rem; margin: 0 0 16px; }
  .tabs { display: flex; gap: 8px; }
  .tabs button {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: #d1d5db;
    padding: 8px 16px; border-radius: 8px; cursor: pointer;
    font-size: 0.9rem;
  }
  .tabs button.active {
    background: rgba(245,158,11,0.18);
    border-color: rgba(245,158,11,0.5);
    color: #fde68a;
  }
  .panel {
    background: rgba(15,23,42,0.55);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 18px;
  }
  .search-row { display: flex; gap: 8px; margin-bottom: 14px; }
  .search-row input {
    flex: 1; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
    color: #e5e7eb; padding: 8px 10px; border-radius: 8px;
  }
  .search-row button, .field-row button, .save-bar button {
    background: rgba(56,189,248,0.18); border: 1px solid rgba(56,189,248,0.5);
    color: #bae6fd; padding: 8px 14px; border-radius: 8px; cursor: pointer;
    font-weight: 600;
  }
  .save-bar button.primary {
    background: rgba(34,197,94,0.18); border-color: rgba(34,197,94,0.5); color: #bbf7d0;
  }
  .empty { color: #6b7280; padding: 30px; text-align: center; font-style: italic; }

  .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .row { background: rgba(255,255,255,0.03); border-radius: 8px; overflow: hidden; }
  .row-head {
    width: 100%; display: flex; justify-content: space-between; align-items: center;
    padding: 10px 14px; background: transparent; border: none; color: #e5e7eb;
    cursor: pointer; text-align: left;
  }
  .row-head:hover { background: rgba(255,255,255,0.04); }
  .name { font-weight: 600; }
  .meta { color: #9ca3af; font-size: 0.8rem; }
  .row-body { padding: 14px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 10px; }
  .field-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .field-row label { color: #9ca3af; font-size: 0.85rem; min-width: 140px; }
  .field-row input, .field-row select {
    background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
    color: #e5e7eb; padding: 6px 8px; border-radius: 6px; min-width: 200px;
  }
  .passes { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
  .passes-label { color: #9ca3af; font-size: 0.85rem; }
  .passes-list { display: flex; gap: 6px; flex-wrap: wrap; }
  .pass-pill {
    background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.4);
    color: #fecaca; padding: 4px 10px; border-radius: 999px; font-size: 0.75rem;
    cursor: pointer;
  }
  .pass-pill:hover { background: rgba(239,68,68,0.22); }

  .char-edit { display: flex; flex-direction: column; gap: 14px; }
  .char-head { display: flex; justify-content: space-between; align-items: center; }
  .back {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
    color: #d1d5db; padding: 6px 12px; border-radius: 6px; cursor: pointer;
  }
  .share code { color: #fde68a; font-family: ui-monospace, monospace; font-size: 0.8rem; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .grid label { display: flex; flex-direction: column; gap: 4px; color: #9ca3af; font-size: 0.8rem; }
  .grid input {
    background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
    color: #e5e7eb; padding: 6px 8px; border-radius: 6px;
  }
  h3 { margin: 6px 0 0; color: #fde68a; font-size: 1rem; }
  .spins-table {
    display: flex; flex-direction: column; gap: 4px;
    background: rgba(0,0,0,0.25); border-radius: 8px; padding: 8px;
    max-height: 480px; overflow-y: auto;
  }
  .spin-row {
    display: grid; grid-template-columns: 28px 1.2fr 1.6fr 0.9fr 70px 1.4fr;
    gap: 6px; align-items: center;
  }
  .spin-head { color: #9ca3af; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0 4px; }
  .spin-head span { padding: 4px 0; }
  .spin-i { color: #6b7280; text-align: center; font-size: 0.75rem; }
  .spin-row input {
    background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.07);
    color: #e5e7eb; padding: 4px 6px; border-radius: 4px; font-size: 0.78rem;
    width: 100%;
  }
  .save-bar { display: flex; gap: 10px; margin-top: 4px; }

  @media (max-width: 640px) {
    .grid { grid-template-columns: 1fr; }
    .spin-row { grid-template-columns: 24px 1fr 1fr; }
    .spin-row > :nth-child(n+4) { grid-column: span 3; }
  }
</style>
