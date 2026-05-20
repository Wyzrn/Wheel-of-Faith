<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import SettingsPanel from '../components/SettingsPanel.svelte'
  import { page } from '$app/stores'
  import { goto, onNavigate } from '$app/navigation'
  import { triggerMenu } from '$lib/menuState.svelte'
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
    $page.url.pathname.startsWith('/friends') ? 'friends' :
    $page.url.pathname.startsWith('/leaderboard') ? 'friends' :
    $page.url.pathname.startsWith('/profile') ? 'profile' :
    $page.url.pathname.startsWith('/battle') ? 'battle' :
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
    <!-- Story mode: Home + Settings only -->
    <button onclick={handleHomeClick} class="nav-tab" class:active={activeTab === 'home'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'home' ? 1 : 0};">home</span>
      <span class="nav-label">Home</span>
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
    <a href="/friends" class="nav-tab" class:active={activeTab === 'friends'}>
      <span class="material-symbols-outlined nav-icon" style="font-variation-settings: 'FILL' {activeTab === 'friends' ? 1 : 0};">group</span>
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

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    height: 64px;
    display: flex;
    align-items: stretch;
    background: rgba(7, 7, 13, 0.97);
    border-top: 1px solid rgba(240, 192, 64, 0.15);
    backdrop-filter: blur(20px);
    box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 223, 150, 0.06);
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
    color: #4e4635;
    transition: color 0.15s, transform 0.1s;
    position: relative;
    -webkit-tap-highlight-color: transparent;
  }

  .nav-tab:active {
    transform: scale(0.88);
  }

  .nav-tab::before {
    content: '';
    position: absolute;
    top: 0;
    left: 20%;
    right: 20%;
    height: 2px;
    background: #f0c040;
    border-radius: 0 0 2px 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .nav-tab.active {
    color: #f0c040;
  }

  .nav-tab.active::before {
    opacity: 1;
  }

  .nav-tab:hover:not(.active) {
    color: #9a907b;
  }

  :global(.nav-icon) {
    font-size: 22px;
  }

  .nav-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 600;
  }
</style>
