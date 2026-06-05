import { describe, expect, it } from 'bun:test'
import { walkerPresentation } from './walker'
import { walkerProximityForAct } from './visualMappers'
import type { GameState } from '../core/index'

function makeState(
  hand: Array<{ name: string }>,
  actIndex: number,
): Pick<GameState, 'hand' | 'actIndex'> & Partial<GameState> {
  return {
    hand: hand as unknown as GameState['hand'],
    actIndex,
    playerDraw: [], playerDiscard: [], worldDraw: [], acts: [],
    progress: {}, hp: 20, skipDrawNext: false, status: 'playing',
    rng: { a: 0, b: 0, c: 0, d: 0 }, nextId: 0, worldId: 'zombie-big-box',
  }
}

describe('walkerPresentation', () => {
  describe('hasWalker = false', () => {
    it('returns hidden regardless of hand contents', () => {
      const state = makeState([], 0)
      expect(walkerPresentation(state as GameState, false)).toEqual({ kind: 'hidden' })
    })

    it('returns hidden even when The Walker is in hand', () => {
      const state = makeState([{ name: 'The Walker' }], 1)
      expect(walkerPresentation(state as GameState, false)).toEqual({ kind: 'hidden' })
    })
  })

  describe('Walker in hand (hasWalker = true)', () => {
    it('returns foreground when The Walker is the only card in hand', () => {
      const state = makeState([{ name: 'The Walker' }], 0)
      expect(walkerPresentation(state as GameState, true)).toEqual({ kind: 'foreground', proximity: { size: 400, alpha: 1.0 } })
    })

    it('returns foreground when The Walker is among other cards', () => {
      const state = makeState([{ name: 'Sprint' }, { name: 'The Walker' }, { name: 'Zombie' }], 1)
      expect(walkerPresentation(state as GameState, true)).toEqual({ kind: 'foreground', proximity: { size: 400, alpha: 1.0 } })
    })

    it('returns foreground even at act 2 (Walker in hand overrides act tier)', () => {
      const state = makeState([{ name: 'The Walker' }], 2)
      expect(walkerPresentation(state as GameState, true)).toEqual({ kind: 'foreground', proximity: { size: 400, alpha: 1.0 } })
    })
  })

  describe('Walker not in hand (hasWalker = true)', () => {
    it('returns proximity when hand is empty', () => {
      const state = makeState([], 0)
      const result = walkerPresentation(state as GameState, true)
      expect(result.kind).toBe('proximity')
    })

    it('returns proximity when hand has cards but none named The Walker', () => {
      const state = makeState([{ name: 'Sprint' }, { name: 'Barricade' }], 1)
      const result = walkerPresentation(state as GameState, true)
      expect(result.kind).toBe('proximity')
    })

    it('act 0 proximity matches walkerProximityForAct(0) — far tier', () => {
      const state = makeState([], 0)
      const result = walkerPresentation(state as GameState, true)
      expect(result).toEqual({ kind: 'proximity', proximity: walkerProximityForAct(0) })
      // far: small, barely visible
      if (result.kind === 'proximity') {
        expect(result.proximity.size).toBe(75)
        expect(result.proximity.alpha).toBe(0.35)
      }
    })

    it('act 1 proximity matches walkerProximityForAct(1) — mid tier', () => {
      const state = makeState([], 1)
      const result = walkerPresentation(state as GameState, true)
      expect(result).toEqual({ kind: 'proximity', proximity: walkerProximityForAct(1) })
      if (result.kind === 'proximity') {
        expect(result.proximity.size).toBe(175)
        expect(result.proximity.alpha).toBe(0.60)
      }
    })

    it('act 2 proximity matches walkerProximityForAct(2) — looming tier', () => {
      const state = makeState([], 2)
      const result = walkerPresentation(state as GameState, true)
      expect(result).toEqual({ kind: 'proximity', proximity: walkerProximityForAct(2) })
      if (result.kind === 'proximity') {
        expect(result.proximity.size).toBe(300)
        expect(result.proximity.alpha).toBe(0.85)
      }
    })

    it('act index beyond 2 clamps to looming tier', () => {
      const state = makeState([], 5)
      const result = walkerPresentation(state as GameState, true)
      expect(result).toEqual({ kind: 'proximity', proximity: walkerProximityForAct(2) })
    })
  })
})
