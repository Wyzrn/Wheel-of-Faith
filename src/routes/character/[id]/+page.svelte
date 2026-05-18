<script lang="ts">
  import { goto } from '$app/navigation'
  import CharacterCard from '../../../components/CharacterCard.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">

  <!-- Nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14"
    style="background: rgba(7,7,13,0.94); border-bottom: 1px solid rgba(240,192,64,0.13); backdrop-filter: blur(16px);"
  >
    <div class="flex items-center" style="min-width: 80px;">
      <a href="/" class="flex items-center gap-1 transition-all active:scale-95"
        style="color: #9a907b; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-decoration: none; padding: 4px 6px; border-radius: 6px;">
        <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
        <span>Menu</span>
      </a>
    </div>
    <div class="flex-1 flex items-center justify-center gap-2">
      <span class="material-symbols-outlined" style="color: #f0c040; font-size: 18px; font-variation-settings: 'FILL' 1;">casino</span>
      <span style="font-family: 'Cinzel', serif; font-size: 13px; font-weight: 700; color: #ffdf96; letter-spacing: 0.18em;">WHEEL OF FATE</span>
    </div>
    <div style="min-width: 80px;"></div>
  </nav>

  <div class="flex justify-center pt-20 pb-24 px-4">
    <CharacterCard
      results={data.character.spins}
      name={data.character.name}
      startedAt={data.character.session_started_at}
      rivalsWins={data.character.rivals_wins ?? 0}
      readonly
      onNewCharacter={() => goto('/')}
    />
  </div>

</main>
