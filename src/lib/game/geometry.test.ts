import { describe, it, expect } from 'vitest'
import { slicePath, equalSegmentAngles, calculateTargetAngle } from './geometry'

describe('slicePath', () => {
  it('returns a non-empty string for standard inputs', () => {
    const result = slicePath(200, 200, 180, 0, 45)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('large-arc-flag is 1 when slice > 180°', () => {
    const result = slicePath(200, 200, 180, 0, 270)
    expect(result).toContain(' 1 1 ')
  })

  it('large-arc-flag is 0 when slice <= 180°', () => {
    const result = slicePath(200, 200, 180, 0, 180)
    expect(result).toContain(' 0 1 ')
  })
})

describe('equalSegmentAngles', () => {
  it('returns count items; first startDeg=0; last endDeg=360', () => {
    const segs = equalSegmentAngles(8)
    expect(segs).toHaveLength(8)
    expect(segs[0].startDeg).toBe(0)
    expect(segs[7].endDeg).toBeCloseTo(360, 5)
  })
})

describe('calculateTargetAngle', () => {
  it('returned value is always greater than currentRotation', () => {
    const result = calculateTargetAngle(0, 3, 8, 5)
    expect(result).toBeGreaterThan(0)
  })

  it('(returned value - currentRotation) >= minSpins * 360', () => {
    const result = calculateTargetAngle(0, 3, 8, 5)
    expect(result - 0).toBeGreaterThanOrEqual(5 * 360)
  })

  it('returns 2002.5 for index 3, 8 segments, from 0', () => {
    expect(calculateTargetAngle(0, 3, 8, 5)).toBeCloseTo(2002.5, 5)
  })
})
