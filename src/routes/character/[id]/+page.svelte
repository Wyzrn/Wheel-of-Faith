<script lang="ts">
  import { goto } from '$app/navigation'
  import CharacterCard from '../../../components/CharacterCard.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<main class="min-h-screen" style="background: #07070d; color: #e4e1ee;">
  <div class="flex justify-center pt-20 pb-8 px-4">
    <CharacterCard
      results={data.character.spins}
      name={data.character.name}
      startedAt={data.character.session_started_at}
      onNewCharacter={() => goto('/')}
    />
  </div>
</main>
