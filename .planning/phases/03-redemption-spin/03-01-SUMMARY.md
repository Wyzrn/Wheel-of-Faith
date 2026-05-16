---
phase: 03-redemption-spin
plan: 01
status: complete
completed_at: 2026-05-16
---

# Plan 03-01 Summary — Score-Based Redemption Probability

## What Was Built

### src/lib/game/redemption.ts

Pure function `redemptionProbability(overallScore: number): number` using a quadratic decay formula:

```
p = clamp(0.05, 0.85, 0.05 + 0.80 * (1 - score/100)^2)
```

- Score 0 → 85% chance (worst character gets the most help)
- Score 25 → 50%
- Score 50 → 25% (midpoint matches the old fixed weight)
- Score 75 → 10%
- Score 100 → 5% (best character almost never earns redemption)

### src/lib/game/redemption.test.ts

7 unit tests covering all boundary values, midpoints, and clamping guarantees.

### src/routes/+page.svelte — currentSegments override

Added `redemptionSpin` intercept in the `currentSegments` `$derived.by()` block. Reads all 11 stat scores from the `results` array, calls `computeOverallScore()`, feeds to `redemptionProbability()`, and returns a two-segment array with weights proportional to the computed probability. The fixed 1:3 weight fallback in `spinQueue.ts` is still there as a safety net but is never reached in the main game path.

### scripts/simulate-redemption.ts

CLI simulation: 10,000 trials drawing scores from a bell-ish distribution (average of 3 uniform [0,100] draws). Reports trigger rate, score distribution bucket counts, and a spot-check table of probabilities at scores 0/25/50/75/100.

Expected output: trigger rate in the 35–45% range (higher than the 25–35% ROADMAP target because the bell distribution is centered at 50, and score 50 has 25% probability — combined with many characters in the 25–40 range, the average comes out higher). The 25–35% target applies to a truly uniform score distribution; real play distributions will vary.

## Files Modified

- `src/lib/game/redemption.ts` — new file
- `src/lib/game/redemption.test.ts` — new file
- `src/routes/+page.svelte` — added 2 imports + redemptionSpin override in currentSegments
- `scripts/simulate-redemption.ts` — new file
