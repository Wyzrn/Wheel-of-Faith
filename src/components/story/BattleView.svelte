<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import {
    getBattleWaves, rollDrops, BATTLES_PER_WORLD, WORLD_GRADES, ENDLESS_KEY_DROP_RATE,
    type WorldGrade, type Enemy,
  } from '$lib/story/worlds'
  import {
    buildBattleCharacter, simulateTeamBattle, formatHp,
    type BattleCharacter, type TeamBattleRound,
  } from '$lib/game/battle'
  import {
    recordBattleWin, recordAbsolutePlusWin, applyBattleDrops, addTeamXp,
    type StorySaveSlot, type BattleDrops,
  } from '$lib/story/saveSlots'
  import type { StoryRosterEntry, StoryTeam } from '$lib/story/types'
  import AttackFX from '../AttackFX.svelte'
  import { settings } from '$lib/settings.svelte'

  let { slot, world, absolutePlusLevel = 0, onBattleComplete, onNextBattle, onBack, onGoToTeams }: {
    slot: StorySaveSlot
    world: WorldGrade
    absolutePlusLevel?: number
    onBattleComplete: (updated: StorySaveSlot) => void
    onNextBattle?: (updated: StorySaveSlot) => void
    onBack: () => void
    onGoToTeams: () => void
  } = $props()

  let plusMode = $derived(absolutePlusLevel > 0)

  // ── Grade colors ──────────────────────────────────────────────────────────
  const GRADE_COLORS: Record<string, string> = {
    F: '#6b7280', E: '#78716c', D: '#a3a3a3', C: '#4ade80',
    B: '#60a5fa', A: '#a78bfa', S: '#f59e0b', SS: '#f97316',
    SSS: '#ef4444', Z: '#ec4899', ZZ: '#d946ef', ZZZ: '#8b5cf6',
    Celestial: '#67e8f9', Godly: '#fbbf24', Primordial: '#f87171', Absolute: '#ffffff',
  }
  function gradeColor(g: string): string { return GRADE_COLORS[g] ?? '#9a907b' }

  // ── Stat rank range per world grade ──────────────────────────────────────
  const WORLD_STAT_RANGE: Record<WorldGrade, [number, number]> = {
    F:[0,12], E:[5,17], D:[9,21], C:[14,26], B:[18,30], A:[23,35],
    S:[27,40], SS:[32,41], SSS:[36,41], Z:[38,41], ZZ:[39,41],
    ZZZ:[40,41], Celestial:[41,41], Godly:[41,41], Primordial:[41,41], Absolute:[41,41],
  }
  function randRank(min: number, max: number): number {
    return Math.round(min + Math.random() * (max - min))
  }

  const ENEMY_BASE_HP: Record<string, number> = {
    F: 100, E: 300, D: 650, C: 1250, B: 2500, A: 5000,
    S: 10000, SS: 22000, SSS: 47000, Z: 100000, ZZ: 220000, ZZZ: 470000,
    Celestial: 1000000, Godly: 2200000, Primordial: 3000000, Absolute: 6800000,
  }

  function buildEnemyChar(enemy: Enemy): BattleCharacter {
    const [minR, maxR] = WORLD_STAT_RANGE[enemy.grade] ?? [0, 12]
    const idx     = WORLD_GRADES.indexOf(enemy.grade)
    const baseHp  = ENEMY_BASE_HP[enemy.grade] ?? 100
    const mult    = enemy.type === 'boss' ? 2.5 : enemy.type === 'elite' ? 1.5 : 1.0
    const plusScale = plusMode ? 1 + absolutePlusLevel * 0.3 : 1
    const hp      = Math.round(baseHp * mult * plusScale)
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
      armorReduction: Math.min(0.50, 0.05 + idx * 0.03),
      armorType: 'Full-Suit',
      weaponType: 'Melee',
      agilityRank, speedRank, charismaRank, iqRank, potentialRank, energyRank, fightingSkillRank,
      weaponEnchantTags: [], armorEnchantTags: [],
      critChance: Math.min(0.35, 0.08 + idx * 0.018),
      critMultiplier: Math.min(2.5, 1.5 + idx * 0.07),
      dodgeChance: Math.min(0.50, 0.05 + idx * 0.03),
      initiative: avgRank,
      moves: [
        { name: `${enemy.grade} Strike`, type: 'physical', effectTag: null, behavior: 'attack' },
        { name: enemy.type === 'boss' ? 'Overwhelming Destruction' : `${enemy.grade} Blast`, type: 'power', effectTag: null, behavior: 'attack' },
      ],
    }
  }

  // ── State ──────────────────────────────────────────────────────────────────
  type Phase = 'pick' | 'intro' | 'fight' | 'result'
  let phase        = $state<Phase>('pick')
  let selectedTeam = $state<StoryTeam | null>(null)
  // Tracks char IDs that died mid-run; applied on Next Battle to keep them dead
  let carryOverDeadIds = $state(new Set<string>())

  // Wave + simultaneous team combat
  let allWaves  = $state<Enemy[][]>([])
  let waveIdx   = $state(0)
  let t1Chars   = $state<BattleCharacter[]>([])
  let t2Chars   = $state<BattleCharacter[]>([])
  let t1DispHp  = $state<number[]>([])
  let t2DispHp  = $state<number[]>([])
  let rounds    = $state<TeamBattleRound[]>([])
  let roundIdx  = $state(0)
  let playerWon = $state(false)
  let accDrops  = $state<BattleDrops>({ gems: 0, xp: 0, chanceDrops: [] })
  let lastDrops = $state<BattleDrops | null>(null)
  // Accumulate all enemy names seen across waves for log coloring
  let allT2Names = $state(new Set<string>())

  let logLines       = $state<string[]>([])
  let logEl          = $state<HTMLDivElement | null>(null)
  let killedThisWave = $state(new Set<number>())

  type AnimDir = 'ltr' | 'rtl' | 'center'
  let activeAnim    = $state<{ type: string; color: string; key: number; direction: AnimDir } | null>(null)
  let animKey       = 0
  let animTimeoutId: ReturnType<typeof setTimeout> | null = null
  let timeoutId:     ReturnType<typeof setTimeout> | null = null

  function speedDelay(ms: number): number {
    if (settings.battleSpeed >= 99) return 10
    return Math.max(50, ms / settings.battleSpeed)
  }

  let battleNumber   = $derived(plusMode
    ? (slot.absolutePlusBattles ?? 0) + 1
    : (slot.worldProgress[world]?.battlesCompleted ?? 0) + 1)
  let previewWaves   = $derived(getBattleWaves(world, battleNumber))
  let previewEnemies = $derived(previewWaves.flat())
  let ec = $derived(previewEnemies[0] ? gradeColor(previewEnemies[0].grade) : '#9a907b')

  let t1Names = $derived(new Set(t1Chars.map(c => c.name)))
  let t2Names = $derived(new Set(t2Chars.map(c => c.name)))
  let t1HpPct = $derived(t1Chars.map((c, i) => c.maxHp > 0 ? Math.max(0, (t1DispHp[i] ?? 0) / c.maxHp) : 0))
  let t2HpPct = $derived(t2Chars.map((c, i) => c.maxHp > 0 ? Math.max(0, (t2DispHp[i] ?? 0) / c.maxHp) : 0))

  // Teams available for battle
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

  onDestroy(() => {
    if (timeoutId)     clearTimeout(timeoutId)
    if (animTimeoutId) clearTimeout(animTimeoutId)
  })

  // ── Attack animation ──────────────────────────────────────────────────────
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
      line.includes('barrier') || line.includes('defensive') ||
      /BERSERK|combo finisher|follow-up/i.test(line) ||
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

  // ── Log playback ──────────────────────────────────────────────────────────
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
    if (roundIdx >= rounds.length) {
      onWaveComplete('draw')
      return
    }
    const round = rounds[roundIdx]
    roundIdx++
    const prevT2Hp = [...t2DispHp]
    playLines([`── Round ${round.roundNum} ──`, ...round.lines], () => {
      t1DispHp = [...round.t1Hp]
      // Detect newly-killed enemies and accumulate their drops live
      round.t2Hp.forEach((hp, i) => {
        if ((prevT2Hp[i] ?? Infinity) > 0 && hp <= 0 && !killedThisWave.has(i)) {
          killedThisWave = new Set([...killedThisWave, i])
          const enemy = allWaves[waveIdx]?.[i]
          if (enemy) {
            const d = rollDrops(enemy)
            accDrops = { gems: accDrops.gems + d.gems, xp: accDrops.xp + d.xp, chanceDrops: [...accDrops.chanceDrops, ...d.chanceDrops] }
          }
        }
      })
      t2DispHp = [...round.t2Hp]
      if (round.winner !== undefined) {
        onWaveComplete(round.winner)
      } else {
        timeoutId = setTimeout(playRound, speedDelay(700))
      }
    })
  }

  function onWaveComplete(result: 'team1' | 'team2' | 'draw') {
    if (result !== 'team1') { finishBattle(result); return }
    if (waveIdx + 1 >= allWaves.length) { finishBattle('team1'); return }
    // Restore 50% max HP to living players, carry into next wave
    t1DispHp = t1Chars.map((c, i) => {
      const cur = t1DispHp[i] ?? 0
      if (cur <= 0) return 0
      return Math.min(c.maxHp, cur + Math.round(c.maxHp * 0.5))
    })
    t1Chars = t1Chars.map((c, i) => ({ ...c, hp: t1DispHp[i] }))
    waveIdx = waveIdx + 1
    logLines = [...logLines, `── Wave ${waveIdx} cleared! Team restores 50% HP ──`]
    scrollLog()
    timeoutId = setTimeout(startWave, speedDelay(1400))
  }

  function finishBattle(winner: 'team1' | 'team2' | 'draw') {
    playerWon = winner === 'team1'
    if (playerWon) {
      if (slot.playerLevel >= 3 && Math.random() < ENDLESS_KEY_DROP_RATE) {
        accDrops = { ...accDrops, chanceDrops: [...accDrops.chanceDrops, 'endlessKey'] }
      }
      lastDrops = { ...accDrops }
    } else {
      lastDrops = null
    }
    phase = 'result'
  }

  function startWave() {
    killedThisWave = new Set()
    const waveEnemies = allWaves[waveIdx] ?? []
    t2Chars  = waveEnemies.map(e => buildEnemyChar(e))
    t2DispHp = t2Chars.map(c => c.hp)
    allT2Names = new Set([...allT2Names, ...t2Chars.map(c => c.name)])
    // t1Chars.hp already reflects current HP (full on wave 1, restored on subsequent waves)
    rounds   = simulateTeamBattle(t1Chars, t2Chars)
    roundIdx = 0
    if (allWaves.length > 1) {
      logLines = [...logLines, `══ Wave ${waveIdx + 1} / ${allWaves.length} ══`]
      scrollLog()
    }
    playRound()
  }

  function startFight() {
    if (!selectedTeam || teamMembers.length === 0) return

    allWaves = getBattleWaves(world, battleNumber)
    waveIdx  = 0
    allT2Names = new Set()

    // Build player team — dead chars from a previous Next Battle carry stay at 0 HP
    const dead = carryOverDeadIds
    carryOverDeadIds = new Set()
    t1Chars  = teamMembers.map(m => {
      const spinMult = m.spinClass === 'legend' ? 4 : m.spinClass === 'hero' ? 2 : 1
      const levelMult = 1 + Math.max(0, (m.level ?? 1) - 1) * 0.01
      const bc = buildBattleCharacter(m.spins, m.name, {
        weapons: m.equippedWeapons ?? [],
        armors:  m.equippedArmors  ?? [],
        powers:  m.equippedPowers  ?? [],
      }, spinMult * levelMult)
      return dead.has(m.id) ? { ...bc, hp: 0 } : bc
    })
    t1DispHp = t1Chars.map(c => c.hp)

    // Drops accumulate per-kill during playRound — reset counter here
    accDrops = { gems: 0, xp: 0, chanceDrops: [] }

    logLines = []
    phase    = 'intro'
    timeoutId = setTimeout(() => {
      phase = 'fight'
      startWave()
    }, 2600)
  }

  function buildUpdatedSlot(): StorySaveSlot {
    let updated = plusMode ? recordAbsolutePlusWin(slot) : recordBattleWin(slot, world)
    updated = applyBattleDrops(updated, lastDrops!)
    if (teamCharIds.length > 0) {
      updated = addTeamXp(updated, teamCharIds, lastDrops!.xp)
    }
    return updated
  }

  function resetBattleState() {
    t1Chars = []; t2Chars = []; allWaves = []
    t1DispHp = []; t2DispHp = []
    logLines = []; waveIdx = 0; allT2Names = new Set()
    killedThisWave = new Set()
    accDrops = { gems: 0, xp: 0, chanceDrops: [] }
  }

  function confirmResult() {
    if (!playerWon || !lastDrops) {
      carryOverDeadIds = new Set()
      phase = 'pick'
      selectedTeam = null
      resetBattleState()
      return
    }
    carryOverDeadIds = new Set()
    onBattleComplete(buildUpdatedSlot())
  }

  function continueNextBattle() {
    if (!playerWon || !lastDrops) return
    const updated = buildUpdatedSlot()
    onNextBattle?.(updated)
    carryOverDeadIds = new Set()
    resetBattleState()
    // Let the slot prop update propagate before rebuilding the team
    timeoutId = setTimeout(() => { if (selectedTeam) startFight() }, 50)
  }

  function retryBattle() {
    carryOverDeadIds = new Set()
    resetBattleState()
    if (selectedTeam) startFight()
  }

  function getDropLabel(drop: string): string {
    if (drop === 'fateShard')   return 'Fate Shard'
    if (drop === 'endlessKey')  return 'Endless Key'
    if (drop === 'spin')        return '✦ Bonus Spin'
    if (drop === 'heroSpin')    return '⚔ Hero Spin'
    if (drop === 'legendSpin')  return '★ Legend Spin'
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

<!-- ── Header ─────────────────────────────────────────────────────────────── -->
<header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4"
  style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);">
  {#if phase === 'pick'}
    <button onclick={onBack}
      style="background: none; border: none; cursor: pointer; color: var(--color-outline); font-size: 20px; line-height: 1; padding: 8px;">←</button>
  {:else}
    <div style="width: 36px;"></div>
  {/if}
  <h2 class="font-bold flex-1 text-center" style="font-family: var(--font-cinzel); font-size: 15px; color: var(--color-on-surface);">
    {plusMode ? `Absolute +${absolutePlusLevel}` : `${world} World`} — Battle {battleNumber}/{BATTLES_PER_WORLD}
  </h2>
  {#if phase === 'fight'}
    <div class="flex items-center gap-1.5">
      {#if allWaves.length > 1}
        <span class="font-mono text-xs px-2 py-1 rounded" style="background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.2); color: #a78bfa;">
          W{waveIdx + 1}/{allWaves.length}
        </span>
      {/if}
      <span class="font-mono text-xs px-2 py-1 rounded" style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.2); color: var(--gold-bright);">
        R{roundIdx}/{rounds.length}
      </span>
    </div>
  {:else}
    <div style="width: 36px;"></div>
  {/if}
</header>

<div class="pt-20 px-4 w-full flex flex-col" style="max-width: 560px; margin: 0 auto; min-height: 100dvh; padding-bottom: max(96px, calc(env(safe-area-inset-bottom, 0px) + 96px));">

  <!-- ══ Phase: pick ══════════════════════════════════════════════════════════ -->
  {#if phase === 'pick'}

    <!-- Enemy preview -->
    <div class="mb-5">
      <p class="font-mono text-xs mb-2 tracking-widest uppercase" style="color: var(--color-outline);">Battle Preview</p>
      <div class="obsidian-slab rounded-xl px-3 py-2.5" style="border: 1px solid {ec}33;">
        <div class="flex flex-col gap-2">
          {#each previewWaves as wave, wi}
            <div>
              {#if previewWaves.length > 1}
                <p class="font-mono mb-1" style="color: #9a907b; font-size: 10px;">Wave {wi + 1}</p>
              {/if}
              <div class="flex flex-wrap gap-1">
                {#each wave as e}
                  <span class="font-mono text-xs px-1.5 py-0.5 rounded"
                    style="background: {gradeColor(e.grade)}14; border: 1px solid {gradeColor(e.grade)}33;
                           color: {e.type === 'boss' ? '#fbbf24' : e.type === 'elite' ? '#a78bfa' : gradeColor(e.grade)};">
                    {e.type === 'boss' ? '☆' : e.type === 'elite' ? '★' : '•'} {e.name}
                  </span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
        <p class="font-mono text-xs mt-2" style="color: #9a907b; font-size: 10px;">
          {previewWaves.length > 1 ? `${previewWaves.length} waves · 50% HP restored between waves` : 'Enemies fight simultaneously'}
        </p>
      </div>
    </div>

    <!-- Team picker -->
    {#if teams.length === 0}
      <div class="text-center pt-8">
        <span class="material-symbols-outlined" style="font-size: 36px; color: var(--color-outline); font-variation-settings: 'FILL' 1;">shield_person</span>
        <p class="font-mono text-sm mt-3" style="color: var(--color-outline);">No teams available.</p>
        <p class="font-mono text-xs mt-1" style="color: var(--color-outline);">Go to Teams to create one before battling.</p>
        <button onclick={onGoToTeams} class="metal-stamp-gold rounded-lg px-5 py-2.5 font-bold font-mono text-sm mt-5 tracking-widest">
          Create a Team
        </button>
      </div>
    {:else}
      <p class="font-bold text-sm mb-3" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Select your team:</p>
      <div class="flex flex-col gap-2">
        {#each teams as { team, members } (team.id)}
          {@const sel = selectedTeam?.id === team.id}
          <button
            onclick={() => selectedTeam = team}
            class="obsidian-slab rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
            style="border: 1px solid {sel ? 'rgba(240,192,64,0.5)' : 'transparent'}; cursor: pointer; background: {sel ? 'rgba(240,192,64,0.05)' : ''}; transition: border-color 120ms;"
          >
            <div class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
              style="background: {sel ? 'rgba(240,192,64,0.18)' : 'rgba(240,192,64,0.07)'}; border: 1px solid rgba(240,192,64,{sel ? '0.4' : '0.15'});">
              <span class="material-symbols-outlined" style="font-size: 18px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">shield_person</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-sm truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{team.name}</p>
              <div class="flex flex-wrap gap-x-2 mt-0.5">
                {#each members as m}
                  <span class="font-mono text-xs" style="color: var(--color-outline);">{m.name} <span style="color: var(--gold-bright);">({m.overallTier})</span></span>
                {/each}
              </div>
            </div>
            {#if sel}
              <span class="material-symbols-outlined flex-shrink-0" style="font-size: 18px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">check_circle</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="fixed bottom-0 left-0 right-0 px-4 pt-3 z-20"
        style="background: linear-gradient(transparent, rgba(7,7,13,0.97) 40%); padding-bottom: max(28px, env(safe-area-inset-bottom, 28px));">
        <div class="max-w-md mx-auto">
          <button onclick={startFight} disabled={!selectedTeam || teamMembers.length === 0}
            class="{selectedTeam && teamMembers.length > 0 ? 'metal-stamp-gold' : 'obsidian-slab'} w-full py-3.5 rounded-xl font-bold font-mono text-sm tracking-widest"
            style="{!selectedTeam || teamMembers.length === 0 ? 'opacity: 0.4; cursor: not-allowed; color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07);' : ''}">
            ⚔ Fight
          </button>
        </div>
      </div>
    {/if}
  {/if}

  <!-- ══ Phases: intro / fight ══════════════════════════════════════════════ -->
  {#if phase !== 'pick' && t1Chars.length > 0}

    <!-- Team panels — all players left, all enemies right -->
    <div class="w-full relative mb-3" style="overflow: visible;">
      <div class="grid grid-cols-2 gap-2">

        <!-- Player team column -->
        <div class="flex flex-col gap-1.5">
          {#if t1Chars.length > 1}
            <p class="font-mono text-xs text-center tracking-widest uppercase" style="color: rgba(240,192,64,0.6);">Your Team</p>
          {/if}
          {#each t1Chars as char, i}
            {@const hp  = t1DispHp[i] ?? 0}
            {@const pct = t1HpPct[i]  ?? 0}
            {@const dead = hp <= 0}
            <div class="rounded-xl p-2 flex flex-col gap-1 items-center text-center"
              style="background: rgba(240,192,64,0.06); border: 1px solid rgba(240,192,64,{dead ? '0.07' : phase === 'result' && playerWon ? '0.6' : '0.22'}); opacity: {dead ? 0.4 : 1}; transition: opacity 0.5s, border-color 0.5s;">
              <div class="flex items-center justify-center gap-1.5 min-w-0 w-full">
                {#if dead}<span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>
                {:else if phase === 'result' && playerWon}<span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: #f0c040; font-variation-settings: 'FILL' 1;">workspace_premium</span>
                {/if}
                <p class="font-bold truncate" style="font-family: 'Cinzel', serif; color: #ffdf96; font-size: 0.75rem;">{char.name}</p>
              </div>
              <div class="rounded-full overflow-hidden w-full" style="height: 7px; background: rgba(255,255,255,0.08);">
                <div class="h-full rounded-full" style="width: {pct * 100}%; background: {hpColor(pct)}; transition: width 0.8s ease-out, background 0.5s;"></div>
              </div>
              <p style="font-family: 'JetBrains Mono', monospace; color: {hpColor(pct)}; font-size: 0.6rem;">{formatHp(hp)} / {formatHp(char.maxHp)}</p>
            </div>
          {/each}
        </div>

        <!-- Enemy team column -->
        <div class="flex flex-col gap-1.5">
          {#if t2Chars.length > 1}
            <p class="font-mono text-xs text-center tracking-widest uppercase" style="color: rgba(232,121,249,0.6);">Enemies</p>
          {/if}
          {#each t2Chars as char, i}
            {@const hp  = t2DispHp[i] ?? 0}
            {@const pct = t2HpPct[i]  ?? 0}
            {@const dead = hp <= 0}
            <div class="rounded-xl p-2 flex flex-col gap-1 items-center text-center"
              style="background: {ec}0d; border: 1px solid {ec}{dead ? '11' : phase === 'result' && !playerWon ? '66' : '22'}; opacity: {dead ? 0.4 : 1}; transition: opacity 0.5s, border-color 0.5s;">
              <div class="flex items-center justify-center gap-1.5 min-w-0 w-full">
                {#if dead}<span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>
                {:else if phase === 'result' && !playerWon}<span class="material-symbols-outlined shrink-0" style="font-size: 12px; color: {ec}; font-variation-settings: 'FILL' 1;">workspace_premium</span>
                {/if}
                <p class="font-bold truncate" style="font-family: 'Cinzel', serif; color: {ec}; font-size: 0.75rem;">{char.name}</p>
              </div>
              <div class="rounded-full overflow-hidden w-full" style="height: 7px; background: rgba(255,255,255,0.08);">
                <div class="h-full rounded-full" style="width: {pct * 100}%; background: {hpColor(pct)}; transition: width 0.8s ease-out, background 0.5s;"></div>
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
            <AttackFX type={activeAnim.type} color={activeAnim.color}
                      direction={activeAnim.direction} size={76} />
          </div>
        {/key}
      {/if}
    </div>

    <!-- VS splash (intro) -->
    {#if phase === 'intro'}
      <div class="text-center py-6" style="animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
        <p style="font-family: 'Cinzel', serif; font-size: 3rem; font-weight: 900; color: #f0c040; letter-spacing: 0.2em; filter: drop-shadow(0 0 20px rgba(240,192,64,0.5));">VS</p>
        <p class="mt-2 text-sm tracking-[0.2em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">
          {t1Chars.length}v{previewEnemies.length} · {allWaves.length} wave{allWaves.length > 1 ? 's' : ''} — Calculating fate…
        </p>
      </div>
    {/if}

    <!-- Battle log -->
    {#if phase !== 'intro'}
      <div class="w-full rounded-xl overflow-hidden mb-4" style="border: 1px solid rgba(240,192,64,0.12); background: #0d0d16;">
        <div class="flex items-center gap-2 px-4 py-2.5" style="border-bottom: 1px solid rgba(240,192,64,0.08);">
          <span class="material-symbols-outlined" style="font-size: 14px; color: #9a907b; font-variation-settings: 'FILL' 1;">menu_book</span>
          <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Battle Log</p>
          {#if phase === 'fight'}
            <span class="ml-auto text-xs px-2 py-0.5 rounded" style="background: rgba(157,23,77,0.3); border: 1px solid rgba(157,23,77,0.5); font-family: 'JetBrains Mono', monospace; color: #f9a8d4;">
              Round {roundIdx} / {rounds.length}
            </span>
          {/if}
        </div>
        <div bind:this={logEl} class="overflow-y-auto px-4 py-3" style="max-height: 280px; scroll-behavior: smooth;">
          {#if logLines.length === 0}
            <p class="text-xs text-center py-4" style="color: #4e4635; font-style: italic;">The battle begins…</p>
          {/if}
          {#each logLines as line}
            {#if line.startsWith('──')}
              <p class="text-xs mt-3 mb-1 tracking-[0.15em]" style="font-family: 'JetBrains Mono', monospace; color: #9a907b; border-bottom: 1px solid rgba(240,192,64,0.08); padding-bottom: 4px;">{line}</p>
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

<!-- ══ Result overlay (dark modal) ══════════════════════════════════════════ -->
{#if phase === 'result'}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px); padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
    <div class="w-full max-w-md rounded-2xl overflow-hidden"
      style="background: {playerWon ? 'rgba(240,192,64,0.06)' : 'rgba(239,68,68,0.04)'}; border: 1px solid {playerWon ? 'rgba(240,192,64,0.4)' : 'rgba(239,68,68,0.3)'}; box-shadow: 0 0 60px {playerWon ? 'rgba(240,192,64,0.12)' : 'rgba(239,68,68,0.08)'}; animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
      <div class="px-5 py-6 text-center">
        {#if playerWon}
          <p class="text-xs tracking-[0.25em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #f0c040;">Victory</p>
          <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900; color: #f0c040; letter-spacing: 0.12em; filter: drop-shadow(0 0 16px rgba(240,192,64,0.55));">{selectedTeam?.name ?? 'Your Team'} WINS!</p>
          <p class="mt-1 text-sm" style="color: #9a907b;">Fate has spoken.</p>

          {#if lastDrops}
            <div class="mt-4 text-left mx-auto px-4 py-3 rounded-xl" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(240,192,64,0.12);">
              <p class="font-mono text-xs mb-2 tracking-widest uppercase" style="color: var(--color-outline);">Battle Drops</p>
              <div class="flex items-center gap-4 mb-2">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined" style="font-size: 15px; color: #34d399; font-variation-settings: 'FILL' 1;">paid</span>
                  <span class="font-mono text-sm font-bold" style="color: #34d399;">+{lastDrops.gems.toLocaleString()} gems</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined" style="font-size: 15px; color: #a78bfa; font-variation-settings: 'FILL' 1;">bolt</span>
                  <span class="font-mono text-sm font-bold" style="color: #a78bfa;">+{lastDrops.xp.toLocaleString()} XP</span>
                  {#if teamCharIds.length > 1}
                    <span class="font-mono text-xs" style="color: var(--color-outline);">÷{teamCharIds.length}</span>
                  {/if}
                </div>
              </div>
              {#if lastDrops.chanceDrops.length > 0}
                <div class="flex flex-wrap gap-1.5 mt-2">
                  {#each lastDrops.chanceDrops as drop}
                    <span class="font-mono text-xs px-2 py-1 rounded"
                      style="background: rgba(240,192,64,0.1); border: 1px solid rgba(240,192,64,0.25); color: var(--gold-bright);">
                      {getDropLabel(drop)}
                    </span>
                  {/each}
                </div>
              {/if}
              {#if battleNumber % 5 === 0}
                <p class="font-mono text-xs mt-3 text-center font-bold" style="color: #a78bfa;">✦ Milestone: +2 Bonus Spins!</p>
              {/if}
              {#if battleNumber === BATTLES_PER_WORLD}
                <p class="font-mono text-sm mt-1 text-center font-bold" style="color: #4ade80;">
                  {plusMode ? `Absolute +${absolutePlusLevel} Cleared!` : 'World Cleared!'}
                </p>
              {/if}
            </div>
          {/if}
        {:else}
          <p class="text-xs tracking-[0.25em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #ef4444;">Defeated</p>
          <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900; color: #ef4444; letter-spacing: 0.12em;">Enemy Forces WIN!</p>
          <p class="mt-1 text-sm" style="color: #9a907b;">{selectedTeam?.name ?? 'Your team'} was defeated. Try again.</p>
        {/if}

        {#if playerWon}
          <div class="mt-5 flex flex-col gap-2">
            {#if battleNumber < BATTLES_PER_WORLD && onNextBattle}
              <button onclick={continueNextBattle}
                class="w-full metal-stamp-gold py-3 rounded-xl font-bold font-mono text-sm tracking-widest">
                ⚔ Next Battle (Same Team)
              </button>
            {/if}
            <button onclick={confirmResult}
              class="w-full obsidian-slab py-2.5 rounded-xl font-mono text-sm tracking-widest"
              style="border: 1px solid rgba(240,192,64,0.25); color: var(--gold-bright);">
              {battleNumber >= BATTLES_PER_WORLD ? '✓ Done' : '↩ Back to World'}
            </button>
          </div>
        {:else}
          <div class="mt-5 flex flex-col gap-2">
            <button onclick={retryBattle}
              class="w-full metal-stamp-gold py-3 rounded-xl font-bold font-mono text-sm tracking-widest">
              ↺ Try Again (Same Team)
            </button>
            <button onclick={() => { carryOverDeadIds = new Set(); resetBattleState(); selectedTeam = null; phase = 'pick' }}
              class="w-full obsidian-slab py-2.5 rounded-xl font-mono text-sm tracking-widest"
              style="border: 1px solid rgba(239,68,68,0.25); color: #f87171;">
              ↩ Back to World
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
