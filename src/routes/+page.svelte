<script lang="ts">
  import SpinWheel from '../components/SpinWheel.svelte'
  import type { WeightedSegment } from '$lib/session/types'

  const DEMO_SEGMENTS: WeightedSegment[] = [
    { label: 'Fire',   weight: 1, color: '#E63946' },
    { label: 'Water',  weight: 1, color: '#457B9D' },
    { label: 'Earth',  weight: 1, color: '#2A9D8F' },
    { label: 'Air',    weight: 1, color: '#E9C46A' },
    { label: 'Shadow', weight: 1, color: '#264653' },
    { label: 'Light',  weight: 1, color: '#F4A261' },
    { label: 'Void',   weight: 1, color: '#6A0572' },
    { label: 'Storm',  weight: 1, color: '#0077B6' },
  ]

  let spinHistory = $state<Array<{ index: number; label: string }>>([])

  function handleSpinComplete(index: number, label: string) {
    spinHistory = [...spinHistory, { index, label }]
  }
</script>

<main class="min-h-screen bg-gray-950 text-white flex flex-col items-center py-8 px-4">
  <h1 class="text-3xl font-bold tracking-wide mb-2">Wheel of Fate</h1>
  <p class="text-sm text-gray-400 mb-8">Phase 1 — Animation Proof of Concept</p>

  <SpinWheel segments={DEMO_SEGMENTS} onSpinComplete={handleSpinComplete} />

  {#if spinHistory.length > 0}
    <div class="mt-8 w-full max-w-sm">
      <h2 class="text-lg font-semibold mb-3">Spin History</h2>
      <ul class="space-y-1">
        {#each spinHistory as entry, i}
          <li class="text-sm text-gray-300">Spin {i + 1}: {entry.label} (segment {entry.index})</li>
        {/each}
      </ul>
    </div>
  {/if}
</main>
