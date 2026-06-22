<script lang="ts">
  // NPC guide UI — renders Quill (the Fate Scribe) as an RPG-style dialogue
  // box. Pinned to the bottom-center on mobile (above the nav), and right
  // side on desktop. Reads its state from the guide store; advance/dismiss
  // mutate that store, no local state needed.
  //
  // Designed to feel like a JRPG / Zelda companion: portrait on the left,
  // dialogue text on the right, big tap-anywhere "Next" affordance. The
  // typewriter effect on each line keeps the player's eyes on the words
  // instead of skimming and bouncing.
  import { guide } from '$lib/guide/store.svelte'
  import { QUILL } from '$lib/guide/scenes'
  import { goto } from '$app/navigation'
  import { settings } from '$lib/settings.svelte'

  // ── Typewriter — paint the line one char at a time so the player reads
  //    rather than skims. Tap-anywhere reveals the whole line instantly.
  let revealedCount = $state(0)
  let typing = $state(false)
  let typeTimer: ReturnType<typeof setInterval> | null = null

  function clearTimer() {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
  }

  // Restart typewriter whenever the active line changes.
  $effect(() => {
    const scene = guide.scene
    const idx = guide.lineIndex
    clearTimer()
    if (!scene) { revealedCount = 0; typing = false; return }
    const text = scene.lines[idx]?.text ?? ''
    revealedCount = 0
    typing = true
    // ~22ms/char ≈ comfortable for an RPG-style reveal; punctuation pauses
    // would be nicer but unnecessary complexity for v1.
    typeTimer = setInterval(() => {
      revealedCount++
      if (revealedCount >= text.length) {
        clearTimer()
        typing = false
      }
    }, 22)
  })

  function revealOrAdvance() {
    const scene = guide.scene
    if (!scene) return
    const fullText = scene.lines[guide.lineIndex]?.text ?? ''
    if (typing) {
      // Tap-anywhere short-circuits the typewriter
      clearTimer()
      revealedCount = fullText.length
      typing = false
      return
    }
    // If we're at the last line and the scene has choices, do nothing —
    // the player must pick a choice button to advance.
    if (guide.atLastLine && (scene.choices?.length ?? 0) > 0) return
    guide.next()
  }

  function handleChoice(choice: { action: string; target?: string }) {
    if (choice.action === 'dismiss') {
      guide.close()
    } else if (choice.action === 'next-scene' && choice.target) {
      const target = choice.target
      guide.close()
      // Tiny delay so the close animation can run before the next scene
      // pops in, otherwise the swap feels abrupt.
      setTimeout(() => guide.open(target, true), 60)
    } else if (choice.action === 'navigate' && choice.target) {
      const target = choice.target
      guide.close()
      goto(target)
    }
  }

  // Mood → portrait tint. Subtle, just a saturation/glow shift so Quill
  // doesn't look like a static asset across all scenes.
  function moodTint(mood?: string): string {
    switch (mood) {
      case 'wry':     return 'rgba(167,139,250,0.45)'
      case 'grave':   return 'rgba(154,144,123,0.55)'
      case 'pleased': return 'rgba(52,211,153,0.45)'
      case 'urgent':  return 'rgba(248,113,113,0.55)'
      default:        return 'rgba(240,192,64,0.45)'
    }
  }

  let scene = $derived(guide.scene)
  let currentLine = $derived(scene?.lines[guide.lineIndex])
  let displayText = $derived((currentLine?.text ?? '').slice(0, revealedCount))
</script>

{#if scene && currentLine}
  <!-- Backdrop — semi-transparent so the underlying screen is still
       visible (the NPC is overlay, not a hard modal). Clicking the backdrop
       advances the line, matching the tap-anywhere RPG convention. -->
  <div class="guide-backdrop" onclick={revealOrAdvance}
    role="button" tabindex="-1" aria-hidden="true"></div>

  <div class="guide-box" role="dialog" aria-labelledby="guide-name">
    <div class="guide-inner">

      <!-- Portrait + nameplate -->
      <div class="guide-portrait" style="--mood: {moodTint(currentLine.mood)};">
        <span class="material-symbols-outlined portrait-icon"
          style="font-variation-settings: 'FILL' 1;">{QUILL.icon}</span>
      </div>

      <div class="guide-content">
        <div class="guide-nameplate">
          <span id="guide-name" class="guide-name">{QUILL.name}</span>
          <span class="guide-title">· {QUILL.title}</span>
          <!-- Per-spin auto-pop toggle. ON = Quill chimes in every new
               wheel. OFF = portrait-only summoning. Mirrors the Settings
               panel switch so the player can mute him in-context. -->
          <button class="guide-perspin-toggle"
            onclick={() => { settings.quillPerSpin = !settings.quillPerSpin; settings.save() }}
            aria-label="Toggle Quill per spin"
            aria-pressed={settings.quillPerSpin}
            title={settings.quillPerSpin ? 'Per-spin pop-ups: ON' : 'Per-spin pop-ups: OFF'}
            style="background: {settings.quillPerSpin ? '#f0c040' : '#1e1a22'}; border-color: {settings.quillPerSpin ? '#f0c040' : 'rgba(78,70,53,0.5)'};">
            <span class="guide-perspin-knob"
              style="left: {settings.quillPerSpin ? '17px' : '2px'}; background: {settings.quillPerSpin ? '#0d0d16' : '#3a3848'};"></span>
          </button>
          <button class="guide-close" onclick={() => guide.close()} aria-label="Close">
            <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
          </button>
        </div>

        <!-- Dialogue body — clicking advances, choice buttons render at the
             end of the final line. -->
        <button class="guide-text-zone" onclick={revealOrAdvance}>
          <p class="guide-text">{displayText}<span class="guide-cursor" class:typing>▍</span></p>
        </button>

        <!-- Footer — line progress dots + Next hint OR choice buttons -->
        {#if guide.atLastLine && (scene.choices?.length ?? 0) > 0 && !typing}
          <div class="guide-choices">
            {#each scene.choices ?? [] as choice}
              <button class="guide-choice"
                style="--c: {choice.color ?? '#f0c040'};"
                onclick={() => handleChoice(choice)}>
                {choice.label}
              </button>
            {/each}
          </div>
        {:else}
          <div class="guide-footer">
            <div class="guide-dots">
              {#each scene.lines as _, i}
                <span class="guide-dot" class:active={i === guide.lineIndex}></span>
              {/each}
            </div>
            <span class="guide-next-hint">
              {typing ? 'tap to reveal' : 'tap to continue ›'}
            </span>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .guide-backdrop {
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 70%);
    backdrop-filter: blur(2px);
    z-index: 9998;
    cursor: pointer;
    animation: guideFadeIn 0.25s ease-out;
  }
  .guide-box {
    position: fixed;
    left: 50%;
    bottom: max(86px, env(safe-area-inset-bottom, 0) + 86px);
    transform: translateX(-50%);
    width: min(640px, calc(100vw - 24px));
    z-index: 9999;
    animation: guideSlideUp 0.32s cubic-bezier(0.34,1.3,0.64,1);
  }
  @media (min-width: 768px) {
    .guide-box { width: min(560px, 50vw); }
  }
  .guide-inner {
    display: flex;
    align-items: stretch;
    gap: 14px;
    padding: 14px;
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(28,22,40,0.97) 0%, rgba(13,10,20,0.97) 100%);
    border: 1.5px solid rgba(240,192,64,0.35);
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.6) inset,
      0 8px 36px rgba(0,0,0,0.6),
      0 0 48px rgba(240,192,64,0.10);
  }
  .guide-portrait {
    flex-shrink: 0;
    width: 72px;
    height: 72px;
    border-radius: 12px;
    background:
      radial-gradient(circle at 30% 30%, var(--mood, rgba(240,192,64,0.45)) 0%, rgba(0,0,0,0) 70%),
      linear-gradient(135deg, rgba(40,32,18,0.9), rgba(20,16,10,0.9));
    border: 1px solid rgba(240,192,64,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 18px var(--mood, rgba(240,192,64,0.30));
    transition: box-shadow 0.4s ease, background 0.4s ease;
  }
  .portrait-icon {
    font-size: 38px;
    color: #f0c040;
    filter: drop-shadow(0 0 8px rgba(240,192,64,0.6));
  }
  .guide-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .guide-nameplate {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .guide-name {
    font-family: 'Cinzel', serif;
    font-size: 0.95rem;
    font-weight: 700;
    color: #ffdf96;
    letter-spacing: 0.08em;
  }
  .guide-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.62rem;
    color: #9a907b;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .guide-close {
    background: none;
    border: none;
    color: #4e4635;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
  }
  .guide-close:hover { color: #9a907b; background: rgba(255,255,255,0.04); }
  .guide-perspin-toggle {
    position: relative;
    margin-left: auto;
    width: 34px;
    height: 18px;
    border-radius: 999px;
    border-width: 1px;
    border-style: solid;
    cursor: pointer;
    padding: 0;
    transition: background 0.18s ease, border-color 0.18s ease;
    flex-shrink: 0;
  }
  .guide-perspin-knob {
    position: absolute;
    top: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    transition: left 0.18s ease, background 0.18s ease;
  }
  .guide-perspin-toggle:hover { filter: brightness(1.1); }
  .guide-text-zone {
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    width: 100%;
  }
  .guide-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.82rem;
    color: #e9dfeb;
    line-height: 1.55;
    margin: 4px 0 8px 0;
    min-height: 2.6em;
  }
  .guide-cursor {
    display: inline-block;
    margin-left: 1px;
    color: #f0c040;
    opacity: 0;
  }
  .guide-cursor.typing {
    animation: guideCursorBlink 0.85s steps(2,end) infinite;
    opacity: 1;
  }
  .guide-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
  }
  .guide-dots {
    display: flex;
    gap: 4px;
  }
  .guide-dot {
    width: 5px; height: 5px;
    border-radius: 999px;
    background: #2a2640;
    transition: width 0.25s, background 0.25s;
  }
  .guide-dot.active { width: 16px; background: #f0c040; }
  .guide-next-hint {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    color: #4e4635;
    text-transform: uppercase;
  }
  .guide-choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }
  .guide-choice {
    flex: 1 1 auto;
    min-width: 120px;
    padding: 9px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--c) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 38%, transparent);
    color: var(--c);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: filter 0.15s, transform 0.1s;
  }
  .guide-choice:hover  { filter: brightness(1.2); }
  .guide-choice:active { transform: scale(0.97); }

  @keyframes guideFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes guideSlideUp {
    from { opacity: 0; transform: translate(-50%, 20px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes guideCursorBlink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0; }
  }
</style>
