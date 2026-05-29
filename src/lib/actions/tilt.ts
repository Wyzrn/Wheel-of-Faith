// 3D parallax tilt — mirrors the Story Mode mockup. On pointer move the node
// rotates toward the cursor (perspective), springing back on leave. Desktop
// pointers only; disabled for touch and prefers-reduced-motion so it never
// fights mobile scrolling or accessibility settings.
export function tilt(node: HTMLElement, opts: { max?: number; scale?: number } = {}) {
  const max = opts.max ?? 8        // max degrees of rotation
  const scale = opts.scale ?? 1.0

  const fine = typeof matchMedia !== 'undefined'
    && matchMedia('(hover: hover) and (pointer: fine)').matches
  const reduce = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!fine || reduce) return {}

  node.style.transformStyle = 'preserve-3d'
  node.style.willChange = 'transform'
  node.style.transition = 'transform 220ms cubic-bezier(0.4,0,0.2,1)'

  function onMove(e: PointerEvent) {
    const r = node.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width   // 0..1
    const py = (e.clientY - r.top) / r.height   // 0..1
    const ry = (px - 0.5) * 2 * max             // left/right → rotateY
    const rx = (0.5 - py) * 2 * max             // up/down   → rotateX
    node.style.transition = 'transform 80ms linear'
    node.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`
  }
  function onLeave() {
    node.style.transition = 'transform 320ms cubic-bezier(0.34,1.56,0.64,1)'
    node.style.transform = 'perspective(900px) rotateX(0) rotateY(0) scale(1)'
  }

  node.addEventListener('pointermove', onMove)
  node.addEventListener('pointerleave', onLeave)
  return {
    destroy() {
      node.removeEventListener('pointermove', onMove)
      node.removeEventListener('pointerleave', onLeave)
    },
  }
}
