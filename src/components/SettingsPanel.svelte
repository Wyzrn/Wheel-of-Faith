<script lang="ts">
  import { settings } from '$lib/settings.svelte'
  import { getPerfTier } from '$lib/perf'
  import { auth } from '$lib/stores/auth.svelte'

  let { onClose }: { onClose: () => void } = $props()
  // Surface the Instant Battle toggle only to owners — keeps the panel
  // clean for everyone else.
  let hasInstantBattle = $derived((auth.user?.gamepasses ?? []).includes('instant_battle'))
  // Tier the heuristic has bucketed this device into — surfaced as a tiny
  // info line under the High Quality toggle so users understand whether
  // enabling the override is risky on their device.
  let detectedTier = $derived(getPerfTier())

  const SPIN_SPEED_OPTIONS: { value: number; label: string }[] = [
    { value: 0.5,  label: 'Slow'    },
    { value: 0.75, label: 'Relaxed' },
    { value: 1.0,  label: 'Normal'  },
    { value: 1.5,  label: 'Fast'    },
    { value: 2.0,  label: 'Turbo'   },
  ]

  // Auto Battle speed — only meaningful while auto is on. Manual mode plays
  // at normal pace because the player paces themselves. "Instant" is no
  // longer free; it lives in the Arcane Shop as the Instant Battle gamepass.
  const AUTO_SPEED_OPTIONS: { value: number; label: string; desc: string }[] = [
    { value: 0.7,  label: 'Relaxed', desc: 'Easy to read'  },
    { value: 1.0,  label: 'Normal',  desc: 'Default'       },
    { value: 2.4,  label: 'Fast',    desc: 'Quick fights'  },
    { value: 4.0,  label: 'Turbo',   desc: 'Lightning playback' },
  ]

  // Auto-continue: how long the result reveal stays before auto-firing Continue.
  // 0 = disabled (user must tap). Power users who've played many sessions usually
  // want this on so they don't have to mash Continue 23 times per character.
  const AUTO_CONTINUE_OPTIONS: { value: number; label: string; desc: string }[] = [
    { value: 0,    label: 'Off',     desc: 'Tap to continue' },
    { value: 1500, label: '1.5s',    desc: 'Brisk pace'      },
    { value: 2500, label: '2.5s',    desc: 'Read each result'},
    { value: 4000, label: '4s',      desc: 'Savor each one'  },
  ]

  function toggle(key: 'soundEnabled' | 'effectsEnabled' | 'autoBattle' | 'instantBattleEnabled') {
    settings[key] = !settings[key]
    settings.save()
  }
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-[90]" style="background: rgba(0,0,0,0.55);" onclick={onClose} role="presentation"></div>

<!-- Panel -->
<aside class="fixed left-0 top-0 bottom-0 z-[95] flex flex-col"
  style="width: min(300px, 100vw); background: linear-gradient(180deg, #12111e 0%, #09090f 100%); border-right: 1px solid rgba(240,192,64,0.22); box-shadow: 8px 0 50px rgba(0,0,0,0.9), inset -1px 0 0 rgba(255,223,150,0.05); animation: slideInLeft 0.22s cubic-bezier(0.25,0.46,0.45,0.94) both;">
  <div class="noise-overlay" style="border-radius: 0;"></div>

  <!-- Header -->
  <div class="flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid rgba(240,192,64,0.12);">
    <div class="flex items-center gap-2.5">
      <span class="material-symbols-outlined" style="font-size: 20px; color: #f0c040; font-variation-settings: 'FILL' 1;">settings</span>
      <span style="font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #ffdf96; letter-spacing: 0.14em;">SETTINGS</span>
    </div>
    <button onclick={onClose}
      style="color: #9a907b; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; cursor: pointer; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; font-size: 20px; transition: color 0.15s, background 0.15s; -webkit-tap-highlight-color: transparent;"
      onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = '#e9dfeb'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
      onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9a907b'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
    >&times;</button>
  </div>

  <!-- Body -->
  <div class="flex flex-col gap-5 px-5 py-5 flex-1 overflow-y-auto">

    <!-- ─ Sound ─ -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold" style="color: #e9dfeb;">Sound Effects</p>
        <p class="text-xs mt-0.5" style="color: #9a907b;">Spin ticks &amp; battle audio</p>
      </div>
      <button onclick={() => toggle('soundEnabled')} class="toggle-btn" style="background: {settings.soundEnabled ? '#f0c040' : '#1e1a22'}; box-shadow: {settings.soundEnabled ? '0 0 10px rgba(240,192,64,0.3)' : 'inset 2px 2px 4px rgba(0,0,0,0.5)'}; border: 1px solid {settings.soundEnabled ? '#f0c040' : 'rgba(78,70,53,0.5)'};" aria-label="Toggle sound">
        <span class="toggle-knob" style="left: {settings.soundEnabled ? '22px' : '2px'}; background: {settings.soundEnabled ? '#0d0d16' : '#3a3848'};"></span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- ─ Effects ─ -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold" style="color: #e9dfeb;">Visual Effects</p>
        <p class="text-xs mt-0.5" style="color: #9a907b;">Particles, shakes &amp; flashes</p>
      </div>
      <button onclick={() => toggle('effectsEnabled')} class="toggle-btn" style="background: {settings.effectsEnabled ? '#f0c040' : '#1e1a22'}; box-shadow: {settings.effectsEnabled ? '0 0 10px rgba(240,192,64,0.3)' : 'inset 2px 2px 4px rgba(0,0,0,0.5)'}; border: 1px solid {settings.effectsEnabled ? '#f0c040' : 'rgba(78,70,53,0.5)'};" aria-label="Toggle effects">
        <span class="toggle-knob" style="left: {settings.effectsEnabled ? '22px' : '2px'}; background: {settings.effectsEnabled ? '#0d0d16' : '#3a3848'};"></span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- ─ High Quality override ─ -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold" style="color: #e9dfeb;">High Quality</p>
        <p class="text-xs mt-0.5" style="color: #9a907b;">
          Force full-fidelity VFX on this device. May lag on phones.
          <span class="ml-1 opacity-70">(detected: <span style="color: {detectedTier === 'high' ? '#34d399' : detectedTier === 'mid' ? '#f0c040' : '#fb923c'}">{detectedTier}</span>)</span>
        </p>
      </div>
      <button
        onclick={() => { settings.highQualityOverride = settings.highQualityOverride === 'high' ? 'auto' : 'high'; settings.save() }}
        class="toggle-btn"
        style="background: {settings.highQualityOverride === 'high' ? '#f0c040' : '#1e1a22'}; box-shadow: {settings.highQualityOverride === 'high' ? '0 0 10px rgba(240,192,64,0.3)' : 'inset 2px 2px 4px rgba(0,0,0,0.5)'}; border: 1px solid {settings.highQualityOverride === 'high' ? '#f0c040' : 'rgba(78,70,53,0.5)'};"
        aria-label="Toggle high quality"
        aria-pressed={settings.highQualityOverride === 'high'}
      >
        <span class="toggle-knob" style="left: {settings.highQualityOverride === 'high' ? '22px' : '2px'}; background: {settings.highQualityOverride === 'high' ? '#0d0d16' : '#3a3848'};"></span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- ─ Spin Speed ─ -->
    <div>
      <p class="text-sm font-semibold mb-1" style="color: #e9dfeb;">Spin Speed</p>
      <p class="text-xs mb-3" style="color: #9a907b;">Wheel animation rate</p>
      <div class="flex gap-1.5 flex-wrap">
        {#each SPIN_SPEED_OPTIONS as opt}
          <button onclick={() => { settings.spinSpeed = opt.value; settings.save() }}
            class="speed-chip"
            style="background: {settings.spinSpeed === opt.value ? 'linear-gradient(135deg, #f0c040, #b88d00)' : 'linear-gradient(180deg, #13121c, #1e1a22)'}; color: {settings.spinSpeed === opt.value ? '#0d0d16' : '#9a907b'}; border-color: {settings.spinSpeed === opt.value ? '#ffdf97' : 'rgba(78,70,53,0.35)'}; box-shadow: {settings.spinSpeed === opt.value ? '0 3px 0 #796125, inset 0 1px 2px rgba(255,255,255,0.3)' : 'inset 1px 1px 0 rgba(255,223,150,0.06)'};"
          >{opt.label}</button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <!-- ─ Auto-Continue ─ -->
    <div>
      <p class="text-sm font-semibold mb-1" style="color: #e9dfeb;">Auto-Continue</p>
      <p class="text-xs mb-3" style="color: #9a907b;">Skip the Continue tap after each spin</p>
      <div class="flex flex-col gap-1.5">
        {#each AUTO_CONTINUE_OPTIONS as opt}
          {@const active = settings.autoContinueMs === opt.value}
          <button onclick={() => { settings.autoContinueMs = opt.value; settings.save() }}
            class="battle-speed-chip"
            style="background: {active ? 'linear-gradient(180deg, rgba(240,192,64,0.14), rgba(240,192,64,0.06))' : 'linear-gradient(180deg, #13121c, #1e1a22)'}; border-color: {active ? '#f0c040' : 'rgba(78,70,53,0.3)'}; box-shadow: {active ? '0 0 12px rgba(240,192,64,0.12), inset 1px 1px 0 rgba(255,223,150,0.08)' : 'inset 1px 1px 0 rgba(255,223,150,0.05)'};"
          >
            <span style="font-family: 'Cinzel', serif; font-size: 0.78rem; font-weight: 700; color: {active ? '#f0c040' : '#9a907b'};">{opt.label}</span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: {active ? '#d4a020' : '#4e4635'};">{opt.desc}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <!-- ─ Auto Battle ─ -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold" style="color: #e9dfeb;">Auto Battle</p>
        <p class="text-xs mt-0.5" style="color: #9a907b;">Off = pick each move manually</p>
      </div>
      <button onclick={() => toggle('autoBattle')} class="toggle-btn"
        style="background: {settings.autoBattle ? '#f0c040' : '#1e1a22'}; box-shadow: {settings.autoBattle ? '0 0 10px rgba(240,192,64,0.3)' : 'inset 2px 2px 4px rgba(0,0,0,0.5)'}; border: 1px solid {settings.autoBattle ? '#f0c040' : 'rgba(78,70,53,0.5)'};"
        aria-label="Toggle auto battle">
        <span class="toggle-knob" style="left: {settings.autoBattle ? '22px' : '2px'}; background: {settings.autoBattle ? '#0d0d16' : '#3a3848'};"></span>
      </button>
    </div>

    {#if settings.autoBattle}
      <!-- ─ Auto Battle Speed (only when auto is on) ─ -->
      <div>
        <p class="text-sm font-semibold mb-1" style="color: #e9dfeb;">Battle Speed</p>
        <p class="text-xs mb-3" style="color: #9a907b;">Playback rate while auto-battling</p>
        <div class="flex flex-col gap-1.5">
          {#each AUTO_SPEED_OPTIONS as opt}
            {@const active = settings.autoBattleSpeed === opt.value}
            <button onclick={() => { settings.autoBattleSpeed = opt.value; settings.save() }}
              class="battle-speed-chip"
              style="background: {active ? 'linear-gradient(180deg, rgba(240,192,64,0.14), rgba(240,192,64,0.06))' : 'linear-gradient(180deg, #13121c, #1e1a22)'}; border-color: {active ? '#f0c040' : 'rgba(78,70,53,0.3)'}; box-shadow: {active ? '0 0 12px rgba(240,192,64,0.12), inset 1px 1px 0 rgba(255,223,150,0.08)' : 'inset 1px 1px 0 rgba(255,223,150,0.05)'};"
            >
              <span style="font-family: 'Cinzel', serif; font-size: 0.78rem; font-weight: 700; color: {active ? '#f0c040' : '#9a907b'};">{opt.label}</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: {active ? '#d4a020' : '#4e4635'};">{opt.desc}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if hasInstantBattle}
      <div class="divider"></div>
      <!-- ─ Instant Battle (owner-only) ─ -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold" style="color: #e9dfeb;">Instant Battle Skip</p>
          <p class="text-xs mt-0.5" style="color: #9a907b;">Show the in-arena Skip button. Off = watch the whole fight.</p>
        </div>
        <button onclick={() => toggle('instantBattleEnabled')} class="toggle-btn"
          style="background: {settings.instantBattleEnabled ? '#f0c040' : '#1e1a22'}; box-shadow: {settings.instantBattleEnabled ? '0 0 10px rgba(240,192,64,0.3)' : 'inset 2px 2px 4px rgba(0,0,0,0.5)'}; border: 1px solid {settings.instantBattleEnabled ? '#f0c040' : 'rgba(78,70,53,0.5)'};"
          aria-label="Toggle Instant Battle skip button">
          <span class="toggle-knob" style="left: {settings.instantBattleEnabled ? '22px' : '2px'}; background: {settings.instantBattleEnabled ? '#0d0d16' : '#3a3848'};"></span>
        </button>
      </div>
    {/if}

  </div>
</aside>

<style>
  /* Toggle — runic on/off switch */
  .toggle-btn {
    position: relative; flex-shrink: 0;
    width: 46px; height: 26px; border-radius: 13px;
    cursor: pointer;
    transition: background 0.22s, box-shadow 0.22s, border-color 0.22s;
    box-shadow: inset 2px 2px 5px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(0,0,0,0.4);
  }
  /* Knob — polished stone sphere */
  .toggle-knob {
    position: absolute; top: 3px;
    width: 20px; height: 20px; border-radius: 50%;
    transition: left 0.22s cubic-bezier(0.34,1.56,0.64,1), background 0.22s;
    box-shadow:
      0 2px 0 rgba(0,0,0,0.5),
      0 4px 8px rgba(0,0,0,0.6),
      inset 0 1px 0 rgba(255,255,255,0.25);
  }
  /* Runic divider — carved seam */
  .divider {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(200,136,42,0.08) 20%,
      rgba(200,136,42,0.18) 50%,
      rgba(200,136,42,0.08) 80%,
      transparent 100%
    );
  }
  /* Speed chip — stone selection chip */
  .speed-chip {
    padding: 9px 14px; border-radius: 9px; border: 1px solid;
    font-family: 'JetBrains Mono', monospace; font-size: 0.70rem; font-weight: 700;
    cursor: pointer; transition: all 0.16s; -webkit-tap-highlight-color: transparent;
    min-height: 40px;
    background: linear-gradient(160deg, #1c1730 0%, #0e0b1c 100%);
    box-shadow:
      0 3px 0 #06040e,
      0 7px 18px rgba(0,0,0,0.7),
      inset 0 1px 0 rgba(255,225,140,0.06);
    letter-spacing: 0.08em;
  }
  .speed-chip:active { transform: translateY(2px); }

  /* Battle speed chip — wider selection row */
  .battle-speed-chip {
    width: 100%; padding: 9px 13px; border-radius: 9px; border: 1px solid;
    cursor: pointer; display: flex; justify-content: space-between; align-items: center;
    transition: all 0.16s;
    background: linear-gradient(160deg, #1c1730 0%, #0e0b1c 100%);
    box-shadow:
      0 3px 0 #06040e,
      0 7px 18px rgba(0,0,0,0.7),
      inset 0 1px 0 rgba(255,225,140,0.05);
  }
  .battle-speed-chip:active { transform: translateY(2px); }
</style>
