import { describe, it, expect } from 'bun:test'
import { CardView } from '../view/CardView'
import { selectTheme } from '../view/themes/themeManifest'
import { CARD_FACE } from '../view/layout'
import { mintCard } from '../../core/model/cards'
import { createRng } from '../../core/engine/rng'
import type { CardCatalog, GameState, PlayerCard } from '../../core/index'

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

interface CostRingCardViewFake {
  scene: unknown
  costRing?: unknown
  updateCostRing: CardView['updateCostRing']
}

function makeCardView(scene: unknown, graphics?: unknown): CostRingCardViewFake {
  const view = Object.create(CardView.prototype) as CostRingCardViewFake
  Object.defineProperty(view, 'scene', { value: scene })
  if (graphics !== undefined) view.costRing = graphics
  return view
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
    makeCardView(scene).updateCostRing(0.5, RING_ACCENT)
    expect(captured.length).toBe(0)
  })

  it('snaps (no tween) on first render and records the displayed fraction', () => {
    const { ring, graphics } = makeFakeRing()
    const { scene, captured, callLog } = makeFakeScene()
    makeCardView(scene, graphics).updateCostRing(0.5, RING_ACCENT)

    expect(captured.length).toBe(0) // snapped, did not animate
    expect(callLog).not.toContain('add') // snap never adds a tween
    expect(ring.displayedFraction).toBe(0.5)
    expect(ring.arcs.at(-1)).toBeCloseTo(0.5, 5)
  })

  it('is idempotent: a repeated identical target does not start a tween', () => {
    const { ring, graphics } = makeFakeRing()
    const { scene, captured, callLog } = makeFakeScene()
    const view = makeCardView(scene, graphics)
    view.updateCostRing(0.5, RING_ACCENT) // first: snap
    view.updateCostRing(0.5, RING_ACCENT) // same target

    expect(captured.length).toBe(0)
    expect(callLog).not.toContain('add') // idempotent repeat never adds a tween
    expect(ring.displayedFraction).toBe(0.5)
  })

  it('animates (kills then adds) when the target differs, targeting the ring object', () => {
    const { ring, graphics } = makeFakeRing()
    const fake = makeFakeScene()
    const view = makeCardView(fake.scene, graphics)
    view.updateCostRing(0.25, RING_ACCENT) // snap to 0.25
    view.updateCostRing(0.75, RING_ACCENT) // animate up

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
    const view = makeCardView(fake.scene, graphics)
    view.updateCostRing(0, RING_ACCENT) // snap to 0
    view.updateCostRing(1, RING_ACCENT) // fill 0 -> 1
    // Simulate the fill tween finishing (real Phaser advances displayedFraction
    // to the target); only then does the next cycle see a different displayed
    // value to drain from.
    nthTween(fake.captured, 0).onComplete()
    view.updateCostRing(0, RING_ACCENT) // drain 1 -> 0

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
    const view = makeCardView(fake.scene, graphics)
    view.updateCostRing(0, RING_ACCENT)
    view.updateCostRing(1, RING_ACCENT)
    const t = nthTween(fake.captured, 0)

    // Simulate the tween engine advancing the property and ticking onUpdate.
    ring.displayedFraction = 0.4
    t.onUpdate()
    expect(ring.arcs.at(-1)).toBeCloseTo(0.4, 5)
  })

  it('onComplete settles exactly on target', () => {
    const { ring, graphics } = makeFakeRing()
    const fake = makeFakeScene()
    const view = makeCardView(fake.scene, graphics)
    view.updateCostRing(0, RING_ACCENT)
    view.updateCostRing(1, RING_ACCENT)
    const t = nthTween(fake.captured, 0)

    // Float drift mid-tween, then complete: must land exactly on target.
    ring.displayedFraction = 0.999_7
    t.onComplete()
    expect(ring.displayedFraction).toBe(1)
    expect(ring.arcs.at(-1)).toBeCloseTo(1, 5)
  })
})

// ---------------------------------------------------------------------------
// CardView emphasize / clearEmphasis — hover-target emphasis (S9)
//
// The methods touch a tiny Phaser surface: view.setScale / .add, plus a
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
 * A fake CardView: records scale, captures added children, and exposes the
 * mutable `targetGlow`/`emphasized` props the method stamps on it. `scene.add.graphics`
 * returns the supplied fake glow so the test can inspect what was drawn.
 */
interface EmphasisCardViewFake {
  scene: unknown
  scale: number
  targetGlow: unknown
  emphasized: boolean | undefined
  added: unknown[]
  setScale(v: number): unknown
  add(child: unknown): unknown
  emphasize: CardView['emphasize']
  clearEmphasis: CardView['clearEmphasis']
}

function makeFakeEmphasisCardView(glow: unknown): { view: EmphasisCardViewFake } {
  const view = Object.create(CardView.prototype) as EmphasisCardViewFake
  Object.assign(view, {
    scale: 1,
    added: [] as unknown[],
    targetGlow: undefined as unknown,
    emphasized: undefined as boolean | undefined,
    setScale(v: number): unknown {
      view.scale = v
      return view
    },
    add(child: unknown): unknown {
      view.added.push(child)
      return view
    },
  })
  const scene = { add: { graphics: (): unknown => glow } }
  Object.defineProperty(view, 'scene', { value: scene })
  return { view }
}

describe('CardView emphasize / clearEmphasis', () => {
  it('lifts the card (scale > 1) and draws a glow when emphasized', () => {
    const { state: glow, graphics } = makeFakeGlow()
    const { view } = makeFakeEmphasisCardView(graphics)
    view.emphasize(GLOW_COLOR, 0.5)

    expect(view.scale).toBeGreaterThan(1)
    expect(view.emphasized).toBe(true)
    expect(view.targetGlow).toBe(graphics) // glow stored on the view
    expect(view.added).toContain(graphics) // appended as a child
    expect(glow.visible).toBe(true)
    expect(glow.alphas.at(-1)).toBeGreaterThan(0)
  })

  it('scales glow alpha AND lift by intensity (loud at 1, calm-but-visible at 0)', () => {
    const low = makeFakeGlow()
    const lowC = makeFakeEmphasisCardView(low.graphics)
    lowC.view.emphasize(GLOW_COLOR, 0)

    const high = makeFakeGlow()
    const highC = makeFakeEmphasisCardView(high.graphics)
    highC.view.emphasize(GLOW_COLOR, 1)

    // Higher intensity → larger lift and brighter glow.
    expect(highC.view.scale).toBeGreaterThan(lowC.view.scale)
    expect(high.state.alphas.at(-1)!).toBeGreaterThan(low.state.alphas.at(-1)!)
    // Even at intensity 0 the emphasis is clearly on (scale > 1, alpha > 0).
    expect(lowC.view.scale).toBeGreaterThan(1)
    expect(low.state.alphas.at(-1)!).toBeGreaterThan(0)
  })

  it('is idempotent: re-emphasizing an already-emphasized card does not redraw', () => {
    const { state: glow, graphics } = makeFakeGlow()
    const { view } = makeFakeEmphasisCardView(graphics)
    view.emphasize(GLOW_COLOR, 1)
    const drawsAfterFirst = glow.alphas.length
    view.emphasize(GLOW_COLOR, 1) // same call again
    expect(glow.alphas.length).toBe(drawsAfterFirst) // no second draw → no jitter
  })

  it('clearEmphasis restores base transform (scale 1, glow hidden/cleared)', () => {
    const { state: glow, graphics } = makeFakeGlow()
    const { view } = makeFakeEmphasisCardView(graphics)
    view.emphasize(GLOW_COLOR, 1)
    const clearsBefore = glow.clears

    view.clearEmphasis()
    expect(view.scale).toBe(1)
    expect(view.emphasized).toBe(false)
    expect(glow.visible).toBe(false)
    expect(glow.clears).toBeGreaterThan(clearsBefore) // glow was cleared
  })

  it('clearEmphasis is safe on a never-emphasized view (no glow)', () => {
    const { view } = makeFakeEmphasisCardView(makeFakeGlow().graphics)
    view.clearEmphasis() // never emphasized → targetGlow undefined
    expect(view.scale).toBe(1)
    expect(view.emphasized).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CardView applyHighlight — named highlight rectangle styling (S10 'committed' kind)
//
// applyHighlight touches only the named overlay rectangle's setStrokeStyle /
// setFillStyle. We also provide a fake `list[1]` guard so the per-kind styling
// (and the committed-fill reset) is tested
// without a real Phaser runtime.
// ---------------------------------------------------------------------------

interface FakeRect {
  strokeWidth: number
  strokeColor: number
  fillColor: number
  fillAlpha: number
}

interface HighlightCardViewFake {
  highlightRect: unknown
  list: unknown[]
  applyHighlight: CardView['applyHighlight']
}

function makeFakeHighlightCardView(): { view: HighlightCardViewFake; rect: FakeRect; listRect: FakeRect } {
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
  const listRect: FakeRect = { strokeWidth: 0, strokeColor: 0, fillColor: 0x000000, fillAlpha: 0 }
  const listRectObj = {
    setStrokeStyle(width: number, color?: number): unknown {
      listRect.strokeWidth = width
      listRect.strokeColor = color ?? 0
      return listRectObj
    },
    setFillStyle(color: number, alpha?: number): unknown {
      listRect.fillColor = color
      listRect.fillAlpha = alpha ?? 1
      return listRectObj
    },
  }
  const view = Object.create(CardView.prototype) as HighlightCardViewFake
  view.highlightRect = rectObj
  // If CardView regresses to list[1], these assertions will see listRect mutate.
  view.list = [{}, listRectObj]
  return { view, rect, listRect }
}

describe("CardView applyHighlight 'committed' kind", () => {
  const fs = selectTheme('zombie-big-box').frameStyle

  it('strokes the highlightRect with the muted committedTarget colour, not the bright target border', () => {
    const { view, rect } = makeFakeHighlightCardView()
    view.applyHighlight('committed', fs)
    expect(rect.strokeColor).toBe(fs.committedTarget)
    expect(rect.strokeColor).not.toBe(fs.targetBorder) // visually distinct from a live legal target
    expect(rect.strokeWidth).toBeGreaterThan(0)
  })

  it('adds a faint committedTarget fill so the mark reads as steady/settled', () => {
    const { view, rect } = makeFakeHighlightCardView()
    view.applyHighlight('committed', fs)
    expect(rect.fillColor).toBe(fs.committedTarget)
    expect(rect.fillAlpha).toBeGreaterThan(0)
    expect(rect.fillAlpha).toBeLessThan(1) // muted, not a solid block
  })

  it("clears any prior committed fill when re-applied as another kind (no stale tint)", () => {
    const { view, rect } = makeFakeHighlightCardView()
    view.applyHighlight('committed', fs) // tints the fill
    view.applyHighlight('target', fs) // reused view, new state
    expect(rect.fillAlpha).toBe(0) // committed tint cleared
    expect(rect.strokeColor).toBe(fs.targetBorder)
  })

  it("'target' uses the bright targetBorder, distinct from committed", () => {
    const { view, rect } = makeFakeHighlightCardView()
    view.applyHighlight('target', fs)
    expect(rect.strokeColor).toBe(fs.targetBorder)
    expect(rect.fillAlpha).toBe(0) // legal-target border has no fill
  })

  it('uses the named highlightRect field instead of depending on list[1]', () => {
    const { view, rect, listRect } = makeFakeHighlightCardView()
    view.applyHighlight('target', fs)
    expect(rect.strokeColor).toBe(fs.targetBorder)
    expect(listRect.strokeWidth).toBe(0)
    expect(listRect.fillAlpha).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// CardView surface methods
// ---------------------------------------------------------------------------

describe('CardView surface methods', () => {
  it('setDimmed pushes the dim alpha onto the view', () => {
    const view = Object.create(CardView.prototype) as CardView & {
      alpha: number
      setAlpha(v: number): unknown
    }
    view.alpha = 1
    view.setAlpha = (v: number) => {
      view.alpha = v
      return view
    }

    view.setDimmed(true)
    expect(view.alpha).toBe(0.35)
    view.setDimmed(false)
    expect(view.alpha).toBe(1)
  })

  it('setCardPosition re-asserts the view position', () => {
    const view = Object.create(CardView.prototype) as CardView & {
      x: number
      y: number
      setPosition(x: number, y: number): unknown
    }
    view.x = 0
    view.y = 0
    view.setPosition = (x: number, y: number) => {
      view.x = x
      view.y = y
      return view
    }

    view.setCardPosition(123, 456)
    expect(view.x).toBe(123)
    expect(view.y).toBe(456)
  })
})

// ---------------------------------------------------------------------------
// CardView player-card keyword line (REQ-MALL-21)
//
// Unlike the surface-method tests above (which fake the CardView itself),
// these run the REAL constructor end-to-end with real minted player cards.
// The scene stub records every text object created (position, content, font
// size) so the tests can pin the keyword line to the exact offset and format
// the world face uses, and prove a keywordless card's layout is untouched.
// ---------------------------------------------------------------------------

/** A created text object as the scene stub tracked it. */
interface TrackedText {
  x: number
  y: number
  content: string
  fontSize: string
}

/**
 * Minimal protocol a fake child must speak so the REAL Container.add
 * (addHandler) accepts it: a DESTROY listener hook plus display-list moves.
 */
const childProtocol = {
  parentContainer: null as unknown,
  once(): void {},
  off(): void {},
  removeFromDisplayList(): void {},
  addedToScene(): void {},
}

function makeFakeText(
  x: number,
  y: number,
  style: { fontSize?: string },
  sink: TrackedText[],
): unknown {
  const tracked: TrackedText = { x, y, content: '', fontSize: style.fontSize ?? '' }
  sink.push(tracked)
  const text = {
    ...childProtocol,
    x,
    y,
    width: 40,
    height: 12,
    setOrigin: (): unknown => text,
    setText(s: string): unknown {
      tracked.content = s
      return text
    },
    // The real implementation wraps via canvas measurement; splitting on
    // explicit newlines is enough here because every string under test is
    // shorter than the wrap width.
    getWrappedText: (s: string): string[] => s.split('\n'),
    setAbove: (): unknown => text,
  }
  return text
}

function makeFakeRect(x: number, y: number): unknown {
  const rect = {
    ...childProtocol,
    x,
    y,
    setOrigin: (): unknown => rect,
    setRounded: (): unknown => rect,
    setAlpha: (): unknown => rect,
    setStrokeStyle: (): unknown => rect,
    setFillStyle: (): unknown => rect,
  }
  return rect
}

function makeFakeImage(x: number, y: number): unknown {
  const img = {
    ...childProtocol,
    x,
    y,
    width: 10,
    height: 10,
    setOrigin: (): unknown => img,
    setDisplaySize: (): unknown => img,
  }
  return img
}

/** Scene stub satisfying the full CardView constructor for player cards. */
function makeRenderScene(): { scene: unknown; texts: TrackedText[] } {
  const texts: TrackedText[] = []
  const scene = {
    sys: {
      queueDepthSort(): void {},
      events: { once(): void {}, off(): void {} },
    },
    add: {
      existing(): void {},
      image: (x: number, y: number): unknown => makeFakeImage(x, y),
      rectangle: (x: number, y: number): unknown => makeFakeRect(x, y),
      text: (x: number, y: number, _s: string, style: { fontSize?: string }): unknown =>
        makeFakeText(x, y, style, texts),
    },
  }
  return { scene, texts }
}

function makeMintState(): GameState {
  return {
    playerDraw: [],
    hand: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    actIndex: 0,
    totalActs: 3,
    progress: {},
    hp: 10,
    energy: 0,
    skipDrawNext: false,
    pendingForceDestroy: 0,
    braceCharges: 0,
    status: 'playing',
    worldId: 'zombie-big-box',
    rng: createRng(0),
    nextId: 0,
  }
}

const keywordCatalog: CardCatalog = {
  'Spore Cloud': {
    kind: 'player',
    name: 'Spore Cloud',
    effect: { kind: 'DealProgress', base: 1 },
    keywords: ['Spore'],
  },
  'Creeping Bloom': {
    kind: 'player',
    name: 'Creeping Bloom',
    effect: { kind: 'DealProgress', base: 1 },
    keywords: ['Spore', 'Slow'],
  },
  'Plain Strike': {
    kind: 'player',
    name: 'Plain Strike',
    effect: { kind: 'DealProgress', base: 1 },
  },
}

function mintPlayer(templateId: string): PlayerCard {
  const [card] = mintCard(keywordCatalog, makeMintState(), templateId)
  if (card.kind !== 'player') throw new Error(`expected ${templateId} to mint a player card`)
  return card
}

function renderTexts(card: PlayerCard): TrackedText[] {
  const { scene, texts } = makeRenderScene()
  const theme = selectTheme('zombie-big-box')
  new CardView(scene as never, card, 0, 0, theme, () => theme)
  return texts
}

describe('CardView player-card keyword line (REQ-MALL-21)', () => {
  // The world face renders keywords at this offset/size; the player face must
  // match it exactly (CardView.ts world branch).
  const KEYWORD_Y = -CARD_FACE.height / 2 + 23
  const EFFECT_Y_DEFAULT = -CARD_FACE.height / 2 + 28
  const EFFECT_Y_WITH_KEYWORDS = -CARD_FACE.height / 2 + 36

  it('renders a minted Spore card with a keyword line at the world-face offset and size', () => {
    const texts = renderTexts(mintPlayer('Spore Cloud'))
    const kw = texts.find((t) => t.content === 'Spore')
    expect(kw).toBeDefined()
    expect(kw!.y).toBe(KEYWORD_Y)
    expect(kw!.fontSize).toBe('9px')
  })

  it("joins multiple keywords with ' · ' exactly like the world face", () => {
    const texts = renderTexts(mintPlayer('Creeping Bloom'))
    expect(texts.some((t) => t.content === 'Spore · Slow')).toBe(true)
  })

  it('shifts the effect block down to the world-face effect offset when keywords are present', () => {
    const texts = renderTexts(mintPlayer('Spore Cloud'))
    const effect = texts.find((t) => t.content === 'Add 1 Progress')
    expect(effect).toBeDefined()
    expect(effect!.y).toBe(EFFECT_Y_WITH_KEYWORDS)
  })

  it('renders a keywordless card unchanged: no keyword line, effect at the original offset', () => {
    const texts = renderTexts(mintPlayer('Plain Strike'))
    // No keyword line at all — nothing renders at the keyword slot and no
    // 9px text exists on the face (name is 13px, effect 11px; no Exhaust).
    expect(texts.some((t) => t.y === KEYWORD_Y)).toBe(false)
    expect(texts.some((t) => t.fontSize === '9px')).toBe(false)
    const effect = texts.find((t) => t.content === 'Add 1 Progress')
    expect(effect).toBeDefined()
    expect(effect!.y).toBe(EFFECT_Y_DEFAULT)
  })
})
