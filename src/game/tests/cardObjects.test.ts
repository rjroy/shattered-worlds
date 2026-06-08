import { describe, it, expect } from 'bun:test'
import { updateCostRing, emphasizeCard, clearEmphasis, applyCardHighlight, createCardObject } from '../view/cardObjects'
import { selectTheme } from '../view/themes/themeManifest'
import type { PlayerCard } from '../../core/index'

// ---------------------------------------------------------------------------
// updateCostRing — fill/drain animation (S5)
//
// updateCostRing only touches a small, well-defined surface of Phaser: the ring
// Graphics' draw methods, plus scene.tweens.{killTweensOf, add}. We fake both so
// the animation logic (snap-on-first-render, idempotence, tween direction, the
// onUpdate/onComplete redraw) is tested deterministically without a real Phaser
// runtime or a real clock.
// ---------------------------------------------------------------------------

const RING_ACCENT = 0x88aaff

interface CapturedTween {
  targets: unknown
  displayedFraction: number
  duration: number
  ease: string
  onUpdate: () => void
  onComplete: () => void
}

/** A fake ring Graphics that records draw calls and arc end fractions. */
interface FakeRingState {
  displayedFraction: number | undefined
  arcs: number[]
  clears: number
}

function makeFakeRing(): {
  ring: FakeRingState
  graphics: unknown
} {
  const state = { displayedFraction: undefined as number | undefined, arcs: [] as number[], clears: 0 }
  const graphics = {
    get displayedFraction(): number | undefined {
      return state.displayedFraction
    },
    set displayedFraction(v: number | undefined) {
      state.displayedFraction = v
    },
    clear(): void {
      state.clears += 1
    },
    lineStyle(): void {},
    strokeCircle(): void {},
    fillStyle(): void {},
    fillCircle(): void {},
    beginPath(): void {},
    // The arc's end angle encodes the drawn fraction: end = -π/2 + frac*2π.
    arc(_x: number, _y: number, _r: number, _start: number, end: number): void {
      const frac = (end + Math.PI / 2) / (Math.PI * 2)
      state.arcs.push(frac)
    },
    strokePath(): void {},
  }
  return { ring: state, graphics }
}

/**
 * A fake scene.tweens that captures the tween config, counts kills, and records
 * an ordered call-log. The log lets tests assert the kill-before-add contract:
 * an in-flight tween must be cancelled (killTweensOf) before a new one is added,
 * on the same target. A bare kill counter would still pass if someone reordered
 * `add` before `killTweensOf`, so the ordered log is the real guard.
 */
function makeFakeScene(): {
  scene: unknown
  captured: CapturedTween[]
  callLog: ('kill' | 'add')[]
  kills: number
} {
  const captured: CapturedTween[] = []
  const callLog: ('kill' | 'add')[] = []
  let kills = 0
  const scene = {
    tweens: {
      killTweensOf(): void {
        kills += 1
        callLog.push('kill')
      },
      add(config: CapturedTween): CapturedTween {
        captured.push(config)
        callLog.push('add')
        return config
      },
    },
  }
  return {
    scene,
    captured,
    callLog,
    get kills(): number {
      return kills
    },
  }
}

function makeContainer(graphics: unknown): unknown {
  return { costRing: graphics }
}

/** Fetch the nth captured tween, asserting it exists (keeps strict types happy). */
function nthTween(captured: CapturedTween[], i: number): CapturedTween {
  const t = captured[i]
  if (t === undefined) throw new Error(`expected a captured tween at index ${i}`)
  return t
}

describe('updateCostRing', () => {
  it('no-ops on a container without a costRing (player card)', () => {
    const { scene, captured } = makeFakeScene()
    // No throw, no tween.
    updateCostRing(scene as never, {} as never, 0.5, RING_ACCENT)
    expect(captured.length).toBe(0)
  })

  it('snaps (no tween) on first render and records the displayed fraction', () => {
    const { ring, graphics } = makeFakeRing()
    const { scene, captured, callLog } = makeFakeScene()
    updateCostRing(scene as never, makeContainer(graphics) as never, 0.5, RING_ACCENT)

    expect(captured.length).toBe(0) // snapped, did not animate
    expect(callLog).not.toContain('add') // snap never adds a tween
    expect(ring.displayedFraction).toBe(0.5)
    expect(ring.arcs.at(-1)).toBeCloseTo(0.5, 5)
  })

  it('is idempotent: a repeated identical target does not start a tween', () => {
    const { ring, graphics } = makeFakeRing()
    const { scene, captured, callLog } = makeFakeScene()
    updateCostRing(scene as never, makeContainer(graphics) as never, 0.5, RING_ACCENT) // first: snap
    updateCostRing(scene as never, makeContainer(graphics) as never, 0.5, RING_ACCENT) // same target

    expect(captured.length).toBe(0)
    expect(callLog).not.toContain('add') // idempotent repeat never adds a tween
    expect(ring.displayedFraction).toBe(0.5)
  })

  it('animates (kills then adds) when the target differs, targeting the ring object', () => {
    const { ring, graphics } = makeFakeRing()
    const fake = makeFakeScene()
    updateCostRing(fake.scene as never, makeContainer(graphics) as never, 0.25, RING_ACCENT) // snap to 0.25
    updateCostRing(fake.scene as never, makeContainer(graphics) as never, 0.75, RING_ACCENT) // animate up

    expect(fake.kills).toBe(1)
    expect(fake.captured.length).toBe(1)
    // The kill-before-add contract: the in-flight tween must be cancelled
    // before the new one is added. This fails if production reorders `add`
    // ahead of `killTweensOf`.
    expect(fake.callLog).toEqual(['kill', 'add'])
    expect(fake.callLog.indexOf('kill')).toBeLessThan(fake.callLog.indexOf('add'))
    const t = nthTween(fake.captured, 0)
    // Must target the ring Graphics itself so the S3 destruction pass
    // (killTweensOf(container.list)) can cancel it before destroy.
    expect(t.targets).toBe(graphics)
    expect(t.displayedFraction).toBe(0.75)
    // displayed fraction is still the pre-tween value until the tween runs.
    expect(ring.displayedFraction).toBe(0.25)
  })

  it('fill and drain use the same duration and easing (one clock)', () => {
    const { graphics } = makeFakeRing()
    const fake = makeFakeScene()
    updateCostRing(fake.scene as never, makeContainer(graphics) as never, 0, RING_ACCENT) // snap to 0
    updateCostRing(fake.scene as never, makeContainer(graphics) as never, 1, RING_ACCENT) // fill 0 -> 1
    // Simulate the fill tween finishing (real Phaser advances displayedFraction
    // to the target); only then does the next cycle see a different displayed
    // value to drain from.
    nthTween(fake.captured, 0).onComplete()
    updateCostRing(fake.scene as never, makeContainer(graphics) as never, 0, RING_ACCENT) // drain 1 -> 0

    expect(fake.captured.length).toBe(2)
    const fill = nthTween(fake.captured, 0)
    const drain = nthTween(fake.captured, 1)
    expect(fill.duration).toBe(drain.duration)
    expect(fill.ease).toBe(drain.ease)
    expect(fill.displayedFraction).toBe(1)
    expect(drain.displayedFraction).toBe(0)
  })

  it('onUpdate redraws the arc at the current displayed fraction', () => {
    const { ring, graphics } = makeFakeRing()
    const fake = makeFakeScene()
    updateCostRing(fake.scene as never, makeContainer(graphics) as never, 0, RING_ACCENT)
    updateCostRing(fake.scene as never, makeContainer(graphics) as never, 1, RING_ACCENT)
    const t = nthTween(fake.captured, 0)

    // Simulate the tween engine advancing the property and ticking onUpdate.
    ring.displayedFraction = 0.4
    t.onUpdate()
    expect(ring.arcs.at(-1)).toBeCloseTo(0.4, 5)
  })

  it('onComplete settles exactly on target', () => {
    const { ring, graphics } = makeFakeRing()
    const fake = makeFakeScene()
    updateCostRing(fake.scene as never, makeContainer(graphics) as never, 0, RING_ACCENT)
    updateCostRing(fake.scene as never, makeContainer(graphics) as never, 1, RING_ACCENT)
    const t = nthTween(fake.captured, 0)

    // Float drift mid-tween, then complete: must land exactly on target.
    ring.displayedFraction = 0.999_7
    t.onComplete()
    expect(ring.displayedFraction).toBe(1)
    expect(ring.arcs.at(-1)).toBeCloseTo(1, 5)
  })
})

// ---------------------------------------------------------------------------
// emphasizeCard / clearEmphasis — hover-target emphasis (S9)
//
// The helper touches a tiny Phaser surface: container.setScale / .add, plus a
// glow Graphics' draw methods. We fake both so the lift-and-glow logic (scale
// > 1, glow alpha scaled by intensity, idempotence, restore-to-base) is tested
// without a real Phaser runtime.
// ---------------------------------------------------------------------------

const GLOW_COLOR = 0x88ffaa

interface FakeGlow {
  alphas: number[]
  clears: number
  visible: boolean
}

/** A fake glow Graphics recording stroke alpha, clears, and visibility. */
function makeFakeGlow(): { state: FakeGlow; graphics: unknown } {
  const state: FakeGlow = { alphas: [], clears: 0, visible: false }
  const graphics = {
    clear(): void {
      state.clears += 1
    },
    lineStyle(_width: number, _color: number, alpha: number): void {
      state.alphas.push(alpha)
    },
    strokeRoundedRect(): void {},
    setVisible(v: boolean): unknown {
      state.visible = v
      return graphics
    },
  }
  return { state, graphics }
}

/**
 * A fake container: records scale, captures added children, and exposes the
 * mutable `targetGlow`/`emphasized` props the helper stamps on it. `scene.add.graphics`
 * returns the supplied fake glow so the test can inspect what was drawn.
 */
function makeFakeEmphasisContainer(glow: unknown): {
  scene: unknown
  container: { scale: number; targetGlow: unknown; emphasized: boolean | undefined; added: unknown[] }
} {
  const container = {
    scale: 1,
    added: [] as unknown[],
    targetGlow: undefined as unknown,
    emphasized: undefined as boolean | undefined,
    setScale(v: number): unknown {
      container.scale = v
      return container
    },
    add(child: unknown): unknown {
      container.added.push(child)
      return container
    },
  }
  const scene = { add: { graphics: (): unknown => glow } }
  return { scene, container }
}

describe('emphasizeCard / clearEmphasis', () => {
  it('lifts the card (scale > 1) and draws a glow when emphasized', () => {
    const { state: glow, graphics } = makeFakeGlow()
    const { scene, container } = makeFakeEmphasisContainer(graphics)
    emphasizeCard(scene as never, container as never, GLOW_COLOR, 0.5)

    expect(container.scale).toBeGreaterThan(1)
    expect(container.emphasized).toBe(true)
    expect(container.targetGlow).toBe(graphics) // glow stored on the container
    expect(container.added).toContain(graphics) // appended as a child (after list[0]/[1])
    expect(glow.visible).toBe(true)
    expect(glow.alphas.at(-1)).toBeGreaterThan(0)
  })

  it('scales glow alpha AND lift by intensity (loud at 1, calm-but-visible at 0)', () => {
    const low = makeFakeGlow()
    const lowC = makeFakeEmphasisContainer(low.graphics)
    emphasizeCard(lowC.scene as never, lowC.container as never, GLOW_COLOR, 0)

    const high = makeFakeGlow()
    const highC = makeFakeEmphasisContainer(high.graphics)
    emphasizeCard(highC.scene as never, highC.container as never, GLOW_COLOR, 1)

    // Higher intensity → larger lift and brighter glow.
    expect(highC.container.scale).toBeGreaterThan(lowC.container.scale)
    expect(high.state.alphas.at(-1)!).toBeGreaterThan(low.state.alphas.at(-1)!)
    // Even at intensity 0 the emphasis is clearly on (scale > 1, alpha > 0).
    expect(lowC.container.scale).toBeGreaterThan(1)
    expect(low.state.alphas.at(-1)!).toBeGreaterThan(0)
  })

  it('is idempotent: re-emphasizing an already-emphasized card does not redraw', () => {
    const { state: glow, graphics } = makeFakeGlow()
    const { scene, container } = makeFakeEmphasisContainer(graphics)
    emphasizeCard(scene as never, container as never, GLOW_COLOR, 1)
    const drawsAfterFirst = glow.alphas.length
    emphasizeCard(scene as never, container as never, GLOW_COLOR, 1) // same call again
    expect(glow.alphas.length).toBe(drawsAfterFirst) // no second draw → no jitter
  })

  it('clearEmphasis restores base transform (scale 1, glow hidden/cleared)', () => {
    const { state: glow, graphics } = makeFakeGlow()
    const { scene, container } = makeFakeEmphasisContainer(graphics)
    emphasizeCard(scene as never, container as never, GLOW_COLOR, 1)
    const clearsBefore = glow.clears

    clearEmphasis(container as never)
    expect(container.scale).toBe(1)
    expect(container.emphasized).toBe(false)
    expect(glow.visible).toBe(false)
    expect(glow.clears).toBeGreaterThan(clearsBefore) // glow was cleared
  })

  it('clearEmphasis is safe on a never-emphasized container (no glow)', () => {
    const { scene: _scene, container } = makeFakeEmphasisContainer(makeFakeGlow().graphics)
    clearEmphasis(container as never) // never emphasized → targetGlow undefined
    expect(container.scale).toBe(1)
    expect(container.emphasized).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// applyCardHighlight — list[1] stroke/fill styling (S10 'committed' kind)
//
// applyCardHighlight touches only the list[1] overlay rectangle's
// setStrokeStyle / setFillStyle. We fake the rectangle and the container's
// `list` array so the per-kind styling (and the committed-fill reset) is tested
// without a real Phaser runtime.
// ---------------------------------------------------------------------------

interface FakeRect {
  strokeWidth: number
  strokeColor: number
  fillColor: number
  fillAlpha: number
}

function makeFakeHighlightContainer(): { container: unknown; rect: FakeRect } {
  const rect: FakeRect = { strokeWidth: 0, strokeColor: 0, fillColor: 0x000000, fillAlpha: 0 }
  const rectObj = {
    setStrokeStyle(width: number, color?: number): unknown {
      rect.strokeWidth = width
      rect.strokeColor = color ?? 0
      return rectObj
    },
    setFillStyle(color: number, alpha?: number): unknown {
      rect.fillColor = color
      rect.fillAlpha = alpha ?? 1
      return rectObj
    },
  }
  // list[0] is the cardfront image (irrelevant here); list[1] is the overlay.
  const container = { list: [{}, rectObj] }
  return { container, rect }
}

describe("applyCardHighlight 'committed' kind", () => {
  const fs = selectTheme('zombie-big-box').frameStyle

  it('strokes the list[1] rect with the muted committedTarget colour, not the bright target border', () => {
    const { container, rect } = makeFakeHighlightContainer()
    applyCardHighlight(container as never, 'committed', fs)
    expect(rect.strokeColor).toBe(fs.committedTarget)
    expect(rect.strokeColor).not.toBe(fs.targetBorder) // visually distinct from a live legal target
    expect(rect.strokeWidth).toBeGreaterThan(0)
  })

  it('adds a faint committedTarget fill so the mark reads as steady/settled', () => {
    const { container, rect } = makeFakeHighlightContainer()
    applyCardHighlight(container as never, 'committed', fs)
    expect(rect.fillColor).toBe(fs.committedTarget)
    expect(rect.fillAlpha).toBeGreaterThan(0)
    expect(rect.fillAlpha).toBeLessThan(1) // muted, not a solid block
  })

  it("clears any prior committed fill when re-applied as another kind (no stale tint)", () => {
    const { container, rect } = makeFakeHighlightContainer()
    applyCardHighlight(container as never, 'committed', fs) // tints the fill
    applyCardHighlight(container as never, 'target', fs) // reused container, new state
    expect(rect.fillAlpha).toBe(0) // committed tint cleared
    expect(rect.strokeColor).toBe(fs.targetBorder)
  })

  it("'target' uses the bright targetBorder, distinct from committed", () => {
    const { container, rect } = makeFakeHighlightContainer()
    applyCardHighlight(container as never, 'target', fs)
    expect(rect.strokeColor).toBe(fs.targetBorder)
    expect(rect.fillAlpha).toBe(0) // legal-target border has no fill
  })
})

// ---------------------------------------------------------------------------
// createCardObject — energy cost badge for player cards (Step 8)
//
// Player cards with energyCost > 0 render a badge (filled circle + digit).
// Cost-0 cards have no badge. The badge is appended AFTER list[0] and list[1]
// to preserve the applyCardHighlight contract.
// ---------------------------------------------------------------------------

/**
 * A fake Phaser scene sufficient to test createCardObject. Records children
 * added to the container in container.list.
 */
function makeFakeCardScene(): {
  scene: unknown
  added: unknown[]
  container: { list: unknown[] } | undefined
} {
  const containerRef: { list: unknown[] } = { list: [] }

  const scene = {
    add: {
      container(_x: number, _y: number): unknown {
        return {
          list: containerRef.list,
          add(child: unknown): unknown {
            containerRef.list.push(child)
            return this
          },
        }
      },
      image(_x: number, _y: number, _key: string): unknown {
        return {
          setDisplaySize(_w: number, _h: number): unknown { return this },
        }
      },
      rectangle(_x: number, _y: number, _w: number, _h: number, _color: number, _alpha: number): unknown {
        return {
          setStrokeStyle(_width: number): unknown { return this },
          setRounded(_radius: number): unknown { return this },
          setAlpha(_a: number): unknown { return this },
          setOrigin(_x: number, _y: number): unknown { return this },
        }
      },
      graphics(): unknown {
        return {
          setPosition(_x: number, _y: number): unknown { return this },
          fillStyle(_color: number, _alpha: number): unknown { return this },
          fillCircle(_x: number, _y: number, _radius: number): unknown { return this },
        }
      },
      text(_x: number, _y: number, _text: string, _style: unknown): unknown {
        return {
          setOrigin(_x: number, _y: number): unknown { return this },
          setText(_text: string): unknown { return this },
          setAbove(_obj: unknown): unknown { return this },
          height: 12,
          getWrappedText(text: string): string[] { return [text] },
        }
      },
    },
  }

  return { scene, added: containerRef.list, container: { list: containerRef.list } }
}

describe('createCardObject — player card energy cost badge', () => {
  const theme = selectTheme('zombie-big-box')
  const resolveTheme = (_worldId: string): typeof theme => theme

  it('cost-1 player cards add more children to the container than cost-0 (badge icon + badge text)', () => {
    const baseCard: PlayerCard = {
      kind: 'player',
      id: 'test-base',
      name: 'Card',
      insetKey: undefined,
      sourceWorldId: 'zombie-big-box',
      effect: { kind: 'Heal', amount: 1 },
      energyCost: 0,
    }

    const { scene: scene0, added: added0 } = makeFakeCardScene()
    createCardObject(scene0 as never, { ...baseCard, energyCost: 0 }, 0, 0, theme, resolveTheme)
    const count0 = added0.length

    const { scene: scene1, added: added1 } = makeFakeCardScene()
    createCardObject(scene1 as never, { ...baseCard, energyCost: 1, id: 'test-1' }, 0, 0, theme, resolveTheme)
    const count1 = added1.length

    // Badge adds 1 image + addCardText without a background = 3 extra children
    expect(count1 - count0).toBe(3)
  })

  it('cost-0 player cards add fewer children than cost-1 (no badge)', () => {
    const cost0Card: PlayerCard = {
      kind: 'player', id: 'test-0', name: 'NoBadge', insetKey: undefined,
      sourceWorldId: 'zombie-big-box', effect: { kind: 'Draw', player: 1 }, energyCost: 0,
    }
    const cost1Card: PlayerCard = {
      kind: 'player', id: 'test-1', name: 'WithBadge', insetKey: undefined,
      sourceWorldId: 'zombie-big-box', effect: { kind: 'Draw', player: 1 }, energyCost: 1,
    }

    const { scene: s0, added: a0 } = makeFakeCardScene()
    createCardObject(s0 as never, cost0Card, 0, 0, theme, resolveTheme)

    const { scene: s1, added: a1 } = makeFakeCardScene()
    createCardObject(s1 as never, cost1Card, 0, 0, theme, resolveTheme)

    expect(a0.length).toBeLessThan(a1.length)
  })

  it('cost-1 player cards add more children than cost-0 (badge present)', () => {
    const cost0Card: PlayerCard = {
      kind: 'player', id: 'test-0', name: 'NoBadge', insetKey: undefined,
      sourceWorldId: 'zombie-big-box', effect: { kind: 'Draw', player: 1 }, energyCost: 0,
    }
    const cost1Card: PlayerCard = {
      kind: 'player', id: 'test-1', name: 'WithBadge', insetKey: undefined,
      sourceWorldId: 'zombie-big-box', effect: { kind: 'Draw', player: 1 }, energyCost: 1,
    }

    const { scene: s0, added: a0 } = makeFakeCardScene()
    createCardObject(s0 as never, cost0Card, 0, 0, theme, resolveTheme)

    const { scene: s1, added: a1 } = makeFakeCardScene()
    createCardObject(s1 as never, cost1Card, 0, 0, theme, resolveTheme)

    expect(a1.length).toBeGreaterThan(a0.length)
  })
})
