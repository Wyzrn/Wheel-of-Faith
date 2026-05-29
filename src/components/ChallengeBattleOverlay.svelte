<script lang="ts">
  // Global overlay that resolves a "your character vs their character" friend
  // duel. Mounted from the root layout; activates when presence.battle is set.
  // Reuses QuickBattleView (the same auto-battler Rivals uses) on the two
  // chosen characters' spin results.
  import { presence } from '$lib/stores/presence.svelte'
  import { auth } from '$lib/stores/auth.svelte'
  import { recordOpponent } from '$lib/recentOpponents'
  import QuickBattleView from './QuickBattleView.svelte'

  let battle = $derived(presence.battle)
  let reported = false

  function finish() { presence.clearBattle() }
</script>

{#if battle}
  <div class="fixed inset-0 z-[70]" style="background: #16121a;">
    <QuickBattleView
      team1={[{ results: battle.you.results, name: battle.you.name }]}
      team2={[{ results: battle.opponent.results, name: battle.opponent.name }]}
      team1Label={battle.you.name}
      team2Label={battle.opponent.name}
      title={`${battle.you.name} vs ${battle.opponent.name}`}
      onComplete={(winner) => {
        if (reported) return
        reported = true
        const iWon = winner === 'team1'
        presence.reportBattleResult(iWon)
        if (auth.loggedIn) auth.recordBattleResult(iWon)
        recordOpponent({
          username: battle?.opponent.name ?? 'Opponent',
          myResult: winner === 'draw' ? 'draw' : (iWon ? 'won' : 'lost'),
          mode: 'rivals',
        })
      }}
      onRematch={() => { reported = false; finish() }}
      onBack={() => { reported = false; finish() }}
      backLabel="Done"
    />
  </div>
{/if}
