import { describe, it, expect } from 'bun:test'

const { ActionConfirmationView } = await import('../view/ActionConfirmationView')
type ViewInstance = InstanceType<typeof ActionConfirmationView>
type ShowOptions = Parameters<ViewInstance['show']>[0]

// ---------------------------------------------------------------------------
// We bypass the Phaser constructor via Object.create and stub the scene plus
// the Container methods show()/hide() rely on, so the test never boots a real
// Phaser runtime or DOM canvas. The Cancel/Commit buttons register pointerdown
// handlers in the real constructor; here we instead invoke the private
// commit()/cancel() methods the buttons call, which is what those handlers do.
// ---------------------------------------------------------------------------

interface TrackedText {
  x: number
  y: number
  content: string
}

interface FakeTextObj extends TrackedText {
  setOrigin(ox: number, oy?: number): this
  setInteractive(_opts?: unknown): this
  setText(content: string): this
  on(_ev: string, _fn: () => void): this
  destroy(): void
}

function makeText(x: number, y: number, content: string, sink: TrackedText[]): FakeTextObj {
  const obj: FakeTextObj = {
    x,
    y,
    content,
    setOrigin() {
      return obj
    },
    setInteractive() {
      return obj
    },
    setText(next: string) {
      obj.content = next
      return obj
    },
    on() {
      return obj
    },
    destroy() {},
  }
  sink.push(obj)
  return obj
}

function makeRect() {
  const r = {
    setStrokeStyle() {
      return r
    },
    setRounded() {
      return r
    },
    setInteractive() {
      return r
    },
    on() {
      return r
    },
  }
  return r
}

function makeScene(): { scene: unknown; trackedTexts: TrackedText[] } {
  const trackedTexts: TrackedText[] = []
  const scene = {
    add: {
      existing(_obj: unknown) {
        return _obj
      },
      rectangle() {
        return makeRect()
      },
      text(x: number, y: number, content: string, _style: unknown) {
        return makeText(x, y, content, trackedTexts)
      },
    },
    children: {
      bringToTop(_obj: unknown) {},
    },
  }
  return { scene, trackedTexts }
}

// A test handle over the view. The view's commit()/cancel() are private, so we
// expose them here for the test to drive the way the buttons' pointerdown
// handlers do. The public surface (show/isOpen) comes from the real class.
interface TestView {
  show(opts: ShowOptions): void
  readonly isOpen: boolean
  commit(): void
  cancel(): void
  list: unknown[]
  visibleState: boolean
  lineObjects: TrackedText[]
}

// Build a view bypassing the Phaser constructor: Object.create skips super(),
// and we stub the Container surface (setVisible/add/remove) plus the persistent
// chrome the constructor would have built, so show()/hide() run with no canvas.
function makeView(): { view: TestView; trackedTexts: TrackedText[] } {
  const { scene, trackedTexts } = makeScene()

  const view = Object.create(ActionConfirmationView.prototype) as ViewInstance & {
    list: unknown[]
    visibleState: boolean
  }

  Object.defineProperty(view, 'scene', { value: scene, writable: false })
  ;(view as unknown as { visible: boolean }).visible = false
  ;(view as unknown as { lineObjects: unknown[] }).lineObjects = []
  ;(view as unknown as { onCommit: null }).onCommit = null
  ;(view as unknown as { onCancel: null }).onCancel = null
  view.list = []
  view.visibleState = false

  // Override the Container methods the view relies on.
  view.setVisible = ((v: boolean) => {
    ;(view as unknown as { visible: boolean }).visible = v
    view.visibleState = v
    return view
  }) as never
  view.add = ((child: unknown) => {
    view.list.push(child)
    return view
  }) as never
  view.remove = ((child: unknown, destroy?: boolean) => {
    view.list = view.list.filter((c) => c !== child)
    if (destroy === true && child !== null && typeof child === 'object' && 'destroy' in child) {
      ;(child as { destroy: () => void }).destroy()
    }
    return view
  }) as never

  // Install the persistent chrome the constructor would have created.
  ;(view as unknown as { titleText: FakeTextObj }).titleText = makeText(0, -150, '', trackedTexts)

  return { view: view as unknown as TestView, trackedTexts }
}

function makeOpts(overrides?: Partial<ShowOptions>): {
  opts: ShowOptions
  commitCalls: number[]
  cancelCalls: number[]
} {
  const commitCalls: number[] = []
  const cancelCalls: number[] = []
  const opts: ShowOptions = {
    title: 'Play Mighty Strike',
    lines: ['Make 3 Progress on Zombie', 'Energy 1 -> 0 (-1)'],
    onCommit: () => commitCalls.push(1),
    onCancel: () => cancelCalls.push(1),
    ...overrides,
  }
  return { opts, commitCalls, cancelCalls }
}

// ---------------------------------------------------------------------------
// Commit fires onCommit exactly once, hides, and never fires onCancel.
// ---------------------------------------------------------------------------

describe('ActionConfirmationView commit', () => {
  it('fires onCommit once, hides, and does not fire onCancel', () => {
    const { view } = makeView()
    const { opts, commitCalls, cancelCalls } = makeOpts()

    view.show(opts)
    expect(view.isOpen).toBe(true)

    view.commit()

    expect(commitCalls).toHaveLength(1)
    expect(cancelCalls).toHaveLength(0)
    expect(view.isOpen).toBe(false)
    expect(view.visibleState).toBe(false)
  })

  it('fires onCommit only ONCE on a double-click', () => {
    const { view } = makeView()
    const { opts, commitCalls } = makeOpts()

    view.show(opts)
    view.commit()
    view.commit()

    expect(commitCalls).toHaveLength(1)
  })

  it('does not fire onCancel after a commit', () => {
    const { view } = makeView()
    const { opts, commitCalls, cancelCalls } = makeOpts()

    view.show(opts)
    view.commit()
    view.cancel()

    expect(commitCalls).toHaveLength(1)
    expect(cancelCalls).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Cancel fires onCancel exactly once, hides, and never fires onCommit.
// ---------------------------------------------------------------------------

describe('ActionConfirmationView cancel', () => {
  it('fires onCancel once, hides, and does not fire onCommit', () => {
    const { view } = makeView()
    const { opts, commitCalls, cancelCalls } = makeOpts()

    view.show(opts)
    view.cancel()

    expect(cancelCalls).toHaveLength(1)
    expect(commitCalls).toHaveLength(0)
    expect(view.isOpen).toBe(false)
  })

  it('fires onCancel only ONCE on a double-click', () => {
    const { view } = makeView()
    const { opts, cancelCalls } = makeOpts()

    view.show(opts)
    view.cancel()
    view.cancel()

    expect(cancelCalls).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// A second show() with different lines does not retain the previous lines.
// ---------------------------------------------------------------------------

describe('ActionConfirmationView re-show', () => {
  it('does not retain the previous show line objects', () => {
    const { view, trackedTexts } = makeView()

    view.show(makeOpts({ lines: ['First line A', 'First line B'] }).opts)
    view.commit()

    // Track which line objects survive in the container after the second show.
    const { opts } = makeOpts({ lines: ['Second line X', 'Second line Y', 'Second line Z'] })
    view.show(opts)

    const liveLineObjects = view.lineObjects
    const liveContents = liveLineObjects.map((o) => o.content)

    expect(liveContents).toEqual(['Second line X', 'Second line Y', 'Second line Z'])
    expect(liveContents).not.toContain('First line A')
    expect(liveContents).not.toContain('First line B')

    // The title reflects the latest show too.
    const titleSet = trackedTexts.filter((t) => t.content === 'Play Mighty Strike')
    expect(titleSet.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Long line sets are capped so the modal stays within canvas bounds.
// ---------------------------------------------------------------------------

describe('ActionConfirmationView line cap', () => {
  it('caps a 30-line summary to MAX_LINES with an overflow indicator', () => {
    const { view } = makeView()
    const lines = Array.from({ length: 30 }, (_, i) => `Consequence ${i + 1}`)

    view.show(makeOpts({ lines }).opts)

    const liveLineObjects = view.lineObjects
    // Documented cap is 12 visible rows.
    expect(liveLineObjects.length).toBeLessThanOrEqual(12)
    expect(liveLineObjects.length).toBe(12)

    // The last visible row is the overflow indicator: 30 - 11 kept = 19 more.
    const last = liveLineObjects[liveLineObjects.length - 1]!
    expect(last.content).toBe('+19 more')
  })
})
