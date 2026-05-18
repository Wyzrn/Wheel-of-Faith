<script lang="ts">
  import { settings } from '$lib/settings.svelte'

  let { onClose }: { onClose: () => void } = $props()

  const SPIN_SPEED_OPTIONS: { value: number; label: string }[] = [
    { value: 0.5,  label: 'Slow'    },
    { value: 0.75, label: 'Relaxed' },
    { value: 1.0,  label: 'Normal'  },
    { value: 1.5,  label: 'Fast'    },
    { value: 2.0,  label: 'Turbo'   },
  ]

  const BATTLE_SPEED_OPTIONS: { value: number; label: string; desc: string }[] = [
    { value: 0.4,  label: 'Slow',    desc: 'Dramatic pacing' },
    { value: 0.7,  label: 'Relaxed', desc: 'Easy to read'   },
    { value: 1.0,  label: 'Normal',  desc: 'Default'        },
    { value: 2.2,  label: 'Fast',    desc: 'Quick fights'   },
    { value: 99,   label: 'Instant', desc: 'Skip animation' },
  ]

  function toggle(key: 'soundEnabled' | 'effectsEnabled') {
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
      onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = '#e4e1ee'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
      onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9a907b'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
    >&times;</button>
  </div>

  <!-- Body -->
  <div class="flex flex-col gap-5 px-5 py-5 flex-1 overflow-y-auto">

    <!-- ─ Sound ─ -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold" style="color: #e4e1ee;">Sound Effects</p>
        <p class="text-xs mt-0.5" style="color: #9a907b;">Spin ticks &amp; battle audio</p>
      </div>
      <button onclick={() => toggle('soundEnabled')} class="toggle-btn" style="background: {settings.soundEnabled ? '#f0c040' : '#0c0b14'}; box-shadow: {settings.soundEnabled ? '0 0 10px rgba(240,192,64,0.3)' : 'inset 2px 2px 4px rgba(0,0,0,0.5)'}; border: 1px solid {settings.soundEnabled ? '#f0c040' : 'rgba(78,70,53,0.5)'};" aria-label="Toggle sound">
        <span class="toggle-knob" style="left: {settings.soundEnabled ? '22px' : '2px'}; background: {settings.soundEnabled ? '#0d0d16' : '#3a3848'};"></span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- ─ Effects ─ -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold" style="color: #e4e1ee;">Visual Effects</p>
        <p class="text-xs mt-0.5" style="color: #9a907b;">Particles, shakes &amp; flashes</p>
      </div>
      <button onclick={() => toggle('effectsEnabled')} class="toggle-btn" style="background: {settings.effectsEnabled ? '#f0c040' : '#0c0b14'}; box-shadow: {settings.effectsEnabled ? '0 0 10px rgba(240,192,64,0.3)' : 'inset 2px 2px 4px rgba(0,0,0,0.5)'}; border: 1px solid {settings.effectsEnabled ? '#f0c040' : 'rgba(78,70,53,0.5)'};" aria-label="Toggle effects">
        <span class="toggle-knob" style="left: {settings.effectsEnabled ? '22px' : '2px'}; background: {settings.effectsEnabled ? '#0d0d16' : '#3a3848'};"></span>
      </button>
    </div>

    <div class="divider"></div>

    <!-- ─ Spin Speed ─ -->
    <div>
      <p class="text-sm font-semibold mb-1" style="color: #e4e1ee;">Spin Speed</p>
      <p class="text-xs mb-3" style="color: #9a907b;">Wheel animation rate</p>
      <div class="flex gap-1.5 flex-wrap">
        {#each SPIN_SPEED_OPTIONS as opt}
          <button onclick={() => { settings.spinSpeed = opt.value; settings.save() }}
            class="speed-chip"
            style="background: {settings.spinSpeed === opt.value ? 'linear-gradient(135deg, #f0c040, #b88d00)' : 'linear-gradient(180deg, #13121c, #0c0b14)'}; color: {settings.spinSpeed === opt.value ? '#0d0d16' : '#9a907b'}; border-color: {settings.spinSpeed === opt.value ? '#ffdf97' : 'rgba(78,70,53,0.35)'}; box-shadow: {settings.spinSpeed === opt.value ? '0 3px 0 #796125, inset 0 1px 2px rgba(255,255,255,0.3)' : 'inset 1px 1px 0 rgba(255,223,150,0.06)'};"
          >{opt.label}</button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <!-- ─ Battle Speed ─ -->
    <div>
      <p class="text-sm font-semibold mb-1" style="color: #e4e1ee;">Battle Speed</p>
      <p class="text-xs mb-3" style="color: #9a907b;">How fast combat lines play back</p>
      <div class="flex flex-col gap-1.5">
        {#each BATTLE_SPEED_OPTIONS as opt}
          {@const active = settings.battleSpeed === opt.value}
          <button onclick={() => { settings.battleSpeed = opt.value; settings.save() }}
            class="battle-speed-chip"
            style="background: {active ? 'linear-gradient(180deg, rgba(240,192,64,0.14), rgba(240,192,64,0.06))' : 'linear-gradient(180deg, #13121c, #0c0b14)'}; border-color: {active ? '#f0c040' : 'rgba(78,70,53,0.3)'}; box-shadow: {active ? '0 0 12px rgba(240,192,64,0.12), inset 1px 1px 0 rgba(255,223,150,0.08)' : 'inset 1px 1px 0 rgba(255,223,150,0.05)'};"
          >
            <span style="font-family: 'Cinzel', serif; font-size: 0.78rem; font-weight: 700; color: {active ? '#f0c040' : '#9a907b'};">{opt.label}</span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: {active ? '#d4a020' : '#4e4635'};">{opt.desc}</span>
          </button>
        {/each}
      </div>
    </div>

  </div>
</aside>

<style>
  .toggle-btn {
    position: relative; flex-shrink: 0;
    width: 44px; height: 24px; border-radius: 12px;
    cursor: pointer; transition: background 0.2s, box-shadow 0.2s, border-color 0.2s;
  }
  .toggle-knob {
    position: absolute; top: 2px;
    width: 20px; height: 20px; border-radius: 50%;
    transition: left 0.2s, background 0.2s;
  }
  .divider { height: 1px; background: rgba(240,192,64,0.08); }
  .speed-chip {
    padding: 9px 14px; border-radius: 8px; border: 1px solid;
    font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s; -webkit-tap-highlight-color: transparent;
    min-height: 40px;
  }
  .battle-speed-chip {
    width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid;
    cursor: pointer; display: flex; justify-content: space-between; align-items: center;
    transition: all 0.15s;
  }
</style>
