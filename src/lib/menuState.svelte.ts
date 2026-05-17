export const menuSignal = $state({ count: 0 })

export function triggerMenu() {
  menuSignal.count++
}
