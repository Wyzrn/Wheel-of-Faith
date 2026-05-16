<script lang="ts">
  import { onMount } from 'svelte'
  import SpinWheel from '../components/SpinWheel.svelte'
  import { loadSession, saveSession, clearSession, createSession } from '$lib/session/store'
  import type { WeightedSegment, SessionState } from '$lib/session/types'

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

  let currentSession = $state<SessionState>(createSession())
  let showResumePrompt = $state(false)
  let restoredResult = $state<{ index: number; label: string } | null>(null)
  let spinHistory = $state<Array<{ index: number; label: string }>>([])

  onMount(() => {
    const saved = loadSession()
    if (saved && saved.completedSpins.length > 0) {
      currentSession = saved
      showResumePrompt = true
    }
  })

  function handleSpinComplete(index: number, label: string) {
    const newSpin = {
      step: currentSession.completedSpins.length + 1,
      category: 'demo',
      resultLabel: label,
      resultIndex: index,
      timestamp: new Date().toISOString(),
    }
    const updatedSession = {
      ...currentSession,
      completedSpins: [...currentSession.completedSpins, newSpin],
    }
    currentSession = updatedSession
    saveSession(updatedSession)
    spinHistory = [...spinHistory, { index, label }]
  }

  function handleResume() {
    showResumePrompt = false
    const lastSpin = currentSession.completedSpins.at(-1)
    if (lastSpin) {
      restoredResult = { index: lastSpin.resultIndex, label: lastSpin.resultLabel }
      spinHistory = currentSession.completedSpins.map(s => ({
        index: s.resultIndex,
        label: s.resultLabel,
      }))
    }
  }

  function handleStartOver() {
    clearSession()
    currentSession = createSession()
    showResumePrompt = false
    restoredResult = null
    spinHistory = []
  }
</script>

<main class="min-h-screen bg-gray-950 text-white flex flex-col items-center py-8 px-4">
  <h1 class="text-3xl font-bold tracking-wide mb-2">Wheel of Fate</h1>
  <p class="text-sm text-gray-400 mb-8">Phase 1 — Animation Proof of Concept</p>

  {#if showResumePrompt}
    <div class="w-full max-w-sm bg-gray-800 border border-gray-600 rounded-xl p-6 mb-6 text-center">
      <p class="text-lg font-semibold mb-2">You have a saved session</p>
      <p class="text-sm text-gray-400 mb-4">
        Last result: <span class="text-white font-medium">
          {currentSession.completedSpins.at(-1)?.resultLabel ?? ''}
        </span>
        ({currentSession.completedSpins.length} spin(s) completed)
      </p>
      <div class="flex gap-3 justify-center">
        <button
          onclick={handleResume}
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg transition-colors"
        >Resume</button>
        <button
          onclick={handleStartOver}
          class="bg-gray-600 hover:bg-gray-500 text-white px-5 py-2 rounded-lg transition-colors"
        >Start Over</button>
      </div>
    </div>
  {/if}

  {#if restoredResult && !showResumePrompt}
    <div class="w-full max-w-sm bg-gray-900 border border-indigo-500 rounded-lg px-4 py-2 mb-4 text-center">
      <p class="text-sm text-gray-400">Resumed session — last result:</p>
      <p class="text-xl font-bold text-indigo-300">{restoredResult.label}</p>
    </div>
  {/if}

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
