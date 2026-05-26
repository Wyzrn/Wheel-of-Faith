<!--
  BattleScreen.svelte — Rivals Mode 1v1.

  This view is now a thin caller of the unified BattleArena shell: it builds
  the two BattleCharacters from spin results, simulates the rounds, hands
  them to the arena, and supplies the mode-specific intro/result UI (Rivals
  "VS" splash + champions-save flow).
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { buildBattleCharacter, formatHp, detectWeaknessElement } from '$lib/game/battle'
  import type { BattleCharacter } from '$lib/game/battle'
  import { computeOverallScore, scoreTier } from '$lib/game/scoreTier'
  import type { SpinResult } from '$lib/session/types'
  import { settings } from '$lib/settings.svelte'
  import { auth } from '$lib/stores/auth.svelte'
  import BattleArena from './BattleArena.svelte'
  import {
    memberFromChar,
    type ArenaTeam, type ArenaWinner,
  } from '$lib/battle/arena'
  import { BattleController1v1 } from '$lib/battle/controller'

  interface Props {
    p1Results: SpinResult[]
    p1Name: string
    p1StartedAt: string
    p1ShareId?: string        // set if P1 is a pre-saved character (skip POST, only PATCH wins)
    p2Results: SpinResult[]
    p2Name: string
    p2StartedAt: string
    p2ShareId?: string        // set if P2 is a pre-saved character
    onRematch: () => void
    onBackToMenu: () => void
    onChallengeWinner?: (winnerResults: SpinResult[], winnerName: string, winnerShareId: string) => void
  }
  let {
    p1Results, p1Name, p1StartedAt, p1ShareId = '',
    p2Results, p2Name, p2StartedAt, p2ShareId = '',
    onRematch, onBackToMenu, onChallengeWinner,
  }: Props = $props()

  // ── Engine state (computed once on mount) ──────────────────────────────────
  let p1Char = $state<BattleCharacter | null>(null)
  let p2Char = $state<BattleCharacter | null>(null)
  let teams  = $state<[ArenaTeam, ArenaTeam] | null>(null)
  let controller = $state<BattleController1v1 | null>(null)

  // Arena drives this binding; the result modal keys off it.
  let phase  = $state<'intro' | 'battle' | 'result'>('intro')
  let winner = $state<ArenaWinner | null>(null)

  // Manual-mode preference: starts inverted from the Auto Battle setting,
  // then can be flipped per battle via the visible Auto / Manual switch in
  // the arena header.
  let manualMode = $state(!settings.autoBattle)

  // Instant Battle (gamepass) — show the Skip button when the player owns
  // the `instant_battle` gamepass on their account.
  let canInstant = $derived((auth.user?.gamepasses ?? []).includes('instant_battle'))

  // Winner save state (mode-specific — stays in this view)
  let saveStatus   = $state<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let savedShareId = $state('')
  let savedWins    = $state(0)

  const TEAM1_ACCENT = '#f0c040'
  const TEAM2_ACCENT = '#e879f9'

  onMount(() => {
    const c1 = buildBattleCharacter(p1Results, p1Name)
    const c2 = buildBattleCharacter(p2Results, p2Name)
    p1Char = c1
    p2Char = c2

    const m1 = memberFromChar(c1, 'p1', 'team1', formatHp)
    const m2 = memberFromChar(c2, 'p2', 'team2', formatHp)
    teams = [
      { side: 'team1', label: c1.name, accent: TEAM1_ACCENT, members: [m1] },
      { side: 'team2', label: c2.name, accent: TEAM2_ACCENT, members: [m2] },
    ]

    // Build the stateful controller so the arena can either auto-step or
    // pause for player input depending on the manual-mode toggle. Both
    // characters live on the same controller — team1 is the player, team2
    // is the opponent (AI).
    controller = new BattleController1v1(
      { id: 'p1', side: 'team1', char: c1 },
      { id: 'p2', side: 'team2', char: c2 },
    )
  })

  function handleBattleEnd(w: ArenaWinner) {
    winner = w
    if (w !== 'draw') saveWinnerToBackend()
  }

  async function saveWinnerToBackend() {
    if (!winner || winner === 'draw') return
    saveStatus = 'saving'

    const winnerResults   = winner === 'team1' ? p1Results : p2Results
    const winnerName      = winner === 'team1' ? p1Name    : p2Name
    const winnerStartedAt = winner === 'team1' ? p1StartedAt : p2StartedAt
    const existingShareId = winner === 'team1' ? p1ShareId  : p2ShareId

    try {
      let shareId = existingShareId

      if (!shareId) {
        // Fresh character — POST to save
        const race      = winnerResults.find(r => r.category === 'race')?.resultLabel      ?? ''
        const archetype = winnerResults.find(r => r.category === 'archetype')?.resultLabel ?? ''
        const STAT_CATS = ['strength','speed','agility','durability','iq','charisma','fightingSkill','powerMastery','weaponMastery','potential','energyLevel']
        const statScores = Object.fromEntries(STAT_CATS.map(c => [c, winnerResults.find(r => r.category === c)?.score ?? 0]))
        const overallScore = computeOverallScore(statScores)
        const overallTier  = scoreTier(overallScore)

        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:               winnerName || race,
            race,
            archetype,
            overall_score:      overallScore,
            overall_tier:       overallTier,
            spins:              winnerResults,
            session_started_at: winnerStartedAt,
            elementWeaknesses:  winnerResults
              .filter(r => r.category === 'weakness')
              .map(r => detectWeaknessElement(r.resultLabel))
              .filter((e): e is NonNullable<typeof e> => !!e),
          }),
        })

        if (!res.ok) { saveStatus = 'error'; return }

        const data = await res.json() as { shareId: string }
        shareId = data.shareId

        // Add to device's saved-character list
        try {
          const existing: string[] = JSON.parse(localStorage.getItem('wof_saved_chars') ?? '[]')
          if (!existing.includes(shareId)) {
            localStorage.setItem('wof_saved_chars', JSON.stringify([shareId, ...existing].slice(0, 50)))
          }
        } catch { /* ignore */ }
      }

      // Increment wins on backend. credentials:'include' is required because the
      // server gates this PATCH by character ownership (userId match), so the
      // auth cookie has to ride along or the increment silently 401s.
      const patchRes = await fetch(`/api/characters/${shareId}/rivals-win`, { method: 'PATCH', credentials: 'include' })
      if (patchRes.ok) {
        const patchData = await patchRes.json() as { rivals_wins: number }
        savedWins    = patchData.rivals_wins
        savedShareId = shareId
        saveStatus   = 'saved'
      } else {
        saveStatus = 'error'
      }
    } catch {
      saveStatus = 'error'
    }
  }
</script>

<div class="w-full flex flex-col px-3 py-5 sm:px-6 sm:py-8 sm:items-center"
     style="min-height: 100dvh; max-width: 800px; margin: 0 auto;">
  {#if teams && controller}
    <BattleArena
      bind:phase
      teams={teams}
      controller={controller}
      manualMode={manualMode}
      playerActorId="p1"
      onManualToggle={(m) => manualMode = m}
      canInstant={canInstant}
      modeTitle="RIVALS BATTLE"
      modeSubtitle="⚔ Rivals Mode"
      modeAccent="#f9a8d4"
      speedFactor={settings.battleSpeed}
      effectsEnabled={settings.effectsEnabled}
      onBattleEnd={handleBattleEnd}
    >
      {#snippet result()}
        {@const winnerName = winner === 'team1' ? p1Char?.name : winner === 'team2' ? p2Char?.name : null}
        {@const winColor   = winner === 'draw' ? '#9ca3af' : winner === 'team1' ? TEAM1_ACCENT : TEAM2_ACCENT}
        <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
          style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px);
                 padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
          <div class="w-full max-w-md rounded-2xl overflow-hidden"
            style="background: {winner === 'draw' ? 'rgba(156,163,175,0.06)' : winner === 'team1' ? 'rgba(240,192,64,0.06)' : 'rgba(232,121,249,0.06)'};
                   border: 1px solid {winColor}44; box-shadow: 0 0 60px {winColor}14;
                   animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
            <div class="px-5 py-6 text-center">
              {#if winner === 'draw'}
                <p class="text-xs tracking-[0.25em] uppercase mb-2"
                   style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">The battle concludes</p>
                <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem);
                          font-weight: 900; color: #d1d5db; letter-spacing: 0.15em;">IT'S A DRAW!</p>
                <p class="mt-2 text-sm" style="color: #9a907b;">Two warriors of equal destiny.</p>
              {:else}
                <p class="text-xs tracking-[0.25em] uppercase mb-2"
                   style="font-family: 'JetBrains Mono', monospace; color: {winColor};">Victory</p>
                <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem);
                          font-weight: 900; color: {winColor}; letter-spacing: 0.12em;
                          filter: drop-shadow(0 0 16px {winColor}55);">{winnerName} WINS!</p>
                <p class="mt-2 text-sm" style="color: #9a907b;">Fate has spoken.</p>

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
                     style="font-family: 'JetBrains Mono', monospace; color: #f87171;">Could not save — session too brief or server unavailable.</p>
                {/if}
              {/if}

              <!-- Action buttons -->
              <div class="flex flex-col gap-2 mt-5">
                {#if winner !== 'draw' && onChallengeWinner && saveStatus === 'saved'}
                  {@const winResults = winner === 'team1' ? p1Results : p2Results}
                  {@const winName    = winner === 'team1' ? p1Name    : p2Name}
                  <button
                    onclick={() => onChallengeWinner!(winResults, winName, savedShareId)}
                    class="w-full py-3 rounded-xl text-sm tracking-[0.14em] uppercase font-bold transition-all active:scale-95"
                    style="font-family: 'Cinzel', serif; color: #fde68a;
                           background: linear-gradient(135deg, #1c1a2a, #13121c);
                           border: 1px solid #f0c040; box-shadow: 0 0 20px rgba(240,192,64,0.18);"
                  >Challenge Winner</button>
                {/if}
                <div class="flex gap-2">
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
                  >Menu</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/snippet}
    </BattleArena>
  {/if}
</div>
