// Mobile shrinks the UI via CSS `zoom` on <html> (see +layout.svelte). That
// desyncs the two coordinate spaces: browser measurement APIs
// (getBoundingClientRect, clientX/clientY, innerWidth/Height) report POST-zoom
// SCREEN pixels, but `position: fixed/absolute` left/top are interpreted in
// PRE-zoom LOCAL pixels. So any coordinate measured from the DOM must be
// divided by the active zoom before it's used as a left/top, or the element
// lands pulled toward the top-left by the zoom factor.
//
// rootZoom() returns the active <html> zoom (1 = no zoom, i.e. PC / portrait),
// so screenToLocal() is a no-op everywhere zoom isn't applied.

export function rootZoom(): number {
  try {
    const z = parseFloat(getComputedStyle(document.documentElement).zoom as string)
    return z && isFinite(z) && z > 0 ? z : 1
  } catch {
    return 1
  }
}

export function screenToLocal(px: number): number {
  return px / rootZoom()
}
