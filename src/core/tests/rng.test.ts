import { describe, expect, it } from 'bun:test'
import { createRng, nextFloat, shuffle } from '../engine/rng'

describe('createRng / nextFloat', () => {
  it('determinism: two instances from the same seed produce identical 50-draw sequences', () => {
    const seed = 12345
    let stateA = createRng(seed)
    let stateB = createRng(seed)

    for (let i = 0; i < 50; i++) {
      const [valA, nextA] = nextFloat(stateA)
      const [valB, nextB] = nextFloat(stateB)
      expect(valA).toBe(valB)
      stateA = nextA
      stateB = nextB
    }
  })

  it('purity: calling nextFloat twice on the same state returns the same value', () => {
    const state = createRng(42)
    const [val1] = nextFloat(state)
    const [val2] = nextFloat(state)
    expect(val1).toBe(val2)
  })

  it('output range: 1000 draws all fall in [0, 1)', () => {
    let state = createRng(99)
    for (let i = 0; i < 1000; i++) {
      const [value, next] = nextFloat(state)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      state = next
    }
  })
})

describe('shuffle', () => {
  const deck = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  it('shuffle determinism: same seed + same array produces identical permutations', () => {
    const seed = 777
    const [shuffledA] = shuffle(deck, createRng(seed))
    const [shuffledB] = shuffle(deck, createRng(seed))
    expect(shuffledA).toEqual(shuffledB)
  })

  it('shuffle determinism: different seed produces a different permutation', () => {
    const [shuffledA] = shuffle(deck, createRng(1))
    const [shuffledB] = shuffle(deck, createRng(2))
    // With 10 items the chance of identical permutation is 1/10! ≈ 2.8e-7
    expect(shuffledA).not.toEqual(shuffledB)
  })

  it('shuffle purity: the input array is not modified', () => {
    const original = [...deck]
    shuffle(deck, createRng(555))
    expect(deck).toEqual(original)
  })
})
