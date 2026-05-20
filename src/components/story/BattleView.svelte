<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    getEnemy, rollDrops, BATTLES_PER_WORLD, WORLD_GRADES, ENDLESS_KEY_DROP_RATE,
    type WorldGrade, type Enemy, type EnemyType, type ChanceDrop,
  } from '$lib/story/worlds'
  import {
    buildBattleCharacter, simulateTeamBattle, formatHp,
    type BattleCharacter, type TeamBattleRound,
  } from '$lib/game/battle'
  import {
    recordBattleWin, applyBattleDrops, addCharacterXp,
    type StorySaveSlot, type BattleDrops,
  } from '$lib/story/saveSlots'
  import type { StoryRosterEntry } from '$lib/story/types'

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

  // ── Enemy HP baseline (base grades, matching battle.ts HP_TABLE) ──────────
  const ENEMY_BASE_HP: Record<string, number> = {
    F: 100, E: 300, D: 650, C: 1250, B: 2500, A: 5000,
    S: 10000, SS: 22000, SSS: 47000, Z: 100000, ZZ: 220000, ZZZ: 470000,
    Celestial: 1000000, Godly: 2200000, Primordial: 3000000, Absolute: 6800000,
  }

  function buildEnemyChar(enemy: Enemy): BattleCharacter {
    const idx  = WORLD_GRADES.indexOf(enemy.grade)
    const rank = (idx / Math.max(1, WORLD_GRADES.length - 1)) * 41
    const baseHp = ENEMY_BASE_HP[enemy.grade] ?? 100
    const mult = enemy.type === 'boss' ? 2.5 : enemy.type === 'elite' ? 1.5 : 1.0
    const hp = Math.round(baseHp * mult)
    const dmg = Math.round(hp / 2 * (1 + rank / 82))
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
      agilityRank:        Math.round(rank),
      speedRank:          Math.round(rank),
      charismaRank:       Math.round(rank * 0.5),
      iqRank:             Math.round(rank * 0.6),
      potentialRank:      Math.round(rank * 0.7),
      energyRank:         Math.round(rank * 0.8),
      fightingSkillRank:  Math.round(rank),
      weaponEnchantTags: [],
      armorEnchantTags:  [],
      critChance:     Math.min(0.35, 0.08 + idx * 0.018),
      critMultiplier: Math.min(2.5,  1.5  + idx * 0.07),
      dodgeChance:    Math.min(0.50, 0.05 + idx * 0.03),
      initiative: rank,
      moves: [
        { name: `${enemy.grade} Strike`,        type: 'physical', effectTag: null, behavior: 'attack' },
        { name: enemy.type === 'boss' ? 'Overwhelming Destruction' : `${enemy.grade} Blast`, type: 'power', effectTag: null, behavior: 'attack' },
      ],
    }
  }

  // ── Generate enemy team (normal=1, elite=2, boss=3) ───────────────────────
  function generateEnemyTeam(w: WorldGrade, battleNum: number): Enemy[] {
    const main = getEnemy(w, battleNum)
    const idx  = WORLD_GRADES.indexOf(w)
    const lowerGrade = idx > 0 ? WORLD_GRADES[idx - 1] : WORLD_GRADES[0]
    if (main.type === 'boss') {
      return [
        main,
        { grade: lowerGrade, type: 'normal', name: `${lowerGrade} Minion I` },
        { grade: lowerGrade, type: 'normal', name: `${lowerGrade} Minion II` },
      ]
    }
    if (main.type === 'elite') {
      return [main, { grade: lowerGrade, type: 'normal', name: `${lowerGrade} Escort` }]
    }
    return [main]
  }

  // ── State ──────────────────────────────────────────────────────────────────
  type Phase = 'pick' | 'battling' | 'result'
  let phase         = $state<Phase>('pick')
  let selectedChar  = $state<StoryRosterEntry | null>(null)
  let rounds        = $state<TeamBattleRound[]>([])
  let displayIdx    = $state(0)
  let playerWon     = $state(false)
  let lastDrops     = $state<BattleDrops | null>(null)
  let playerMaxHp   = $state(0)
  let animInterval: ReturnType<typeof setInterval> | null = null

  let battleNumber  = $derived((slot.worldProgress[world]?.battlesCompleted ?? 0) + 1)
  let enemyTeam     = $derived(generateEnemyTeam(world, battleNumber))
  let sortedRoster  = $derived([...slot.roster].sort((a, b) => b.overallScore - a.overallScore))
  let currentRound  = $derived(rounds[displayIdx] as TeamBattleRound | undefined)
  let enemyMaxHps   = $derived(enemyTeam.map(e => buildEnemyChar(e).maxHp))
  let playerHpNow   = $derived(currentRound ? currentRound.t1Hp[0] : playerMaxHp)
  let enemyHpsNow   = $derived(currentRound ? currentRound.t2Hp : enemyMaxHps)

  onDestroy(() => {
    if (animInterval !== null) clearInterval(animInterval)
  })

  function hpPct(cur: number, max: number): number {
    return max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0
  }

  // ── Start fight ────────────────────────────────────────────────────────────
  function startFight() {
    if (!selectedChar) return
    const playerChar  = buildBattleCharacter(selectedChar.spins, selectedChar.name)
    playerMaxHp = playerChar.maxHp
    const enemyChars  = enemyTeam.map(buildEnemyChar)
    const simRounds   = simulateTeamBattle([playerChar], enemyChars)

    rounds     = simRounds
    displayIdx = 0

    const final = simRounds[simRounds.length - 1]
    playerWon = final.winner === 'team1'

    if (playerWon) {
      let totalGems = 0, totalXp = 0
      const chanceDrops: ChanceDrop[] = []
      for (const enemy of enemyTeam) {
        const d = rollDrops(enemy)
        totalGems += d.gems
        totalXp   += d.xp
        chanceDrops.push(...d.chanceDrops)
      }
      // Endless Key drops at player level 3+
      if (slot.playerLevel >= 3 && Math.random() < ENDLESS_KEY_DROP_RATE) {
        chanceDrops.push('endlessKey')
      }
      lastDrops = { gems: totalGems, xp: totalXp, chanceDrops }
    } else {
      lastDrops = null
    }

    phase = 'battling'

    animInterval = setInterval(() => {
      if (displayIdx < rounds.length - 1) {
        displayIdx++
      } else {
        clearInterval(animInterval!)
        animInterval = null
        phase = 'result'
      }
    }, 700)
  }

  function confirmResult() {
    if (!playerWon || !lastDrops) {
      phase        = 'pick'
      selectedChar = null
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
    endlessKey:   '🗝 Endless Key',
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

<div class="pt-20 px-4 max-w-md mx-auto"
  style="padding-bottom: max(96px, calc(env(safe-area-inset-bottom, 0px) + 96px));">

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- Phase: pick character                                                  -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  {#if phase === 'pick'}

    <!-- Enemy lineup preview -->
    <div class="mb-5">
      <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: var(--color-outline);">
        Enemy {enemyTeam.length > 1 ? 'Team' : ''}
      </p>
      <div class="flex gap-2 flex-wrap">
        {#each enemyTeam as enemy}
          {@const ec = gradeColor(enemy.grade)}
          <div class="obsidian-slab rounded-xl px-3 py-2.5 flex items-center gap-2.5 flex-1 min-w-0"
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
        {/each}
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

    <!-- Fight button — anchored above safe zone -->
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
  <!-- Phase: battling                                                        -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  {#if phase === 'battling'}
    <!-- Player HP bar -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-1">
        <span class="font-mono text-xs font-bold" style="color: #4ade80;">{selectedChar?.name}</span>
        <span class="font-mono text-xs" style="color: #4ade80;">{formatHp(playerHpNow)} / {formatHp(playerMaxHp)}</span>
      </div>
      <div class="rounded-full overflow-hidden" style="height: 8px; background: rgba(255,255,255,0.06);">
        <div class="h-full rounded-full transition-all duration-300"
          style="width: {hpPct(playerHpNow, playerMaxHp) * 100}%; background: {hpPct(playerHpNow, playerMaxHp) > 0.5 ? '#4ade80' : hpPct(playerHpNow, playerMaxHp) > 0.25 ? '#f59e0b' : '#ef4444'};">
        </div>
      </div>
    </div>

    <!-- VS divider -->
    <div class="flex items-center gap-3 my-3">
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
      <span class="font-mono text-xs tracking-widest" style="color: var(--color-outline);">VS</span>
      <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></div>
    </div>

    <!-- Enemy HP bars -->
    <div class="flex flex-col gap-2 mb-4">
      {#each enemyTeam as enemy, ei}
        {@const ec = gradeColor(enemy.grade)}
        {@const maxHp = enemyMaxHps[ei]}
        {@const curHp = enemyHpsNow[ei] ?? 0}
        {@const pct = hpPct(curHp, maxHp)}
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="font-mono text-xs" style="color: {ec};">{enemy.name}</span>
            <span class="font-mono text-xs" style="color: var(--color-outline);">{curHp <= 0 ? '☠' : formatHp(curHp) + ' / ' + formatHp(maxHp)}</span>
          </div>
          <div class="rounded-full overflow-hidden" style="height: 6px; background: rgba(255,255,255,0.06);">
            <div class="h-full rounded-full transition-all duration-300"
              style="width: {pct * 100}%; background: {ec}; opacity: {curHp <= 0 ? 0.2 : 1};">
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Round badge -->
    <div class="text-center mb-3">
      <span class="font-mono text-xs tracking-widest uppercase" style="color: var(--color-outline);">Round {currentRound?.roundNum ?? 1}</span>
    </div>

    <!-- Battle log — last 5 lines of current round -->
    <div class="obsidian-slab rounded-xl px-4 py-3 flex flex-col gap-1"
      style="min-height: 120px; border: 1px solid rgba(255,255,255,0.05);">
      {#each (currentRound?.lines ?? []).slice(-6) as line}
        <p class="font-mono text-xs leading-relaxed" style="color: var(--color-on-surface-variant, #c4b99a);">{line}</p>
      {/each}
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- Phase: result                                                          -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  {#if phase === 'result'}
    <div class="flex flex-col items-center gap-5 pt-2">

      {#if playerWon}
        <div class="text-center">
          <p class="font-bold text-2xl mb-1" style="font-family: var(--font-cinzel); color: #4ade80;">Victory!</p>
          <p class="font-mono text-sm" style="color: var(--color-outline);">
            {selectedChar?.name} defeated {enemyTeam.map(e => e.name).join(', ')}
          </p>
        </div>

        {#if lastDrops}
          <div class="obsidian-slab w-full rounded-xl px-5 py-4">
            <p class="font-mono text-xs mb-3 tracking-widest uppercase" style="color: var(--color-outline);">Battle Drops</p>
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
              <p class="font-mono text-sm mt-3 text-center font-bold" style="color: #4ade80;">🏆 World Cleared!</p>
            {/if}
          </div>
        {/if}

      {:else}
        <div class="text-center">
          <p class="font-bold text-2xl mb-1" style="font-family: var(--font-cinzel); color: #ef4444;">Defeated!</p>
          <p class="font-mono text-sm" style="color: var(--color-outline);">
            {selectedChar?.name} was defeated. Try again.
          </p>
        </div>
      {/if}

      <button onclick={confirmResult}
        class="metal-stamp-gold w-full py-3 rounded-xl font-bold font-mono text-sm max-w-xs tracking-widest">
        {playerWon && battleNumber < BATTLES_PER_WORLD ? 'Continue' : 'Done'}
      </button>

    </div>
  {/if}

</div>
