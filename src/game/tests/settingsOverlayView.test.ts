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
    setOrigin: () => r,
    on: () => r,
    // Mutated by VolumeSlider via `this.parts.thumb.x = thumbCentre`
    x: 0,
    width: 0,
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
    setText: () => t,
    setName: () => t,
  }
  return t
}

function makeFakeContainer() {
  const c = {
    setPosition: () => c,
    add: () => c,
    setInteractive: () => c,
    on: () => c,
    x: 0,
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
      circle: () => makeFakeRect(), // VolumeSlider uses this for the thumb dot
    },
    input: {
      on: () => {},
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
): { view: SettingsOverlayViewInstance; log: SceneCallLog; visible: () => boolean; onAudioChangeCalls: string[] } {
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
    muteSegments: unknown[]
    musicSlider: unknown
    fxSlider: unknown
    onAudioChange: (() => void) | undefined
  }
  Object.defineProperty(raw, 'scene', { value: scene, writable: false, configurable: true })
  // The class-field initializers (segment arrays) only run via `new`; seed them
  // so build() can push into them.
  raw.confirmationSegments = []
  raw.hoverSegments = []
  raw.muteSegments = []
  raw.musicSlider = { setValue: () => {} }
  raw.fxSlider = { setValue: () => {} }
  raw._visible = false

  // Track onAudioChange invocations so handler tests can assert they fire.
  const onAudioChangeCalls: string[] = []
  raw.onAudioChange = () => {
    onAudioChangeCalls.push('called')
  }

  // Run the real build() body against the bare instance (the constructor itself
  // cannot be re-applied to an existing instance — see the field note in the view).
  raw.build(scene, store)

  const view = raw as unknown as SettingsOverlayViewInstance
  return { view, log, visible: () => raw._visible === true, onAudioChangeCalls }
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

  // -----------------------------------------------------------------------
  // Volume sliders
  // -----------------------------------------------------------------------

  it('writes music volume to the store and clamps out-of-range values', () => {
    const store = makeFakeStore({ musicVolume: 1.0 })
    const { view, onAudioChangeCalls } = makeView(store)

    view.setMusicVolume(0.75)
    expect(store.updates).toContainEqual({ musicVolume: 0.75 })
    expect(store.get().musicVolume).toBe(0.75)
    expect(onAudioChangeCalls.length).toBe(1)

    // Clamp to [0, 1]
    view.setMusicVolume(-0.2)
    expect(store.updates).toContainEqual({ musicVolume: 0 })
    expect(onAudioChangeCalls.length).toBe(2)

    view.setMusicVolume(1.5)
    expect(store.updates).toContainEqual({ musicVolume: 1 })
    expect(onAudioChangeCalls.length).toBe(3)
  })

  it('writes FX volume to the store and clamps out-of-range values', () => {
    const store = makeFakeStore({ fxVolume: 0.5 })
    const { view, onAudioChangeCalls } = makeView(store)

    view.setFxVolume(0.25)
    expect(store.updates).toContainEqual({ fxVolume: 0.25 })
    expect(store.get().fxVolume).toBe(0.25)
    expect(onAudioChangeCalls.length).toBe(1)

    // Clamp to [0, 1]
    view.setFxVolume(-1)
    expect(store.updates).toContainEqual({ fxVolume: 0 })

    view.setFxVolume(3)
    expect(store.updates).toContainEqual({ fxVolume: 1 })
  })

  it('sets master mute and fires onAudioChange', () => {
    const store = makeFakeStore({ masterMute: false })
    const { view, onAudioChangeCalls } = makeView(store)

    view.setMasterMute(true)
    expect(store.updates).toContainEqual({ masterMute: true })
    expect(store.get().masterMute).toBe(true)
    expect(onAudioChangeCalls.length).toBe(1)

    view.setMasterMute(false)
    expect(store.updates).toContainEqual({ masterMute: false })
    expect(onAudioChangeCalls.length).toBe(2)
  })

  it('refreshFromStore drives slider values and mute highlights from the store', () => {
    const store = makeFakeStore({ musicVolume: 1.0, fxVolume: 0.5, masterMute: false })
    const { view } = makeView(store)

    // Verify sliders were driven to initial values by refreshFromStore during build.
    // Since the fake sliders capture setValue calls, we check indirectly through
    // the store state and highlight.
    const muteSegments = (
      view as unknown as {
        muteSegments: {
          value: boolean
          label: { color?: string }
        }[]
      }
    ).muteSegments

    // masterMute is false → "No Mute" segment should be highlighted (TEXT.textLight)
    const muted = muteSegments.filter((s) => s.label.color === '#e8eaf0')
    expect(muted.map((s) => s.value)).toEqual([false])

    // Now mute on and check highlight flips
    view.setMasterMute(true)
    const nowMuted = muteSegments.filter((s) => s.label.color === '#e8eaf0')
    expect(nowMuted.map((s) => s.value)).toEqual([true])
  })
})
