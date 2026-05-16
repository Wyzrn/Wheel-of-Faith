export function slicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (deg: number) => (deg - 90) * Math.PI / 180
  const x1 = cx + r * Math.cos(toRad(startDeg))
  const y1 = cy + r * Math.sin(toRad(startDeg))
  const x2 = cx + r * Math.cos(toRad(endDeg))
  const y2 = cy + r * Math.sin(toRad(endDeg))
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

export function equalSegmentAngles(count: number): Array<{ startDeg: number; endDeg: number; midDeg: number }> {
  const size = 360 / count
  return Array.from({ length: count }, (_, i) => ({
    startDeg: i * size,
    endDeg: (i + 1) * size,
    midDeg: i * size + size / 2,
  }))
}

// Distributes arc angles proportional to each segment's weight.
// Higher weight = larger slice; lower weight = smaller slice.
export function weightedSegmentAngles(
  segments: Array<{ weight: number }>
): Array<{ startDeg: number; endDeg: number; midDeg: number }> {
  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0)
  const result: Array<{ startDeg: number; endDeg: number; midDeg: number }> = []
  let cumDeg = 0
  for (const seg of segments) {
    const span = (seg.weight / totalWeight) * 360
    result.push({ startDeg: cumDeg, endDeg: cumDeg + span, midDeg: cumDeg + span / 2 })
    cumDeg += span
  }
  return result
}

export function calculateTargetAngle(
  currentRotation: number,
  targetIndex: number,
  totalSegments: number,
  minSpins = 5
): number {
  const segmentSize = 360 / totalSegments
  const segmentCenter = targetIndex * segmentSize + segmentSize / 2
  const currentMod = currentRotation % 360
  const delta = ((360 - segmentCenter) - currentMod + 360) % 360
  return currentRotation + (minSpins * 360) + delta
}
