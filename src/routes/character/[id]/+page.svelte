<script lang="ts">
  import { goto } from '$app/navigation'
  import CharacterCard from '../../../components/CharacterCard.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<main class="min-h-screen" style="background: transparent; color: #e9dfeb;">

  <!-- Nav -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center px-4 h-14"
    style="background: rgba(22,18,26,0.92); border-bottom: 2px solid rgba(240,192,82,0.45); backdrop-filter: blur(16px); box-shadow: 0 4px 20px rgba(90,214,239,0.12);"
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

  <div class="flex justify-center pt-16 pb-2 px-4">
    <div class="flex justify-center pt-2 pb-2">
      <a href="/character/{data.character.shareId}/replay" class="flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs" style="background: rgba(240,192,64,0.08); border: 1px solid rgba(240,192,64,0.2); color: #f0c040; text-decoration: none;">
        <span class="material-symbols-outlined" style="font-size: 14px; font-variation-settings: 'FILL' 1;">play_circle</span>
        Watch Replay
      </a>
    </div>
  </div>
  <div class="flex justify-center pb-24 px-4">
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
