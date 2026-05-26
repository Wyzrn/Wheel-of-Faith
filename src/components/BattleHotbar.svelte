<!--
  BattleHotbar.svelte — Bottom action bar for manual battles.

  Four primary buttons (Weapon · Power · Spell ▾ · Defend). The Spell
  button expands into a popover of the categories the active actor
  actually owns — per the design rule "only show the ones you have".

  Pure presentational component. Emits a PlayerAction via onAction; the
  parent owns turn state, the controller, and what to do with the input.
-->
<script lang="ts">
  import type { ActionAvailability, PlayerAction } from '$lib/battle/controller'
  import type { AttackType } from '$lib/content/types'
  import { SPELL_CATEGORY_LABEL, SPELL_CATEGORY_ICON } from '$lib/battle/controller'

  interface Props {
    availability: ActionAvailability
    // When true, buttons are disabled (e.g. an action is still resolving).
    busy?: boolean
    // Optional preview of the actor's name to make the hotbar feel personal.
    actorName?: string
    // Accent color for the actor's team.
    accent?: string
    onAction: (action: PlayerAction) => void
  }
  let { availability, busy = false, actorName = '', accent = '#f0c040', onAction }: Props = $props()

  let spellOpen = $state(false)

  function fire(action: PlayerAction) {
    if (busy) return
    spellOpen = false
    onAction(action)
  }

  function toggleSpell() {
    if (busy || availability.spell.length === 0) return
    spellOpen = !spellOpen
  }
</script>

<div class="bh-wrap" style="--accent: {accent};">
  {#if actorName}
    <div class="bh-actor">
      <span class="material-symbols-outlined" style="font-size: 13px; color: {accent}; font-variation-settings: 'FILL' 1;">arrow_drop_down</span>
      <span class="bh-actor-name">{actorName}</span>
      <span class="bh-actor-turn">your turn</span>
    </div>
  {/if}

  <!-- Spell popover -->
  {#if spellOpen}
    <div class="bh-spell-pop" role="menu">
      {#each availability.spell as cat}
        <button
          class="bh-spell-opt"
          onclick={() => fire({ kind: 'spell', spellCategory: cat })}
          aria-label="Cast {SPELL_CATEGORY_LABEL[cat]} spell">
          <span class="material-symbols-outlined" style="font-size: 22px; color: {accent}; font-variation-settings: 'FILL' 1;">{SPELL_CATEGORY_ICON[cat]}</span>
          <span class="bh-spell-opt-label">{SPELL_CATEGORY_LABEL[cat]}</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="bh-row">
    <button
      class="bh-btn bh-weapon"
      disabled={busy || !availability.weapon}
      onclick={() => fire({ kind: 'weapon' })}
      aria-label="Weapon attack">
      <span class="material-symbols-outlined bh-icon">swords</span>
      <span class="bh-label">Weapon</span>
    </button>

    <button
      class="bh-btn bh-power"
      disabled={busy || !availability.power}
      onclick={() => fire({ kind: 'power' })}
      aria-label="Power attack">
      <span class="material-symbols-outlined bh-icon">bolt</span>
      <span class="bh-label">Power</span>
    </button>

    <button
      class="bh-btn bh-spell"
      class:bh-spell-open={spellOpen}
      disabled={busy || availability.spell.length === 0}
      onclick={toggleSpell}
      aria-haspopup="menu"
      aria-expanded={spellOpen}
      aria-label="Cast a spell">
      <span class="material-symbols-outlined bh-icon">auto_fix</span>
      <span class="bh-label">
        Spell
        {#if availability.spell.length > 0}
          <span class="bh-caret">▾</span>
        {/if}
      </span>
    </button>

    <button
      class="bh-btn bh-defend"
      disabled={busy}
      onclick={() => fire({ kind: 'defend' })}
      aria-label="Defend">
      <span class="material-symbols-outlined bh-icon">shield</span>
      <span class="bh-label">Defend</span>
    </button>
  </div>
</div>

<style>
  .bh-wrap {
    position: relative;
    width: 100%;
    margin-top: 6px;
  }
  .bh-actor {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 12px 4px;
    font-family: 'JetBrains Mono', monospace;
  }
  .bh-actor-name { color: var(--accent); font-weight: 700; font-size: 12px; letter-spacing: 0.08em; }
  .bh-actor-turn {
    color: #9a907b;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    margin-left: 6px;
  }
  .bh-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    padding: 6px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(20,18,30,0.92), rgba(10,9,16,0.96));
    border: 1px solid var(--accent);
    box-shadow:
      0 10px 30px rgba(0,0,0,0.55),
      0 0 0 1px rgba(255,255,255,0.02) inset,
      0 0 32px color-mix(in srgb, var(--accent) 22%, transparent);
  }
  .bh-btn {
    position: relative;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 2px;
    padding: 10px 4px 8px;
    min-height: 64px;
    border-radius: 10px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.08);
    color: #ffdf96;
    font-family: 'Cinzel', serif;
    cursor: pointer;
    transition: all 0.12s ease-out;
    overflow: hidden;
  }
  .bh-btn::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--accent) 30%, transparent) 0%, transparent 60%);
    opacity: 0;
    transition: opacity 0.14s ease-out;
    pointer-events: none;
  }
  .bh-btn:not(:disabled):hover::before { opacity: 1; }
  .bh-btn:not(:disabled):active {
    transform: scale(0.94);
    background: color-mix(in srgb, var(--accent) 14%, rgba(0,0,0,0));
  }
  .bh-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .bh-icon {
    font-size: 26px !important;
    color: var(--accent);
    font-variation-settings: 'FILL' 1 !important;
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 55%, transparent));
  }
  .bh-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    display: inline-flex; align-items: center; gap: 2px;
  }
  .bh-caret { font-size: 9px; opacity: 0.7; }

  .bh-weapon .bh-icon { color: #fde68a; filter: drop-shadow(0 0 6px rgba(253, 224, 71, 0.55)); }
  .bh-power  .bh-icon { color: #fbbf24; filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.55)); }
  .bh-spell  .bh-icon { color: #c084fc; filter: drop-shadow(0 0 6px rgba(192, 132, 252, 0.55)); }
  .bh-defend .bh-icon { color: #93c5fd; filter: drop-shadow(0 0 6px rgba(147, 197, 253, 0.55)); }

  .bh-spell.bh-spell-open {
    background: color-mix(in srgb, #c084fc 18%, transparent);
    border-color: #c084fc;
  }

  /* Spell category popover */
  .bh-spell-pop {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 6px;
    display: flex; flex-direction: column;
    gap: 4px;
    padding: 6px;
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(20,18,30,0.96), rgba(10,9,16,0.99));
    border: 1px solid #c084fc;
    box-shadow: 0 12px 32px rgba(0,0,0,0.7), 0 0 24px rgba(192,132,252,0.32);
    z-index: 50;
    animation: bh-pop 0.16s ease-out;
  }
  @keyframes bh-pop {
    0%   { opacity: 0; transform: translateY(8px) scale(0.96); }
    100% { opacity: 1; transform: translateY(0)    scale(1.00); }
  }
  .bh-spell-opt {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px 8px 10px;
    border-radius: 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(192,132,252,0.18);
    color: #e9d5ff;
    font-family: 'Cinzel', serif;
    cursor: pointer;
    min-width: 140px;
    transition: all 0.10s ease-out;
  }
  .bh-spell-opt:hover {
    background: rgba(192,132,252,0.10);
    border-color: rgba(192,132,252,0.45);
  }
  .bh-spell-opt:active { transform: scale(0.96); }
  .bh-spell-opt-label {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
</style>
