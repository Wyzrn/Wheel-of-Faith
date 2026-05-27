<!--
  BattleHotbar.svelte — Bottom action bar for manual battles.

  Four primary buttons: Weapon · Power ▾ · Spell ▾ · Defend.
  • Power ▾  expands into a popover listing each power the actor owns with
    its damage estimate and cooldown timer. Disabled entries are still
    visible (so the player can see what's recharging) but greyed out and
    not clickable.
  • Spell ▾  expands into the spell-category popover, scoped to categories
    the actor actually has at least one ability move for.
  • Weapon and Defend fire immediately.

  Pure presentational component. Emits a PlayerAction via onAction; the
  parent owns turn state, the controller, and what to do with the input.
-->
<script lang="ts">
  import type { ActionAvailability, PlayerAction, PowerOption } from '$lib/battle/controller'
  import type { AttackType } from '$lib/content/types'
  import { SPELL_CATEGORY_LABEL, SPELL_CATEGORY_ICON } from '$lib/battle/controller'
  import { formatHp } from '$lib/game/battle'

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

  // Mutually exclusive popovers — opening one closes the other.
  let openMenu = $state<'powers' | 'spells' | null>(null)

  function fire(action: PlayerAction) {
    if (busy) return
    openMenu = null
    onAction(action)
  }

  function togglePowers() {
    if (busy || availability.powers.length === 0) return
    openMenu = openMenu === 'powers' ? null : 'powers'
  }
  function toggleSpells() {
    if (busy || availability.spell.length === 0) return
    openMenu = openMenu === 'spells' ? null : 'spells'
  }

  // ── Power list helpers ────────────────────────────────────────────────────
  let powers     = $derived(availability.powers)
  let anyPower   = $derived(powers.length > 0)
  let anyReady   = $derived(powers.some(p => p.cooldown <= 0))

  // Element → accent color for the small chip next to each power name.
  const ELEMENT_COLOR: Record<string, string> = {
    Fire: '#f97316',  Ice: '#7dd3fc',  Lightning: '#fbbf24', Earth: '#a16207',
    Wind: '#e2e8f0',  Shadow: '#8b5cf6', Light: '#fde68a',   Arcane: '#c084fc',
    Nature: '#22c55e', Void: '#6b21a8',  Cosmic: '#818cf8',  Blood: '#dc2626',
    Metal: '#94a3b8',  Soul: '#f9a8d4',  Poison: '#84cc16',  Time: '#a78bfa',
    Water: '#38bdf8',  Sound: '#e0f2fe', Gravity: '#6366f1', Psychic: '#e879f9',
    Chaos: '#f43f5e',  Neutral: '#f87171',
  }
  function elColor(el?: string): string { return el ? ELEMENT_COLOR[el] ?? '#9a907b' : '#9a907b' }

  // Tier → accent color for the grade chip. Mirrors the colors used in the
  // worlds + tier glossary so the player builds one mental map across UIs.
  const TIER_COLOR: Record<string, string> = {
    F: '#6b7280',  E: '#78716c',  D: '#a3a3a3', C: '#4ade80',
    B: '#60a5fa',  A: '#a78bfa',  S: '#f59e0b', SS: '#f97316',
    SSS: '#ef4444', God: '#fbbf24', Godly: '#fbbf24',
  }
  function tierColor(g?: string): string {
    if (!g) return '#4e4635'
    const base = g.replace(/[-+]/g, '').replace(/\s+/g, '')
    return TIER_COLOR[base] ?? '#9a907b'
  }

  function selectPower(p: PowerOption) {
    if (p.cooldown > 0) return
    fire({ kind: 'power', moveName: p.name })
  }
</script>

<div class="bh-wrap" style="--accent: {accent};">
  {#if actorName}
    <div class="bh-actor">
      <span class="material-symbols-outlined"
            style="font-size: 13px; color: {accent}; font-variation-settings: 'FILL' 1;">arrow_drop_down</span>
      <span class="bh-actor-name">{actorName}</span>
      <span class="bh-actor-turn">your turn</span>
    </div>
  {/if}

  <!-- Power popover — lists every power with damage + cooldown -->
  {#if openMenu === 'powers'}
    <div class="bh-pop bh-pop-powers" role="menu">
      <p class="bh-pop-title">Powers</p>
      <div class="bh-pop-list">
        {#each powers as p}
          {@const onCd = p.cooldown > 0}
          <button
            class="bh-pop-item"
            class:bh-pop-item-disabled={onCd}
            disabled={onCd}
            onclick={() => selectPower(p)}
            aria-label="Cast {p.name}{onCd ? ` (on cooldown for ${p.cooldown} turns)` : ''} — tier {p.grade ?? '?'}, ~{formatHp(p.damage)} damage">
            <span class="bh-pop-tier"
                  style="background: {tierColor(p.grade)}1f; border-color: {tierColor(p.grade)}99; color: {tierColor(p.grade)};">
              {p.grade ?? '?'}
            </span>
            <span class="bh-pop-el"
                  style="background: {elColor(p.element)}22; border-color: {elColor(p.element)}66; color: {elColor(p.element)};">
              {p.element ?? '·'}
            </span>
            <span class="bh-pop-name">{p.name}</span>
            <span class="bh-pop-dmg">{formatHp(p.damage)}</span>
            {#if onCd}
              <span class="bh-pop-cd" aria-hidden="true">
                <span class="material-symbols-outlined" style="font-size: 11px;">hourglass_top</span>
                {p.cooldown}
              </span>
            {/if}
          </button>
        {/each}
      </div>
      {#if !anyReady && anyPower}
        <p class="bh-pop-foot">All powers recharging — try a weapon or spell.</p>
      {/if}
    </div>
  {/if}

  <!-- Spell category popover -->
  {#if openMenu === 'spells'}
    <div class="bh-pop bh-pop-spells" role="menu">
      <p class="bh-pop-title">Spell School</p>
      <div class="bh-pop-list">
        {#each availability.spell as cat}
          <button
            class="bh-pop-item bh-pop-spell"
            onclick={() => fire({ kind: 'spell', spellCategory: cat })}
            aria-label="Cast {SPELL_CATEGORY_LABEL[cat]} spell">
            <span class="material-symbols-outlined"
                  style="font-size: 22px; color: #c084fc; font-variation-settings: 'FILL' 1;">{SPELL_CATEGORY_ICON[cat]}</span>
            <span class="bh-pop-name">{SPELL_CATEGORY_LABEL[cat]}</span>
          </button>
        {/each}
      </div>
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
      class:bh-pop-open={openMenu === 'powers'}
      disabled={busy || !anyPower}
      onclick={togglePowers}
      aria-haspopup="menu"
      aria-expanded={openMenu === 'powers'}
      aria-label="Choose a power">
      <span class="material-symbols-outlined bh-icon">bolt</span>
      <span class="bh-label">
        Power
        {#if anyPower}<span class="bh-caret">▾</span>{/if}
      </span>
    </button>

    <button
      class="bh-btn bh-spell"
      class:bh-pop-open={openMenu === 'spells'}
      disabled={busy || availability.spell.length === 0}
      onclick={toggleSpells}
      aria-haspopup="menu"
      aria-expanded={openMenu === 'spells'}
      aria-label="Cast a spell">
      <span class="material-symbols-outlined bh-icon">auto_fix</span>
      <span class="bh-label">
        Spell
        {#if availability.spell.length > 0}<span class="bh-caret">▾</span>{/if}
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
  .bh-btn.bh-pop-open {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    border-color: var(--accent);
  }

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

  /* Popovers (powers + spells share most styling) */
  .bh-pop {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 6px; right: 6px;
    padding: 10px 8px;
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(20,18,30,0.96), rgba(10,9,16,0.99));
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 12px 32px rgba(0,0,0,0.7);
    z-index: 50;
    animation: bh-pop 0.16s ease-out;
    max-height: 260px;
    overflow-y: auto;
  }
  .bh-pop-powers { border-color: #fbbf24; box-shadow: 0 12px 32px rgba(0,0,0,0.7), 0 0 24px rgba(251, 191, 36, 0.28); }
  .bh-pop-spells { border-color: #c084fc; box-shadow: 0 12px 32px rgba(0,0,0,0.7), 0 0 24px rgba(192, 132, 252, 0.32); }

  @keyframes bh-pop {
    0%   { opacity: 0; transform: translateY(8px) scale(0.96); }
    100% { opacity: 1; transform: translateY(0)    scale(1.00); }
  }
  .bh-pop-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #9a907b;
    margin: 0 4px 6px;
  }
  .bh-pop-list {
    display: flex; flex-direction: column; gap: 4px;
  }
  .bh-pop-item {
    display: grid;
    grid-template-columns: auto auto 1fr auto auto;
    align-items: center;
    gap: 8px;
    padding: 8px 12px 8px 10px;
    border-radius: 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    color: #ffdf96;
    font-family: 'Cinzel', serif;
    cursor: pointer;
    transition: all 0.10s ease-out;
    text-align: left;
  }
  .bh-pop-item:not(:disabled):hover {
    background: rgba(251, 191, 36, 0.08);
    border-color: rgba(251, 191, 36, 0.4);
  }
  .bh-pop-item:not(:disabled):active { transform: scale(0.97); }
  .bh-pop-spell { grid-template-columns: auto 1fr; }
  .bh-pop-spell:not(:disabled):hover {
    background: rgba(192, 132, 252, 0.10);
    border-color: rgba(192, 132, 252, 0.45);
  }

  .bh-pop-item-disabled {
    opacity: 0.42;
    cursor: not-allowed;
    background: rgba(0,0,0,0.18);
  }
  .bh-pop-item-disabled .bh-pop-name { color: #6b6552; }
  .bh-pop-item-disabled .bh-pop-dmg  { color: #4e4635; }

  .bh-pop-tier {
    display: inline-flex;
    align-items: center; justify-content: center;
    min-width: 32px; height: 22px;
    padding: 0 6px;
    border-radius: 6px;
    border: 1px solid;
    font-family: 'Cinzel', serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.08em;
    line-height: 1;
  }
  .bh-pop-el {
    display: inline-flex;
    align-items: center; justify-content: center;
    min-width: 44px; height: 22px;
    padding: 0 6px;
    border-radius: 6px;
    border: 1px solid;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .bh-pop-name {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .bh-pop-dmg {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    color: #fbbf24;
    text-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
  }
  .bh-pop-cd {
    display: inline-flex; align-items: center; gap: 2px;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.42);
    color: #fca5a5;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
  }
  .bh-pop-foot {
    margin: 8px 4px 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: #9a907b;
    text-align: center;
    font-style: italic;
  }
</style>
