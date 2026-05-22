<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import SettingsPanel from '../components/SettingsPanel.svelte'
  import { page } from '$app/stores'
  import { goto, onNavigate } from '$app/navigation'
  import { triggerMenu, triggerStoryHome } from '$lib/menuState.svelte'
  import { auth } from '$lib/stores/auth.svelte'

  let { children } = $props()
  let showSettings = $state(false)

  onMount(() => { auth.init() })

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
    <button onclick={handleHomeClick} class="nav-tab" class:active={activeTab === 'home'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'home' ? 1 : 0};">home</span>
      <span class="nav-label">Home</span>
    </button>
    <a href="/characters" class="nav-tab" class:active={activeTab === 'characters'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'characters' ? 1 : 0};">group</span>
      <span class="nav-label">Fighters</span>
    </a>
    <a href="/rivals" class="nav-tab" class:active={activeTab === 'rivals'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'rivals' ? 1 : 0};">swords</span>
      <span class="nav-label">Rivals</span>
    </a>
    <a href="/challenges" class="nav-tab" class:active={activeTab === 'challenges'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'challenges' ? 1 : 0};">task_alt</span>
      <span class="nav-label">Tasks</span>
    </a>
    <a href="/friends" class="nav-tab" class:active={activeTab === 'friends'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'friends' ? 1 : 0};">group</span>
      <span class="nav-label">Friends</span>
    </a>
    <a href="/shop" class="nav-tab" class:active={activeTab === 'shop'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'shop' ? 1 : 0};">storefront</span>
      <span class="nav-label">Shop</span>
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

<style>
  /* Stone fortress floor — the nav bar is a carved obsidian shelf */
  .bottom-nav {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 10;
    height: 64px;
    display: flex;
    align-items: stretch;
    /* Deep stone slab background */
    background: linear-gradient(180deg, #0e0b1c 0%, #070510 100%);
    /* Stone edge glow + carved top rim */
    border-top: 1px solid rgba(200,136,42,0.22);
    box-shadow:
      /* Outer top glow seam */
      0 -1px 0 rgba(200,136,42,0.08),
      /* Deep upward shadow */
      0 -8px 40px rgba(0,0,0,0.85),
      /* Inner top highlight (light on stone rim) */
      inset 0 1px 0 rgba(255,225,140,0.10),
      /* Inner depth */
      inset 0 -1px 0 rgba(0,0,0,0.6);
    backdrop-filter: blur(24px);
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
      rgba(200,136,42,0.0) 10%,
      rgba(200,136,42,0.7) 30%,
      rgba(72,200,224,0.6) 50%,
      rgba(200,136,42,0.7) 70%,
      rgba(200,136,42,0.0) 90%,
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
    color: #4a3c24;
    transition: color 0.18s, transform 0.12s;
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
    background: linear-gradient(90deg, transparent, #c0882a, #e8b84b, #c0882a, transparent);
    border-radius: 0 0 3px 3px;
    opacity: 0;
    transition: opacity 0.18s;
    box-shadow: 0 0 8px rgba(200,136,42,0.7);
  }

  /* Active tab warm stone glow behind */
  .nav-tab::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 60% 70% at 50% 60%, rgba(200,136,42,0.07) 0%, transparent 80%);
    opacity: 0;
    transition: opacity 0.18s;
    pointer-events: none;
  }

  .nav-tab.active { color: #e8b84b; }
  .nav-tab.active::before { opacity: 1; }
  .nav-tab.active::after  { opacity: 1; }

  .nav-tab:hover:not(.active) { color: #806020; }

  :global(.nav-icon) { font-size: 22px; }

  .nav-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 700;
  }
</style>
