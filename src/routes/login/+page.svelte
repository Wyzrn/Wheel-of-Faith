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

<main class="min-h-screen flex items-center justify-center px-4" style="background: #09090f;">
  <div class="w-full max-w-sm">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 style="font-family: 'Cinzel', serif; font-size: 1.75rem; font-weight: 900; color: #ffdf96; letter-spacing: 0.1em;">
        WHEEL OF FATE
      </h1>
      <p class="text-xs mt-2 tracking-widest uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </p>
    </div>

    <!-- Card -->
    <div class="rounded-2xl p-6" style="background: #0f0e1a; border: 1px solid rgba(240,192,64,0.15);">
      <!-- Google OAuth -->
      <button
        onclick={auth.loginWithGoogle}
        class="w-full flex items-center justify-center gap-3 py-3 rounded-xl mb-5 text-sm font-medium transition-opacity hover:opacity-90"
        style="background: #1e1e2e; border: 1px solid rgba(255,255,255,0.1); color: #e4e1ee;"
      >
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>

      <div class="flex items-center gap-3 mb-5">
        <div class="flex-1 h-px" style="background: rgba(255,255,255,0.08);"></div>
        <span class="text-xs" style="color: #4e4635; font-family: 'JetBrains Mono', monospace;">or</span>
        <div class="flex-1 h-px" style="background: rgba(255,255,255,0.08);"></div>
      </div>

      <!-- Form -->
      <form onsubmit={(e) => { e.preventDefault(); submit() }} class="flex flex-col gap-4">
        <div>
          <label class="text-xs block mb-1.5 tracking-wider uppercase" style="color: #9a907b; font-family: 'JetBrains Mono', monospace;">Username</label>
          <input
            bind:value={username}
            type="text"
            autocomplete="username"
            required
            class="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
            style="background: #1a1a28; border: 1px solid rgba(255,255,255,0.1); color: #e4e1ee; font-family: 'JetBrains Mono', monospace;"
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
              class="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style="background: #1a1a28; border: 1px solid rgba(255,255,255,0.1); color: #e4e1ee; font-family: 'JetBrains Mono', monospace;"
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
            class="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style="background: #1a1a28; border: 1px solid rgba(255,255,255,0.1); color: #e4e1ee; font-family: 'JetBrains Mono', monospace;"
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
