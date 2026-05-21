export const menuSignal = $state({ count: 0 })
export const storyHomeSignal = $state({ count: 0 })

export function triggerMenu() {
  menuSignal.count++
}

export function triggerStoryHome() {
  storyHomeSignal.count++
}
