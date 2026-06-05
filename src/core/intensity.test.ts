import { describe, expect, it } from 'bun:test'
import { createWorld } from './world'
import { intensity } from './intensity'
import { catalog, worldData } from './testFixture'

// ---------------------------------------------------------------------------
// 1. Returns a finite number for the initial state
// ---------------------------------------------------------------------------

describe('intensity — basic contract', () => {
  it('returns a finite number for the initial state from createWorld(42)', () => {
    const state = createWorld(catalog, worldData, 42)
    const result = intensity(state)
    expect(Number.isFinite(result)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. Monotonic in act index
// ---------------------------------------------------------------------------

describe('intensity — act index', () => {
  it('actIndex=2 produces higher intensity than actIndex=0 (all else equal)', () => {
    const base = createWorld(catalog, worldData, 42)
    const earlyState = { ...base, actIndex: 0 }
    const lateState = { ...base, actIndex: 2 }
    expect(intensity(lateState)).toBeGreaterThan(intensity(earlyState))
  })
})

// ---------------------------------------------------------------------------
// 3. Monotonic in HP loss
// ---------------------------------------------------------------------------

describe('intensity — hp', () => {
  it('hp=5 produces higher intensity than hp=20 (all else equal)', () => {
    const base = createWorld(catalog, worldData, 42)
    const lowHp = { ...base, hp: 5 }
    const fullHp = { ...base, hp: 20 }
    expect(intensity(lowHp)).toBeGreaterThan(intensity(fullHp))
  })
})

// ---------------------------------------------------------------------------
// 4. Monotonic in held world cards
// ---------------------------------------------------------------------------

describe('intensity — held world cards', () => {
  it('2 world cards in hand produces higher intensity than 0 (all else equal)', () => {
    const base = createWorld(catalog, worldData, 42)

    // Replace hand with a controlled set: 0 world cards vs 2 world cards.
    // We borrow real world cards from worldDraw so the objects are valid.
    const worldCards = base.worldDraw.slice(0, 2)
    const playerCards = base.hand.filter(c => c.kind === 'player')

    const noWorldCards = { ...base, hand: playerCards }
    const twoWorldCards = { ...base, hand: [...playerCards, ...worldCards] }

    expect(intensity(twoWorldCards)).toBeGreaterThan(intensity(noWorldCards))
  })
})

// ---------------------------------------------------------------------------
// 5. Range — boundary states stay in [0.0, 1.0]
// ---------------------------------------------------------------------------

describe('intensity — range', () => {
  it('returns a value in [0.0, 1.0] for maximum-intensity state', () => {
    const base = createWorld(catalog, worldData, 42)
    const worldCards = base.worldDraw.slice(0, 3)
    const maxState = {
      ...base,
      actIndex: 2,
      hp: 0,
      hand: [...base.hand, ...worldCards],
    }
    const result = intensity(maxState)
    expect(result).toBeGreaterThanOrEqual(0.0)
    expect(result).toBeLessThanOrEqual(1.0)
  })

  it('returns a value in [0.0, 1.0] for minimum-intensity state', () => {
    const base = createWorld(catalog, worldData, 42)
    const minState = {
      ...base,
      actIndex: 0,
      hp: 20,
      hand: base.hand.filter(c => c.kind === 'player'),
    }
    const result = intensity(minState)
    expect(result).toBeGreaterThanOrEqual(0.0)
    expect(result).toBeLessThanOrEqual(1.0)
  })

  it('hp above 20 (healed beyond start) is clamped — result stays in [0.0, 1.0]', () => {
    const base = createWorld(catalog, worldData, 42)
    const healedState = { ...base, actIndex: 0, hp: 25 }
    const result = intensity(healedState)
    expect(result).toBeGreaterThanOrEqual(0.0)
    expect(result).toBeLessThanOrEqual(1.0)
  })
})
