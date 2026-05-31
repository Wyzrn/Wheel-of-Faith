<!--
  TeamBattleScreen.svelte — Rivals 1v1 and team-vs-team battles.

  Migrated onto the unified BattleArena + BattleControllerTeam stack.
  The legacy view carried a lot of bespoke FX (ambient particles, vignette
  pulse, screen flashes, round banners, center text, custom audio) which
  this slim version sheds in exchange for the new projectile VFX system,
  manual-mode hotbar with target picking, the Auto/Manual switch, and the
  Instant Battle Skip button.

  Preserved: champions-record save flow for 1v1 wins (POST /api/characters
  + PATCH rivals-win), team-rematch/menu hooks, and the result modal.
-->
<script lang="ts">
  import { apiUrl } from '$lib/api'
  import { onMount } from 'svelte'
  import {
    buildBattleCharacter, formatHp, detectWeaknessElement,
    type BattleCharacter,
  } from '$lib/game/battle'
  import { computeOverallScore, scoreTier } from '$lib/game/scoreTier'
  import type { SpinResult } from '$lib/session/types'
  import { settings } from '$lib/settings.svelte'
  import { auth } from '$lib/stores/auth.svelte'
  import BattleArena from './BattleArena.svelte'
  import {
    memberFromChar,
    type ArenaTeam, type ArenaWinner,
  } from '$lib/battle/arena'
  import { BattleControllerTeam } from '$lib/battle/teamController'

  interface TeamMember {
    results: SpinResult[]
    name: string
    shareId?: string
    startedAt?: string
  }
  interface Props {
    team1: TeamMember[]
    team2: TeamMember[]
    onRematch: () => void
    onBackToMenu: () => void
  }
  let { team1, team2, onRematch, onBackToMenu }: Props = $props()

  const is1v1 = team1.length === 1 && team2.length === 1

  // ── Engine state ─────────────────────────────────────────────────────────
  let t1Chars     = $state<BattleCharacter[]>([])
  let t2Chars     = $state<BattleCharacter[]>([])
  let arenaTeams  = $state<[ArenaTeam, ArenaTeam] | null>(null)
  let controller  = $state<BattleControllerTeam | null>(null)
  let phase       = $state<'intro' | 'battle' | 'result'>('intro')
  let winner      = $state<ArenaWinner | null>(null)

  // Manual / Auto preference seeded from settings.
  let manualMode  = $state(!settings.autoBattle)
  let canInstant  = $derived((auth.user?.gamepasses ?? []).includes('instant_battle'))

  // ── Save flow (1v1 only) ─────────────────────────────────────────────────
  let saveStatus   = $state<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let savedShareId = $state('')
  let savedWins    = $state(0)

  function handleBattleEnd(w: ArenaWinner) {
    winner = w
    if (is1v1 && w && w !== 'draw') saveWinnerToBackend()
  }

  async function saveWinnerToBackend() {
    if (!winner || winner === 'draw') return
    saveStatus = 'saving'
    const winMember = winner === 'team1' ? team1[0] : team2[0]
    const existingId = winMember.shareId ?? ''
    const winnerResults = winMember.results
    const winnerName    = winMember.name
    const winnerStart   = winMember.startedAt ?? ''
    try {
      let shareId = existingId
      if (!shareId) {
        const race      = winnerResults.find(r => r.category === 'race')?.resultLabel      ?? ''
        const archetype = winnerResults.find(r => r.category === 'archetype')?.resultLabel ?? ''
        const STAT_CATS = ['strength','speed','agility','durability','iq','charisma','fightingSkill','powerMastery','weaponMastery','potential','energyLevel']
        const statScores = Object.fromEntries(STAT_CATS.map(c => [c, winnerResults.find(r => r.category === c)?.score ?? 0]))
        const res = await fetch(apiUrl('/api/characters'), {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: winnerName || race, race, archetype,
            overall_score: computeOverallScore(statScores),
            overall_tier:  scoreTier(computeOverallScore(statScores)),
            spins: winnerResults, session_started_at: winnerStart,
            elementWeaknesses: winnerResults
              .filter(r => r.category === 'weakness')
              .map(r => detectWeaknessElement(r.resultLabel))
              .filter((e): e is NonNullable<typeof e> => !!e),
          }),
        })
        if (!res.ok) { saveStatus = 'error'; return }
        const data = await res.json() as { shareId: string }
        shareId = data.shareId
        try {
          const ex: string[] = JSON.parse(localStorage.getItem('wof_saved_chars') ?? '[]')
          if (!ex.includes(shareId)) localStorage.setItem('wof_saved_chars', JSON.stringify([shareId, ...ex].slice(0, 50)))
        } catch { /* ignore */ }
      }
      // credentials:'include' so the server's ownership gate sees the auth
      // cookie — without it the PATCH silently 401s and the medal never lands.
      const patchRes = await fetch(apiUrl(`/api/characters/${shareId}/rivals-win`), { method: 'PATCH', credentials: 'include' })
      if (patchRes.ok) {
        const pd = await patchRes.json() as { rivals_wins: number }
        savedWins = pd.rivals_wins; savedShareId = shareId; saveStatus = 'saved'
      } else {
        savedShareId = shareId; saveStatus = 'saved'
      }
    } catch { saveStatus = 'error' }
  }

  onMount(() => {
    t1Chars = team1.map(m => buildBattleCharacter(m.results, m.name))
    t2Chars = team2.map(m => buildBattleCharacter(m.results, m.name))

    const t1Ids = t1Chars.map((_, i) => `t1-${i}`)
    const t2Ids = t2Chars.map((_, i) => `t2-${i}`)

    arenaTeams = [
      {
        side: 'team1', label: is1v1 ? t1Chars[0].name : 'Team 1', accent: '#f0c040',
        members: t1Chars.map((c, i) => memberFromChar(c, t1Ids[i], 'team1', formatHp)),
      },
      {
        side: 'team2', label: is1v1 ? t2Chars[0].name : 'Team 2', accent: '#e879f9',
        members: t2Chars.map((c, i) => memberFromChar(c, t2Ids[i], 'team2', formatHp)),
      },
    ]
    controller = new BattleControllerTeam(
      t1Chars.map((c, i) => ({ id: t1Ids[i], side: 'team1', char: c })),
      t2Chars.map((c, i) => ({ id: t2Ids[i], side: 'team2', char: c })),
    )
  })
</script>

<div class="w-full flex flex-col px-3 py-5 sm:px-6 sm:py-8 sm:items-center"
     style="min-height: 100dvh; max-width: 800px; margin: 0 auto;">

  {#if arenaTeams && controller}
    <BattleArena
      bind:phase
      teams={arenaTeams}
      controller={controller}
      manualMode={manualMode}
      onManualToggle={(m) => manualMode = m}
      modeTitle={is1v1 ? 'RIVALS BATTLE' : `${team1.length}v${team2.length} TEAM BATTLE`}
      modeName="Rivals"
      modeSubtitle="⚔ Rivals Mode"
      modeAccent="#f9a8d4"
      speedFactor={settings.battleSpeed}
      effectsEnabled={settings.effectsEnabled}
      canInstant={canInstant}
      onBattleEnd={handleBattleEnd}>

      {#snippet result()}
        {@const winLabel = winner === 'team1'
          ? (is1v1 ? t1Chars[0]?.name : 'Team 1')
          : winner === 'team2'
            ? (is1v1 ? t2Chars[0]?.name : 'Team 2')
            : null}
        {@const wc = winner === 'draw' ? '#9ca3af' : winner === 'team1' ? '#f0c040' : '#e879f9'}
        <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
          style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px);
                 padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
          <div class="w-full max-w-md rounded-2xl overflow-hidden"
            style="background: {winner === 'draw' ? 'rgba(156,163,175,0.06)' : winner === 'team1' ? 'rgba(240,192,64,0.06)' : 'rgba(232,121,249,0.06)'};
                   border: 1px solid {wc}44; box-shadow: 0 0 60px {wc}14;
                   animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
            <div class="px-5 py-6 text-center">
              {#if winner === 'draw'}
                <p class="text-xs tracking-[0.25em] uppercase mb-2"
                   style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">The battle concludes</p>
                <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900;
                          color: #d1d5db; letter-spacing: 0.15em;">IT'S A DRAW!</p>
                <p class="mt-2 text-sm" style="color: #9a907b;">Two sides of equal destiny.</p>
              {:else}
                <p class="text-xs tracking-[0.25em] uppercase mb-2"
                   style="font-family: 'JetBrains Mono', monospace; color: {wc};">
                  {is1v1 ? 'Victory' : winner === 'team1' ? 'Team 1 Victory' : 'Team 2 Victory'}
                </p>
                <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900;
                          color: {wc}; letter-spacing: 0.12em; filter: drop-shadow(0 0 16px {wc}55);">{winLabel} WINS!</p>
                <p class="mt-2 text-sm" style="color: #9a907b;">Fate has spoken.</p>

                {#if is1v1}
                  {#if saveStatus === 'saving'}
                    <p class="mt-3 text-xs"
                       style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Saving to champions record…</p>
                  {:else if saveStatus === 'saved'}
                    <div class="mt-3 flex items-center justify-center gap-1.5">
                      <span class="material-symbols-outlined"
                            style="font-size: 14px; color: #34d399; font-variation-settings: 'FILL' 1;">check_circle</span>
                      <p class="text-xs"
                         style="font-family: 'JetBrains Mono', monospace; color: #34d399;">Saved — {savedWins} rival win{savedWins !== 1 ? 's' : ''} total</p>
                    </div>
                  {:else if saveStatus === 'error'}
                    <p class="mt-3 text-xs"
                       style="font-family: 'JetBrains Mono', monospace; color: #f87171;">Could not save — server unavailable.</p>
                  {/if}
                {:else}
                  <p class="mt-3 text-xs"
                     style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Win records not tracked for team battles.</p>
                {/if}
              {/if}

              <div class="flex gap-2 mt-5">
                <button
                  onclick={onRematch}
                  class="flex-1 py-3 rounded-xl text-sm tracking-[0.14em] uppercase font-bold transition-all active:scale-95"
                  style="font-family: 'Cinzel', serif; color: #f9a8d4;
                         background: rgba(157,23,77,0.12); border: 1px solid #9d174d;"
                >⚔ Rematch</button>
                <button
                  onclick={onBackToMenu}
                  class="flex-1 py-3 rounded-xl text-sm tracking-[0.14em] uppercase font-bold transition-all active:scale-95"
                  style="font-family: 'Cinzel', serif; color: #9a907b;
                         background: rgba(255,255,255,0.03); border: 1px solid #4e4635;"
                >Characters</button>
              </div>
            </div>
          </div>
        </div>
      {/snippet}
    </BattleArena>
  {/if}
</div>
