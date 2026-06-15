import { describe, it, expect } from 'bun:test'
import { RunSummaryView, type RunSummaryData } from './RunSummaryView'
import type { FeatDefinition } from '../../data/feats/types'

// ---------------------------------------------------------------------------
// Validations #17, #18, #19 — feats section in RunSummaryView.show()
//
// We bypass the Phaser constructor via Object.create, stub the scene and
// override view.add / view.remove / view.setVisible directly so the test never
// touches a real Phaser runtime or DOM canvas.
// ---------------------------------------------------------------------------

// A minimal text object returned by scene.add.text().
// setOrigin is the only chained method called on it by RunSummaryView.
interface TrackedText {
  x: number
  y: number
  content: string
}

interface FakeTextObj extends TrackedText {
  setOrigin(ox: number, oy?: number): this
}

function makeTrackedText(x: number, y: number, content: string, sink: TrackedText[]): FakeTextObj {
  const obj: FakeTextObj = {
    x,
    y,
    content,
    setOrigin(_ox: number, _oy?: number) {
      return this
    },
  }
  sink.push(obj)
  return obj
}

// A minimal rectangle stub: setStrokeStyle, setRounded, setPosition, setSize
// all return `this` for chaining.
function makeFakeRect() {
  const r = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    setStrokeStyle() { return r },
    setRounded() { return r },
    setPosition(x: number, y: number) { r.x = x; r.y = y; return r },
    setSize(w: number, h: number) { r.width = w; r.height = h; return r },
  }
  return r
}

// A minimal graphics stub: lineStyle, strokeRect, strokeCircle, clear all
// no-op and return `this` for chaining.
function makeFakeGraphics() {
  const g = {
    lineStyle() { return g },
    strokeRect() { return g },
    strokeCircle() { return g },
    clear() { return g },
  }
  return g
}

// Build the fake scene. We collect all text objects in `trackedTexts` so
// tests can inspect them after show() completes.
function makeFakeScene(): { scene: unknown; trackedTexts: TrackedText[] } {
  const trackedTexts: TrackedText[] = []
  const scene = {
    add: {
      rectangle(_x: number, _y: number, _w: number, _h: number, _color?: number, _alpha?: number) {
        return makeFakeRect()
      },
      graphics() {
        return makeFakeGraphics()
      },
      text(x: number, y: number, content: string, _style: unknown) {
        return makeTrackedText(x, y, content, trackedTexts)
      },
    },
    time: {
      delayedCall(_ms: number, _fn: () => void) {},
    },
  }
  return { scene, trackedTexts }
}

// Build a RunSummaryView bypassing the Phaser constructor.
// The bg stub implements the three methods show() calls on it.
function makeView(scene: unknown): {
  view: RunSummaryView & { list: unknown[] }
  trackedTexts: TrackedText[]
} {
  // We need access to trackedTexts from the scene we already built.
  // The caller passes scene in and we return view only; texts come from makeFakeScene.
  const bgStub = {
    setInteractive() {},
    removeAllListeners(_ev: string) {},
    once(_ev: string, _fn: () => void) {},
  }

  const view = Object.create(RunSummaryView.prototype) as RunSummaryView & { list: unknown[] }

  // Install the required instance fields.
  Object.defineProperty(view, 'scene', { value: scene, writable: false })
  Object.defineProperty(view, 'bg', { value: bgStub, writable: false })
  ;(view as unknown as { onDismiss: null }).onDismiss = null
  view.list = []

  // Override Container methods that show() relies on.
  view.setVisible = (_v: boolean) => view as never
  view.add = (children: unknown | unknown[]) => {
    if (Array.isArray(children)) {
      for (const c of children) view.list.push(c)
    } else {
      view.list.push(children)
    }
    return view as never
  }
  view.remove = (child: unknown, _destroy?: boolean) => {
    view.list = view.list.filter((c) => c !== child)
    return view as never
  }

  // Seed list with bg so the clearing loop in show() has something to compare.
  view.list.push(bgStub)

  return { view, trackedTexts: [] }
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeData(overrides?: Partial<RunSummaryData>): RunSummaryData {
  return {
    outcome: 'won',
    worldName: 'Test World',
    runNumber: 1,
    worldWins: 0,
    activeDurationMs: 0,
    turns: 5,
    cardsPlayed: 0,
    progressDealt: 0,
    damageTaken: 0,
    hazardsResolved: 0,
    hazardsDiscarded: 0,
    cardsDiscarded: 0,
    records: {},
    featsEarned: [],
    ...overrides,
  }
}

const firstSurvivorDef: FeatDefinition = {
  id: 'first-survivor',
  name: 'First Survivor',
  description: 'Win your first run.',
  conditions: [{ statId: 'outcome', operator: 'is', value: 'won' }],
  reward: { items: [{ type: 'memoryFragments', amount: 10 }] },
}

// ---------------------------------------------------------------------------
// Helper: run show() using a fresh scene and return the tracked texts.
// ---------------------------------------------------------------------------

function runShow(data: RunSummaryData): { trackedTexts: TrackedText[]; view: RunSummaryView & { list: unknown[] } } {
  const { scene, trackedTexts } = makeFakeScene()
  const { view } = makeView(scene)
  view.show(data, () => {})
  return { trackedTexts, view }
}

// ---------------------------------------------------------------------------
// Validation #17 — one feat row is added and continue text is positioned after it
// ---------------------------------------------------------------------------

describe('RunSummaryView feat rows (validation #17)', () => {
  it('renders a feat name and fragment reward, and positions continue text after the feat row', () => {
    const { trackedTexts } = runShow(makeData({ featsEarned: [firstSurvivorDef] }))

    const nameTxt = trackedTexts.find((t) => t.content === 'First Survivor')
    expect(nameTxt).toBeDefined()

    const rewardTxt = trackedTexts.find((t) => t.content === '+10 Fragments')
    expect(rewardTxt).toBeDefined()

    // anchor = 104 (no records), rowCount = 1, lastFeatRowY = 104 + 28 + 0*22 = 132
    // continueY = max(184, 132 + 28) = 184, so continue is at y=184 ≥ 132 + 24 = 156.
    const continueTxt = trackedTexts.find((t) => t.content === 'Tap to continue')
    expect(continueTxt).toBeDefined()
    expect(continueTxt!.y).toBeGreaterThanOrEqual(132 + 24)
  })
})

// ---------------------------------------------------------------------------
// Validation #18 — no fragment text when featsEarned is empty
// ---------------------------------------------------------------------------

describe('RunSummaryView feat rows (validation #18)', () => {
  it('does not render any Fragments text when featsEarned is empty', () => {
    const { trackedTexts } = runShow(makeData({ featsEarned: [] }))

    const fragmentsTexts = trackedTexts.filter((t) => t.content.includes('Fragments'))
    expect(fragmentsTexts).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Validation #19 — 6 feats render exactly 4 name rows + one overflow row
// ---------------------------------------------------------------------------

describe('RunSummaryView feat rows (validation #19)', () => {
  it('renders 4 feat name rows and a "+ 2 more" overflow row for 6 feats', () => {
    const sixFeats: FeatDefinition[] = [
      { id: 'f1', name: 'Feat One',   description: '', conditions: [], reward: { items: [{ type: 'memoryFragments', amount: 5 }] } },
      { id: 'f2', name: 'Feat Two',   description: '', conditions: [], reward: { items: [{ type: 'memoryFragments', amount: 5 }] } },
      { id: 'f3', name: 'Feat Three', description: '', conditions: [], reward: { items: [{ type: 'memoryFragments', amount: 5 }] } },
      { id: 'f4', name: 'Feat Four',  description: '', conditions: [], reward: { items: [{ type: 'memoryFragments', amount: 5 }] } },
      { id: 'f5', name: 'Feat Five',  description: '', conditions: [], reward: { items: [{ type: 'memoryFragments', amount: 5 }] } },
      { id: 'f6', name: 'Feat Six',   description: '', conditions: [], reward: { items: [{ type: 'memoryFragments', amount: 5 }] } },
    ]

    const cappedNames = ['Feat One', 'Feat Two', 'Feat Three', 'Feat Four']

    const { trackedTexts } = runShow(makeData({ featsEarned: sixFeats }))

    // Exactly 4 texts with one of the capped feat names.
    const nameTxts = trackedTexts.filter((t) => cappedNames.includes(t.content))
    expect(nameTxts).toHaveLength(4)

    // Overflow row present.
    const moreTxt = trackedTexts.find((t) => t.content === '+ 2 more')
    expect(moreTxt).toBeDefined()
  })
})
