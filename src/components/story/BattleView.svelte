<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import {
    getEnemy, rollDrops, BATTLES_PER_WORLD, WORLD_GRADES, ENDLESS_KEY_DROP_RATE,
    type WorldGrade, type Enemy, type ChanceDrop,
  } from '$lib/story/worlds'
  import {
    buildBattleCharacter, simulateBattle, formatHp,
    type BattleCharacter, type BattleRound,
  } from '$lib/game/battle'
  import {
    recordBattleWin, applyBattleDrops, addCharacterXp,
    type StorySaveSlot, type BattleDrops,
  } from '$lib/story/saveSlots'
  import type { StoryRosterEntry } from '$lib/story/types'
  import AttackFX from '../AttackFX.svelte'

  let { slot, world, onBattleComplete, onBack }: {
    slot: StorySaveSlot
    world: WorldGrade
    onBattleComplete: (updated: StorySaveSlot) => void
    onBack: () => void
  } = $props()

  // ── Grade colors ──────────────────────────────────────────────────────────
  const GRADE_COLORS: Record<string, string> = {
    F: '#6b7280', E: '#78716c', D: '#a3a3a3', C: '#4ade80',
    B: '#60a5fa', A: '#a78bfa', S: '#f59e0b', SS: '#f97316',
    SSS: '#ef4444', Z: '#ec4899', ZZ: '#d946ef', ZZZ: '#8b5cf6',
    Celestial: '#67e8f9', Godly: '#fbbf24', Primordial: '#f87171', Absolute: '#ffffff',
  }
  function gradeColor(g: string): string { return GRADE_COLORS[g] ?? '#9a907b' }

  // ── Stat rank range per world grade (F world → F to D tier, E → E to C, etc.) ──
  // Ranks are 0–41 where 0 = F- tier, 41 = God tier.
  // Each world maps to [minRank, maxRank] spanning roughly 3 letter grades of stats.
  const WORLD_STAT_RANGE: Record<WorldGrade, [number, number]> = {
    F:         [0,   12],
    E:         [5,   17],
    D:         [9,   21],
    C:         [14,  26],
    B:         [18,  30],
    A:         [23,  35],
    S:         [27,  40],
    SS:        [32,  41],
    SSS:       [36,  41],
    Z:         [38,  41],
    ZZ:        [39,  41],
    ZZZ:       [40,  41],
    Celestial: [41,  41],
    Godly:     [41,  41],
    Primordial:[41,  41],
    Absolute:  [41,  41],
  }

  function randRank(min: number, max: number): number {
    return Math.round(min + Math.random() * (max - min))
  }

  // ── Enemy HP baseline matching battle.ts HP_TABLE ──────────────────────────
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
    const hp      = Math.round(baseHp * mult)

    // Each stat gets its own random roll within the world's tier band
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
      agilityRank,
      speedRank,
      charismaRank,
      iqRank,
      potentialRank,
      energyRank,
      fightingSkillRank,
      weaponEnchantTags: [],
      armorEnchantTags:  [],
      critChance:     Math.min(0.35, 0.08 + idx * 0.018),
      critMultiplier: Math.min(2.5,  1.5  + idx * 0.07),
      dodgeChance:    Math.min(0.50, 0.05 + idx * 0.03),
      initiative: avgRank,
      moves: [
        { name: `${enemy.grade} Strike`,        type: 'physical', effectTag: null, behavior: 'attack' },
        { name: enemy.type === 'boss' ? 'Overwhelming Destruction' : `${enemy.grade} Blast`, type: 'power', effectTag: null, behavior: 'attack' },
      ],
    }
  }

  // ── State ──────────────────────────────────────────────────────────────────
  type Phase = 'pick' | 'intro' | 'battle' | 'result'
  let phase         = $state<Phase>('pick')
  let selectedChar  = $state<StoryRosterEntry | null>(null)
  let playerChar    = $state<BattleCharacter | null>(null)
  let enemyChar     = $state<BattleCharacter | null>(null)
  let rounds        = $state<BattleRound[]>([])
  let roundIdx      = $state(0)
  let playerWon     = $state(false)
  let lastDrops     = $state<BattleDrops | null>(null)

  let p1DisplayHp   = $state(0)
  let p2DisplayHp   = $state(0)
  let logLines      = $state<string[]>([])
  let logEl         = $state<HTMLDivElement | null>(null)

  type AnimDir = 'ltr' | 'rtl' | 'center'
  let activeAnim = $state<{ type: string; color: string; key: number; direction: AnimDir } | null>(null)
  let animKey = 0
  let dodgeDir = $state<'ltr' | 'rtl' | null>(null)
  let animTimeoutId: ReturnType<typeof setTimeout> | null = null
  let timeoutId:     ReturnType<typeof setTimeout> | null = null

  let battleNumber  = $derived((slot.worldProgress[world]?.battlesCompleted ?? 0) + 1)
  let enemy         = $derived(getEnemy(world, battleNumber))
  let sortedRoster  = $derived([...slot.roster].sort((a, b) => b.overallScore - a.overallScore))

  let p1HpPct = $derived(playerChar ? Math.max(0, p1DisplayHp / playerChar.maxHp) : 1)
  let p2HpPct = $derived(enemyChar  ? Math.max(0, p2DisplayHp / enemyChar.maxHp)  : 1)

  function hpColor(pct: number): string {
    if (pct > 0.50) return '#22c55e'
    if (pct > 0.25) return '#eab308'
    return '#ef4444'
  }

  onDestroy(() => {
    if (timeoutId)     clearTimeout(timeoutId)
    if (animTimeoutId) clearTimeout(animTimeoutId)
  })

  // ── Attack animation (same logic as BattleScreen) ─────────────────────────
  function showAnim(type: string, color: string, direction: AnimDir = 'center') {
    if (animTimeoutId) clearTimeout(animTimeoutId)
    activeAnim = { type, color, key: ++animKey, direction }
    dodgeDir = type === 'dodge' ? (direction === 'ltr' ? 'ltr' : direction === 'rtl' ? 'rtl' : null) : null
    animTimeoutId = setTimeout(() => { activeAnim = null; dodgeDir = null }, 950)
  }

  function detectAnim(line: string): { type: string; color: string; direction: AnimDir } | null {
    const direction: AnimDir =
      (playerChar && line.startsWith(playerChar.name)) ? 'ltr' :
      (enemyChar  && line.startsWith(enemyChar.name))  ? 'rtl' :
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

  // ── Animated log playback (identical to BattleScreen) ────────────────────
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
    const delay = head.startsWith('──') ? 550 : 1600
    timeoutId = setTimeout(() => playLines(rest, onDone), delay)
  }

  function playRound() {
    if (roundIdx >= rounds.length) {
      const finalWinner = rounds.at(-1)?.winner ?? null
      playerWon = finalWinner === 'p1'
      afterBattle()
      return
    }

    const round = rounds[roundIdx]
    roundIdx++

    const lines = [`── Round ${round.roundNum} ──`, ...round.lines]

    playLines(lines, () => {
      p1DisplayHp = round.p1Hp
      p2DisplayHp = round.p2Hp

      if (round.winner !== undefined) {
        playerWon = round.winner === 'p1'
        afterBattle()
      } else {
        timeoutId = setTimeout(playRound, 900)
      }
    })
  }

  function afterBattle() {
    if (playerWon) {
      let totalGems = 0, totalXp = 0
      const chanceDrops: ChanceDrop[] = []
      const d = rollDrops(enemy)
      totalGems = d.gems
      totalXp   = d.xp
      chanceDrops.push(...d.chanceDrops)
      if (slot.playerLevel >= 3 && Math.random() < ENDLESS_KEY_DROP_RATE) {
        chanceDrops.push('endlessKey')
      }
      lastDrops = { gems: totalGems, xp: totalXp, chanceDrops }
    } else {
      lastDrops = null
    }
    phase = 'result'
  }

  // ── Start fight ────────────────────────────────────────────────────────────
  function startFight() {
    if (!selectedChar) return
    playerChar = buildBattleCharacter(selectedChar.spins, selectedChar.name)
    enemyChar  = buildEnemyChar(enemy)

    p1DisplayHp = playerChar.hp
    p2DisplayHp = enemyChar.hp
    rounds      = simulateBattle(playerChar, enemyChar)
    roundIdx    = 0
    logLines    = []

    phase = 'intro'
    timeoutId = setTimeout(() => {
      phase = 'battle'
      playRound()
    }, 2600)
  }

  function confirmResult() {
    if (!playerWon || !lastDrops) {
      phase        = 'pick'
      selectedChar = null
      playerChar   = null
      enemyChar    = null
      logLines     = []
      return
    }
    let updated = recordBattleWin(slot, world)
    updated = applyBattleDrops(updated, lastDrops)
    if (selectedChar) {
      updated = addCharacterXp(updated, selectedChar.id, lastDrops.xp)
    }
    onBattleComplete(updated)
  }

  const DROP_LABELS: Record<string, string> = {
    fateShard:    'Fate Shard',
    powerCrystal: 'Power Crystal (F)',
    statCrystal:  'Stat Crystal (Common)',
    weaponCrystal:'Weapon Crystal (F)',
    armorCrystal: 'Armor Crystal (F)',
    endlessKey:   'Endless Key',
  }
</script>

<!-- ── Header ─────────────────────────────────────────────────────────────── -->
<header class="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4"
  style="height: 64px; background: rgba(7,7,13,0.97); border-bottom: 1px solid rgba(240,192,64,0.15); backdrop-filter: blur(20px);"
>
  {#if phase === 'pick'}
    <button onclick={onBack}
      style="background: none; border: none; cursor: pointer; color: var(--color-outline); font-size: 20px; line-height: 1; padding: 8px;">←</button>
  {:else}
    <div style="width: 36px;"></div>
  {/if}
  <h2 class="font-bold flex-1 text-center" style="font-family: var(--font-cinzel); font-size: 15px; color: var(--color-on-surface);">
    {world} World — Battle {battleNumber}/{BATTLES_PER_WORLD}
  </h2>
  <div style="width: 36px;"></div>
</header>

<div class="pt-20 px-3 w-full flex flex-col" style="max-width: 800px; margin: 0 auto; min-height: 100dvh; padding-bottom: max(96px, calc(env(safe-area-inset-bottom, 0px) + 96px));">

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- Phase: pick character                                                  -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  {#if phase === 'pick'}
    <!-- Enemy preview -->
    <div class="mb-5">
      <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: var(--color-outline);">Opponent</p>
      {@const ec = gradeColor(enemy.grade)}
      <div class="obsidian-slab rounded-xl px-3 py-2.5 flex items-center gap-2.5"
        style="border: 1px solid {ec}33;">
        <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs"
          style="background: {ec}18; border: 1px solid {ec}44; color: {ec}; font-family: var(--font-cinzel); font-size: {enemy.grade.length > 3 ? '8px' : '12px'};">
          {enemy.grade}
        </div>
        <div class="min-w-0">
          <p class="font-bold text-xs truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{enemy.name}</p>
          <p class="font-mono text-xs" style="color: var(--color-outline);">
            {enemy.type === 'boss' ? '⚔ Boss' : enemy.type === 'elite' ? '★ Elite' : 'Normal'}
          </p>
        </div>
      </div>
    </div>

    <!-- Character picker -->
    {#if sortedRoster.length === 0}
      <div class="text-center pt-8">
        <p class="font-mono text-sm" style="color: var(--color-outline);">No characters in roster. Spin to add some first.</p>
        <button onclick={onBack} class="metal-stamp-gold rounded-lg px-5 py-2 font-bold font-mono text-sm mt-5">Back</button>
      </div>
    {:else}
      <p class="font-bold text-sm mb-3" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">Choose your fighter:</p>
      <div class="flex flex-col gap-2">
        {#each sortedRoster as char (char.id)}
          {@const sel = selectedChar?.id === char.id}
          <button
            onclick={() => selectedChar = char}
            class="obsidian-slab rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left"
            style="border: 1px solid {sel ? 'rgba(240,192,64,0.5)' : 'transparent'}; cursor: pointer; background: {sel ? 'rgba(240,192,64,0.05)' : ''}; transition: border-color 120ms;"
          >
            <div class="flex-1 min-w-0">
              <p class="font-bold text-sm truncate" style="font-family: var(--font-cinzel); color: var(--color-on-surface);">{char.name}</p>
              <p class="font-mono text-xs mt-0.5" style="color: var(--color-outline);">{char.race} · {char.archetype} · Lv {char.level}</p>
            </div>
            <div class="flex-shrink-0 text-right">
              <p class="font-mono text-xs font-bold" style="color: var(--gold-bright);">{char.overallTier}</p>
              <p class="font-mono text-xs" style="color: var(--color-outline);">score {char.overallScore}</p>
            </div>
            {#if sel}
              <span class="material-symbols-outlined flex-shrink-0" style="font-size: 18px; color: var(--gold-bright); font-variation-settings: 'FILL' 1;">check_circle</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Fight button -->
    {#if sortedRoster.length > 0}
      <div class="fixed bottom-0 left-0 right-0 px-4 pt-3 z-20"
        style="background: linear-gradient(transparent, rgba(7,7,13,0.97) 40%); padding-bottom: max(28px, env(safe-area-inset-bottom, 28px));">
        <div class="max-w-md mx-auto">
          <button
            onclick={startFight}
            disabled={!selectedChar}
            class="{selectedChar ? 'metal-stamp-gold' : 'obsidian-slab'} w-full py-3.5 rounded-xl font-bold font-mono text-sm tracking-widest"
            style="{!selectedChar ? 'opacity: 0.4; cursor: not-allowed; color: var(--color-outline); border: 1px solid rgba(255,255,255,0.07);' : ''}"
          >
            ⚔ Fight
          </button>
        </div>
      </div>
    {/if}
  {/if}

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- Phases: intro / battle / result — character panels always visible     -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  {#if phase !== 'pick' && playerChar && enemyChar}

    <!-- Character panels + attack FX overlay -->
    <div class="w-full relative mb-3" style="overflow: visible;">
      <div class="grid grid-cols-2 gap-2">

        <!-- Player panel -->
        <div class="rounded-xl p-2.5 flex flex-col gap-1.5 {dodgeDir === 'ltr' ? 'panel-dodging' : ''}"
          style="background: rgba(240,192,64,0.06); border: 1px solid rgba(240,192,64,{phase === 'result' && playerWon ? '0.7' : '0.22'}); box-shadow: {phase === 'result' && playerWon ? '0 0 40px rgba(240,192,64,0.3)' : 'none'}; transition: box-shadow 0.5s, border-color 0.5s;">
          <div class="flex items-center gap-2 min-w-0">
            {#if phase === 'result' && playerWon}
              <span class="material-symbols-outlined shrink-0" style="font-size: 18px; color: #f0c040; font-variation-settings: 'FILL' 1;">workspace_premium</span>
            {:else if phase === 'result' && !playerWon}
              <span class="material-symbols-outlined shrink-0" style="font-size: 18px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>
            {/if}
            <p class="font-bold truncate" style="font-family: 'Cinzel', serif; color: #ffdf96; font-size: 0.9rem;">{playerChar.name}</p>
          </div>
          <p class="text-xs truncate" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">{playerChar.raceLabel} · {playerChar.archetypeLabel}</p>
          <div class="rounded-full overflow-hidden" style="height: 10px; background: rgba(255,255,255,0.08);">
            <div class="h-full rounded-full" style="width: {p1HpPct * 100}%; background: {hpColor(p1HpPct)}; transition: width 0.8s ease-out, background 0.5s;"></div>
          </div>
          <p class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: {hpColor(p1HpPct)};">{formatHp(p1DisplayHp)} / {formatHp(playerChar.maxHp)} HP</p>
          <div class="grid grid-cols-3 gap-1 mt-1">
            {#each [['ATK', formatHp(playerChar.physicalDamage)], ['DEF', Math.round(playerChar.armorReduction * 100) + '%'], ['INIT', Math.round(playerChar.initiative)]] as [lbl, val]}
              <div class="text-center rounded py-1" style="background: rgba(240,192,64,0.06); border: 1px solid rgba(240,192,64,0.1);">
                <p style="font-family: 'JetBrains Mono', monospace; color: #9a907b; font-size: 9px;">{lbl}</p>
                <p class="font-bold text-xs" style="font-family: 'Cinzel', serif; color: #ffdf96;">{val}</p>
              </div>
            {/each}
          </div>
        </div>

        <!-- Enemy panel -->
        {@const ec = gradeColor(enemy.grade)}
        <div class="rounded-xl p-2.5 flex flex-col gap-1.5 {dodgeDir === 'rtl' ? 'panel-dodging' : ''}"
          style="background: {ec}0d; border: 1px solid {ec}{phase === 'result' && !playerWon ? '66' : '22'}; box-shadow: {phase === 'result' && !playerWon ? '0 0 40px ' + ec + '30' : 'none'}; transition: box-shadow 0.5s, border-color 0.5s;">
          <div class="flex items-center gap-2 min-w-0">
            {#if phase === 'result' && !playerWon}
              <span class="material-symbols-outlined shrink-0" style="font-size: 18px; color: {ec}; font-variation-settings: 'FILL' 1;">workspace_premium</span>
            {:else if phase === 'result' && playerWon}
              <span class="material-symbols-outlined shrink-0" style="font-size: 18px; color: #ef4444; font-variation-settings: 'FILL' 1;">skull</span>
            {/if}
            <p class="font-bold truncate" style="font-family: 'Cinzel', serif; color: {ec}; font-size: 0.9rem;">{enemyChar.name}</p>
          </div>
          <p class="text-xs truncate" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">{enemyChar.raceLabel} · {enemyChar.archetypeLabel}</p>
          <div class="rounded-full overflow-hidden" style="height: 10px; background: rgba(255,255,255,0.08);">
            <div class="h-full rounded-full" style="width: {p2HpPct * 100}%; background: {hpColor(p2HpPct)}; transition: width 0.8s ease-out, background 0.5s;"></div>
          </div>
          <p class="text-xs" style="font-family: 'JetBrains Mono', monospace; color: {hpColor(p2HpPct)};">{formatHp(p2DisplayHp)} / {formatHp(enemyChar.maxHp)} HP</p>
          <div class="grid grid-cols-3 gap-1 mt-1">
            {#each [['ATK', formatHp(enemyChar.physicalDamage)], ['DEF', Math.round(enemyChar.armorReduction * 100) + '%'], ['INIT', Math.round(enemyChar.initiative)]] as [lbl, val]}
              <div class="text-center rounded py-1" style="background: {ec}0d; border: 1px solid {ec}1a;">
                <p style="font-family: 'JetBrains Mono', monospace; color: #9a907b; font-size: 9px;">{lbl}</p>
                <p class="font-bold text-xs" style="font-family: 'Cinzel', serif; color: {ec};">{val}</p>
              </div>
            {/each}
          </div>
        </div>

      </div>

      <!-- Attack FX overlay -->
      {#if phase === 'battle' && activeAnim}
        {#key activeAnim.key}
          <div style="position: absolute; top: 50%; transform: translateY(-50%);
                      {activeAnim.direction === 'rtl' ? 'right: 8%' : 'left: 8%'};
                      z-index: 20; pointer-events: none;">
            <AttackFX type={activeAnim.type} color={activeAnim.color}
                      direction={activeAnim.direction} size={76} />
          </div>
        {/key}
      {/if}
    </div>

    <!-- Intro VS splash -->
    {#if phase === 'intro'}
      <div class="text-center py-6" style="animation: resultReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
        <p style="font-family: 'Cinzel', serif; font-size: 3rem; font-weight: 900; color: #f0c040; letter-spacing: 0.2em; filter: drop-shadow(0 0 20px rgba(240,192,64,0.5));">VS</p>
        <p class="mt-2 text-sm tracking-[0.2em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Calculating fate…</p>
      </div>
    {/if}

    <!-- Battle log -->
    {#if phase !== 'intro'}
      <div class="w-full rounded-xl overflow-hidden mb-4" style="border: 1px solid rgba(240,192,64,0.12); background: #0d0d16;">
        <div class="flex items-center gap-2 px-4 py-2.5" style="border-bottom: 1px solid rgba(240,192,64,0.08);">
          <span class="material-symbols-outlined" style="font-size: 14px; color: #9a907b; font-variation-settings: 'FILL' 1;">menu_book</span>
          <p class="text-xs tracking-[0.15em] uppercase" style="font-family: 'JetBrains Mono', monospace; color: #9a907b;">Battle Log</p>
          {#if phase === 'battle'}
            <span class="ml-auto text-xs px-2 py-0.5 rounded" style="background: rgba(157,23,77,0.3); border: 1px solid rgba(157,23,77,0.5); font-family: 'JetBrains Mono', monospace; color: #f9a8d4;">
              Round {roundIdx} of {rounds.length}
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
            {:else if playerChar && line.startsWith(playerChar.name)}
              <p class="text-xs mb-1" style="color: #fde68a; font-family: 'JetBrains Mono', monospace;">{line}</p>
            {:else if enemyChar && line.startsWith(enemyChar.name)}
              <p class="text-xs mb-1" style="color: var(--color-on-surface-variant, #c4b99a); font-family: 'JetBrains Mono', monospace;">{line}</p>
            {:else}
              <p class="text-xs mb-1" style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-style: italic;">{line}</p>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Result section -->
    {#if phase === 'result'}
      <div class="w-full text-center py-6 rounded-2xl mb-4"
        style="background: {playerWon ? 'rgba(240,192,64,0.08)' : 'rgba(239,68,68,0.06)'}; border: 1px solid {playerWon ? 'rgba(240,192,64,0.4)' : 'rgba(239,68,68,0.3)'}; box-shadow: 0 0 60px {playerWon ? 'rgba(240,192,64,0.1)' : 'rgba(239,68,68,0.08)'}; animation: resultReveal 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;">
        {#if playerWon}
          <p class="text-xs tracking-[0.25em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #f0c040;">Victory</p>
          <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900; color: #f0c040; letter-spacing: 0.12em; filter: drop-shadow(0 0 16px rgba(240,192,64,0.55));">{selectedChar?.name} WINS!</p>
          <p class="mt-2 text-sm" style="color: #9a907b;">Fate has spoken.</p>

          {#if lastDrops}
            <div class="mt-4 text-left mx-auto px-4 py-3 rounded-xl max-w-xs" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(240,192,64,0.15);">
              <p class="font-mono text-xs mb-2 tracking-widest uppercase" style="color: var(--color-outline);">Battle Drops</p>
              <div class="flex items-center gap-4 mb-2">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined" style="font-size: 15px; color: #34d399; font-variation-settings: 'FILL' 1;">paid</span>
                  <span class="font-mono text-sm font-bold" style="color: #34d399;">+{lastDrops.gems.toLocaleString()} gems</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined" style="font-size: 15px; color: #a78bfa; font-variation-settings: 'FILL' 1;">bolt</span>
                  <span class="font-mono text-sm font-bold" style="color: #a78bfa;">+{lastDrops.xp.toLocaleString()} XP</span>
                </div>
              </div>
              {#if lastDrops.chanceDrops.length > 0}
                <div class="flex flex-wrap gap-1.5 mt-2">
                  {#each lastDrops.chanceDrops as drop}
                    <span class="font-mono text-xs px-2 py-1 rounded"
                      style="background: rgba(240,192,64,0.1); border: 1px solid rgba(240,192,64,0.25); color: var(--gold-bright);">
                      {DROP_LABELS[drop] ?? drop}
                    </span>
                  {/each}
                </div>
              {/if}
              {#if battleNumber === BATTLES_PER_WORLD}
                <p class="font-mono text-sm mt-3 text-center font-bold" style="color: #4ade80;">World Cleared!</p>
              {/if}
            </div>
          {/if}

        {:else}
          <p class="text-xs tracking-[0.25em] uppercase mb-2" style="font-family: 'JetBrains Mono', monospace; color: #ef4444;">Defeated</p>
          <p style="font-family: 'Cinzel', serif; font-size: clamp(1.4rem, 5vw, 2rem); font-weight: 900; color: #ef4444; letter-spacing: 0.12em;">{enemy.name} WINS!</p>
          <p class="mt-2 text-sm" style="color: #9a907b;">{selectedChar?.name} was defeated. Try again.</p>
        {/if}
      </div>

      <div class="flex gap-3 w-full max-w-sm mx-auto justify-center">
        <button onclick={confirmResult}
          class="flex-1 metal-stamp-gold py-3 rounded-xl font-bold font-mono text-sm tracking-widest">
          {playerWon && battleNumber < BATTLES_PER_WORLD ? 'Continue' : playerWon ? 'Done' : 'Try Again'}
        </button>
      </div>
    {/if}

  {/if}

</div>

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
