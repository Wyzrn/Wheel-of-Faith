<script lang="ts">
  // Main hub — renders the spin engine in menu mode (the gold panel of
  // verbs sits over the wheel). The same shared component handles /spin
  // and /character/new with different routeMode values; URL sync inside
  // the component keeps the address bar in step with the player's
  // progress (menu → /spin → /character/new → back to /).
  import SpinPageView from '$lib/spin/SpinPageView.svelte'
</script>

<SpinPageView routeMode="menu" />
