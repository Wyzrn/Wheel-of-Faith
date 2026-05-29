<script lang="ts">
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth.svelte'

  let mode = $state<'login' | 'register'>('login')
  let username = $state('')
  let email = $state('')
  let password = $state('')
  let error = $state<string | null>(null)
  let loading = $state(false)

  async function submit() {
    error = null
    loading = true
    const err = mode === 'login'
      ? await auth.login(username, password)
      : await auth.register(username, password, email || undefined)
    loading = false
    if (err) { error = err; return }
    goto('/')
  }
</script>

<main class="min-h-screen flex items-center justify-center px-4" style="background: transparent;">
  <div class="w-full max-w-sm">
    <!-- Header -->
    <div class="text-center mb-8">
      <p class="text-xs tracking-[0.3em] uppercase mb-3" style="font-family: 'JetBrains Mono', monospace; color: #4e4635;">Wheel of Fate</p>
      <h1 style="font-family: 'Cinzel', serif; font-size: 1.75rem; font-weight: 900; color: #ffdf96; letter-spacing: 0.1em;">
        {mode === 'login' ? 'Welcome Back' : 'Create Account'}
      </h1>
      <p class="text-xs mt-2 tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
        {mode === 'login' ? 'Sign in to sync your fates' : 'Start your legend'}
      </p>
    </div>

    <!-- Card -->
    <div class="obsidian-slab rounded-2xl p-6">
      <!-- Form -->
      <form onsubmit={(e) => { e.preventDefault(); submit() }} class="flex flex-col gap-4">
        <div>
          <label class="text-xs block mb-1.5 tracking-wider uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Username</label>
          <input
            bind:value={username}
            type="text"
            autocomplete="username"
            required
            class="carved-groove w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
            style="color: #e9dfeb; font-family: 'JetBrains Mono', monospace;"
            placeholder="your_username"
          />
        </div>

        {#if mode === 'register'}
          <div>
            <label class="text-xs block mb-1.5 tracking-wider uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Email <span style="color: #4e4635;">(optional)</span></label>
            <input
              bind:value={email}
              type="email"
              autocomplete="email"
              class="carved-groove w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style="color: #e9dfeb; font-family: 'JetBrains Mono', monospace;"
              placeholder="you@example.com"
            />
          </div>
        {/if}

        <div>
          <label class="text-xs block mb-1.5 tracking-wider uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Password</label>
          <input
            bind:value={password}
            type="password"
            autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minlength={6}
            class="carved-groove w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style="color: #e9dfeb; font-family: 'JetBrains Mono', monospace;"
            placeholder="••••••••"
          />
        </div>

        {#if error}
          <p class="text-xs text-red-400 text-center" style="font-family: 'JetBrains Mono', monospace;">{error}</p>
        {/if}

        <button
          type="submit"
          disabled={loading}
          class="metal-stamp-gold py-3 rounded-xl text-sm font-bold tracking-widest uppercase disabled:opacity-50"
          style="font-family: 'Cinzel', serif;"
        >
          {loading ? 'Loading…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
    </div>

    <!-- Toggle mode -->
    <p class="text-center mt-4 text-sm" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
      {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
      <button
        onclick={() => { mode = mode === 'login' ? 'register' : 'login'; error = null }}
        class="underline ml-1"
        style="color: #f0c040;"
      >
        {mode === 'login' ? 'Register' : 'Sign in'}
      </button>
    </p>

    <p class="text-center mt-3">
      <a href="/" class="text-xs" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">← Back to game</a>
    </p>
  </div>
</main>
