import { describe, it, expect } from 'bun:test'
import type {
  ConfirmationMode,
  UserSettings,
  UserSettingsStore,
} from '../runtime/userSettings'

const { SettingsOverlayView } = await import('../view/SettingsOverlayView')
type SettingsOverlayViewInstance = InstanceType<typeof SettingsOverlayView>

// ---------------------------------------------------------------------------
// We construct the REAL SettingsOverlayView against a fully stubbed scene, so
// the whole build path (panel, segments, close button, initial refresh) runs
// without a Phaser runtime or DOM canvas. The scene records every call so the
// tests can assert that constructing/opening never dispatches, starts a scene,
// or abandons the run.
//
// Container methods the constructor relies on (setDepth/setVisible/add) are
// patched on the prototype once; the instance is built via Object.create so the
// heavy Phaser Container constructor never runs.
// ---------------------------------------------------------------------------

const proto = SettingsOverlayView.prototype as unknown as Record<string, unknown>
proto.setDepth = function setDepth(this: unknown) {
  return this
}
proto.add = function add(this: unknown) {
  return this
}
// setVisible records visibility on the instance so tests can read it.
proto.setVisible = function setVisible(this: { _visible?: boolean }, v: boolean) {
  this._visible = v
  return this
}

interface SceneCallLog {
  // Any method a real game-state mutation would route through. The settings
  // overlay must touch none of these.
  forbidden: string[]
}

function makeFakeRect() {
  const r = {
    setStrokeStyle: () => r,
    setRounded: () => r,
    setPosition: () => r,
    setInteractive: () => r,
    setFillStyle: () => r,
    on: () => r,
  }
  return r
}

// Fake text tracks its color so highlight assertions can read it back.
function makeFakeText() {
  const t = {
    color: undefined as string | undefined,
    setOrigin: () => t,
    setColor(c: string) {
      t.color = c
      return t
    },
  }
  return t
}

function makeFakeContainer() {
  const c = {
    setPosition: () => c,
    add: () => c,
  }
  return c
}

function makeFakeScene(log: SceneCallLog): unknown {
  const guard = (name: string) => () => {
    log.forbidden.push(name)
  }
  return {
    add: {
      existing: () => {},
      container: () => makeFakeContainer(),
      rectangle: () => makeFakeRect(),
      image: () => ({ setDisplaySize: () => {}, setAlpha: () => {}, setTint: () => {} }),
      text: () => makeFakeText(),
    },
    textures: {
      // Force the rectangle fallback path in addScreenBackdrop (no real texture).
      exists: () => false,
    },
    // If any of these were called, the overlay is doing something it must not.
    scene: { start: guard('scene.start') },
    game: { abandon: guard('game.abandon') },
  }
}

// ---------------------------------------------------------------------------
// In-memory UserSettingsStore.
// ---------------------------------------------------------------------------

function makeFakeStore(initial?: Partial<UserSettings>): UserSettingsStore & {
  updates: Partial<Omit<UserSettings, 'version'>>[]
} {
  let settings: UserSettings = {
    version: 2,
    confirmationMode: 'always',
    detailedHoverPreviews: true,
    musicVolume: 1.0,
    fxVolume: 0.5,
    masterMute: false,
    ...initial,
  }
  const updates: Partial<Omit<UserSettings, 'version'>>[] = []
  return {
    get: () => settings,
    set(next) {
      settings = next
    },
    update(patch) {
      updates.push(patch)
      settings = { ...settings, ...patch }
    },
    updates,
  }
}

// ---------------------------------------------------------------------------
// Build a real SettingsOverlayView against the fake scene + store.
// ---------------------------------------------------------------------------

function makeView(
  store: UserSettingsStore,
): { view: SettingsOverlayViewInstance; log: SceneCallLog; visible: () => boolean } {
  const log: SceneCallLog = { forbidden: [] }
  const scene = makeFakeScene(log)

  // A loose view onto the instance's private members, reached through `unknown`
  // so the cast doesn't intersect with the class's private types (which would
  // collapse to `never`).
  const raw = Object.create(SettingsOverlayView.prototype) as unknown as {
    _visible?: boolean
    scene?: unknown
    build(s: unknown, st: unknown): void
    confirmationSegments: unknown[]
    hoverSegments: unknown[]
  }
  Object.defineProperty(raw, 'scene', { value: scene, writable: false, configurable: true })
  // The class-field initializers (segment arrays) only run via `new`; seed them
  // so build() can push into them.
  raw.confirmationSegments = []
  raw.hoverSegments = []
  raw._visible = false

  // Run the real build() body against the bare instance (the constructor itself
  // cannot be re-applied to an existing instance — see the field note in the view).
  raw.build(scene, store)

  const view = raw as unknown as SettingsOverlayViewInstance
  return { view, log, visible: () => raw._visible === true }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsOverlayView', () => {
  it('does not dispatch, start a scene, or abandon when constructed or opened', () => {
    const store = makeFakeStore()
    const { view, log, visible } = makeView(store)

    expect(log.forbidden).toEqual([])
    expect(store.updates).toEqual([])
    // Hidden by default.
    expect(visible()).toBe(false)

    view.open()
    expect(log.forbidden).toEqual([])
    expect(store.updates).toEqual([])
    expect(visible()).toBe(true)
  })

  it('writes the chosen confirmation mode to the store when a mode is selected', () => {
    const store = makeFakeStore({ confirmationMode: 'always' })
    const { view } = makeView(store)

    view.selectConfirmationMode('risk-only')

    expect(store.updates).toContainEqual({ confirmationMode: 'risk-only' })
    expect(store.get().confirmationMode).toBe('risk-only')
  })

  it('writes the new boolean to the store when detailed hover is toggled', () => {
    const store = makeFakeStore({ detailedHoverPreviews: true })
    const { view } = makeView(store)

    view.setDetailedHoverPreviews(false)

    expect(store.updates).toContainEqual({ detailedHoverPreviews: false })
    expect(store.get().detailedHoverPreviews).toBe(false)
  })

  it('reflects the store current value in the highlighted control when opened', () => {
    const store = makeFakeStore({ confirmationMode: 'off' })
    const { view } = makeView(store)

    view.open()

    // The Off confirmation segment must be the highlighted one. The view paints
    // the selected segment's label with TEXT.textLight (#e8eaf0).
    const segments = (
      view as unknown as {
        confirmationSegments: {
          value: ConfirmationMode
          label: { color?: string }
        }[]
      }
    ).confirmationSegments

    const selected = segments.filter((s) => s.label.color === '#e8eaf0')
    expect(selected.map((s) => s.value)).toEqual(['off'])
  })

  it('closing only toggles visibility and never mutates the store', () => {
    const store = makeFakeStore({ confirmationMode: 'risk-only' })
    const { view, log, visible } = makeView(store)

    view.open()
    view.close()

    expect(visible()).toBe(false)
    expect(log.forbidden).toEqual([])
    expect(store.updates).toEqual([])
    expect(store.get().confirmationMode).toBe('risk-only')
  })
})
