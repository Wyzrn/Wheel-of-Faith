<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import {
    BATTLE_SPECS, rollDrops, WORLD_GRADES, ENDLESS_KEY_DROP_RATE,
    type WorldGrade, type Enemy, type WaveEnemySpec,
  } from '$lib/story/worlds'
  import {
    buildBattleCharacter, simulateTeamBattle, formatHp,
    type BattleCharacter, type TeamBattleRound,
  } from '$lib/game/battle'
  import {
    recordEndlessResult, applyBattleDrops,
    type StorySaveSlot, type BattleDrops,
  } from '$lib/story/saveSlots'
  import type { StoryRosterEntry, StoryTeam } from '$lib/story/types'
  import AttackFX from '../AttackFX.svelte'
  import { settings } from '$lib/settings.svelte'

  let { slot, onExit }: {
    slot: StorySaveSlot
    onExit: (updated: StorySaveSlot) => void
  } = $props()

  // ── Grade colors ───────────────────────────────────────────────────────────
  const GRADE_COLORS: Record<string, string> = {
    F: '#6b7280', E: '#78716c', D: '#a3a3a3', C: '#4ade80',
    B: '#60a5fa', A: '#a78bfa', S: '#f59e0b', SS: '#f97316',
    SSS: '#ef4444', Z: '#ec4899', ZZ: '#d946ef', ZZZ: '#8b5cf6',
    Celestial: '#67e8f9', Godly: '#fbbf24', Primordial: '#f87171', Absolute: '#ffffff',
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
    const idx = WORLD_GRADES.indexOf(grade)
    return spec.map(waveSpec =>
      waveSpec.flatMap(({ type, count }) =>
        Array.from({ length: count }, (_, i) => {
          const suffix = count > 1 ? ` ${i + 1}` : ''
          const name = type === 'boss' ? `${grade} Overlord`
            : type === 'elite' ? `${grade} Champion${suffix}`
            : `${grade} Warrior${suffix}`
          return { grade, type, name } as Enemy
        })
      )
    )
  }

  // ── Stat ranges (same as BattleView) ──────────────────────────────────────
  const WORLD_STAT_RANGE: Record<WorldGrade, [number, number]> = {
    F:[0,12], E:[5,17], D:[9,21], C:[14,26], B:[18,30], A:[23,35],
    S:[27,40], SS:[32,41], SSS:[36,41], Z:[38,41], ZZ:[39,41],
    ZZZ:[40,41], Celestial:[41,41], Godly:[41,41], Primordial:[41,41], Absolute:[41,41],
  }
  const ENEMY_BASE_HP: Record<string, number> = {
    F: 100, E: 300, D: 650, C: 1250, B: 2500, A: 5000,
    S: 10000, SS: 22000, SSS: 47000, Z: 100000, ZZ: 220000, ZZZ: 470000,
    Celestial: 1000000, Godly: 2200000, Primordial: 3000000, Absolute: 6800000,
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
      weaponEnchantTags: [], armorEnchantTags: [],
      critChance: Math.min(0.40, 0.08 + idx * 0.02),
      critMultiplier: Math.min(2.8, 1.5 + idx * 0.08),
      dodgeChance: Math.min(0.55, 0.05 + idx * 0.035),
      initiative: avgRank,
      moves: [
        { name: `${enemy.grade} Strike`, type: 'physical', effectTag: null, behavior: 'attack' },
        { name: enemy.type === 'boss' ? 'Overwhelming Destruction' : `${enemy.grade} Blast`, type: 'power', effectTag: null, behavior: 'attack' },
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

  // Combat state
  let allSubWaves  = $state<Enemy[][]>([])
  let subWaveIdx   = $state(0)
  let t1Chars      = $state<BattleCharacter[]>([])
  let t2Chars      = $state<BattleCharacter[]>([])
  let t1DispHp     = $state<number[]>([])
  let t2DispHp     = $state<number[]>([])
  let rounds       = $state<TeamBattleRound[]>([])
  let roundIdx     = $state(0)
  let logLines     = $state<string[]>([])
  let logEl        = $state<HTMLDivElement | null>(null)
  let killedThisSubWave = $state(new Set<number>())
  let allT2Names   = $state(new Set<string>())

  type AnimDir = 'ltr' | 'rtl' | 'center'
  let activeAnim   = $state<{ type: string; color: string; key: number; direction: AnimDir } | null>(null)
  let animKey      = 0
  let animTimeoutId: ReturnType<typeof setTimeout> | null = null
  let timeoutId:    ReturnType<typeof setTimeout> | null = null

  function speedDelay(ms: number): number {
    if (settings.battleSpeed >= 99) return 10
    return Math.max(50, ms / settings.battleSpeed)
  }

  onDestroy(() => {
    if (timeoutId)     clearTimeout(timeoutId)
    if (animTimeoutId) clearTimeout(animTimeoutId)
  })

  // ── Derived ────────────────────────────────────────────────────────────────
  let currentGrade = $derived(endlessGrade(currentWave))
  let ec           = $derived(gradeColor(currentGrade))

  let t1Names  = $derived(new Set(t1Chars.map(c => c.name)))
  let t2Names  = $derived(new Set(t2Chars.map(c => c.name)))
  let t1HpPct  = $derived(t1Chars.map((c, i) => c.maxHp > 0 ? Math.max(0, (t1DispHp[i] ?? 0) / c.maxHp) : 0))
  let t2HpPct  = $derived(t2Chars.map((c, i) => c.maxHp > 0 ? Math.max(0, (t2DispHp[i] ?? 0) / c.maxHp) : 0))

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

  function hpColor(pct: number): string {
    if (pct > 0.50) return '#22c55e'
    if (pct > 0.25) return '#eab308'
    return '#ef4444'
  }

  // ── Attack animation ───────────────────────────────────────────────────────
  function showAnim(type: string, color: string, direction: AnimDir = 'center') {
    if (animTimeoutId) clearTimeout(animTimeoutId)
    activeAnim = { type, color, key: ++animKey, direction }
    animTimeoutId = setTimeout(() => { activeAnim = null }, 950)
  }

  function detectAnim(line: string): { type: string; color: string; direction: AnimDir } | null {
    const direction: AnimDir =
      [...t1Names].some(n => line.startsWith(n)) ? 'ltr' :
      [...t2Names].some(n => line.startsWith(n)) ? 'rtl' : 'center'
    const hasAction = line.includes('damage!') || line.includes('restores') || line.includes('recovers') ||
      line.includes('barrier') || line.includes('defensive') || /BERSERK|combo finisher|follow-up/i.test(line) ||
      /narrowly dodges|weaves around|barely evades|slips past|anticipates|phases through|blinks away|mirrors away|deflects/i.test(line)
    if (!hasAction) return null
    if (/narrowly dodges|weaves around|barely evades|slips past|anticipates and sidesteps|phases through|blinks away from|mirrors away/i.test(line)) return { type: 'dodge', color: '#a5f3fc', direction }
    if (/barrier forms|defensive stance|protective shell|bracing/i.test(line)) return { type: 'shield', color: '#93c5fd', direction }
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
    const delay = speedDelay(head.startsWith('──') ? 350 : 600)
    timeoutId = setTimeout(() => playLines(rest, onDone), delay)
  }

  function playRound() {
    if (roundIdx >= rounds.length) { onSubWaveComplete('draw'); return }
    const round = rounds[roundIdx]
    roundIdx++
    const prevT2Hp = [...t2DispHp]
    playLines([`── Round ${round.roundNum} ──`, ...round.lines], () => {
      t1DispHp = [...round.t1Hp]
      round.t2Hp.forEach((hp, i) => {
        if ((prevT2Hp[i] ?? Infinity) > 0 && hp <= 0 && !killedThisSubWave.has(i)) {
          killedThisSubWave = new Set([...killedThisSubWave, i])
          const enemy = allSubWaves[subWaveIdx]?.[i]
          if (enemy) {
            const d = rollDrops(enemy)
            accDrops = { gems: accDrops.gems + d.gems, xp: accDrops.xp + d.xp, chanceDrops: [...accDrops.chanceDrops, ...d.chanceDrops] }
          }
        }
      })
      t2DispHp = [...round.t2Hp]
      if (round.winner !== undefined) {
        onSubWaveComplete(round.winner)
      } else {
        timeoutId = setTimeout(playRound, speedDelay(700))
      }
    })
  }

  function onSubWaveComplete(result: 'team1' | 'team2' | 'draw') {
    if (result !== 'team1') { finishWave(false); return }
    if (subWaveIdx + 1 >= allSubWaves.length) { finishWave(true); return }
    // Restore 30% HP to survivors between sub-waves (tougher than story mode)
    t1DispHp = t1Chars.map((c, i) => {
      const cur = t1DispHp[i] ?? 0
      if (cur <= 0) return 0
      return Math.min(c.maxHp, cur + Math.round(c.maxHp * 0.3))
    })
    t1Chars = t1Chars.map((c, i) => ({ ...c, hp: t1DispHp[i] }))
    subWaveIdx = subWaveIdx + 1
    logLines = [...logLines, `── Sub-wave ${subWaveIdx} cleared! Team restores 30% HP ──`]
    scrollLog()
    timeoutId = setTimeout(startSubWave, speedDelay(1200))
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

  function startSubWave() {
    killedThisSubWave = new Set()
    const subEnemies = allSubWaves[subWaveIdx] ?? []
    t2Chars  = subEnemies.map(e => buildEnemyChar(e, currentWave))
    t2DispHp = t2Chars.map(c => c.hp)
    allT2Names = new Set([...allT2Names, ...t2Chars.map(c => c.name)])
    rounds   = simulateTeamBattle(t1Chars, t2Chars)
    roundIdx = 0
    if (allSubWaves.length > 1) {
      logLines = [...logLines, `══ Sub-wave ${subWaveIdx + 1} / ${allSubWaves.length} ══`]
      scrollLog()
    }
    playRound()
  }

  function startWave() {
    allSubWaves = buildEndlessEnemies(currentWave)
    subWaveIdx  = 0
    allT2Names  = new Set()

    // Team HP persists between endless waves — no full restore
    // On very first wave build t1Chars from roster, otherwise reuse existing with current HP
    if (phase === 'intro') {
      t1Chars  = teamMembers.map(m => buildBattleCharacter(m.spins, m.name, {
        weapons: m.equippedWeapons ?? [],
        armors:  m.equippedArmors  ?? [],
        powers:  m.equippedPowers  ?? [],
      }))
      t1DispHp = t1Chars.map(c => c.hp)
      accDrops = { gems: 0, xp: 0, chanceDrops: [] }
    }
    // Sync HP into chars (HP persists across waves)
    t1Chars = t1Chars.map((c, i) => ({ ...c, hp: t1DispHp[i] ?? c.maxHp }))

    logLines = []
    phase    = 'fight'
    startSubWave()
  }

  function startRun() {
    if (!selectedTeam || teamMembers.length === 0) return
    currentWave = 1
    wavesCleared = 0
    phase = 'intro'
    timeoutId = setTimeout(() => startWave(), 2600)
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

  function handleQuit() {
    const updated = buildFinalSlot(wavesCleared)
    onExit(updated)
  }

  function handleGameOver() {
    const updated = buildFinalSlot(wavesCleared)
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
  {#if phase === 'fight'}
    <span class="font-mono text-xs px-2 py-1 rounded" style="background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.2); color: #a78bfa;">
      R{roundIdx}/{rounds.length}
    </span>
  {:else}
    <div style="width: 36px;"></div>
  {/if}
</header>

<div class="pt-20 px-4 w-full flex flex-col" style="max-width: 560px; margin: 0 auto; min-height: 100dvh; padding-bottom: max(96px, calc(env(safe-area-inset-bottom, 0px) + 96px));">

  <!-- ══ Pick phase ══════════════════════════════════════════════════════════ -->
  {#if phase === 'pick'}
    <!-- Info card -->
    <div class="rounded-xl px-4 py-4 mb-5" style="background: rgba(167,139,250,0.06); border: 1px solid rgba(167,139,250,0.2);">
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

    <div class="fixed bottom-0 left-0 right-0 px-4 pt-3 z-20"
      style="background: linear-gradient(transparent, rgba(7,7,13,0.97) 40%); padding-bottom: max(28px, env(safe-area-inset-bottom, 28px));">
      <div class="max-w-md mx-auto">
        <button onclick={startRun} disabled={!selectedTeam || teamMembers.length === 0}
          class="{selectedTeam && teamMembers.length > 0 ? '' : 'obsidian-slab'} w-full py-3.5 rounded-xl font-bold font-mono text-sm tracking-widest"
          style="{selectedTeam && teamMembers.length > 0 ? 'background: rgba(167,139,250,0.15); border: 1.5px solid rgba(167,139,250,0.5); color: #a78bfa; cursor: pointer;' : 'opacity: 0.4; cursor: not-allowed; color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07);'}">
          ∞ Enter Endless
        </button>
      </div>
    </div>
  {/if}

  <!-- ══ Intro / Fight ═══════════════════════════════════════════════════════ -->
  {#if phase !== 'pick' && phase !== 'wave_result' && phase !== 'gameover' && t1Chars.length > 0}
    <div class="w-full relative mb-3" style="overflow: visible;">
      <div class="grid grid-cols-2 gap-2">
        <!-- Player team -->
        <div class="flex flex-col gap-1.5">
          {#if t1Chars.length > 1}
            <p class="font-mono text-xs text-center tracking-widest uppercase" style="color: rgba(240,192,64,0.6);">Your Team</p>
          {/if}
          {#each t1Chars as char, i}
            {@const hp  = t1DispHp[i] ?? 0}
            {@const pct = t1HpPct[i]  ?? 0}
            {@const dead = hp <= 0}
            <div class="rounded-xl p-2 flex flex-col gap-1 items-center text-center"
              style="background: rgba(240,192,64,0.06); border: 1px solid rgba(240,192,64,{dead ? '0.07' : '0.22'}); opacity: {dead ? 0.4 : 1}; transition: opacity 0.5s;">
              {#if dead}<span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>{/if}
              <p class="font-bold truncate w-full" style="font-family: 'Cinzel', serif; color: #ffdf96; font-size: 0.75rem;">{char.name}</p>
              <div class="rounded-full overflow-hidden w-full" style="height: 7px; background: rgba(255,255,255,0.08);">
                <div class="h-full rounded-full" style="width: {pct * 100}%; background: {hpColor(pct)}; transition: width 0.8s ease-out;"></div>
              </div>
              <p style="font-family: 'JetBrains Mono', monospace; color: {hpColor(pct)}; font-size: 0.6rem;">{formatHp(hp)} / {formatHp(char.maxHp)}</p>
            </div>
          {/each}
        </div>
        <!-- Enemies -->
        <div class="flex flex-col gap-1.5">
          {#if t2Chars.length > 1}
            <p class="font-mono text-xs text-center tracking-widest uppercase" style="color: rgba(232,121,249,0.6);">Enemies</p>
          {/if}
          {#each t2Chars as char, i}
            {@const hp  = t2DispHp[i] ?? 0}
            {@const pct = t2HpPct[i]  ?? 0}
            {@const dead = hp <= 0}
            <div class="rounded-xl p-2 flex flex-col gap-1 items-center text-center"
              style="background: {ec}0d; border: 1px solid {ec}{dead ? '11' : '22'}; opacity: {dead ? 0.4 : 1}; transition: opacity 0.5s;">
              {#if dead}<span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>{/if}
              <p class="font-bold truncate w-full" style="font-family: 'Cinzel', serif; color: {ec}; font-size: 0.75rem;">{char.name}</p>
              <div class="rounded-full overflow-hidden w-full" style="height: 7px; background: rgba(255,255,255,0.08);">
                <div class="h-full rounded-full" style="width: {pct * 100}%; background: {hpColor(pct)}; transition: width 0.8s ease-out;"></div>
              </div>
              <p style="font-family: 'JetBrains Mono', monospace; color: {hpColor(pct)}; font-size: 0.6rem;">{formatHp(hp)} / {formatHp(char.maxHp)}</p>
            </div>
          {/each}
        </div>
      </div>
      <!-- Attack FX overlay -->
      {#if phase === 'fight' && activeAnim}
        {#key activeAnim.key}
          <div style="position: absolute; top: 40%; transform: translateY(-50%);
                      {activeAnim.direction === 'rtl' ? 'right: 8%' : activeAnim.direction === 'center' ? 'left: 50%; transform: translate(-50%, -50%)' : 'left: 8%'};
                      z-index: 20; pointer-events: none;">
            <AttackFX type={activeAnim.type} color={activeAnim.color} direction={activeAnim.direction} size={76} />
          </div>
        {/key}
      {/if}
    </div>

    <!-- VS splash -->
    {#if phase === 'intro'}
      <div class="text-center py-6">
        <p style="font-family: 'Cinzel', serif; font-size: 3rem; font-weight: 900; color: #a78bfa; letter-spacing: 0.2em; filter: drop-shadow(0 0 20px rgba(167,139,250,0.5));">VS</p>
        <p class="mt-2 text-sm tracking-[0.2em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">
          Wave {currentWave} · {currentGrade} Grade · Endless Mode
        </p>
      </div>
    {/if}

    <!-- Battle log -->
    {#if phase === 'fight'}
      <div class="w-full rounded-xl overflow-hidden mb-4" style="border: 1px solid rgba(167,139,250,0.15); background: #0d0d16;">
        <div class="flex items-center gap-2 px-4 py-2.5" style="border-bottom: 1px solid rgba(167,139,250,0.08);">
          <span class="material-symbols-outlined" style="font-size: 14px; color: #9a907b; font-variation-settings: 'FILL' 1;">menu_book</span>
          <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Battle Log — Wave {currentWave}</p>
          <span class="ml-auto text-xs px-2 py-0.5 rounded" style="background: rgba(157,23,77,0.3); border: 1px solid rgba(157,23,77,0.5); font-family: 'JetBrains Mono', monospace; color: #f9a8d4;">
            R{roundIdx} / {rounds.length}
          </span>
        </div>
        <div bind:this={logEl} class="overflow-y-auto px-4 py-3" style="max-height: 260px; scroll-behavior: smooth;">
          {#if logLines.length === 0}
            <p class="text-xs text-center py-4" style="color: #4e4635; font-style: italic;">The battle begins…</p>
          {/if}
          {#each logLines as line}
            {#if line.startsWith('──')}
              <p class="text-xs mt-3 mb-1 tracking-[0.15em]" style="font-family: 'JetBrains Mono', monospace; color: #9a907b; border-bottom: 1px solid rgba(167,139,250,0.08); padding-bottom: 4px;">{line}</p>
            {:else if line.includes('CRITICAL') || line.includes('DEVASTATING') || line.includes('PERFECT STRIKE') || line.includes('OVERWHELMING') || line.includes('UNSTOPPABLE') || line.includes('OVERKILL')}
              <p class="text-xs mb-1 font-bold" style="color: #fde047; font-family: 'JetBrains Mono', monospace;">{line}</p>
            {:else if line.includes('has been defeated!')}
              <p class="text-xs mb-1 font-bold" style="color: #ef4444; font-family: 'JetBrains Mono', monospace;">{line}</p>
            {:else if [...t1Names].some(n => line.startsWith(n))}
              <p class="text-xs mb-1" style="color: #fde68a; font-family: 'JetBrains Mono', monospace;">{line}</p>
            {:else if [...allT2Names].some(n => line.startsWith(n))}
              <p class="text-xs mb-1" style="color: #e9d5ff; font-family: 'JetBrains Mono', monospace;">{line}</p>
            {:else}
              <p class="text-xs mb-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-style: italic;">{line}</p>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  {/if}

</div>

<!-- ══ Wave result overlay ═════════════════════════════════════════════════ -->
{#if phase === 'wave_result'}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px); padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
    <div class="w-full max-w-md rounded-2xl overflow-hidden"
      style="background: rgba(167,139,250,0.06); border: 1px solid rgba(167,139,250,0.35); box-shadow: 0 0 60px rgba(167,139,250,0.12); animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
      <div class="px-5 py-5 text-center">
        <p class="text-xs tracking-[0.25em] uppercase mb-1" style="font-family: 'JetBrains Mono', monospace; color: #a78bfa;">Wave Cleared!</p>
        <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 1.8rem); font-weight: 900; color: #a78bfa; letter-spacing: 0.1em; filter: drop-shadow(0 0 16px rgba(167,139,250,0.55));">
          Wave {wavesCleared} — {currentGrade}
        </p>
        {#if waveDrops}
          <div class="mt-3 text-left mx-auto px-3 py-2.5 rounded-xl" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(167,139,250,0.12);">
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
        {/if}
        <div class="mt-4 flex flex-col gap-2">
          <button onclick={advanceToNextWave}
            class="w-full py-3 rounded-xl font-bold font-mono text-sm tracking-widest"
            style="background: rgba(167,139,250,0.15); border: 1.5px solid rgba(167,139,250,0.5); color: #a78bfa; cursor: pointer;">
            ⚔ Wave {currentWave + 1}
          </button>
          <button onclick={handleQuit}
            class="w-full obsidian-slab py-2.5 rounded-xl font-mono text-sm tracking-widest"
            style="border: 1px solid rgba(167,139,250,0.2); color: var(--color-outline);">
            ↩ Quit & Save
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ══ Game Over overlay ═══════════════════════════════════════════════════ -->
{#if phase === 'gameover'}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
    <div class="w-full max-w-md rounded-2xl overflow-hidden"
      style="background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.3); box-shadow: 0 0 60px rgba(239,68,68,0.08); animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
      <div class="px-5 py-6 text-center">
        <p class="text-xs tracking-[0.25em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #ef4444;">Game Over</p>
        <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900; color: #ef4444; letter-spacing: 0.12em;">
          Survived {wavesCleared} Wave{wavesCleared !== 1 ? 's' : ''}
        </p>
        {#if isNewRecord && wavesCleared > 0}
          <p class="mt-1 font-mono text-sm font-bold" style="color: #ffd700;">🏆 New Personal Best!</p>
        {:else if (slot.endlessHighestWave ?? 0) > 0}
          <p class="mt-1 font-mono text-xs" style="color: #9a907b;">Best: Wave {slot.endlessHighestWave}</p>
        {/if}
        {#if accDrops.gems > 0 || accDrops.xp > 0}
          <div class="mt-4 text-left mx-auto px-3 py-2.5 rounded-xl" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(239,68,68,0.12);">
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
        {/if}
        <button onclick={handleGameOver}
          class="mt-5 w-full py-3 rounded-xl font-bold font-mono text-sm tracking-widest"
          style="background: rgba(239,68,68,0.1); border: 1.5px solid rgba(239,68,68,0.35); color: #ef4444; cursor: pointer;">
          ↩ Back to Hub
        </button>
      </div>
    </div>
  </div>
{/if}
