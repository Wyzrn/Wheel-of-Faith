// Score range is [-20, 150]. Normalize so -20 → p=0.85 (weakest gets most help),
// 150 → p=0.05 (strongest needs least help).
export function redemptionProbability(overallScore: number): number {
  const normalized = (overallScore - (-20)) / (150 - (-20)) // 0 at -20, 1 at 150
  const p = 0.05 + 0.80 * Math.pow(1 - normalized, 2)
  return Math.max(0.05, Math.min(0.85, p))
}
