<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    BATTLE_SPECS, rollDrops, WORLD_GRADES, ENDLESS_KEY_DROP_RATE,
    type WorldGrade, type Enemy, type WaveEnemySpec,
  } from '$lib/story/worlds'
  import {
    buildBattleCharacter, formatHp,
    type BattleCharacter,
  } from '$lib/game/battle'
  import {
    recordEndlessResult, applyBattleDrops,
    type StorySaveSlot, type BattleDrops,
  } from '$lib/story/saveSlots'
  import type { StoryRosterEntry, StoryTeam } from '$lib/story/types'
  import BattleArena from '../BattleArena.svelte'
  import { BattleControllerTeam } from '$lib/battle/teamController'
  import { memberFromChar, type ArenaRound, type ArenaTeam, type ArenaWinner } from '$lib/battle/arena'
  import { settings } from '$lib/settings.svelte'
  import { auth } from '$lib/stores/auth.svelte'

  let { slot, onExit, gamepasses = [] }: {
    slot: StorySaveSlot
    onExit: (updated: StorySaveSlot) => void
    gamepasses?: string[]
  } = $props()

  // World-grade → accent color. Mirrors WorldsView's canonical palette so
  // endless wave chrome reads with the same colors as the story-mode worlds
  // menu, gallery, and character cards.
  const GRADE_COLORS: Record<string, string> = {
    F: '#404040', E: '#64748b', D: '#166534', C: '#059669',
    B: '#0d9488', A: '#0e7490', S: '#0369a1', SS: '#2563eb',
    SSS: '#4f46e5', Z: '#7c3aed', ZZ: '#a21caf', ZZZ: '#db2777',
    Cosmic: '#0891b2', Immortal: '#ec4899',
    Celestial: '#9d174d', Godly: '#f472b6', Primordial: '#e4e4e7', Absolute: '#38bdf8',
    Transcendent: '#65a30d', Infinite: '#262626',
  }
  function gradeColor(g: string): string { return GRADE_COLORS[g] ?? '#9a907b' }

  // ── Endless wave helpers ───────────────────────────────────────────────────
  // 3 waves per world grade → wave 1-3=F, 4-6=E, …, 46-48=Absolute, 49+=Absolute+scaled
  function endlessGrade(wave: number): WorldGrade {
    return WORLD_GRADES[Math.min(15, Math.floor((wave - 1) / 3))]
  }

  function endlessHpScale(wave: number): number {
    if (wave <= 48) return 1
    // +20% HP per wave beyond Absolute tier (every 3 waves)
    return 1 + Math.floor((wave - 48) / 3) * 0.2
  }

  function endlessSpec(wave: number): WaveEnemySpec[][] {
    return BATTLE_SPECS[Math.min(wave - 1, BATTLE_SPECS.length - 1)]
  }

  function buildEndlessEnemies(wave: number): Enemy[][] {
    const grade = endlessGrade(wave)
    const spec = endlessSpec(wave)
    const hasBossMagnet = gamepasses.includes('boss_magnet')
    return spec.map(waveSpec =>
      waveSpec.flatMap(({ type, count }) =>
        Array.from({ length: count }, (_, i) => {
          // boss_magnet: 25% chance to upgrade any warrior to elite, or elite to boss
          let effectiveType = type
          if (hasBossMagnet && effectiveType !== 'boss' && Math.random() < 0.25) {
            effectiveType = effectiveType === 'elite' ? 'boss' : 'elite'
          }
          const suffix = count > 1 ? ` ${i + 1}` : ''
          const name = effectiveType === 'boss' ? `${grade} Overlord`
            : effectiveType === 'elite' ? `${grade} Champion${suffix}`
            : `${grade} Warrior${suffix}`
          return { grade, type: effectiveType, name } as Enemy
        })
      )
    )
  }

  // ── Stat ranges (same as BattleView) ──────────────────────────────────────
  const WORLD_STAT_RANGE: Record<WorldGrade, [number, number]> = {
    F:[0,12], E:[5,17], D:[9,21], C:[14,26], B:[18,30], A:[23,35],
    S:[27,40], SS:[32,44], SSS:[36,46],
    Z:[38,48], ZZ:[40,50], ZZZ:[42,52],
    Cosmic:[44,53], Immortal:[46,54],
    Celestial:[48,55], Godly:[50,56], Primordial:[52,57], Absolute:[54,58],
    Transcendent:[56,59], Infinite:[58,59],
  }
  const ENEMY_BASE_HP: Record<string, number> = {
    F: 100, E: 300, D: 650, C: 1250, B: 2500, A: 5000,
    S: 10000, SS: 22000, SSS: 47000, Z: 100000, ZZ: 220000, ZZZ: 470000,
    Cosmic: 1_000_000, Immortal: 2_200_000,
    Celestial: 4_900_000, Godly: 10_800_000, Primordial: 23_700_000, Absolute: 52_000_000,
    Transcendent: 114_000_000, Infinite: 250_000_000,
  }
  function randRank(min: number, max: number): number {
    return Math.round(min + Math.random() * (max - min))
  }
  function buildEnemyChar(enemy: Enemy, wave: number): BattleCharacter {
    const [minR, maxR] = WORLD_STAT_RANGE[enemy.grade] ?? [0, 12]
    const idx = WORLD_GRADES.indexOf(enemy.grade)
    const baseHp = ENEMY_BASE_HP[enemy.grade] ?? 100
    const typeMult = enemy.type === 'boss' ? 2.5 : enemy.type === 'elite' ? 1.5 : 1.0
    const hp = Math.round(baseHp * typeMult * endlessHpScale(wave))
    const agilityRank       = randRank(minR, maxR)
    const speedRank         = randRank(minR, maxR)
    const fightingSkillRank = randRank(minR, maxR)
    const potentialRank     = randRank(minR, maxR)
    const energyRank        = randRank(minR, maxR)
    const iqRank            = randRank(minR, maxR)
    const charismaRank      = randRank(minR, maxR)
    const avgRank = (agilityRank + speedRank + fightingSkillRank) / 3
    const dmg = Math.round(hp / 2 * (1 + avgRank / 82))
    return {
      name: enemy.name,
      raceLabel: enemy.grade + ' Entity',
      archetypeLabel: enemy.type === 'boss' ? 'Overlord' : enemy.type === 'elite' ? 'Champion' : 'Warrior',
      hp, maxHp: hp,
      physicalDamage: dmg,
      powerDamage: Math.round(dmg * 0.9),
      armorReduction: Math.min(0.60, 0.05 + idx * 0.035),
      armorType: 'Full-Suit',
      weaponType: 'Melee',
      agilityRank, speedRank, charismaRank, iqRank, potentialRank, energyRank, fightingSkillRank,
      powerMasteryRank: avgRank, weaponMasteryRank: avgRank,
      weaponEnchantTags: [], armorEnchantTags: [],
      critChance: Math.min(0.40, 0.08 + idx * 0.02),
      critMultiplier: Math.min(2.8, 1.5 + idx * 0.08),
      dodgeChance: Math.min(0.55, 0.05 + idx * 0.035),
      initiative: avgRank,
      elementWeaknesses: [], statusImmunities: [],
      passiveHealPerRound: 0, powerDamageReduction: 0, physicalDamageReduction: 0,
      damageReductionCap: 0.80, summons: [], buffMultiplier: 1.0, buffRoundsLeft: 0,
      gimmickIds: [],
      moves: [
        { name: `${enemy.grade} Strike`, type: 'physical', effectTag: null, behavior: 'attack', attackType: 'attack' as const },
        { name: enemy.type === 'boss' ? 'Overwhelming Destruction' : `${enemy.grade} Blast`, type: 'power', effectTag: null, behavior: 'attack', attackType: 'attack' as const },
      ],
    }
  }

  // ── State ──────────────────────────────────────────────────────────────────
  type Phase = 'pick' | 'intro' | 'fight' | 'wave_result' | 'gameover'
  let phase        = $state<Phase>('pick')
  let selectedTeam = $state<StoryTeam | null>(null)
  let currentWave  = $state(1)
  let wavesCleared = $state(0)
  let accDrops     = $state<BattleDrops>({ gems: 0, xp: 0, chanceDrops: [] })
  let waveDrops    = $state<BattleDrops | null>(null)
  let playerWon    = $state(false)
  let isNewRecord  = $state(false)

  // Autoplay — when on, the wave_result screen auto-advances to the next wave
  // after a short delay. Player can interrupt by tapping Quit. Persisted in
  // localStorage so the preference survives page reloads.
  const AUTOPLAY_KEY = 'wof_endless_autoplay_v1'
  function loadAutoplay(): boolean {
    if (typeof localStorage === 'undefined') return false
    try { return localStorage.getItem(AUTOPLAY_KEY) === '1' } catch { return false }
  }
  let autoplay = $state(loadAutoplay())
  let autoplayCountdown = $state(0)
  let autoplayTimer: ReturnType<typeof setInterval> | null = null
  let autoplayTimeout: ReturnType<typeof setTimeout> | null = null
  function toggleAutoplay() {
    autoplay = !autoplay
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(AUTOPLAY_KEY, autoplay ? '1' : '0') } catch { /* quota */ }
    }
    if (!autoplay) cancelAutoplayTimer()
    else if (phase === 'wave_result') startAutoplayTimer()
  }
  function startAutoplayTimer() {
    cancelAutoplayTimer()
    autoplayCountdown = 3000
    autoplayTimer = setInterval(() => {
      autoplayCountdown = Math.max(0, autoplayCountdown - 100)
    }, 100)
    autoplayTimeout = setTimeout(() => {
      cancelAutoplayTimer()
      advanceToNextWave()
    }, 3000)
  }
  function cancelAutoplayTimer() {
    if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null }
    if (autoplayTimeout) { clearTimeout(autoplayTimeout); autoplayTimeout = null }
    autoplayCountdown = 0
  }
  $effect(() => {
    if (phase === 'wave_result' && autoplay) startAutoplayTimer()
    else if (phase !== 'wave_result') cancelAutoplayTimer()
  })

  // Combat state — driven by the shared BattleArena + BattleControllerTeam
  // since the Endless-mode UI migration. Endless used to pre-roll the whole
  // sub-wave with simulateTeamBattle and replay it manually with its own VFX
  // scheduler; now it shares the same live controller pipeline that powers
  // every other battle screen so damage indicators, stat panels, and the
  // recent VFX upgrades apply here too.
  let allSubWaves   = $state<Enemy[][]>([])
  let subWaveIdx    = $state(0)
  let t1Chars       = $state<BattleCharacter[]>([])
  let t2Chars       = $state<BattleCharacter[]>([])
  let t1DispHp      = $state<number[]>([])      // mirror of player HP for between-wave restore + handoff
  let arenaPhase    = $state<'intro' | 'battle' | 'result'>('intro')
  let arenaTeams    = $state<[ArenaTeam, ArenaTeam] | null>(null)
  let controller    = $state<BattleControllerTeam | null>(null)
  let prevEnemyHp   = $state<Record<string, number>>({})
  let killedIds     = $state(new Set<string>())
  let timeoutId:    ReturnType<typeof setTimeout> | null = null
  let canInstant    = $derived(gamepasses.includes('instant_battle'))
  let manualMode    = $state(!settings.autoBattle)

  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })

  // ── Derived ────────────────────────────────────────────────────────────────
  let currentGrade = $derived(endlessGrade(currentWave))
  let ec           = $derived(gradeColor(currentGrade))

  let teams = $derived(
    (slot.teams ?? []).map(t => ({
      team: t,
      members: t.characterIds.map(id => slot.roster.find(r => r.id === id)).filter((r): r is StoryRosterEntry => !!r),
    })).filter(t => t.members.length > 0)
  )

  let teamMembers = $derived(
    selectedTeam
      ? (slot.teams ?? []).find(t => t.id === selectedTeam!.id)?.characterIds
          .map(id => slot.roster.find(r => r.id === id))
          .filter((r): r is StoryRosterEntry => !!r) ?? []
      : []
  )

  let teamCharIds = $derived(
    selectedTeam
      ? (slot.teams ?? []).find(t => t.id === selectedTeam!.id)?.characterIds ?? []
      : []
  )

  // ── BattleArena driven flow ────────────────────────────────────────────
  // Endless used to roll the whole sub-wave with simulateTeamBattle and
  // play it back via a hand-built VFX scheduler. The migration to the
  // shared BattleArena collapsed all of that into the same live-controller
  // pipeline that powers story-mode battles. Endless-specific behaviour
  // (HP persistence, 30% sub-wave restore, autoplay between waves,
  // game-over on team wipe) lives in handleArenaEnd below.
  function startSubWave() {
    killedIds = new Set()
    const subEnemies = allSubWaves[subWaveIdx] ?? []
    t2Chars = subEnemies.map(e => buildEnemyChar(e, currentWave))
    // t1Chars HP was synced back from controller.getHp() at end of prior
    // sub-wave (see handleArenaEnd). Apply the cross-sub-wave 30% restore
    // BEFORE building the controller so the new arena reflects it.

    const t1Ids = t1Chars.map((_, i) => `t1-${i}`)
    const t2Ids = t2Chars.map((_, i) => `t2-${i}-sw${subWaveIdx}`)

    arenaTeams = [
      {
        side: 'team1',
        label: selectedTeam?.name ?? 'Your Team',
        accent: '#f0c040',
        members: t1Chars.map((c, i) =>
          memberFromChar(c, t1Ids[i], 'team1', formatHp, teamMembers[i]?.spinClass)),
      },
      {
        side: 'team2',
        label: allSubWaves.length > 1
          ? `Sub-wave ${subWaveIdx + 1} / ${allSubWaves.length}`
          : 'Enemies',
        accent: ec,
        members: t2Chars.map((c, i) => memberFromChar(c, t2Ids[i], 'team2', formatHp)),
      },
    ]

    controller = new BattleControllerTeam(
      t1Chars.map((c, i) => ({ id: t1Ids[i], side: 'team1', char: c })),
      t2Chars.map((c, i) => ({ id: t2Ids[i], side: 'team2', char: c })),
    )

    prevEnemyHp = Object.fromEntries(t2Ids.map((id, i) => [id, t2Chars[i].hp]))
    arenaPhase = 'intro'
  }

  function handleArenaRoundEnd(round: ArenaRound) {
    // Track newly-killed enemies → accumulate drops.
    for (const id of Object.keys(prevEnemyHp)) {
      const prev = prevEnemyHp[id]
      const now  = round.hpAfter[id] ?? prev
      if (prev > 0 && now <= 0 && !killedIds.has(id)) {
        killedIds.add(id)
        killedIds = killedIds  // force reactivity
        const idx = t2Chars.findIndex((_, i) => `t2-${i}-sw${subWaveIdx}` === id)
        const enemy = idx >= 0 ? allSubWaves[subWaveIdx]?.[idx] : undefined
        if (enemy) {
          const d = rollDrops(enemy)
          accDrops = {
            gems: accDrops.gems + d.gems,
            xp:   accDrops.xp + d.xp,
            chanceDrops: [...accDrops.chanceDrops, ...d.chanceDrops],
          }
        }
      }
    }
    prevEnemyHp = { ...prevEnemyHp, ...round.hpAfter }
  }

  function handleArenaEnd(w: ArenaWinner) {
    // Sync player HP back from controller for the next sub-wave / next wave.
    if (controller) {
      t1Chars = t1Chars.map((c, i) => ({ ...c, hp: controller!.getHp(`t1-${i}`) }))
      t1DispHp = t1Chars.map(c => c.hp)
    }

    if (w !== 'team1') { finishWave(false); return }
    if (subWaveIdx + 1 >= allSubWaves.length) { finishWave(true); return }

    // Player won this sub-wave + more sub-waves remain: restore 30% HP to
    // living allies, advance index, remount the arena for the next group.
    t1Chars = t1Chars.map(c => {
      if (c.hp <= 0) return c
      return { ...c, hp: Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.3)) }
    })
    t1DispHp = t1Chars.map(c => c.hp)
    subWaveIdx = subWaveIdx + 1
    timeoutId = setTimeout(startSubWave, 800)
  }

  function finishWave(won: boolean) {
    playerWon = won
    if (won) {
      if (slot.playerLevel >= 3 && Math.random() < ENDLESS_KEY_DROP_RATE) {
        accDrops = { ...accDrops, chanceDrops: [...accDrops.chanceDrops, 'endlessKey'] }
      }
      wavesCleared = currentWave
      waveDrops = { ...accDrops }
    } else {
      waveDrops = null
    }
    phase = won ? 'wave_result' : 'gameover'
  }

  function startWave() {
    allSubWaves = buildEndlessEnemies(currentWave)
    subWaveIdx  = 0

    // Team HP persists between endless waves — no full restore.
    // First wave: build t1Chars from roster. Subsequent waves: reuse with
    // current HP from the prior wave's controller (already synced into
    // t1Chars during handleArenaEnd).
    if (phase === 'intro') {
      t1Chars  = teamMembers.map(m => {
        // Apply the same spin-class + character-level multipliers Story Mode
        // applies (BattleView.svelte) — Hero ×2, Legend ×4, Paragon ×8.
        const spinMult  = m.spinClass === 'paragon' ? 8
                        : m.spinClass === 'legend'  ? 4
                        : m.spinClass === 'hero'    ? 2
                        : 1
        const levelMult = 1 + Math.max(0, (m.level ?? 1) - 1) * 0.01
        return buildBattleCharacter(m.spins, m.name, {
          weapons: m.equippedWeapons ?? [],
          armors:  m.equippedArmors  ?? [],
          powers:  m.equippedPowers  ?? [],
        }, spinMult * levelMult)
      })
      t1DispHp = t1Chars.map(c => c.hp)
      accDrops = { gems: 0, xp: 0, chanceDrops: [] }
    }
    // Re-sync HP back onto t1Chars in case advanceToNextWave updated it.
    t1Chars = t1Chars.map((c, i) => ({ ...c, hp: t1DispHp[i] ?? c.maxHp }))

    phase = 'fight'
    startSubWave()
  }

  function startRun() {
    if (!selectedTeam || teamMembers.length === 0) return
    currentWave = 1
    wavesCleared = 0
    // BattleArena owns the intro splash now, so we drop the 2.6s blank
    // screen that used to gate the start of the run. The startWave call
    // still uses phase==='intro' as the "first-time roster build"
    // sentinel — set it briefly here so that branch fires once.
    phase = 'intro'
    startWave()
  }

  function advanceToNextWave() {
    currentWave++
    // Slight HP restore (15%) between waves as a breather
    t1DispHp = t1Chars.map((c, i) => {
      const cur = t1DispHp[i] ?? 0
      if (cur <= 0) return 0
      return Math.min(c.maxHp, cur + Math.round(c.maxHp * 0.15))
    })
    t1Chars = t1Chars.map((c, i) => ({ ...c, hp: t1DispHp[i] }))
    phase = 'fight'
    timeoutId = setTimeout(() => startWave(), 50)
  }

  function buildFinalSlot(clearedWave: number): StorySaveSlot {
    const prevBest = slot.endlessHighestWave ?? 0
    isNewRecord = clearedWave > prevBest
    return recordEndlessResult(slot, clearedWave, accDrops, teamCharIds)
  }

  async function submitEndlessScore(wave: number, characterName: string, race: string, archetype: string, tier: string) {
    if (!auth.loggedIn) return
    try {
      await fetch('/api/endless/score', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wave, characterName, race, archetype, tier }),
      })
    } catch { /* silent */ }
  }

  function handleQuit() {
    const updated = buildFinalSlot(wavesCleared)
    onExit(updated)
  }

  function handleGameOver() {
    const updated = buildFinalSlot(wavesCleared)
    // Submit endless score using the best character in team (first member as representative)
    const rep = teamMembers[0]
    if (rep && wavesCleared > 0) {
      submitEndlessScore(wavesCleared, rep.name, rep.race, rep.archetype, rep.overallTier)
    }
    onExit(updated)
  }

  function getDropLabel(drop: string): string {
    if (drop === 'fateShard')   return 'Fate Shard'
    if (drop === 'endlessKey')  return 'Endless Key'
    if (drop === 'spin')        return '✦ Bonus Spin'
    const colon = drop.indexOf(':')
    if (colon === -1) return drop
    const [type, suffix] = [drop.slice(0, colon), drop.slice(colon + 1)]
    const cap = suffix.charAt(0).toUpperCase() + suffix.slice(1)
    if (type === 'statCrystal')   return `Stat Crystal (${cap})`
    if (type === 'powerCrystal')  return `Power Crystal (${suffix})`
    if (type === 'weaponCrystal') return `Weapon Crystal (${suffix})`
    if (type === 'armorCrystal')  return `Armor Crystal (${suffix})`
    return drop
  }
</script>

<!-- ── Header ──────────────────────────────────────────────────────────────── -->
<header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4"
  style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(167,139,250,0.2); backdrop-filter: blur(20px);">
  {#if phase === 'pick'}
    <button onclick={handleQuit}
      style="background: none; border: none; cursor: pointer; color: var(--color-outline); font-size: 20px; line-height: 1; padding: 8px;">←</button>
  {:else}
    <div style="width: 36px;"></div>
  {/if}
  <div class="flex-1 text-center">
    <h2 class="font-bold" style="font-family: var(--font-cinzel); font-size: 15px; color: #a78bfa;">
      {#if phase === 'pick'}
        Endless Mode
      {:else}
        Wave {currentWave} — {currentGrade} Grade
      {/if}
    </h2>
    {#if phase !== 'pick' && (slot.endlessHighestWave ?? 0) > 0}
      <p class="font-mono text-xs" style="color: var(--color-outline);">Best: Wave {slot.endlessHighestWave}</p>
    {/if}
  </div>
  <div style="width: 36px;"></div>
</header>

<div class="pt-20 px-4 w-full flex flex-col" style="max-width: 560px; margin: 0 auto; min-height: 100dvh; padding-bottom: max(96px, calc(env(safe-area-inset-bottom, 0px) + 96px));">

  <!-- ══ Pick phase ══════════════════════════════════════════════════════════ -->
  {#if phase === 'pick'}
    <!-- Info card -->
    <div class="rounded-xl px-4 py-4 mb-3" style="background: rgba(167,139,250,0.06); border: 1px solid rgba(167,139,250,0.2);">
      <p class="font-bold text-sm mb-2" style="font-family: var(--font-cinzel); color: #a78bfa;">How Endless Works</p>
      <ul class="font-mono text-xs flex flex-col gap-1" style="color: var(--color-outline);">
        <li>• Fight waves that grow stronger every 3 waves</li>
        <li>• Team HP persists — no full heal between waves</li>
        <li>• Survive as long as possible; drops accumulate</li>
        <li>• Your best wave is saved as your record</li>
        {#if (slot.endlessHighestWave ?? 0) > 0}
          <li style="color: #a78bfa;">• Personal best: Wave {slot.endlessHighestWave}</li>
        {/if}
      </ul>
    </div>

    <!-- Autoplay toggle — power-user feature for AFK grinding. Persists across
         sessions. Saves you tapping "Next Wave" 30 times in a row. -->
    <button onclick={toggleAutoplay} data-fx="big"
      class="flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-5 transition-all active:scale-95"
      style="background: {autoplay ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.03)'}; border: 1px solid {autoplay ? 'rgba(52,211,153,0.32)' : 'rgba(255,255,255,0.08)'}; cursor: pointer;">
      <div class="flex items-center gap-2.5">
        <span class="material-symbols-outlined" style="font-size: 18px; color: {autoplay ? '#34d399' : '#9a907b'}; font-variation-settings: 'FILL' 1;">{autoplay ? 'play_circle' : 'pause_circle'}</span>
        <div class="text-left">
          <p class="font-bold text-sm" style="font-family: 'Cinzel', serif; color: {autoplay ? '#34d399' : '#e4e1ee'};">Autoplay</p>
          <p class="font-mono text-[10px]" style="color: #9a907b;">Auto-advance to next wave after a 3s breather</p>
        </div>
      </div>
      <div class="rounded-full transition-all" style="width: 38px; height: 22px; padding: 2px; background: {autoplay ? '#34d399' : '#3a3a48'};">
        <div class="rounded-full transition-all" style="width: 18px; height: 18px; background: #0d0d16; transform: translateX({autoplay ? '16px' : '0'});"></div>
      </div>
    </button>

    {#if teams.length === 0}
      <div class="text-center pt-8">
        <p class="font-mono text-sm mt-3" style="color: var(--color-outline);">No teams — create one in the Teams menu.</p>
      </div>
    {:else}
      <p class="font-bold text-sm mb-3" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Select your team:</p>
      <div class="flex flex-col gap-2 mb-24">
        {#each teams as { team, members } (team.id)}
          {@const sel = selectedTeam?.id === team.id}
          <button
            onclick={() => selectedTeam = team}
            class="obsidian-slab rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
            style="border: 1px solid {sel ? 'rgba(167,139,250,0.5)' : 'transparent'}; cursor: pointer; background: {sel ? 'rgba(167,139,250,0.05)' : ''}; transition: border-color 120ms;"
          >
            <div class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
              style="background: {sel ? 'rgba(167,139,250,0.18)' : 'rgba(167,139,250,0.07)'}; border: 1px solid rgba(167,139,250,{sel ? '0.4' : '0.15'});">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #a78bfa; font-variation-settings: 'FILL' 1;">shield_person</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-sm truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{team.name}</p>
              <div class="flex flex-wrap gap-x-2 mt-0.5">
                {#each members as m}
                  <span class="font-mono text-xs" style="color: var(--color-outline);">{m.name} <span style="color: #a78bfa;">({m.overallTier})</span></span>
                {/each}
              </div>
            </div>
            {#if sel}
              <span class="material-symbols-outlined flex-shrink-0" style="font-size: 18px; color: #a78bfa; font-variation-settings: 'FILL' 1;">check_circle</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Sits above the 64px bottom nav so it isn't half-occluded by the hotbar. -->
    <div class="fixed left-0 right-0 px-4 pt-3 z-20"
      style="bottom: 64px; background: linear-gradient(transparent, rgba(7,7,13,0.97) 40%); padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));">
      <div class="max-w-md mx-auto">
        <button onclick={startRun} disabled={!selectedTeam || teamMembers.length === 0}
          data-fx="big"
          class="{selectedTeam && teamMembers.length > 0 ? '' : 'obsidian-slab'} w-full py-3.5 rounded-xl font-bold font-mono text-sm tracking-widest"
          style="{selectedTeam && teamMembers.length > 0 ? 'background: rgba(167,139,250,0.15); border: 1.5px solid rgba(167,139,250,0.5); color: #a78bfa; cursor: pointer;' : 'opacity: 0.4; cursor: not-allowed; color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07);'}">
          ∞ Enter Endless
        </button>
      </div>
    </div>
  {/if}


</div>

<!-- ══ Fight phase — unified BattleArena (shared with story mode) ═════════ -->
<!-- Mount per sub-wave (keyed on currentWave + subWaveIdx) so the arena
     remounts cleanly between groups. BattleArena owns the chrome that
     used to be hand-coded here: cards, HP bars, status badges, battle
     log, VFX overlay, floating damage indicators, intro splash. -->
{#if phase === 'fight' && arenaTeams && controller}
  {#key `${currentWave}-${subWaveIdx}`}
    <BattleArena
      bind:phase={arenaPhase}
      teams={arenaTeams}
      controller={controller}
      manualMode={manualMode}
      onManualToggle={(m) => manualMode = m}
      modeTitle={`Wave ${currentWave} — ${currentGrade}`}
      modeSubtitle={allSubWaves.length > 1
        ? `Sub-wave ${subWaveIdx + 1} / ${allSubWaves.length}`
        : 'Endless Mode'}
      modeAccent={ec}
      speedFactor={settings.battleSpeed}
      effectsEnabled={settings.effectsEnabled}
      canInstant={canInstant}
      onRoundEnd={handleArenaRoundEnd}
      onBattleEnd={handleArenaEnd}/>
  {/key}
{/if}

<!-- ══ Wave result overlay ═════════════════════════════════════════════════ -->
{#if phase === 'wave_result'}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px); padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
    <!-- Modal: capped at 80% viewport height with flex layout so the
         header + footer are pinned and the drops section scrolls when
         the accumulated chance-drop list grows long across many waves. -->
    <div class="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
      style="background: linear-gradient(135deg, rgba(167,139,250,0.16), rgba(8,7,16,0.95) 75%); border: 1px solid rgba(167,139,250,0.45); box-shadow: 0 0 32px rgba(167,139,250,0.25), inset 0 1px 0 rgba(255,255,255,0.06); animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; max-height: 80vh;">
      <!-- Pinned header -->
      <div class="px-5 pt-5 pb-3 text-center" style="flex-shrink: 0;">
        <span class="material-symbols-outlined" style="font-size: 32px; color: #a78bfa; font-variation-settings: 'FILL' 1; filter: drop-shadow(0 0 12px rgba(167,139,250,0.6));">military_tech</span>
        <p class="text-xs tracking-[0.32em] uppercase mt-1 mb-1.5" style="font-family: 'JetBrains Mono', monospace; color: #a78bfa; font-weight: 700;">Wave Cleared!</p>
        <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 1.8rem); font-weight: 900; color: #a78bfa; letter-spacing: 0.1em; filter: drop-shadow(0 0 16px rgba(167,139,250,0.55));">
          Wave {wavesCleared} — {currentGrade}
        </p>
      </div>
      <!-- Scrollable drops section — grows to fill available space; if
           the chance-drops list explodes (many waves cleared), this is
           where the overflow goes instead of pushing the modal off-screen. -->
      {#if waveDrops}
        <div class="px-5" style="flex: 1 1 auto; overflow-y: auto; min-height: 0;">
          <div class="text-left mx-auto px-3 py-2.5 rounded-xl" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(167,139,250,0.12);">
            <p class="font-mono text-xs mb-2 tracking-widest uppercase" style="color: var(--color-outline);">Drops This Run</p>
            <div class="flex items-center gap-4 mb-2">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined" style="font-size: 14px; color: #34d399; font-variation-settings: 'FILL' 1;">paid</span>
                <span class="font-mono text-sm font-bold" style="color: #34d399;">+{waveDrops.gems.toLocaleString()}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined" style="font-size: 14px; color: #a78bfa; font-variation-settings: 'FILL' 1;">bolt</span>
                <span class="font-mono text-sm font-bold" style="color: #a78bfa;">+{waveDrops.xp.toLocaleString()} XP</span>
              </div>
            </div>
            {#if waveDrops.chanceDrops.length > 0}
              <div class="flex flex-wrap gap-1 mt-1">
                {#each waveDrops.chanceDrops as drop}
                  <span class="font-mono text-xs px-1.5 py-0.5 rounded"
                    style="background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.25); color: #a78bfa;">
                    {getDropLabel(drop)}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}
      <!-- Pinned footer buttons (always visible regardless of drop count) -->
      <div class="px-5 pb-5 pt-3 flex flex-col gap-2" style="flex-shrink: 0;">
        <button onclick={() => { cancelAutoplayTimer(); advanceToNextWave() }}
          data-fx="big"
          class="w-full py-3 rounded-xl font-bold font-mono text-sm tracking-widest"
          style="background: rgba(167,139,250,0.15); border: 1.5px solid rgba(167,139,250,0.5); color: #a78bfa; cursor: pointer;">
          ⚔ Wave {currentWave + 1}{autoplay && autoplayCountdown > 0 ? ` · auto in ${Math.ceil(autoplayCountdown / 1000)}s` : ''}
        </button>
        <button onclick={() => { cancelAutoplayTimer(); handleQuit() }}
          class="w-full obsidian-slab py-2.5 rounded-xl font-mono text-sm tracking-widest"
          style="border: 1px solid rgba(167,139,250,0.2); color: var(--color-outline);">
          ↩ Quit & Save
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ══ Game Over overlay ═══════════════════════════════════════════════════ -->
{#if phase === 'gameover'}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
    <!-- Capped + scrollable to handle deep endless runs with huge drop lists. -->
    <div class="w-full max-w-md bv-result-banner bv-result-loss flex flex-col"
         style="max-height: 80vh;">
      <!-- Pinned header -->
      <div class="text-center px-5 pt-4 pb-2" style="flex-shrink: 0;">
        <span class="material-symbols-outlined" style="font-size: 36px; color: #ef4444; font-variation-settings: 'FILL' 1; filter: drop-shadow(0 0 12px rgba(239,68,68,0.5));">sentiment_dissatisfied</span>
        <p class="text-xs tracking-[0.32em] uppercase mt-1 mb-1.5" style="font-family: 'JetBrains Mono', monospace; color: #ef4444; font-weight: 700;">Game Over</p>
        <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900; color: #ef4444; letter-spacing: 0.12em;">
          Survived {wavesCleared} Wave{wavesCleared !== 1 ? 's' : ''}
        </p>
        {#if isNewRecord && wavesCleared > 0}
          <p class="mt-1 font-mono text-sm font-bold" style="color: #ffd700;">🏆 New Personal Best!</p>
        {:else if (slot.endlessHighestWave ?? 0) > 0}
          <p class="mt-1 font-mono text-xs" style="color: #9a907b;">Best: Wave {slot.endlessHighestWave}</p>
        {/if}
      </div>
      <!-- Scrollable drops -->
      {#if accDrops.gems > 0 || accDrops.xp > 0}
        <div class="px-5" style="flex: 1 1 auto; overflow-y: auto; min-height: 0;">
          <div class="text-left mx-auto px-3 py-2.5 rounded-xl" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(239,68,68,0.12);">
            <p class="font-mono text-xs mb-2 tracking-widest uppercase" style="color: var(--color-outline);">Drops Collected</p>
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined" style="font-size: 14px; color: #34d399; font-variation-settings: 'FILL' 1;">paid</span>
                <span class="font-mono text-sm font-bold" style="color: #34d399;">+{accDrops.gems.toLocaleString()}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined" style="font-size: 14px; color: #a78bfa; font-variation-settings: 'FILL' 1;">bolt</span>
                <span class="font-mono text-sm font-bold" style="color: #a78bfa;">+{accDrops.xp.toLocaleString()} XP</span>
              </div>
            </div>
            {#if accDrops.chanceDrops.length > 0}
              <div class="flex flex-wrap gap-1 mt-2">
                {#each accDrops.chanceDrops as drop}
                  <span class="font-mono text-xs px-1.5 py-0.5 rounded"
                    style="background: rgba(240,192,64,0.1); border: 1px solid rgba(240,192,64,0.25); color: var(--gold-bright);">
                    {getDropLabel(drop)}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}
      <!-- Pinned footer button -->
      <div class="px-5 pb-5 pt-3" style="flex-shrink: 0;">
        <button onclick={handleGameOver}
          class="w-full py-3 rounded-xl font-bold font-mono text-sm tracking-widest"
          style="background: rgba(239,68,68,0.1); border: 1.5px solid rgba(239,68,68,0.35); color: #ef4444; cursor: pointer;">
          ↩ Back to Hub
        </button>
      </div>
    </div>
  </div>
{/if}
