export function redemptionProbability(overallScore: number): number {
  const p = 0.05 + 0.80 * Math.pow(1 - overallScore / 100, 2)
  return Math.max(0.05, Math.min(0.85, p))
}
