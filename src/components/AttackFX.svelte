<script lang="ts">
  interface Props {
    type: string
    color?: string
    size?: number
    direction?: 'ltr' | 'rtl' | 'center'
  }
  let { type, color = '#ffffff', size = 100, direction = 'center' }: Props = $props()
</script>

<div class="fx-root"
     class:fx-ltr={direction === 'ltr'}
     class:fx-rtl={direction === 'rtl'}
     style="width:{size}px;height:{size}px;--c:{color};">
  {#if type === 'slash'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <line class="sl sl1" x1="72" y1="18" x2="28" y2="62" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/>
      <line class="sl sl2" x1="80" y1="28" x2="36" y2="72" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
      <line class="sl sl3" x1="64" y1="12" x2="20" y2="56" stroke="var(--c)" stroke-width="2" stroke-linecap="round"/>
    </svg>

  {:else if type === 'fire'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="fire-g">
        <path d="M50 88 C38 72 32 60 40 44 C36 57 46 50 44 32 C50 45 60 37 54 24 C66 38 70 58 64 70 C70 58 72 48 64 44 C72 56 68 74 50 88Z" fill="var(--c)"/>
        <ellipse cx="50" cy="88" rx="14" ry="5" fill="var(--c)" opacity="0.45"/>
      </g>
    </svg>

  {:else if type === 'lightning'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <polyline class="bolt-glow" pathLength="100" points="62,8 46,44 56,44 38,92" stroke="var(--c)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.22"/>
      <polyline class="bolt" pathLength="100" points="62,8 46,44 56,44 38,92" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>

  {:else if type === 'ice'}
    <svg viewBox="0 0 100 100" class="fx-svg ice-g" overflow="visible">
      <line x1="50" y1="12" x2="50" y2="88" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="12" y1="50" x2="88" y2="50" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="22" y1="22" x2="78" y2="78" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="78" y1="22" x2="22" y2="78" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="50" y1="12" x2="43" y2="22" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="50" y1="12" x2="57" y2="22" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="50" y1="88" x2="43" y2="78" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="50" y1="88" x2="57" y2="78" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="12" y1="50" x2="22" y2="43" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="12" y1="50" x2="22" y2="57" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="88" y1="50" x2="78" y2="43" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="88" y1="50" x2="78" y2="57" stroke="var(--c)" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="6" fill="var(--c)"/>
    </svg>

  {:else if type === 'shadow'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="shadow-g">
        <circle cx="50" cy="50" r="16" fill="var(--c)" opacity="0.85"/>
        <path d="M50 34 Q36 22 28 30 Q38 36 50 50" fill="var(--c)" opacity="0.7"/>
        <path d="M66 36 Q78 24 72 16 Q64 30 50 50" fill="var(--c)" opacity="0.7"/>
        <path d="M66 64 Q78 76 70 84 Q60 70 50 50" fill="var(--c)" opacity="0.65"/>
        <path d="M34 64 Q18 70 16 82 Q28 70 50 50" fill="var(--c)" opacity="0.65"/>
      </g>
    </svg>

  {:else if type === 'holy'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="holy-g">
        <circle cx="50" cy="50" r="9" fill="var(--c)"/>
        <line x1="50" y1="39" x2="50" y2="13" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="50" y1="61" x2="50" y2="87" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="39" y1="50" x2="13" y2="50" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="61" y1="50" x2="87" y2="50" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="41" y1="41" x2="22" y2="22" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="59" y1="59" x2="78" y2="78" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="59" y1="41" x2="78" y2="22" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="41" y1="59" x2="22" y2="78" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    </svg>

  {:else if type === 'time'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="37" stroke="var(--c)" stroke-width="2.5" fill="none" class="tr tr1"/>
      <circle cx="50" cy="50" r="27" stroke="var(--c)" stroke-width="1.8" fill="none" class="tr tr2" opacity="0.75"/>
      <circle cx="50" cy="50" r="16" stroke="var(--c)" stroke-width="1.2" fill="none" class="tr tr3" opacity="0.55"/>
      <line x1="50" y1="50" x2="50" y2="20" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" class="th th1"/>
      <line x1="50" y1="50" x2="72" y2="50" stroke="var(--c)" stroke-width="2" stroke-linecap="round" class="th th2"/>
      <circle cx="50" cy="50" r="3.5" fill="var(--c)"/>
    </svg>

  {:else if type === 'psychic'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="50" r="10" stroke="var(--c)" stroke-width="2.5" fill="none" class="pr pr1"/>
      <circle cx="50" cy="50" r="24" stroke="var(--c)" stroke-width="2" fill="none" class="pr pr2" opacity="0.8"/>
      <circle cx="50" cy="50" r="38" stroke="var(--c)" stroke-width="1.5" fill="none" class="pr pr3" opacity="0.5"/>
      <circle cx="50" cy="50" r="5" fill="var(--c)" class="pr-core"/>
    </svg>

  {:else if type === 'poison'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <circle cx="50" cy="44" r="11" fill="var(--c)" class="pb pb1"/>
      <circle cx="34" cy="52" r="7.5" fill="var(--c)" class="pb pb2" opacity="0.85"/>
      <circle cx="66" cy="48" r="8.5" fill="var(--c)" class="pb pb3" opacity="0.9"/>
      <circle cx="44" cy="66" r="6" fill="var(--c)" class="pb pb4" opacity="0.75"/>
      <circle cx="62" cy="66" r="5" fill="var(--c)" class="pb pb5" opacity="0.65"/>
      <circle cx="50" cy="28" r="6" fill="var(--c)" class="pb pb6" opacity="0.8"/>
      <circle cx="46" cy="42" r="2" fill="white" opacity="0.65"/>
      <circle cx="54" cy="42" r="2" fill="white" opacity="0.65"/>
      <path d="M46 48 Q50 51 54 48" stroke="white" stroke-width="1.2" fill="none" opacity="0.65"/>
    </svg>

  {:else if type === 'gravity'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="grav-g">
        <line x1="16" y1="50" x2="42" y2="50" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <path d="M42 50 L36 44 M42 50 L36 56" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <line x1="84" y1="50" x2="58" y2="50" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <path d="M58 50 L64 44 M58 50 L64 56" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <line x1="50" y1="16" x2="50" y2="42" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <path d="M50 42 L44 36 M50 42 L56 36" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <line x1="50" y1="84" x2="50" y2="58" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <path d="M50 58 L44 64 M50 58 L56 64" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <circle cx="50" cy="50" r="8" fill="var(--c)"/>
      </g>
    </svg>

  {:else if type === 'combo'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="cmb cmb1"><line x1="22" y1="22" x2="30" y2="30" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/><line x1="30" y1="22" x2="22" y2="30" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/></g>
      <g class="cmb cmb2"><line x1="40" y1="36" x2="48" y2="44" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/><line x1="48" y1="36" x2="40" y2="44" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/></g>
      <g class="cmb cmb3"><line x1="56" y1="50" x2="64" y2="58" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/><line x1="64" y1="50" x2="56" y2="58" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/></g>
      <g class="cmb cmb4"><line x1="66" y1="26" x2="74" y2="34" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/><line x1="74" y1="26" x2="66" y2="34" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/></g>
      <g class="cmb cmb5"><line x1="46" y1="64" x2="54" y2="72" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/><line x1="54" y1="64" x2="46" y2="72" stroke="var(--c)" stroke-width="3.5" stroke-linecap="round"/></g>
    </svg>

  {:else if type === 'crit'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="crit-g">
        <polygon points="50,8 55,44 90,50 55,56 50,92 45,56 10,50 45,44" fill="var(--c)" opacity="0.9"/>
        <polygon points="50,22 53,44 74,50 53,56 50,78 47,56 26,50 47,44" fill="var(--c)"/>
        <circle cx="50" cy="50" r="9" fill="white" opacity="0.92"/>
      </g>
    </svg>

  {:else if type === 'shield'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="shld-g">
        <polygon class="hex" points="50,14 80,32 80,68 50,86 20,68 20,32" stroke="var(--c)" stroke-width="3.5" fill="none"/>
        <polygon points="50,26 68,36 68,64 50,74 32,64 32,36" stroke="var(--c)" stroke-width="1.5" fill="none" opacity="0.45"/>
        <line x1="50" y1="36" x2="50" y2="64" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" opacity="0.65"/>
        <line x1="36" y1="50" x2="64" y2="50" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round" opacity="0.65"/>
      </g>
    </svg>

  {:else if type === 'berserker'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="bsrk-g">
        <circle cx="50" cy="50" r="13" fill="var(--c)"/>
        <line x1="50" y1="37" x2="50" y2="10" stroke="var(--c)" stroke-width="7" stroke-linecap="round"/>
        <line x1="50" y1="63" x2="50" y2="90" stroke="var(--c)" stroke-width="7" stroke-linecap="round"/>
        <line x1="37" y1="50" x2="10" y2="50" stroke="var(--c)" stroke-width="7" stroke-linecap="round"/>
        <line x1="63" y1="50" x2="90" y2="50" stroke="var(--c)" stroke-width="7" stroke-linecap="round"/>
        <line x1="41" y1="41" x2="22" y2="22" stroke="var(--c)" stroke-width="6" stroke-linecap="round"/>
        <line x1="59" y1="59" x2="78" y2="78" stroke="var(--c)" stroke-width="6" stroke-linecap="round"/>
        <line x1="59" y1="41" x2="78" y2="22" stroke="var(--c)" stroke-width="6" stroke-linecap="round"/>
        <line x1="41" y1="59" x2="22" y2="78" stroke="var(--c)" stroke-width="6" stroke-linecap="round"/>
      </g>
    </svg>

  {:else if type === 'wind'}
    <svg viewBox="0 0 100 100" class="fx-svg wind-g" overflow="visible">
      <path class="wl wl1" d="M16 38 Q36 26 56 38 Q76 50 88 38" stroke="var(--c)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path class="wl wl2" d="M10 53 Q32 40 54 53 Q76 66 90 53" stroke="var(--c)" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>
      <path class="wl wl3" d="M18 67 Q40 56 60 67 Q76 76 84 67" stroke="var(--c)" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.6"/>
    </svg>

  {:else if type === 'earth'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="erth-g">
        <polygon class="es es2" points="50,88 43,44 57,44" fill="var(--c)"/>
        <polygon class="es es1" points="30,88 24,60 36,60" fill="var(--c)"/>
        <polygon class="es es3" points="70,88 64,60 76,60" fill="var(--c)"/>
        <polygon class="es es4" points="18,88 14,72 22,72" fill="var(--c)" opacity="0.7"/>
        <polygon class="es es5" points="82,88 78,70 86,70" fill="var(--c)" opacity="0.7"/>
        <line x1="8" y1="88" x2="92" y2="88" stroke="var(--c)" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    </svg>

  {:else if type === 'blood'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="bld-g">
        <circle cx="50" cy="50" r="12" fill="var(--c)"/>
        <ellipse cx="50" cy="27" rx="4.5" ry="7" fill="var(--c)" class="bd bd1"/>
        <ellipse cx="68" cy="34" rx="4" ry="6" fill="var(--c)" class="bd bd2" transform="rotate(40 68 34)"/>
        <ellipse cx="78" cy="54" rx="3.5" ry="6" fill="var(--c)" class="bd bd3" transform="rotate(85 78 54)"/>
        <ellipse cx="66" cy="72" rx="3.5" ry="5.5" fill="var(--c)" class="bd bd4" transform="rotate(130 66 72)"/>
        <ellipse cx="34" cy="72" rx="3.5" ry="5.5" fill="var(--c)" class="bd bd5" transform="rotate(-130 34 72)"/>
        <ellipse cx="22" cy="54" rx="3.5" ry="6" fill="var(--c)" class="bd bd6" transform="rotate(-85 22 54)"/>
        <ellipse cx="32" cy="34" rx="4" ry="6" fill="var(--c)" class="bd bd7" transform="rotate(-40 32 34)"/>
      </g>
    </svg>

  {:else if type === 'void'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="void-g">
        <circle cx="50" cy="50" r="38" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.4" class="vr vr3"/>
        <circle cx="50" cy="50" r="28" stroke="var(--c)" stroke-width="2.5" fill="none" opacity="0.65" class="vr vr2"/>
        <circle cx="50" cy="50" r="17" stroke="var(--c)" stroke-width="3" fill="none" opacity="0.85" class="vr vr1"/>
        <circle cx="50" cy="50" r="9" fill="var(--c)" class="void-core"/>
      </g>
    </svg>

  {:else if type === 'energy'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="enrg-g">
        <line x1="50" y1="50" x2="50" y2="6" stroke="var(--c)" stroke-width="2" opacity="0.6" class="eb"/>
        <line x1="50" y1="50" x2="50" y2="94" stroke="var(--c)" stroke-width="2" opacity="0.6" class="eb"/>
        <line x1="50" y1="50" x2="6" y2="50" stroke="var(--c)" stroke-width="2" opacity="0.6" class="eb"/>
        <line x1="50" y1="50" x2="94" y2="50" stroke="var(--c)" stroke-width="2" opacity="0.6" class="eb"/>
        <circle cx="50" cy="50" r="27" stroke="var(--c)" stroke-width="2" fill="none" class="er er1" opacity="0.7"/>
        <circle cx="50" cy="50" r="39" stroke="var(--c)" stroke-width="1.5" fill="none" class="er er2" opacity="0.5"/>
        <circle cx="50" cy="50" r="13" fill="var(--c)" class="enrg-core" opacity="0.95"/>
      </g>
    </svg>

  {:else if type === 'cursed'}
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="curs-g">
        <circle cx="50" cy="50" r="37" stroke="var(--c)" stroke-width="2" fill="none"/>
        <polygon points="50,18 59,44 87,44 64,60 72,86 50,70 28,86 36,60 13,44 41,44" stroke="var(--c)" stroke-width="2" fill="none" opacity="0.8"/>
        <circle cx="50" cy="50" r="7" fill="var(--c)" opacity="0.6"/>
        <circle cx="46" cy="48" r="2" fill="white" opacity="0.8"/>
        <circle cx="54" cy="48" r="2" fill="white" opacity="0.8"/>
        <path d="M44 54 Q50 57 56 54" stroke="white" stroke-width="1.5" fill="none" opacity="0.8"/>
      </g>
    </svg>

  {:else}
    <!-- generic impact -->
    <svg viewBox="0 0 100 100" class="fx-svg" overflow="visible">
      <g class="gen-g">
        <circle cx="50" cy="50" r="28" stroke="var(--c)" stroke-width="3" fill="none" class="gen-ring"/>
        <line x1="32" y1="32" x2="68" y2="68" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
        <line x1="68" y1="32" x2="32" y2="68" stroke="var(--c)" stroke-width="3" stroke-linecap="round"/>
      </g>
    </svg>
  {/if}
</div>

<style>
.fx-root {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  filter: drop-shadow(0 0 8px var(--c));
}
.fx-svg { width: 100%; height: 100%; }

/* ─── DIRECTIONAL TRAVEL ─────────────────────────────────────────── */
/* ltr = attacker on left panel → flies right toward defender         */
/* rtl = attacker on right panel → flies left toward defender         */
/* Start position is set by the parent (left:8% or right:8% of the   */
/* character panels wrapper). translateX carries it to the other side.*/

.fx-ltr { animation: fly-ltr 0.75s cubic-bezier(0.2, 0.8, 0.35, 1) forwards; }
.fx-rtl { animation: fly-rtl 0.75s cubic-bezier(0.2, 0.8, 0.35, 1) forwards; }

@keyframes fly-ltr {
  0%   { transform: translateX(0)    scale(0.5);  opacity: 0;
         filter: drop-shadow(0 0 8px var(--c)); }
  10%  { transform: translateX(4px)  scale(1.0);  opacity: 1;
         filter: drop-shadow(0 0 12px var(--c)); }
  58%  { transform: translateX(58vw) scale(1.0);  opacity: 1;
         filter: drop-shadow(0 0 14px var(--c)); }
  74%  { transform: translateX(60vw) scale(1.45); opacity: 1;
         filter: brightness(2.5) drop-shadow(0 0 24px var(--c)); }
  100% { transform: translateX(60vw) scale(0.4);  opacity: 0;
         filter: brightness(1) drop-shadow(0 0 4px var(--c)); }
}

@keyframes fly-rtl {
  0%   { transform: translateX(0)     scale(0.5);  opacity: 0;
         filter: drop-shadow(0 0 8px var(--c)); }
  10%  { transform: translateX(-4px)  scale(1.0);  opacity: 1;
         filter: drop-shadow(0 0 12px var(--c)); }
  58%  { transform: translateX(-58vw) scale(1.0);  opacity: 1;
         filter: drop-shadow(0 0 14px var(--c)); }
  74%  { transform: translateX(-60vw) scale(1.45); opacity: 1;
         filter: brightness(2.5) drop-shadow(0 0 24px var(--c)); }
  100% { transform: translateX(-60vw) scale(0.4);  opacity: 0;
         filter: brightness(1) drop-shadow(0 0 4px var(--c)); }
}

/* ─── SLASH ──────────────────────────────────────────────────────── */
.sl { stroke-dasharray: 70; stroke-dashoffset: 70; }
.sl1 { animation: slash-draw 0.65s ease-out forwards; }
.sl2 { animation: slash-draw 0.65s 0.06s ease-out forwards; }
.sl3 { animation: slash-draw 0.65s 0.13s ease-out forwards; }
@keyframes slash-draw {
  0%   { stroke-dashoffset: 70; opacity: 0; }
  30%  { stroke-dashoffset: 0;  opacity: 0.95; }
  70%  { stroke-dashoffset: 0;  opacity: 0.85; }
  100% { stroke-dashoffset: 0;  opacity: 0; }
}

/* ─── FIRE ───────────────────────────────────────────────────────── */
.fire-g { transform-origin: 50% 88%; animation: fire-rise 0.85s ease-out forwards; }
@keyframes fire-rise {
  0%   { transform: scaleY(0.1) scaleX(0.4); opacity: 0; }
  25%  { transform: scaleY(1.1) scaleX(1.05); opacity: 1; }
  60%  { transform: scaleY(1.0) scaleX(1.0); opacity: 0.95; }
  85%  { transform: scaleY(1.05) scaleX(0.95); opacity: 0.6; }
  100% { transform: scaleY(0.7) scaleX(0.85) translateY(-10px); opacity: 0; }
}

/* ─── LIGHTNING ──────────────────────────────────────────────────── */
.bolt, .bolt-glow { stroke-dasharray: 100; stroke-dashoffset: 100; }
.bolt      { animation: bolt-draw 0.18s ease-out forwards, bolt-fade 0.55s 0.22s ease-in forwards; }
.bolt-glow { animation: bolt-draw 0.18s ease-out forwards, bolt-fade 0.55s 0.22s ease-in forwards; }
@keyframes bolt-draw { to { stroke-dashoffset: 0; } }
@keyframes bolt-fade { to { opacity: 0; } }

/* ─── ICE ────────────────────────────────────────────────────────── */
.ice-g { transform-origin: 50% 50%; animation: ice-crystal 0.78s ease-out forwards; }
@keyframes ice-crystal {
  0%   { transform: scale(0.1) rotate(45deg); opacity: 0; }
  40%  { transform: scale(1.1) rotate(2deg); opacity: 1; }
  65%  { transform: scale(1.0) rotate(0deg); opacity: 1; }
  100% { transform: scale(0.9) rotate(-4deg); opacity: 0; }
}

/* ─── SHADOW ─────────────────────────────────────────────────────── */
.shadow-g { transform-origin: 50% 50%; animation: shadow-bloom 0.88s ease-out forwards; }
@keyframes shadow-bloom {
  0%   { transform: scale(0.2) rotate(-25deg); opacity: 0; }
  30%  { transform: scale(1.15) rotate(8deg);  opacity: 0.9; }
  65%  { transform: scale(1.0) rotate(0deg);   opacity: 0.8; }
  100% { transform: scale(1.3) rotate(15deg);  opacity: 0; }
}

/* ─── HOLY ───────────────────────────────────────────────────────── */
.holy-g { transform-origin: 50% 50%; animation: holy-burst 0.78s ease-out forwards; }
@keyframes holy-burst {
  0%   { transform: scale(0); opacity: 0; filter: brightness(4); }
  25%  { transform: scale(1.2); opacity: 1; filter: brightness(2); }
  60%  { transform: scale(1.0); opacity: 0.9; filter: brightness(1.3); }
  100% { transform: scale(0.9); opacity: 0; filter: brightness(1); }
}

/* ─── TIME ───────────────────────────────────────────────────────── */
.tr { transform-origin: 50% 50%; }
.tr1 { animation: ring-expand 0.82s ease-out forwards; }
.tr2 { animation: ring-expand 0.82s 0.07s ease-out forwards; }
.tr3 { animation: ring-expand 0.82s 0.14s ease-out forwards; }
.th { transform-origin: 50% 50%; }
.th1 { animation: clock-spin 0.82s linear forwards; }
.th2 { animation: clock-spin 0.55s linear forwards; }
@keyframes ring-expand {
  0%   { transform: scale(0.2); opacity: 0; }
  40%  { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1.3); opacity: 0; }
}
@keyframes clock-spin {
  0%   { transform: rotate(0deg); opacity: 1; }
  100% { transform: rotate(720deg); opacity: 0; }
}

/* ─── PSYCHIC ────────────────────────────────────────────────────── */
.pr { transform-origin: 50% 50%; }
.pr1 { animation: ripple 0.72s ease-out forwards; }
.pr2 { animation: ripple 0.72s 0.11s ease-out forwards; }
.pr3 { animation: ripple 0.72s 0.22s ease-out forwards; }
.pr-core { transform-origin: 50% 50%; animation: core-pulse 0.72s ease-out forwards; }
@keyframes ripple {
  0%   { transform: scale(0.1); opacity: 0; }
  30%  { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1.45); opacity: 0; }
}
@keyframes core-pulse {
  0%   { transform: scale(0); opacity: 0; }
  40%  { transform: scale(1.6); opacity: 1; }
  100% { transform: scale(1.0); opacity: 0; }
}

/* ─── POISON ─────────────────────────────────────────────────────── */
.pb { transform-origin: 50% 50%; }
.pb1 { animation: bubble-float 0.88s ease-out forwards; }
.pb2 { animation: bubble-float 0.88s 0.07s ease-out forwards; }
.pb3 { animation: bubble-float 0.88s 0.04s ease-out forwards; }
.pb4 { animation: bubble-float 0.88s 0.15s ease-out forwards; }
.pb5 { animation: bubble-float 0.88s 0.22s ease-out forwards; }
.pb6 { animation: bubble-float 0.88s 0.11s ease-out forwards; }
@keyframes bubble-float {
  0%   { transform: scale(0) translateY(0); opacity: 0; }
  30%  { transform: scale(1.2) translateY(-4px); opacity: 1; }
  70%  { transform: scale(1.0) translateY(-10px); opacity: 0.8; }
  100% { transform: scale(1.4) translateY(-22px); opacity: 0; }
}

/* ─── GRAVITY ────────────────────────────────────────────────────── */
.grav-g { transform-origin: 50% 50%; animation: gravity-crush 0.72s ease-in forwards; }
@keyframes gravity-crush {
  0%   { transform: scale(2.2); opacity: 0; }
  35%  { transform: scale(1.1); opacity: 1; }
  70%  { transform: scale(1.0); opacity: 1; }
  100% { transform: scale(0.1); opacity: 0; }
}

/* ─── COMBO ──────────────────────────────────────────────────────── */
.cmb { opacity: 0; }
.cmb1 { animation: x-pop 0.55s ease-out forwards; }
.cmb2 { animation: x-pop 0.55s 0.10s ease-out forwards; }
.cmb3 { animation: x-pop 0.55s 0.20s ease-out forwards; }
.cmb4 { animation: x-pop 0.55s 0.30s ease-out forwards; }
.cmb5 { animation: x-pop 0.55s 0.40s ease-out forwards; }
@keyframes x-pop {
  0%   { transform: scale(0); opacity: 0; }
  45%  { transform: scale(1.3); opacity: 1; }
  75%  { transform: scale(1.0); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0; }
}

/* ─── CRIT ───────────────────────────────────────────────────────── */
.crit-g { transform-origin: 50% 50%; animation: crit-explosion 0.72s cubic-bezier(0.34,1.56,0.64,1) forwards; }
@keyframes crit-explosion {
  0%   { transform: scale(0) rotate(-20deg); opacity: 0; filter: brightness(5); }
  30%  { transform: scale(1.3) rotate(4deg); opacity: 1; filter: brightness(2.5); }
  60%  { transform: scale(1.1) rotate(0deg); opacity: 1; filter: brightness(1.5); }
  100% { transform: scale(0.85) rotate(-3deg); opacity: 0; filter: brightness(1); }
}

/* ─── SHIELD ─────────────────────────────────────────────────────── */
.shld-g { transform-origin: 50% 50%; animation: shield-form 0.82s ease-out forwards; }
.hex { stroke-dasharray: 320; stroke-dashoffset: 320; animation: hex-draw 0.5s ease-out forwards; }
@keyframes shield-form {
  0%   { transform: scale(0.2); opacity: 0; }
  45%  { transform: scale(1.1); opacity: 1; }
  75%  { transform: scale(1.0); opacity: 1; }
  100% { transform: scale(1.05); opacity: 0; }
}
@keyframes hex-draw { to { stroke-dashoffset: 0; } }

/* ─── BERSERKER ──────────────────────────────────────────────────── */
.bsrk-g { transform-origin: 50% 50%; animation: berserk-rage 0.72s ease-out forwards; }
@keyframes berserk-rage {
  0%   { transform: scale(0.3) rotate(-10deg); opacity: 0; }
  18%  { transform: scale(1.25) rotate(6deg);  opacity: 1; }
  38%  { transform: scale(0.9) rotate(-4deg);  opacity: 1; }
  58%  { transform: scale(1.12) rotate(3deg);  opacity: 0.9; }
  78%  { transform: scale(1.0) rotate(0deg);   opacity: 0.7; }
  100% { transform: scale(1.2) rotate(-5deg);  opacity: 0; }
}

/* ─── WIND ───────────────────────────────────────────────────────── */
.wind-g { animation: wind-sweep 0.72s ease-out forwards; }
.wl { stroke-dasharray: 110; stroke-dashoffset: 110; }
.wl1 { animation: wind-draw 0.42s ease-out forwards; }
.wl2 { animation: wind-draw 0.42s 0.07s ease-out forwards; }
.wl3 { animation: wind-draw 0.42s 0.14s ease-out forwards; }
@keyframes wind-sweep {
  0%   { transform: translateX(-18px); opacity: 0; }
  35%  { transform: translateX(4px);   opacity: 1; }
  100% { transform: translateX(14px);  opacity: 0; }
}
@keyframes wind-draw { to { stroke-dashoffset: 0; } }

/* ─── EARTH ──────────────────────────────────────────────────────── */
.erth-g { animation: erth-shake 0.78s ease-out forwards; }
.es { transform-box: fill-box; transform-origin: bottom center; transform: scaleY(0); opacity: 0; }
.es1 { animation: spike-rise 0.5s 0.05s ease-out forwards; }
.es2 { animation: spike-rise 0.5s ease-out forwards; }
.es3 { animation: spike-rise 0.5s 0.09s ease-out forwards; }
.es4 { animation: spike-rise 0.4s 0.16s ease-out forwards; }
.es5 { animation: spike-rise 0.4s 0.13s ease-out forwards; }
@keyframes spike-rise {
  0%   { transform: scaleY(0); opacity: 0; }
  55%  { transform: scaleY(1.1); opacity: 1; }
  80%  { transform: scaleY(1.0); opacity: 1; }
  100% { transform: scaleY(0.8); opacity: 0; }
}
@keyframes erth-shake {
  0%,100% { transform: translateX(0); }
  20%     { transform: translateX(-3px); }
  40%     { transform: translateX(3px); }
  60%     { transform: translateX(-2px); }
  80%     { transform: translateX(2px); }
}

/* ─── BLOOD ──────────────────────────────────────────────────────── */
.bld-g { transform-origin: 50% 50%; animation: blood-splat 0.82s ease-out forwards; }
.bd { transform-box: fill-box; transform-origin: center center; }
.bd1 { animation: drop-fly 0.65s ease-out forwards; }
.bd2 { animation: drop-fly 0.65s 0.04s ease-out forwards; }
.bd3 { animation: drop-fly 0.65s 0.02s ease-out forwards; }
.bd4 { animation: drop-fly 0.65s 0.08s ease-out forwards; }
.bd5 { animation: drop-fly 0.65s 0.06s ease-out forwards; }
.bd6 { animation: drop-fly 0.65s 0.03s ease-out forwards; }
.bd7 { animation: drop-fly 0.65s 0.01s ease-out forwards; }
@keyframes blood-splat {
  0%   { transform: scale(0); opacity: 0; }
  32%  { transform: scale(1.25); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0; }
}
@keyframes drop-fly {
  0%   { transform: scale(0) translate(0,0); opacity: 0; }
  38%  { transform: scale(1.25) translate(0,-5px); opacity: 1; }
  100% { transform: scale(0.6) translate(0,-18px); opacity: 0; }
}

/* ─── VOID ───────────────────────────────────────────────────────── */
.void-g { transform-origin: 50% 50%; animation: void-spin 0.92s ease-in-out forwards; }
.vr { transform-origin: 50% 50%; }
.vr1 { animation: void-collapse 0.82s ease-in forwards; }
.vr2 { animation: void-collapse 0.82s 0.05s ease-in forwards; }
.vr3 { animation: void-collapse 0.82s 0.10s ease-in forwards; }
.void-core { transform-origin: 50% 50%; animation: void-core-anim 0.82s ease-out forwards; }
@keyframes void-spin {
  0%   { transform: rotate(0deg); opacity: 0; }
  18%  { opacity: 1; }
  100% { transform: rotate(-200deg); opacity: 0; }
}
@keyframes void-collapse {
  0%   { transform: scale(1.6); opacity: 0; }
  38%  { transform: scale(1.0); opacity: 1; }
  100% { transform: scale(0.15); opacity: 0; }
}
@keyframes void-core-anim {
  0%   { transform: scale(0); opacity: 0; }
  45%  { transform: scale(1.6); opacity: 1; }
  100% { transform: scale(0); opacity: 0; }
}

/* ─── ENERGY ─────────────────────────────────────────────────────── */
.enrg-g { transform-origin: 50% 50%; animation: energy-pulse 0.78s ease-out forwards; }
.er { transform-origin: 50% 50%; }
.er1 { animation: ring-expand-fade 0.62s ease-out forwards; }
.er2 { animation: ring-expand-fade 0.72s 0.09s ease-out forwards; }
.eb  { animation: beam-flash 0.52s ease-out forwards; }
.enrg-core { transform-origin: 50% 50%; animation: enrg-core-anim 0.78s ease-out forwards; }
@keyframes energy-pulse {
  0%   { transform: scale(0.2); opacity: 0; }
  32%  { transform: scale(1.15); opacity: 1; }
  68%  { transform: scale(1.0); opacity: 0.9; }
  100% { transform: scale(0.9); opacity: 0; }
}
@keyframes ring-expand-fade {
  0%   { transform: scale(0.3); opacity: 0; }
  38%  { transform: scale(1.0); opacity: 0.85; }
  100% { transform: scale(1.55); opacity: 0; }
}
@keyframes beam-flash {
  0%   { opacity: 0; }
  22%  { opacity: 0.85; }
  100% { opacity: 0; }
}
@keyframes enrg-core-anim {
  0%   { transform: scale(0); opacity: 0; }
  35%  { transform: scale(1.3); opacity: 1; }
  70%  { transform: scale(1.0); opacity: 0.9; }
  100% { transform: scale(0.6); opacity: 0; }
}

/* ─── CURSED ─────────────────────────────────────────────────────── */
.curs-g { transform-origin: 50% 50%; animation: curse-appear 0.88s ease-out forwards; }
@keyframes curse-appear {
  0%   { transform: scale(0.2) rotate(-30deg); opacity: 0; filter: brightness(2.5); }
  28%  { transform: scale(1.1) rotate(4deg);   opacity: 1; filter: brightness(1.6); }
  62%  { transform: scale(1.0) rotate(0deg);   opacity: 0.9; filter: brightness(1); }
  100% { transform: scale(1.05) rotate(-3deg); opacity: 0; }
}

/* ─── GENERIC ────────────────────────────────────────────────────── */
.gen-g { transform-origin: 50% 50%; animation: gen-impact 0.68s ease-out forwards; }
.gen-ring { transform-origin: 50% 50%; animation: ring-expand-fade 0.62s ease-out forwards; }
@keyframes gen-impact {
  0%   { transform: scale(0); opacity: 0; }
  38%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1.0); opacity: 0; }
}
</style>
