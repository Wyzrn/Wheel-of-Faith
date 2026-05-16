export interface WeightedItem {
  label: string
  weight: number
}

export function weightedRandom(items: WeightedItem[]): number {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    roll -= items[i].weight
    if (roll <= 0) return i
  }
  return items.length - 1
}
