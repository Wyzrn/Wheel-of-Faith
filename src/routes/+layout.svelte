<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import SettingsPanel from '../components/SettingsPanel.svelte'
  import ClickParticles from '../components/ClickParticles.svelte'
  import Toaster from '../components/Toaster.svelte'
  import AmbientField from '../components/AmbientField.svelte'
  import RotateHint from '../components/RotateHint.svelte'
  import IncomingChallengePopup from '../components/IncomingChallengePopup.svelte'
  import ChallengeBattleOverlay from '../components/ChallengeBattleOverlay.svelte'
  import { page } from '$app/stores'
  import { goto, onNavigate } from '$app/navigation'
  import { triggerMenu, triggerStoryHome } from '$lib/menuState.svelte'
  import { auth } from '$lib/stores/auth.svelte'
  import { presence } from '$lib/stores/presence.svelte'
  import { settings } from '$lib/settings.svelte'
  import { setPerfTierOverride, getPerfTier } from '$lib/perf'
  import { toast } from '$lib/toast.svelte'

  let { children } = $props()
  let showSettings = $state(false)

  onMount(() => {
    auth.init()
    // Expose perf tier to CSS so heavy ambient effects can be gated declaratively.
    try { document.documentElement.dataset.perf = getPerfTier() } catch { /* ssr */ }

    // Graceful network net: turn silent fetch failures (offline / server down)
    // into one friendly, throttled toast instead of a dead button + console
    // spew. Conservative — only catches network-type rejections.
    let lastNetToast = 0
    const onRejection = (e: PromiseRejectionEvent) => {
      const r: any = e.reason
      const msg = (r?.message ?? String(r ?? '')).toLowerCase()
      const isNetwork = r?.name === 'TypeError'
        || msg.includes('failed to fetch') || msg.includes('networkerror')
        || msg.includes('load failed') || msg.includes('network request failed')
      if (!isNetwork) return
      const now = Date.now()
      if (now - lastNetToast > 6000) {
        lastNetToast = now
        toast.error('Connection hiccup', { detail: "Couldn't reach the server — check your connection." })
      }
      e.preventDefault()  // handled — don't let it spam the console
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  })

  // Keep the perf-tier override in sync with the High Quality settings
  // toggle. Default 'auto' = use device detection; 'high' = force every
  // device to render full fidelity.
  $effect(() => {
    setPerfTierOverride(settings.highQualityOverride === 'high' ? 'high' : null)
  })

  // Keep a global presence/challenge socket open while logged in so friend
  // challenges can pop up anywhere in the app and online status stays fresh.
  $effect(() => {
    if (auth.loggedIn) presence.connect()
    else presence.disconnect()
  })

  let isStoryRoute = $derived($page.url.pathname.startsWith('/story'))

  let activeTab = $derived(
    $page.url.pathname === '/' ? 'home' :
    $page.url.pathname.startsWith('/character') ? 'characters' :
    $page.url.pathname.startsWith('/gallery') ? 'gallery' :
    $page.url.pathname.startsWith('/rivals') ? 'rivals' :
    $page.url.pathname.startsWith('/challenges') ? 'challenges' :
    $page.url.pathname.startsWith('/clan') ? 'clan' :
    $page.url.pathname.startsWith('/friends') ? 'friends' :
    $page.url.pathname.startsWith('/leaderboard') ? 'friends' :
    $page.url.pathname.startsWith('/profile') ? 'profile' :
    $page.url.pathname.startsWith('/battle') ? 'battle' :
    $page.url.pathname.startsWith('/shop') ? 'shop' :
    'home'
  )

  function handleHomeClick() {
    if ($page.url.pathname === '/') {
      triggerMenu()
    } else {
      goto('/')
    }
  }

  // View Transitions API — smooth crossfade between SvelteKit pages
  onNavigate((navigation) => {
    if (!document.startViewTransition) return
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve()
        await navigation.complete
      })
    })
  })
</script>

<!-- Global ambient backdrop (gradient glows + drifting embers), behind all content -->
<AmbientField />

{@render children()}

<!-- Bottom navigation bar -->
<nav class="bottom-nav">
  {#if isStoryRoute}
    <!-- Story mode: Menu + Home + Settings -->
    <button onclick={() => goto('/')} class="nav-tab">
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' 0;">grid_view</span>
      <span class="nav-label">Menu</span>
    </button>
    <button onclick={triggerStoryHome} class="nav-tab">
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' 1;">castle</span>
      <span class="nav-label">Hub</span>
    </button>
    <button onclick={() => showSettings = !showSettings} class="nav-tab" class:active={showSettings}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {showSettings ? 1 : 0};">settings</span>
      <span class="nav-label">Settings</span>
    </button>
  {:else}
    <!-- 5 tabs only — Rivals/Tasks/Shop moved to the in-page main menu to keep
         the hotbar usable on mobile. Each tab gets ~20% width instead of ~11%. -->
    <button onclick={handleHomeClick} class="nav-tab" class:active={activeTab === 'home'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'home' ? 1 : 0};">home</span>
      <span class="nav-label">Home</span>
    </button>
    <a href="/characters" class="nav-tab" class:active={activeTab === 'characters'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'characters' ? 1 : 0};">group</span>
      <span class="nav-label">Fighters</span>
    </a>
    <a href="/friends" class="nav-tab" class:active={activeTab === 'friends'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'friends' ? 1 : 0};">groups</span>
      <span class="nav-label">Friends</span>
    </a>
    <a href={auth.loggedIn ? '/profile' : '/login'} class="nav-tab" class:active={activeTab === 'profile'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'profile' ? 1 : 0};">{auth.loggedIn ? 'account_circle' : 'login'}</span>
      <span class="nav-label">{auth.loggedIn ? auth.user?.username?.slice(0,8) ?? 'Profile' : 'Login'}</span>
    </a>
    <button onclick={() => showSettings = !showSettings} class="nav-tab" class:active={showSettings}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {showSettings ? 1 : 0};">settings</span>
      <span class="nav-label">Settings</span>
    </button>
  {/if}
</nav>

{#if showSettings}
  <SettingsPanel onClose={() => showSettings = false} />
{/if}

<!-- Global click sparkle effects — listens to pointerdown on document and emits
     short-lived particles at the click location. Skipped on low perf tier and
     when settings.effectsEnabled is off. -->
<ClickParticles />

<!-- Global toast notifications — anything in the app can call toast.show(),
     toast.success(), etc. and a single Toaster renders the queue here. -->
<Toaster />

<!-- Friend-challenge UI — both render globally so a challenge can arrive on
     any page. The popup handles accept/decline; the overlay runs the
     character-vs-character duel. -->
<IncomingChallengePopup />
<ChallengeBattleOverlay />

<!-- Mobile landscape gate — blocks portrait play on touch devices -->
<RotateHint />

<style>
  /* Stone fortress floor — the nav bar is a carved obsidian shelf */
  .bottom-nav {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 10;
    height: 64px;
    display: flex;
    align-items: stretch;
    /* Obsidian shelf rising from the void to a lighter carved rim */
    background: linear-gradient(0deg, #16121a 0%, #38333c 100%);
    border-top: 3px solid rgba(240,192,82,0.5);
    border-radius: 16px 16px 0 0;
    box-shadow:
      0 -1px 0 rgba(240,192,82,0.10),
      0 -10px 30px rgba(0,0,0,0.9),
      inset 0 1px 0 rgba(255,255,255,0.06),
      inset 0 -1px 0 rgba(0,0,0,0.6);
    backdrop-filter: blur(24px);
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* Animated rune trace running along the top edge */
  .bottom-nav::before {
    content: '';
    position: absolute;
    top: -1px; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(240,192,82,0.0) 10%,
      rgba(240,192,82,0.7) 30%,
      rgba(90,214,239,0.7) 50%,
      rgba(240,192,82,0.7) 70%,
      rgba(240,192,82,0.0) 90%,
      transparent 100%
    );
    background-size: 300% 100%;
    animation: runeFlow 6s linear infinite;
  }

  .nav-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 4px;
    cursor: pointer;
    text-decoration: none;
    border: none;
    background: none;
    color: #5b6568;
    transition: color 0.18s, transform 0.18s ease-out, filter 0.18s;
    position: relative;
    -webkit-tap-highlight-color: transparent;
  }

  .nav-tab:active { transform: scale(0.86); }

  /* Active indicator: rune glow line at top + subtle warmth behind icon */
  .nav-tab::before {
    content: '';
    position: absolute;
    top: 0; left: 15%; right: 15%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #5ad6ef, #6ae4fd, #5ad6ef, transparent);
    border-radius: 0 0 3px 3px;
    opacity: 0;
    transition: opacity 0.18s;
    box-shadow: 0 0 10px rgba(90,214,239,0.9);
  }

  /* Active tab warm stone glow behind */
  .nav-tab::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 60% 70% at 50% 60%, rgba(90,214,239,0.12) 0%, transparent 80%);
    opacity: 0;
    transition: opacity 0.18s;
    pointer-events: none;
  }

  .nav-tab.active {
    color: #6ae4fd;
    transform: translateY(-3px) scale(1.08);
    filter: drop-shadow(0 0 10px rgba(90,214,239,0.9));
  }
  .nav-tab.active::before { opacity: 1; }
  .nav-tab.active::after  { opacity: 1; }

  .nav-tab:hover:not(.active) { color: #97a3a6; }

  :global(.nav-icon) { font-size: 24px; }

  .nav-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 700;
  }
  /* Tighten on very narrow phones so 5 labels never collide */
  @media (max-width: 360px) {
    .nav-label { font-size: 9px; letter-spacing: 0.08em; }
    :global(.nav-icon) { font-size: 22px; }
  }
</style>
