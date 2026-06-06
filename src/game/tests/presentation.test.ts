/**
 * Tests for the pure presentation layer.
 *
 * Every function under test here decides HOW something looks and returns plain
 * data — none constructs or mutates a Phaser object. The module imports Phaser
 * as a type only, so these tests do NOT need the DOM preload: they pass even
 * when run with a bare `bun test src/game/presentation.test.ts` (no
 * `--preload`). That property is the reason this module exists; keep it true.
 */
import { describe, it, expect } from 'bun:test'
import {
  selectCardFrontKey,
  clampUnit,
  highlightDescriptor,
  costRingArc,
  emphasisDescriptor,
} from '../view/presentation'
import { selectTheme } from '../view/theme'
import type { PlayerCard, WorldCard } from '../../core/index'
import type { VisualTheme } from '../view/theme'

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const playerCardZombie: PlayerCard = {
  kind: 'player',
  id: '1',
  name: 'Sprint',
  insetKey: undefined,
  sourceWorldId: 'zombie-big-box',
  effect: { kind: 'Draw', player: 1 },
}

const playerCardUnknown: PlayerCard = {
  kind: 'player',
  id: '2',
  name: 'Explore',
  insetKey: undefined,
  sourceWorldId: 'unknown-world',
  effect: { kind: 'Draw', player: 1 },
}

const worldCard: WorldCard = {
  kind: 'world',
  id: '3',
  name: 'The Horde',
  insetKey: undefined,
  cost: 3,
  keywords: [],
  discardable: false,
  onDiscarded: { kind: 'None' },
  onCleared: { kind: 'None' },
  onEndOfTurn: { kind: 'None' },
}

const activeThemeWithFront: VisualTheme = {
  ...selectTheme('zombie-big-box'),
  worldCardfrontKey: 'zombie-cardfront',
}

const { worldCardfrontKey: _wck, ...themeBase } = selectTheme('zombie-big-box')
const activeThemeNoFront: VisualTheme = themeBase

// ---------------------------------------------------------------------------
// selectCardFrontKey
// ---------------------------------------------------------------------------

describe('selectCardFrontKey', () => {
  it('returns the active theme worldCardfrontKey for a world card', () => {
    const key = selectCardFrontKey(worldCard, activeThemeWithFront, selectTheme)
    expect(key).toBe('zombie-cardfront')
  })

  it('falls back to "cardfront" for a world card when activeTheme has no worldCardfrontKey', () => {
    const key = selectCardFrontKey(worldCard, activeThemeNoFront, selectTheme)
    expect(key).toBe('cardfront')
  })

  it('returns "cardfront" for a player card with zombie sourceWorldId, never the world-specific front', () => {
    // The zombie theme has worldCardfrontKey: 'zombie-cardfront', but player
    // cards must never use it — they always use the generic front.
    const key = selectCardFrontKey(playerCardZombie, activeThemeWithFront, selectTheme)
    expect(key).toBe('cardfront')
    expect(key).not.toBe('zombie-cardfront')
  })

  it('returns "cardfront" for a player card with an unknown sourceWorldId (no throw)', () => {
    // selectTheme falls back gracefully for unregistered worlds.
    const key = selectCardFrontKey(playerCardUnknown, activeThemeNoFront, selectTheme)
    expect(key).toBe('cardfront')
  })
})

// ---------------------------------------------------------------------------
// clampUnit
// ---------------------------------------------------------------------------

describe('clampUnit', () => {
  it('passes values already inside [0, 1] through unchanged', () => {
    expect(clampUnit(0)).toBe(0)
    expect(clampUnit(0.42)).toBe(0.42)
    expect(clampUnit(1)).toBe(1)
  })

  it('clamps values below 0 up to 0 and above 1 down to 1', () => {
    expect(clampUnit(-0.5)).toBe(0)
    expect(clampUnit(2)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// highlightDescriptor
// ---------------------------------------------------------------------------

describe('highlightDescriptor', () => {
  const fs = selectTheme('zombie-big-box').frameStyle

  it('strokes selected/target/discard at width 3 with their frame colours and no fill', () => {
    for (const [kind, color] of [
      ['selected', fs.selectedBorder],
      ['target', fs.targetBorder],
      ['discard', fs.discardBorder],
    ] as const) {
      const d = highlightDescriptor(kind, fs)
      expect(d.strokeWidth).toBe(3)
      expect(d.strokeColor).toBe(color)
      expect(d.fillAlpha).toBe(0) // no fill on a live border state
    }
  })

  it('marks committed with the muted committedTarget colour and a faint matching fill', () => {
    const d = highlightDescriptor('committed', fs)
    expect(d.strokeColor).toBe(fs.committedTarget)
    expect(d.strokeColor).not.toBe(fs.targetBorder) // visually distinct from a live target
    expect(d.strokeWidth).toBeGreaterThan(0)
    expect(d.fillColor).toBe(fs.committedTarget)
    expect(d.fillAlpha).toBeGreaterThan(0)
    expect(d.fillAlpha).toBeLessThan(1) // muted, not a solid block
  })

  it('clears stroke and fill for none (width 0, transparent fill)', () => {
    const d = highlightDescriptor('none', fs)
    expect(d.strokeWidth).toBe(0)
    expect(d.fillAlpha).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// costRingArc
// ---------------------------------------------------------------------------

describe('costRingArc', () => {
  it('starts the sweep at the top of the circle (−π/2)', () => {
    expect(costRingArc(0.5).start).toBeCloseTo(-Math.PI / 2, 10)
  })

  it('sweeps clamped × 2π clockwise from the start angle', () => {
    const { start, end } = costRingArc(0.25)
    expect(end - start).toBeCloseTo(0.25 * Math.PI * 2, 10)
  })

  it('clamps the fraction into [0, 1] before computing the sweep', () => {
    expect(costRingArc(2).clamped).toBe(1)
    expect(costRingArc(-1).clamped).toBe(0)
    const full = costRingArc(2)
    expect(full.end - full.start).toBeCloseTo(Math.PI * 2, 10) // a full circle
  })

  it('yields no visible sweep at fraction 0 (start === end)', () => {
    const z = costRingArc(0)
    expect(z.clamped).toBe(0)
    expect(z.end).toBeCloseTo(z.start, 10)
  })
})

// ---------------------------------------------------------------------------
// emphasisDescriptor
// ---------------------------------------------------------------------------

describe('emphasisDescriptor', () => {
  it('is clearly on even at intensity 0 (scale > 1, glow alpha > 0)', () => {
    const d = emphasisDescriptor(0)
    expect(d.scale).toBeGreaterThan(1)
    expect(d.glowAlpha).toBeGreaterThan(0)
  })

  it('grows both lift and glow alpha with intensity', () => {
    const low = emphasisDescriptor(0)
    const high = emphasisDescriptor(1)
    expect(high.scale).toBeGreaterThan(low.scale)
    expect(high.glowAlpha).toBeGreaterThan(low.glowAlpha)
  })

  it('keeps glow alpha within a visible, non-opaque range at full intensity', () => {
    const d = emphasisDescriptor(1)
    expect(d.glowAlpha).toBeGreaterThan(0)
    expect(d.glowAlpha).toBeLessThanOrEqual(1)
  })

  it('clamps out-of-range intensity to the [0, 1] endpoints', () => {
    expect(emphasisDescriptor(-5)).toEqual(emphasisDescriptor(0))
    expect(emphasisDescriptor(5)).toEqual(emphasisDescriptor(1))
  })
})
