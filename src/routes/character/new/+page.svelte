<script lang="ts">
  // Character creation result — the player has just finished the spin
  // queue. Their final card + name input live on this URL so it's
  // bookmarkable and the back button behaves sensibly. Same shared
  // engine renders, but starts in result mode.
  import SpinPageView from '$lib/spin/SpinPageView.svelte'
</script>

<svelte:head><title>New Character — Wheel of Destiny</title></svelte:head>

<SpinPageView routeMode="result" />
