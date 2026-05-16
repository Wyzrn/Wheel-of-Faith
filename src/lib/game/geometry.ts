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
