import { describe, it, expect } from 'bun:test'
import { positionToValue, valueToPosition } from '../view/VolumeSlider'

// ---------------------------------------------------------------------------
// Pure slider math — unit-tested without any Phaser objects.
// ---------------------------------------------------------------------------

describe('positionToValue', () => {
  it('returns 0 at the left edge', () => {
    expect(positionToValue(10, 10, 210)).toBe(0)
  })

  it('returns 1 at the right edge', () => {
    expect(positionToValue(210, 10, 210)).toBe(1)
  })

  it('returns 0.5 at the midpoint', () => {
    expect(positionToValue(110, 10, 210)).toBe(0.5)
  })

  it('clamps below-track positions to 0', () => {
    expect(positionToValue(-50, 10, 210)).toBe(0)
    expect(positionToValue(0, 10, 210)).toBe(0)
    expect(positionToValue(9, 10, 210)).toBeCloseTo(0, 5)
  })

  it('clamps above-track positions to 1', () => {
    expect(positionToValue(999, 10, 210)).toBe(1)
    expect(positionToValue(300, 10, 210)).toBe(1)
  })

  it('maps 25% along the track to 0.25', () => {
    // startX + 0.25 * (endX - startX) = 10 + 0.25 * 200 = 10 + 50 = 60
    expect(positionToValue(60, 10, 210)).toBeCloseTo(0.25, 5)
  })

  it('returns three-quarter value for 75% along the track', () => {
    // startX + 0.75 * (endX - startX) = 10 + 0.75 * 200 = 10 + 150 = 160
    expect(positionToValue(160, 10, 210)).toBeCloseTo(0.75, 5)
  })
})

describe('valueToPosition', () => {
  it('returns startX for value 0', () => {
    expect(valueToPosition(0, 10, 210)).toBe(10)
  })

  it('returns endX for value 1', () => {
    expect(valueToPosition(1, 10, 210)).toBe(210)
  })

  it('returns midpoint for value 0.5', () => {
    expect(valueToPosition(0.5, 10, 210)).toBe(110)
  })

  it('maps intermediate values proportionally', () => {
    expect(valueToPosition(0.25, 10, 210)).toBeCloseTo(60, 5)
    expect(valueToPosition(0.75, 10, 210)).toBeCloseTo(160, 5)
  })

  it('is the inverse of positionToValue within [0,1]', () => {
    const startX = 50
    const endX = 300
    for (let v = 0; v <= 1.0; v += 0.1) {
      const clamped = Math.round(v * 10) / 10
      const pos = valueToPosition(clamped, startX, endX)
      const back = positionToValue(pos, startX, endX)
      expect(back).toBeCloseTo(clamped, 4)
    }
  })

  it('is the inverse of valueToPosition within valid range', () => {
    const startX = 0
    const endX = 100
    for (let x = 0; x <= 100; x += 10) {
      const v = positionToValue(x, startX, endX)
      const back = valueToPosition(v, startX, endX)
      expect(back).toBeCloseTo(x, 4)
    }
  })
})
