<script lang="ts">
  import { page } from '$app/stores'
</script>

<main
  class="min-h-screen flex flex-col items-center justify-center px-6 text-center"
  style="background: #07070d; color: #e4e1ee;"
>
  <!-- Decorative icon -->
  <div class="mb-6" style="color: #f0c040; opacity: 0.6;">
    <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>
  </div>

  <!-- Headline (Cinzel — matching the game aesthetic) -->
  <h1
    style="font-family: 'Cinzel', serif; font-size: clamp(1.8rem, 7vw, 3rem); font-weight: 700; color: #ffdf96; line-height: 1.2; max-width: 22ch; margin-bottom: 1rem;"
  >
    {$page.error?.message ?? 'This fate has been lost to the multiverse.'}
  </h1>

  <!-- Subtext (JetBrains Mono) -->
  <p
    style="font-family: 'JetBrains Mono', monospace; color: #9a907b; letter-spacing: 0.18em; text-transform: uppercase; font-size: 0.75rem; margin-bottom: 2.5rem;"
  >
    The threads of this destiny have unravelled.
  </p>

  <!-- Return link — styled like the 'Rewrite Destiny' button in CharacterCard -->
  <a
    href="/"
    style="
      font-family: 'Cinzel', serif;
      font-size: 0.875rem;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #ffdf96;
      background: linear-gradient(135deg, #1c1a2a, #13121c);
      border: 1px solid #f0c040;
      box-shadow: 0 0 22px rgba(240,192,64,0.12);
      padding: 0.75rem 2.5rem;
      border-radius: 0.5rem;
      text-decoration: none;
      display: inline-block;
      transition: box-shadow 0.15s;
    "
  >
    Return to the Wheel
  </a>
</main>
