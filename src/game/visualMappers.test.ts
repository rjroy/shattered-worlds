import { describe, expect, it } from 'bun:test'
import { intrusionForIntensity, walkerProximityForAct } from './visualMappers'

describe('intrusionForIntensity', () => {
  it('clamps: intensity 0 returns 0', () => {
    expect(intrusionForIntensity(0)).toBe(0)
  })

  it('clamps: large intensity clamped to [0,1] output', () => {
    expect(intrusionForIntensity(2)).toBeLessThanOrEqual(1)
    expect(intrusionForIntensity(-1)).toBeGreaterThanOrEqual(0)
  })

  it('is monotonically non-decreasing (property test over 100 pairs)', () => {
    const rng = (n: number) => (n * 9301 + 49297) % 233280 / 233280
    for (let i = 0; i < 100; i++) {
      const a = rng(i)
      const b = rng(i + 50)
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      const resultLo = intrusionForIntensity(lo)
      const resultHi = intrusionForIntensity(hi)
      expect(resultLo).toBeLessThanOrEqual(resultHi + 1e-10) // floating point tolerance
    }
  })
})

describe('walkerProximityForAct', () => {
  it('returns distinct values for each act tier', () => {
    const far = walkerProximityForAct(0)
    const mid = walkerProximityForAct(1)
    const looming = walkerProximityForAct(2)
    // Each tier is closer (larger size) than the previous
    expect(far.size).toBeLessThan(mid.size)
    expect(mid.size).toBeLessThan(looming.size)
    // Each tier is more visible (higher alpha)
    expect(far.alpha).toBeLessThan(mid.alpha)
    expect(mid.alpha).toBeLessThan(looming.alpha)
  })

  it('clamps out-of-range act indices', () => {
    expect(walkerProximityForAct(-1)).toEqual(walkerProximityForAct(0))
    expect(walkerProximityForAct(3)).toEqual(walkerProximityForAct(2))
    expect(walkerProximityForAct(99)).toEqual(walkerProximityForAct(2))
  })

  it('all values are in valid ranges', () => {
    for (let i = 0; i <= 2; i++) {
      const p = walkerProximityForAct(i)
      expect(p.size).toBeGreaterThan(0)
      expect(p.alpha).toBeGreaterThan(0)
      expect(p.alpha).toBeLessThanOrEqual(1)
    }
  })
})
