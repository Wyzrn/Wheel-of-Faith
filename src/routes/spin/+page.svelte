<script lang="ts">
  // Spin route — the wheel and its current spin definition are
  // foregrounded; the main menu starts hidden. Same engine as /, just
  // a different starting mode.
  import SpinPageView from '$lib/spin/SpinPageView.svelte'
</script>

<svelte:head><title>Spinning — Wheel of Destiny</title></svelte:head>

<SpinPageView routeMode="spin" />
