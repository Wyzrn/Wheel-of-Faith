<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import { buildBattleCharacter, simulateBattle, formatHp } from '$lib/game/battle'
  import type { BattleCharacter, BattleRound } from '$lib/game/battle'
  import { computeOverallScore, scoreTier } from '$lib/game/scoreTier'
  import type { SpinResult } from '$lib/session/types'
  import AttackFX from './AttackFX.svelte'

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

  let p1Char   = $state<BattleCharacter | null>(null)
  let p2Char   = $state<BattleCharacter | null>(null)
  let rounds   = $state<BattleRound[]>([])
  let roundIdx = $state(0)

  let p1DisplayHp = $state(0)
  let p2DisplayHp = $state(0)

  let logLines = $state<string[]>([])
  let phase    = $state<'intro' | 'battle' | 'result'>('intro')
  let winner   = $state<'p1' | 'p2' | 'draw' | null>(null)

  // Winner save state
  let saveStatus   = $state<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let savedShareId = $state('')    // shareId of saved winner (empty until saved)
  let savedWins    = $state(0)

  let logEl = $state<HTMLDivElement | null>(null)
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let animTimeoutId: ReturnType<typeof setTimeout> | null = null

  type AnimDir = 'ltr' | 'rtl' | 'center'
  let activeAnim = $state<{ type: string; color: string; key: number; direction: AnimDir } | null>(null)
  let animKey = 0
  let dodgeDir = $state<'ltr' | 'rtl' | null>(null)

  function showAnim(type: string, color: string, direction: AnimDir = 'center') {
    if (animTimeoutId) clearTimeout(animTimeoutId)
    activeAnim = { type, color, key: ++animKey, direction }
    dodgeDir = type === 'dodge' ? (direction === 'ltr' ? 'ltr' : direction === 'rtl' ? 'rtl' : null) : null
    animTimeoutId = setTimeout(() => { activeAnim = null; dodgeDir = null }, 950)
  }

  function detectAnim(line: string): { type: string; color: string; direction: AnimDir } | null {
    const direction: AnimDir =
      (p1Char && line.startsWith(p1Char.name)) ? 'ltr' :
      (p2Char && line.startsWith(p2Char.name)) ? 'rtl' :
      'center'

    const hasAction = line.includes('damage!') || line.includes('restores') ||
      line.includes('recovers') || line.includes('barrier') || line.includes('defensive') ||
      /BERSERK|combo finisher|follow-up/i.test(line) ||
      /narrowly dodges|weaves around|barely evades|slips past|anticipates|phases through|blinks away|mirrors away|deflects/i.test(line)
    if (!hasAction) return null

    if (/narrowly dodges|weaves around|barely evades|slips past|anticipates and sidesteps|phases through|blinks away from|mirrors away/i.test(line))
      return { type: 'dodge', color: '#a5f3fc', direction }
    if (/barrier forms|defensive stance|protective shell|bracing/i.test(line))
      return { type: 'shield', color: '#93c5fd', direction }
    if (/CRITICAL|DEVASTATING|PERFECT STRIKE|OVERWHELMING|UNSTOPPABLE|OVERKILL/i.test(line)) return { type: 'crit', color: '#fde047', direction }
    if (/berserk|frenzy/i.test(line)) return { type: 'berserker', color: '#ef4444', direction }
    if (/combo finisher|follow-up/i.test(line)) return { type: 'combo', color: '#f59e0b', direction }
    if (/restores|recovers.*HP|vital force|mends/i.test(line)) return { type: 'holy', color: '#34d399', direction: 'center' }
    if (/fire|flame|blaze|inferno|burn|ember|magma|lava|heat/i.test(line)) return { type: 'fire', color: '#f97316', direction }
    if (/shadow|void|abyss|soul drain|leech/i.test(line)) return { type: 'shadow', color: '#8b5cf6', direction }
    if (/blood|crimson/i.test(line)) return { type: 'blood', color: '#dc2626', direction }
    if (/curse/i.test(line)) return { type: 'cursed', color: '#7c3aed', direction }
    if (/lightning|thunder|electric|storm|volt|spark|shock|arc/i.test(line)) return { type: 'lightning', color: '#fbbf24', direction }
    if (/ice|frost|freeze|cryo|blizzard|snow|cold|glacier/i.test(line)) return { type: 'ice', color: '#7dd3fc', direction }
    if (/divine|holy|celestial|angel|sacred|radiant|blessed/i.test(line)) return { type: 'holy', color: '#fde68a', direction }
    if (/water|wave|aqua|flood|tidal|ocean|torrent/i.test(line)) return { type: 'water', color: '#38bdf8', direction }
    if (/time|temporal|chrono|rewind|haste|blink|phase/i.test(line)) return { type: 'time', color: '#a78bfa', direction }
    if (/psychic|mind|telepathy|mental|chaos|reality|warp|phantom/i.test(line)) return { type: 'psychic', color: '#e879f9', direction }
    if (/poison|acid|toxic|venom|plague|rot/i.test(line)) return { type: 'poison', color: '#84cc16', direction }
    if (/gravity|black hole|collapse|crush|singularity|weight/i.test(line)) return { type: 'gravity', color: '#6366f1', direction }
    if (/wind|gust|tornado|vortex|cyclone|whirlwind/i.test(line)) return { type: 'wind', color: '#e2e8f0', direction }
    if (/earth|rock|stone|ground|quake|mountain|boulder/i.test(line)) return { type: 'earth', color: '#a16207', direction }
    if (/energy|power|force|blast|surge|beam/i.test(line)) return { type: 'energy', color: '#60a5fa', direction }
    if (line.includes('damage!')) return { type: 'slash', color: '#f87171', direction }
    return null
  }

  let p1HpPct = $derived(p1Char ? Math.max(0, p1DisplayHp / p1Char.maxHp) : 1)
  let p2HpPct = $derived(p2Char ? Math.max(0, p2DisplayHp / p2Char.maxHp) : 1)

  function hpColor(pct: number): string {
    if (pct > 0.50) return '#22c55e'
    if (pct > 0.25) return '#eab308'
    return '#ef4444'
  }

  async function scrollLog() {
    await tick()
    if (logEl) logEl.scrollTop = logEl.scrollHeight
  }

  function playLines(lines: string[], onDone: () => void) {
    if (lines.length === 0) { onDone(); return }
    const [head, ...rest] = lines
    logLines = [...logLines, head]
    scrollLog()
    const anim = detectAnim(head)
    if (anim) showAnim(anim.type, anim.color, anim.direction)
    const delay = head.startsWith('──') ? 550 : 1000
    timeoutId = setTimeout(() => playLines(rest, onDone), delay)
  }

  function playRound() {
    if (roundIdx >= rounds.length) {
      phase  = 'result'
      winner = rounds.at(-1)?.winner ?? null
      afterBattle()
      return
    }

    const round = rounds[roundIdx]
    roundIdx++

    const lines = [`── Round ${round.roundNum} ──`, ...round.lines]

    playLines(lines, () => {
      // HP bars update after all round lines have played — so the log explains the damage first
      p1DisplayHp = round.p1Hp
      p2DisplayHp = round.p2Hp

      if (round.winner !== undefined) {
        phase  = 'result'
        winner = round.winner
        afterBattle()
      } else {
        timeoutId = setTimeout(playRound, 900)
      }
    })
  }

  function afterBattle() {
    if (winner && winner !== 'draw') {
      saveWinnerToBackend()
    }
  }

  async function saveWinnerToBackend() {
    if (!winner || winner === 'draw') return
    saveStatus = 'saving'

    const winnerResults   = winner === 'p1' ? p1Results : p2Results
    const winnerName      = winner === 'p1' ? p1Name    : p2Name
    const winnerStartedAt = winner === 'p1' ? p1StartedAt : p2StartedAt
    const existingShareId = winner === 'p1' ? p1ShareId  : p2ShareId

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
          }),
        })

        if (!res.ok) {
          saveStatus = 'error'
          return
        }

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

      // Increment wins on backend
      const patchRes = await fetch(`/api/characters/${shareId}/rivals-win`, { method: 'PATCH' })
      if (patchRes.ok) {
        const patchData = await patchRes.json() as { rivals_wins: number }
        savedWins    = patchData.rivals_wins
        savedShareId = shareId
        saveStatus   = 'saved'
      } else {
        savedShareId = shareId
        saveStatus   = 'saved'
      }
    } catch {
      saveStatus = 'error'
    }
  }

  onMount(() => {
    p1Char = buildBattleCharacter(p1Results, p1Name)
    p2Char = buildBattleCharacter(p2Results, p2Name)
    p1DisplayHp = p1Char.hp
    p2DisplayHp = p2Char.hp
    rounds = simulateBattle(p1Char, p2Char, 10)

    timeoutId = setTimeout(() => {
      phase = 'battle'
      playRound()
    }, 2600)
  })

  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId)
    if (animTimeoutId) clearTimeout(animTimeoutId)
  })
</script>

<div class="w-full flex flex-col px-3 py-5 sm:px-6 sm:py-8 sm:items-center" style="min-height: 100dvh; max-width: 800px; margin: 0 auto;">

  <!-- Header — compact on mobile -->
  <div class="text-center mb-4 sm:mb-8" style="animation: fadeIn 0.3s ease-out forwards;">
    <p class="text-xs tracking-[0.28em] uppercase mb-1 sm:mb-2" style="font-family: 'JetBrains Mono', monospace; color: #f9a8d4;">⚔ Rivals Mode</p>
    <h1 style="font-family: 'Cinzel', serif; font-size: clamp(1.2rem, 5vw, 2.4rem); font-weight: 900; color: #ffdf96; letter-spacing: 0.15em;">RIVALS BATTLE</h1>
  </div>

  <!-- Character panels + attack animation overlay — always 2 columns on all screen sizes -->
  {#if p1Char && p2Char}
    <div class="w-full relative mb-3 sm:mb-6" style="overflow:visible;">
    <div class="grid grid-cols-2 gap-2 sm:gap-4">

      <!-- P1 panel -->
      <div class="rounded-xl p-2.5 sm:p-4 flex flex-col gap-1.5 sm:gap-2 {dodgeDir === 'ltr' ? 'panel-dodging' : ''}"
        style="background: rgba(240,192,64,0.06); border: 1px solid rgba(240,192,64,{phase === 'result' && winner === 'p1' ? '0.7' : '0.22'}); box-shadow: {phase === 'result' && winner === 'p1' ? '0 0 40px rgba(240,192,64,0.3)' : 'none'}; transition: box-shadow 0.5s, border-color 0.5s;">
        <div class="flex items-center gap-2 min-w-0">
          {#if phase === 'result' && winner === 'p1'}
            <span class="material-symbols-outlined shrink-0" style="font-size: 18px; color: #f0c040; font-variation-settings: 'FILL' 1;">workspace_premium</span>
          {:else if phase === 'result' && winner === 'p2'}
            <span class="material-symbols-outlined shrink-0" style="font-size: 18px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>
          {/if}
          <p class="font-bold truncate" style="font-family: 'Cinzel', serif; color: #ffdf96; font-size: 0.95rem;">{p1Char.name}</p>
        </div>
        <p class="text-xs truncate" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">{p1Char.raceLabel} · {p1Char.archetypeLabel}</p>
        <div class="rounded-full overflow-hidden" style="height: 10px; background: rgba(255,255,255,0.08);">
          <div class="h-full rounded-full" style="width: {p1HpPct * 100}%; background: {hpColor(p1HpPct)}; transition: width 0.8s ease-out, background 0.5s;"></div>
        </div>
        <p class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: {hpColor(p1HpPct)};">{formatHp(p1DisplayHp)} / {formatHp(p1Char.maxHp)} HP</p>
        <div class="grid grid-cols-3 gap-1 mt-1">
          {#each [['ATK', formatHp(p1Char.physicalDamage)], ['DEF', Math.round(p1Char.armorReduction * 100) + '%'], ['INIT', Math.round(p1Char.initiative)]] as [lbl, val]}
            <div class="text-center rounded py-1" style="background: rgba(240,192,64,0.06); border: 1px solid rgba(240,192,64,0.1);">
              <p style="font-family: 'JetBrains Mono', monospace; color: #9a907b; font-size: 9px;">{lbl}</p>
              <p class="font-bold text-xs" style="font-family: 'Cinzel', serif; color: #ffdf96;">{val}</p>
            </div>
          {/each}
        </div>
      </div>

      <!-- P2 panel -->
      <div class="rounded-xl p-2.5 sm:p-4 flex flex-col gap-1.5 sm:gap-2 {dodgeDir === 'rtl' ? 'panel-dodging' : ''}"
        style="background: rgba(232,121,249,0.06); border: 1px solid rgba(232,121,249,{phase === 'result' && winner === 'p2' ? '0.7' : '0.22'}); box-shadow: {phase === 'result' && winner === 'p2' ? '0 0 40px rgba(232,121,249,0.3)' : 'none'}; transition: box-shadow 0.5s, border-color 0.5s;">
        <div class="flex items-center gap-2 min-w-0">
          {#if phase === 'result' && winner === 'p2'}
            <span class="material-symbols-outlined shrink-0" style="font-size: 18px; color: #e879f9; font-variation-settings: 'FILL' 1;">workspace_premium</span>
          {:else if phase === 'result' && winner === 'p1'}
            <span class="material-symbols-outlined shrink-0" style="font-size: 18px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>
          {/if}
          <p class="font-bold truncate" style="font-family: 'Cinzel', serif; color: #e879f9; font-size: 0.95rem;">{p2Char.name}</p>
        </div>
        <p class="text-xs truncate" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">{p2Char.raceLabel} · {p2Char.archetypeLabel}</p>
        <div class="rounded-full overflow-hidden" style="height: 10px; background: rgba(255,255,255,0.08);">
          <div class="h-full rounded-full" style="width: {p2HpPct * 100}%; background: {hpColor(p2HpPct)}; transition: width 0.8s ease-out, background 0.5s;"></div>
        </div>
        <p class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: {hpColor(p2HpPct)};">{formatHp(p2DisplayHp)} / {formatHp(p2Char.maxHp)} HP</p>
        <div class="grid grid-cols-3 gap-1 mt-1">
          {#each [['ATK', formatHp(p2Char.physicalDamage)], ['DEF', Math.round(p2Char.armorReduction * 100) + '%'], ['INIT', Math.round(p2Char.initiative)]] as [lbl, val]}
            <div class="text-center rounded py-1" style="background: rgba(232,121,249,0.06); border: 1px solid rgba(232,121,249,0.1);">
              <p style="font-family: 'JetBrains Mono', monospace; color: #9a907b; font-size: 9px;">{lbl}</p>
              <p class="font-bold text-xs" style="font-family: 'Cinzel', serif; color: #e879f9;">{val}</p>
            </div>
          {/each}
        </div>
      </div>

    </div>

    <!-- Attack FX overlay: absolutely positioned over the panels, flies from attacker to defender -->
    {#if phase === 'battle' && activeAnim}
      {#key activeAnim.key}
        <div style="position:absolute;top:50%;transform:translateY(-50%);
                    {activeAnim.direction === 'rtl' ? 'right:8%' : 'left:8%'};
                    z-index:20;pointer-events:none;">
          <AttackFX type={activeAnim.type} color={activeAnim.color}
                    direction={activeAnim.direction} size={76}/>
        </div>
      {/key}
    {/if}

    </div>
  {/if}

  <!-- Intro VS splash -->
  {#if phase === 'intro' && p1Char && p2Char}
    <div class="text-center py-6" style="animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
      <p style="font-family: 'Cinzel', serif; font-size: 3rem; font-weight: 900; color: #f0c040; letter-spacing: 0.2em; filter: drop-shadow(0 0 20px rgba(240,192,64,0.5));">VS</p>
      <p class="mt-2 text-sm tracking-[0.2em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Calculating fate…</p>
    </div>
  {/if}

  <!-- Battle log — full width below character panels on mobile, centered on desktop -->
  {#if phase !== 'intro'}
    <div class="w-full rounded-xl overflow-hidden mb-4 sm:mb-6" style="border: 1px solid rgba(240,192,64,0.12); background: #0d0d16;">
      <div class="flex items-center gap-2 px-4 py-2.5" style="border-bottom: 1px solid rgba(240,192,64,0.08);">
        <span class="material-symbols-outlined" style="font-size: 14px; color: #9a907b; font-variation-settings: 'FILL' 1;">menu_book</span>
        <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Battle Log</p>
        {#if phase === 'battle'}
          <span class="ml-auto text-xs px-2 py-0.5 rounded" style="background: rgba(157,23,77,0.3); border: 1px solid rgba(157,23,77,0.5); font-family: 'JetBrains Mono', monospace; color: #f9a8d4;">
            Round {roundIdx} of {rounds.length}
          </span>
        {/if}
      </div>
      <div bind:this={logEl} class="overflow-y-auto px-4 py-3" style="max-height: 300px; scroll-behavior: smooth;">
        {#if logLines.length === 0}
          <p class="text-xs text-center py-4" style="color: #4e4635; font-style: italic;">The battle begins…</p>
        {/if}
        {#each logLines as line}
          {#if line.startsWith('──')}
            <p class="text-xs mt-3 mb-1 tracking-[0.15em]" style="font-family: 'JetBrains Mono', monospace; color: #9a907b; border-bottom: 1px solid rgba(240,192,64,0.08); padding-bottom: 4px;">{line}</p>
          {:else if line.includes('CRITICAL') || line.includes('DEVASTATING') || line.includes('PERFECT STRIKE') || line.includes('OVERWHELMING') || line.includes('UNSTOPPABLE') || line.includes('OVERKILL')}
            <p class="text-xs mb-1 font-bold" style="color: #fde047; font-family: 'JetBrains Mono', monospace;">{line}</p>
          {:else if p1Char && line.startsWith(p1Char.name)}
            <p class="text-xs mb-1" style="color: #fde68a; font-family: 'JetBrains Mono', monospace;">{line}</p>
          {:else if p2Char && line.startsWith(p2Char.name)}
            <p class="text-xs mb-1" style="color: #e9d5ff; font-family: 'JetBrains Mono', monospace;">{line}</p>
          {:else}
            <p class="text-xs mb-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-style: italic;">{line}</p>
          {/if}
        {/each}
      </div>
    </div>
  {/if}


</div>

<!-- ══ Result overlay (dark modal) ══════════════════════════════════════════ -->
{#if phase === 'result' && winner}
  {@const winnerName = winner === 'p1' ? p1Char?.name : winner === 'p2' ? p2Char?.name : null}
  {@const winColor   = winner === 'draw' ? '#9ca3af' : winner === 'p1' ? '#f0c040' : '#e879f9'}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px); padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
    <div class="w-full max-w-md rounded-2xl overflow-hidden"
      style="background: {winner === 'draw' ? 'rgba(156,163,175,0.06)' : winner === 'p1' ? 'rgba(240,192,64,0.06)' : 'rgba(232,121,249,0.06)'}; border: 1px solid {winColor}44; box-shadow: 0 0 60px {winColor}14; animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
      <div class="px-5 py-6 text-center">
        {#if winner === 'draw'}
          <p class="text-xs tracking-[0.25em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">The battle concludes</p>
          <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900; color: #d1d5db; letter-spacing: 0.15em;">IT'S A DRAW!</p>
          <p class="mt-2 text-sm" style="color: #9a907b;">Two warriors of equal destiny.</p>
        {:else}
          <p class="text-xs tracking-[0.25em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: {winColor};">Victory</p>
          <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900; color: {winColor}; letter-spacing: 0.12em; filter: drop-shadow(0 0 16px {winColor}55);">{winnerName} WINS!</p>
          <p class="mt-2 text-sm" style="color: #9a907b;">Fate has spoken.</p>

          {#if saveStatus === 'saving'}
            <p class="mt-3 text-xs" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Saving to champions record…</p>
          {:else if saveStatus === 'saved'}
            <div class="mt-3 flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined" style="font-size: 14px; color: #34d399; font-variation-settings: 'FILL' 1;">check_circle</span>
              <p class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: #34d399;">Saved — {savedWins} rival win{savedWins !== 1 ? 's' : ''} total</p>
            </div>
          {:else if saveStatus === 'error'}
            <p class="mt-3 text-xs" style="font-family: 'JetBrains Mono', monospace; color: #f87171;">Could not save — session too brief or server unavailable.</p>
          {/if}
        {/if}

        <!-- Action buttons -->
        <div class="flex flex-col gap-2 mt-5">
          {#if winner !== 'draw' && onChallengeWinner && saveStatus === 'saved'}
            {@const winResults = winner === 'p1' ? p1Results : p2Results}
            {@const winName    = winner === 'p1' ? p1Name    : p2Name}
            <button
              onclick={() => onChallengeWinner!(winResults, winName, savedShareId)}
              class="w-full py-3 rounded-xl text-sm tracking-[0.14em] uppercase font-bold transition-all active:scale-95"
              style="font-family: 'Cinzel', serif; color: #fde68a; background: linear-gradient(135deg, #1c1a2a, #13121c); border: 1px solid #f0c040; box-shadow: 0 0 20px rgba(240,192,64,0.18);"
            >Challenge Winner</button>
          {/if}
          <div class="flex gap-2">
            <button
              onclick={onRematch}
              class="flex-1 py-3 rounded-xl text-sm tracking-[0.14em] uppercase font-bold transition-all active:scale-95"
              style="font-family: 'Cinzel', serif; color: #f9a8d4; background: rgba(157,23,77,0.12); border: 1px solid #9d174d;"
            >⚔ Rematch</button>
            <button
              onclick={onBackToMenu}
              class="flex-1 py-3 rounded-xl text-sm tracking-[0.14em] uppercase font-bold transition-all active:scale-95"
              style="font-family: 'Cinzel', serif; color: #9a907b; background: rgba(255,255,255,0.03); border: 1px solid #4e4635;"
            >Menu</button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
@keyframes panel-dodge {
  0%   { opacity: 1;    transform: translateX(0);     filter: none; }
  12%  { opacity: 0.22; transform: translateX(-15px);  filter: brightness(1.8) blur(3px); }
  30%  { opacity: 0.45; transform: translateX(11px);   filter: brightness(1.4) blur(1.5px); }
  50%  { opacity: 0.18; transform: translateX(-9px);   filter: brightness(2) blur(3px); }
  68%  { opacity: 0.55; transform: translateX(5px);    filter: blur(1px); }
  85%  { opacity: 0.85; transform: translateX(-2px);   filter: none; }
  100% { opacity: 1;    transform: translateX(0);     filter: none; }
}
.panel-dodging {
  animation: panel-dodge 0.75s ease-out forwards;
  will-change: transform, opacity;
}
</style>
