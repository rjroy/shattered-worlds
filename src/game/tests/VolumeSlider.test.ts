import { describe, it, expect } from 'bun:test'
import { positionToValue, valueToPosition } from '../view/VolumeSlider'

describe('positionToValue', () => {
  const start = 100
  const end = 300 // track width = 200

  it('returns 0 at the left edge', () => {
    expect(positionToValue(start, start, end)).toBe(0)
  })

  it('returns 1 at the right edge', () => {
    expect(positionToValue(end, start, end)).toBe(1)
  })

  it('returns 0.5 at the midpoint', () => {
    expect(positionToValue(start + 100, start, end)).toBe(0.5)
  })

  it('clamps below-left to 0', () => {
    expect(positionToValue(0, start, end)).toBe(0)
    expect(positionToValue(50, start, end)).toBe(0)
  })

  it('clamps above-right to 1', () => {
    expect(positionToValue(500, start, end)).toBe(1)
    expect(positionToValue(350, start, end)).toBe(1)
  })

  it('produces proportional values within the range', () => {
    expect(positionToValue(120, start, end)).toBeCloseTo(0.1, 4)
    expect(positionToValue(160, start, end)).toBeCloseTo(0.3, 4)
    expect(positionToValue(280, start, end)).toBeCloseTo(0.9, 4)
  })

  it('works with negative coordinates', () => {
    expect(positionToValue(-100, -300, 100)).toBe(0.5)
  })
})

describe('valueToPosition', () => {
  const start = 100
  const end = 300 // width = 200

  it('returns startX at value 0', () => {
    expect(valueToPosition(0, start, end)).toBe(start)
  })

  it('returns endX at value 1', () => {
    expect(valueToPosition(1, start, end)).toBe(end)
  })

  it('returns midpoint at value 0.5', () => {
    expect(valueToPosition(0.5, start, end)).toBe(start + 100)
  })

  it('produces proportional coordinates', () => {
    expect(valueToPosition(0.25, start, end)).toBe(start + 50)
    expect(valueToPosition(0.75, start, end)).toBe(start + 150)
  })
})

describe('roundtrip', () => {
  const start = 50
  const end = 250 // width = 200

  it('value → position → value is identity (within tolerance)', () => {
    for (const v of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0]) {
      const pos = valueToPosition(v, start, end)
      const back = positionToValue(pos, start, end)
      expect(back).toBeCloseTo(v, 6)
    }
  })

  it('position → value → position is identity (within tolerance)', () => {
    for (const pos of [start, start + 50, start + 100, start + 150, end]) {
      const val = positionToValue(pos, start, end)
      const back = valueToPosition(val, start, end)
      expect(back).toBeCloseTo(pos, 6)
    }
  })
})
