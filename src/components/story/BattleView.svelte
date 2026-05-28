<!--
  story/BattleView.svelte — Story Mode battle (player team vs world wave).

  Pick phase (team selection + enemy preview) and Result phase (drops +
  next-battle CTA) stay mode-specific. The Fight phase now mounts the
  unified BattleArena per wave (keyed by waveIdx so it remounts cleanly
  between waves) and drives turns through BattleControllerTeam.

  Player perks vs the legacy view:
  • New projectile VFX (comets from attacker → chosen target).
  • Manual mode hotbar — per-ally turn input with target picking.
  • In-arena Skip button when the Instant Battle gamepass is owned.
  • Auto Battle speed setting respected uniformly.
-->
<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    getBattleWaves, rollDrops, BATTLES_PER_WORLD, WORLD_GRADES, ENDLESS_KEY_DROP_RATE,
    type WorldGrade, type Enemy,
  } from '$lib/story/worlds'
  import {
    buildBattleCharacter, formatHp,
    type BattleCharacter,
  } from '$lib/game/battle'
  import {
    recordBattleWin, recordAbsolutePlusWin, applyBattleDrops, addTeamXp,
    type StorySaveSlot, type BattleDrops,
  } from '$lib/story/saveSlots'
  import type { StoryRosterEntry, StoryTeam } from '$lib/story/types'
  import { settings } from '$lib/settings.svelte'
  import { saveReplay } from '$lib/battleReplay'
  import BattleArena from '../BattleArena.svelte'
  import {
    memberFromChar,
    type ArenaTeam, type ArenaRound, type ArenaWinner,
  } from '$lib/battle/arena'
  import { BattleControllerTeam } from '$lib/battle/teamController'

  let { slot, world, absolutePlusLevel = 0, onBattleComplete, onNextBattle, onBack, onGoToTeams, gamepasses = [] }: {
    slot: StorySaveSlot
    world: WorldGrade
    absolutePlusLevel?: number
    onBattleComplete: (updated: StorySaveSlot) => void
    onNextBattle?: (updated: StorySaveSlot) => void
    onBack: () => void
    onGoToTeams: () => void
    gamepasses?: string[]
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
  // Tier ranks index into TIER_THRESHOLDS (0 = F-, 59 = Infinite+). Post-mortal
  // worlds saturate near the top of the ladder so enemies hit the new
  // Cosmic/Immortal/Transcendent/Infinite ranges as the player ascends.
  const WORLD_STAT_RANGE: Record<WorldGrade, [number, number]> = {
    F:[0,12], E:[5,17], D:[9,21], C:[14,26], B:[18,30], A:[23,35],
    S:[27,40], SS:[32,44], SSS:[36,46],
    Z:[38,48], ZZ:[40,50], ZZZ:[42,52],
    Cosmic:[44,53], Immortal:[46,54],
    Celestial:[48,55], Godly:[50,56], Primordial:[52,57], Absolute:[54,58],
    Transcendent:[56,59], Infinite:[58,59],
  }
  function randRank(min: number, max: number): number {
    return Math.round(min + Math.random() * (max - min))
  }

  const ENEMY_BASE_HP: Record<string, number> = {
    F: 100, E: 300, D: 650, C: 1250, B: 2500, A: 5000,
    S: 10000, SS: 22000, SSS: 47000, Z: 100000, ZZ: 220000, ZZZ: 470000,
    Cosmic: 1_000_000, Immortal: 2_200_000,
    Celestial: 4_900_000, Godly: 10_800_000, Primordial: 23_700_000, Absolute: 52_000_000,
    Transcendent: 114_000_000, Infinite: 250_000_000,
  }

  // Per-type stat shape. HP/damage multipliers + armor/dodge tweaks +
  // gimmickIds give each enemy type its own mechanical identity. Shared
  // by BattleView + EndlessView (any divergence is a bug).
  // hp:  HP multiplier vs. baseline
  // dmg: damage multiplier vs. baseline
  // armorCap: max armor reduction (0..0.80)
  // dodgeCap: max dodge chance (0..0.70)
  // gimmicks: gimmickIds applied to this enemy
  const _TYPE_STATS: Record<string, { hp: number; dmg: number; armorCap: number; dodgeCap: number; gimmicks: string[]; archetypeLabel: string }> = {
    normal:       { hp: 1.00, dmg: 1.00, armorCap: 0.50, dodgeCap: 0.50, gimmicks: [],                       archetypeLabel: 'Warrior'    },
    elite:        { hp: 1.50, dmg: 1.30, armorCap: 0.55, dodgeCap: 0.50, gimmicks: [],                       archetypeLabel: 'Champion'   },
    boss:         { hp: 2.50, dmg: 1.60, armorCap: 0.60, dodgeCap: 0.50, gimmicks: ['leader'],               archetypeLabel: 'Overlord'   },
    phaseShifter: { hp: 0.65, dmg: 1.10, armorCap: 0.25, dodgeCap: 0.62, gimmicks: ['firstStrike'],          archetypeLabel: 'Phaseling'  },
    shielder:     { hp: 1.70, dmg: 0.70, armorCap: 0.65, dodgeCap: 0.20, gimmicks: ['ironSkin'],             archetypeLabel: 'Bulwark'    },
    leech:        { hp: 1.20, dmg: 1.00, armorCap: 0.50, dodgeCap: 0.30, gimmicks: ['lifesteal'],            archetypeLabel: 'Bloodleech' },
    cursed:       { hp: 1.10, dmg: 1.05, armorCap: 0.40, dodgeCap: 0.35, gimmicks: ['curseStrike'],          archetypeLabel: 'Hexbringer' },
    bomber:       { hp: 0.60, dmg: 0.80, armorCap: 0.20, dodgeCap: 0.35, gimmicks: ['bomberDeath'],          archetypeLabel: 'Detonator'  },
    cloner:       { hp: 1.10, dmg: 0.95, armorCap: 0.40, dodgeCap: 0.40, gimmicks: ['clonerDeath'],          archetypeLabel: 'Cloner'     },
    reflector:    { hp: 1.00, dmg: 0.85, armorCap: 0.55, dodgeCap: 0.30, gimmicks: ['reflectShield'],        archetypeLabel: 'Mirrorblade'},
    berserker:    { hp: 0.85, dmg: 1.80, armorCap: 0.30, dodgeCap: 0.40, gimmicks: ['berserkerRage'],        archetypeLabel: 'Berserker'  },
  }

  function buildEnemyChar(enemy: Enemy): BattleCharacter {
    const [minR, maxR] = WORLD_STAT_RANGE[enemy.grade] ?? [0, 12]
    const idx     = WORLD_GRADES.indexOf(enemy.grade)
    const baseHp  = ENEMY_BASE_HP[enemy.grade] ?? 100
    const ts      = _TYPE_STATS[enemy.type] ?? _TYPE_STATS.normal
    const plusScale = plusMode ? 1 + absolutePlusLevel * 0.3 : 1
    const hp      = Math.round(baseHp * ts.hp * plusScale)
    const agilityRank       = randRank(minR, maxR)
    const speedRank         = randRank(minR, maxR)
    const fightingSkillRank = randRank(minR, maxR)
    const potentialRank     = randRank(minR, maxR)
    const energyRank        = randRank(minR, maxR)
    const iqRank            = randRank(minR, maxR)
    const charismaRank      = randRank(minR, maxR)
    const avgRank = (agilityRank + speedRank + fightingSkillRank) / 3
    const dmg = Math.round(hp / 2 * (1 + avgRank / 82) * ts.dmg)
    return {
      name: enemy.name,
      raceLabel: enemy.grade + ' Entity',
      archetypeLabel: ts.archetypeLabel,
      hp, maxHp: hp,
      physicalDamage: dmg,
      powerDamage: Math.round(dmg * 0.9),
      armorReduction: Math.min(ts.armorCap, 0.05 + idx * 0.03),
      armorType: 'Full-Suit',
      weaponType: 'Melee',
      agilityRank, speedRank, charismaRank, iqRank, potentialRank, energyRank, fightingSkillRank,
      powerMasteryRank: avgRank, weaponMasteryRank: avgRank,
      weaponEnchantTags: [], armorEnchantTags: [],
      critChance: Math.min(0.35, 0.08 + idx * 0.018),
      critMultiplier: Math.min(2.5, 1.5 + idx * 0.07),
      dodgeChance: Math.min(ts.dodgeCap, 0.05 + idx * 0.03),
      initiative: avgRank,
      elementWeaknesses: [], statusImmunities: [],
      passiveHealPerRound: 0, powerDamageReduction: 0, physicalDamageReduction: 0,
      damageReductionCap: 0.80, summons: [], buffMultiplier: 1.0, buffRoundsLeft: 0,
      gimmickIds: ts.gimmicks,
      moves: [
        { name: `${enemy.grade} Strike`, type: 'physical', effectTag: null, behavior: 'attack', attackType: 'attack' as const },
        { name: enemy.type === 'boss' ? 'Overwhelming Destruction' : `${enemy.grade} Blast`, type: 'power', effectTag: null, behavior: 'attack', attackType: 'attack' as const },
      ],
    }
  }

  // ── State ──────────────────────────────────────────────────────────────────
  type Phase = 'pick' | 'fight' | 'result'
  let phase        = $state<Phase>('pick')
  let selectedTeam = $state<StoryTeam | null>(null)
  // Tracks char IDs that died mid-run; applied on Next Battle to keep them dead
  let carryOverDeadIds = $state(new Set<string>())

  // Wave + simultaneous team combat
  let allWaves     = $state<Enemy[][]>([])
  let waveIdx      = $state(0)
  // Player team's current HP (carried across waves with the 50% restore).
  // Built once per battle from the selected team; mutated when waves advance.
  let t1Chars      = $state<BattleCharacter[]>([])
  // Current wave's enemies — rebuilt fresh per wave.
  let t2Chars      = $state<BattleCharacter[]>([])
  let playerWon    = $state(false)
  let accDrops     = $state<BattleDrops>({ gems: 0, xp: 0, chanceDrops: [] })
  let lastDrops    = $state<BattleDrops | null>(null)
  // Set of enemy member-ids killed in this run (used to dedupe drop awards
  // since the controller can re-emit hpAfter snapshots).
  let killedIds    = $state(new Set<string>())

  // Manual / Auto preference seeded from the user's setting.
  let manualMode   = $state(!settings.autoBattle)
  let canInstant   = $derived(gamepasses.includes('instant_battle'))

  // Arena driving state (rebuilt per wave).
  let arenaTeams      = $state<[ArenaTeam, ArenaTeam] | null>(null)
  let controller      = $state<BattleControllerTeam | null>(null)
  let arenaPhase      = $state<'intro' | 'battle' | 'result'>('intro')
  // Latest hpAfter snapshot — used to detect newly-killed enemies for drops.
  let prevEnemyHp     = $state<Record<string, number>>({})

  // ── Derived ────────────────────────────────────────────────────────────────
  let battleNumber   = $derived(plusMode
    ? (slot.absolutePlusBattles ?? 0) + 1
    : (slot.worldProgress[world]?.battlesCompleted ?? 0) + 1)
  let previewWaves   = $derived(getBattleWaves(world, battleNumber))
  let previewEnemies = $derived(previewWaves.flat())
  let ec = $derived(previewEnemies[0] ? gradeColor(previewEnemies[0].grade) : '#9a907b')

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

  // ── Lifecycle helpers ──────────────────────────────────────────────────────
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  onDestroy(() => { if (timeoutId) clearTimeout(timeoutId) })

  function startFight() {
    if (!selectedTeam || teamMembers.length === 0) return

    allWaves = getBattleWaves(world, battleNumber)
    waveIdx  = 0
    killedIds = new Set()

    // Build the player team. Dead chars from a previous Next Battle carry stay at 0 HP.
    const dead = carryOverDeadIds
    carryOverDeadIds = new Set()
    t1Chars = teamMembers.map(m => {
      const spinMult  = m.spinClass === 'paragon' ? 8 : m.spinClass === 'legend' ? 4 : m.spinClass === 'hero' ? 2 : 1
      const levelMult = 1 + Math.max(0, (m.level ?? 1) - 1) * 0.01
      const bc = buildBattleCharacter(m.spins, m.name, {
        weapons: m.equippedWeapons ?? [],
        armors:  m.equippedArmors  ?? [],
        powers:  m.equippedPowers  ?? [],
      }, spinMult * levelMult)
      return dead.has(m.id) ? { ...bc, hp: 0 } : bc
    })

    accDrops = { gems: 0, xp: 0, chanceDrops: [] }
    phase = 'fight'
    mountWave()
  }

  // Build arena teams + controller for the current wave. Called on wave
  // start. Player HP carries forward via the t1Chars `hp` field.
  function mountWave() {
    const enemies = allWaves[waveIdx] ?? []
    t2Chars = enemies.map(e => buildEnemyChar(e))

    const t1Ids = t1Chars.map((_, i) => `t1-${i}`)
    const t2Ids = t2Chars.map((_, i) => `t2-${i}-w${waveIdx}`)

    arenaTeams = [
      {
        side: 'team1', label: selectedTeam?.name ?? 'Your Team', accent: '#f0c040',
        members: t1Chars.map((c, i) => memberFromChar(c, t1Ids[i], 'team1', formatHp, teamMembers[i]?.spinClass)),
      },
      {
        side: 'team2',
        label: allWaves.length > 1 ? `Wave ${waveIdx + 1} / ${allWaves.length}` : 'Enemies',
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
    // Snapshot newly-killed enemies in this round → accumulate drops.
    for (const id of Object.keys(prevEnemyHp)) {
      const prev = prevEnemyHp[id]
      const now  = round.hpAfter[id] ?? prev
      if (prev > 0 && now <= 0 && !killedIds.has(id)) {
        killedIds.add(id)
        killedIds = killedIds  // force reactivity
        // Resolve enemy index → drops
        const idx = t2Chars.findIndex((_, i) => `t2-${i}-w${waveIdx}` === id)
        const enemy = idx >= 0 ? allWaves[waveIdx]?.[idx] : undefined
        if (enemy) {
          const d = rollDrops(enemy)
          accDrops = {
            gems: accDrops.gems + d.gems,
            xp:   accDrops.xp   + d.xp,
            chanceDrops: [...accDrops.chanceDrops, ...d.chanceDrops],
          }
        }
      }
    }
    // Update HP snapshot for next round's diff.
    prevEnemyHp = { ...prevEnemyHp, ...round.hpAfter }
  }

  function handleArenaEnd(w: ArenaWinner) {
    // Carry over each player ally's current HP into t1Chars for the next
    // wave (or for the final result snapshot).
    if (controller) {
      t1Chars = t1Chars.map((c, i) => ({ ...c, hp: controller!.getHp(`t1-${i}`) }))
    }

    if (w !== 'team1') { finishBattle(w); return }
    if (waveIdx + 1 >= allWaves.length) { finishBattle('team1'); return }

    // Player won this wave + more waves to go: restore 50% HP to living
    // allies, advance, remount the arena.
    t1Chars = t1Chars.map(c => {
      if (c.hp <= 0) return c
      return { ...c, hp: Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.5)) }
    })
    waveIdx = waveIdx + 1
    // Small pause so the player can see the wave-cleared state before the
    // next intro splash.
    timeoutId = setTimeout(mountWave, 800)
  }

  function finishBattle(winner: ArenaWinner) {
    playerWon = winner === 'team1'
    if (playerWon) {
      if (slot.playerLevel >= 3 && Math.random() < ENDLESS_KEY_DROP_RATE) {
        accDrops = { ...accDrops, chanceDrops: [...accDrops.chanceDrops, 'endlessKey'] }
      }
      lastDrops = { ...accDrops }
      // Fire-and-forget daily-challenge tick; server rate-limits.
      fetch('/api/challenges/progress', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'story_battle_win' }),
      }).catch(() => { /* network — ignore */ })
    } else {
      lastDrops = null
    }
    // Persist a lightweight replay snapshot.
    try {
      saveReplay({
        mode: 'story',
        worldGrade: world,
        team1Label: selectedTeam?.name ?? 'Your Team',
        team2Label: `World ${world}`,
        team1Chars: t1Chars.map(c => ({ name: c.name, race: c.raceLabel, archetype: c.archetypeLabel })),
        team2Chars: t2Chars.map(c => ({ name: c.name })),
        logLines: [],
        playerWon,
        fullState: {
          team1: $state.snapshot(t1Chars),
          team2: $state.snapshot(t2Chars),
          allWaves: $state.snapshot(allWaves),
        },
      })
    } catch { /* localStorage quota — skip silently */ }
    phase = 'result'
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
    arenaTeams = null; controller = null
    waveIdx = 0; killedIds = new Set()
    accDrops = { gems: 0, xp: 0, chanceDrops: [] }
  }

  function confirmResult() {
    if (!playerWon) {
      if (gamepasses.includes('revenge_protocol') && accDrops.gems > 0) {
        const partialDrops: BattleDrops = { gems: Math.floor(accDrops.gems / 2), xp: 0, chanceDrops: [] }
        onBattleComplete(applyBattleDrops(slot, partialDrops))
      } else {
        carryOverDeadIds = new Set()
        phase = 'pick'
        selectedTeam = null
        resetBattleState()
      }
      return
    }
    if (!lastDrops) {
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
    // Story mode revives all characters between battles — only Endless
    // mode keeps fallen members dead across runs (see EndlessView). So
    // we explicitly clear carryOverDeadIds here regardless of who died.
    carryOverDeadIds = new Set()
    resetBattleState()
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
  {#if phase === 'fight' && allWaves.length > 1}
    <span class="font-mono text-xs px-2 py-1 rounded"
      style="background: rgba(167,139,250,0.08); border: 1px solid rgba(167,139,250,0.2); color: #a78bfa;">
      W{waveIdx + 1}/{allWaves.length}
    </span>
  {:else}
    <div style="width: 36px;"></div>
  {/if}
</header>

<div class="pt-20 px-4 w-full flex flex-col"
  style="max-width: 560px; margin: 0 auto; min-height: 100dvh;
         padding-bottom: max(96px, calc(env(safe-area-inset-bottom, 0px) + 96px)); contain: layout;">

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
        <span class="material-symbols-outlined"
              style="font-size: 36px; color: var(--color-outline); font-variation-settings: 'FILL' 1;">shield_person</span>
        <p class="font-mono text-sm mt-3" style="color: var(--color-outline);">No teams available.</p>
        <p class="font-mono text-xs mt-1" style="color: var(--color-outline);">Go to Teams to create one before battling.</p>
        <button onclick={onGoToTeams}
                class="metal-stamp-gold rounded-lg px-5 py-2.5 font-bold font-mono text-sm mt-5 tracking-widest">
          Create a Team
        </button>
      </div>
    {:else}
      <p class="font-bold text-sm mb-3"
         style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Select your team:</p>
      <div class="flex flex-col gap-2">
        {#each teams as { team, members } (team.id)}
          {@const sel = selectedTeam?.id === team.id}
          <button
            onclick={() => selectedTeam = team}
            class="obsidian-slab rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
            style="border: 1px solid {sel ? 'rgba(240,192,64,0.5)' : 'transparent'};
                   cursor: pointer; background: {sel ? 'rgba(240,192,64,0.05)' : ''};
                   transition: border-color 120ms;">
            <div class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                 style="background: {sel ? 'rgba(240,192,64,0.18)' : 'rgba(240,192,64,0.07)'};
                        border: 1px solid rgba(240,192,64,{sel ? '0.4' : '0.15'});">
              <span class="material-symbols-outlined"
                    style="font-size: 18px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">shield_person</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-sm truncate"
                 style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{team.name}</p>
              <div class="flex flex-wrap gap-x-2 mt-0.5">
                {#each members as m}
                  <span class="font-mono text-xs" style="color: var(--color-outline);">
                    {m.name} <span style="color: var(--gold-bright);">({m.overallTier})</span>
                  </span>
                {/each}
              </div>
            </div>
            {#if sel}
              <span class="material-symbols-outlined flex-shrink-0"
                    style="font-size: 18px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">check_circle</span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Fight CTA — sits ABOVE the 64px bottom hotbar so it isn't half-occluded. -->
      <div class="fixed left-0 right-0 px-4 pt-3 z-20"
        style="bottom: 64px; background: linear-gradient(transparent, rgba(7,7,13,0.97) 40%);
               padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));">
        <div class="max-w-md mx-auto">
          <button onclick={startFight} disabled={!selectedTeam || teamMembers.length === 0}
            data-fx="big"
            class="{selectedTeam && teamMembers.length > 0 ? 'metal-stamp-gold' : 'obsidian-slab'} w-full py-3.5 rounded-xl font-bold font-mono text-sm tracking-widest"
            style="{!selectedTeam || teamMembers.length === 0 ? 'opacity: 0.4; cursor: not-allowed; color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07);' : ''}">
            ⚔ Fight
          </button>
        </div>
      </div>
    {/if}
  {/if}

  <!-- ══ Phase: fight (per-wave BattleArena) ════════════════════════════════ -->
  {#if phase === 'fight' && arenaTeams && controller}
    {#key waveIdx}
      <BattleArena
        bind:phase={arenaPhase}
        teams={arenaTeams}
        controller={controller}
        manualMode={manualMode}
        onManualToggle={(m) => manualMode = m}
        modeTitle={plusMode ? `Absolute +${absolutePlusLevel}` : `${world} World — Battle ${battleNumber}`}
        modeSubtitle={allWaves.length > 1 ? `Wave ${waveIdx + 1} / ${allWaves.length}` : 'Story Battle'}
        modeAccent={ec}
        speedFactor={settings.battleSpeed}
        effectsEnabled={settings.effectsEnabled}
        canInstant={canInstant}
        onRoundEnd={handleArenaRoundEnd}
        onBattleEnd={handleArenaEnd}/>
    {/key}
  {/if}

</div>

<!-- ══ Result overlay (dark modal) ══════════════════════════════════════════ -->
{#if phase === 'result'}
  <div class="fixed inset-0 z-50 flex items-end justify-center px-4"
    style="background: rgba(0,0,0,0.72); backdrop-filter: blur(10px);
           padding-bottom: max(88px, calc(env(safe-area-inset-bottom,0px) + 88px));">
    <div class="w-full max-w-md bv-result-banner"
         class:bv-result-win={playerWon} class:bv-result-loss={!playerWon}>
      <div class="px-5 py-2 text-center">
        {#if playerWon}
          <span class="material-symbols-outlined"
                style="font-size: 36px; color: #34d399; font-variation-settings: 'FILL' 1;
                       filter: drop-shadow(0 0 12px rgba(52,211,153,0.5));">emoji_events</span>
          <p class="text-xs tracking-[0.32em] uppercase mt-1 mb-1.5"
             style="font-family: 'JetBrains Mono', monospace; color: #34d399; font-weight: 700;">Victory</p>
          <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900;
                    color: #34d399; letter-spacing: 0.12em;
                    filter: drop-shadow(0 0 16px rgba(52,211,153,0.6));">{selectedTeam?.name ?? 'Your Team'} WINS!</p>
          <p class="mt-1 text-sm" style="color: #9a907b;">Fate has spoken.</p>

          {#if lastDrops}
            <div class="mt-4 text-left mx-auto px-4 py-3 rounded-xl"
                 style="background: rgba(0,0,0,0.3); border: 1px solid rgba(240,192,64,0.12);">
              <p class="font-mono text-xs mb-2 tracking-widest uppercase" style="color: var(--color-outline);">Battle Drops</p>
              <div class="flex items-center gap-4 mb-2">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined"
                        style="font-size: 15px; color: #34d399; font-variation-settings: 'FILL' 1;">paid</span>
                  <span class="font-mono text-sm font-bold" style="color: #34d399;">+{lastDrops.gems.toLocaleString()} gems</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined"
                        style="font-size: 15px; color: #a78bfa; font-variation-settings: 'FILL' 1;">bolt</span>
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
          <span class="material-symbols-outlined"
                style="font-size: 36px; color: #ef4444; font-variation-settings: 'FILL' 1;
                       filter: drop-shadow(0 0 12px rgba(239,68,68,0.5));">sentiment_dissatisfied</span>
          <p class="text-xs tracking-[0.32em] uppercase mt-1 mb-1.5"
             style="font-family: 'JetBrains Mono', monospace; color: #ef4444; font-weight: 700;">Defeated</p>
          <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900;
                    color: #ef4444; letter-spacing: 0.12em;">Enemy Forces WIN!</p>
          <p class="mt-1 text-sm" style="color: #9a907b;">{selectedTeam?.name ?? 'Your team'} was defeated. Try again.</p>
          {#if gamepasses.includes('revenge_protocol') && accDrops.gems > 0}
            <div class="mt-4 mx-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg"
              style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.4); animation: fadeIn 0.3s ease-out forwards;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: #f87171; font-variation-settings: 'FILL' 1;">shield</span>
              <span class="font-mono text-xs font-bold" style="color: #f87171; letter-spacing: 0.08em;">
                REVENGE PROTOCOL · +{Math.floor(accDrops.gems / 2).toLocaleString()} gems salvaged
              </span>
            </div>
          {/if}
        {/if}

        {#if playerWon && lastDrops}
          <!-- Visible badges for passive game passes that affected this win.
               Players were owning these and getting no feedback; this row
               telegraphs each one's contribution to the drop. -->
          <div class="mt-2 flex flex-wrap gap-1.5 justify-center">
            {#if gamepasses.includes('double_shard_drop') && lastDrops.chanceDrops.some(d => d === 'fateShard')}
              <span class="font-mono text-[10px] px-2 py-0.5 rounded"
                style="background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.35); color: #38bdf8; letter-spacing: 0.08em;">
                ⚡ 2× SHARD DROP
              </span>
            {/if}
            {#if gamepasses.includes('double_luck')}
              <span class="font-mono text-[10px] px-2 py-0.5 rounded"
                style="background: rgba(167,139,250,0.12); border: 1px solid rgba(167,139,250,0.35); color: #a78bfa; letter-spacing: 0.08em;">
                ⚡ 2× LUCK
              </span>
            {/if}
            {#if gamepasses.includes('crit_surge')}
              <span class="font-mono text-[10px] px-2 py-0.5 rounded"
                style="background: rgba(244,63,94,0.12); border: 1px solid rgba(244,63,94,0.35); color: #f87171; letter-spacing: 0.08em;">
                ⚡ CRIT SURGE
              </span>
            {/if}
          </div>
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
