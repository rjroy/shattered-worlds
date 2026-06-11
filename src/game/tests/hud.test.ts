import { describe, it, expect } from 'bun:test'
import { HUDView } from '../view/HUDView'
import type { GameState } from '../../core/index'

// ---------------------------------------------------------------------------
// Fakes
//
// HUDView.update only mutates the text content of energyText, hpText, and
// actText by calling setText(). We fake these Text objects to
// capture the text that was set, so we can assert the correct value for a
// known state without needing a real Phaser runtime or canvas.
// ---------------------------------------------------------------------------

interface FakeText {
  text: string
  visible: boolean
  x: number
  width: number
  setText(content: string): void
  setVisible(visible: boolean): void
}

function makeFakeText(): FakeText {
  return {
    text: '',
    visible: true,
    x: 0,
    width: 0,
    setText(content: string): void {
      this.text = content
    },
    setVisible(visible: boolean): void {
      this.visible = visible
    },
  }
}

interface FakeDisplayObject {
  visible: boolean
  setVisible(visible: boolean): void
  setPosition(x: number, y: number): void
  setSize(width: number, height: number): void
}

function makeFakeDisplayObject(): FakeDisplayObject {
  return {
    visible: true,
    setVisible(visible: boolean): void {
      this.visible = visible
    },
    setPosition(): void {},
    setSize(): void {},
  }
}

interface FakeHUDView {
  hpText: FakeText
  actText: FakeText
  energyText: FakeText
  powerUpsTexts: FakeText[]
  powerUps: FakeDisplayObject
  powerUpPanel: FakeDisplayObject
  update: HUDView['update']
}

function makeFakeHUDView(): {
  view: FakeHUDView
  energyText: FakeText
} {
  const energyText = makeFakeText()
  const view = Object.create(HUDView.prototype) as FakeHUDView
  Object.assign(view, {
    hpText: makeFakeText(),
    actText: makeFakeText(),
    energyText,
    powerUpsTexts: [],
    powerUps: makeFakeDisplayObject(),
    powerUpPanel: makeFakeDisplayObject(),
  })
  return { view, energyText }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HUDView.update', () => {
  it('sets energyText to the current energy value', () => {
    const { view, energyText } = makeFakeHUDView()
    const state: GameState = {
      playerDraw: [],
      hand: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      actIndex: 0,
      totalActs: 3,
      progress: {},
      hp: 20,
      energy: 5,
      skipDrawNext: false,
      pendingForceDestroy: 0,
      braceCharges: 0,
      status: 'playing',
      worldId: 'test-world',
      rng: { a: 1, b: 2, c: 3, d: 4 },
      nextId: 1,
    }

    view.update(state)

    expect(energyText.text).toBe('5')
  })

  it('formats energy correctly with different values', () => {
    const { view, energyText } = makeFakeHUDView()
    const state: GameState = {
      playerDraw: [],
      hand: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      actIndex: 0,
      totalActs: 3,
      progress: {},
      hp: 20,
      energy: 0,
      skipDrawNext: false,
      pendingForceDestroy: 0,
      braceCharges: 0,
      status: 'playing',
      worldId: 'test-world',
      rng: { a: 1, b: 2, c: 3, d: 4 },
      nextId: 1,
    }

    view.update(state)
    expect(energyText.text).toBe('0')

    state.energy = 10
    view.update(state)
    expect(energyText.text).toBe('10')
  })

  it('updates HP and act text alongside energy', () => {
    const { view } = makeFakeHUDView()
    const state: GameState = {
      playerDraw: [],
      hand: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      actIndex: 1,
      totalActs: 3,
      progress: {},
      hp: 15,
      energy: 3,
      skipDrawNext: false,
      pendingForceDestroy: 0,
      braceCharges: 0,
      status: 'playing',
      worldId: 'test-world',
      rng: { a: 1, b: 2, c: 3, d: 4 },
      nextId: 1,
    }

    view.update(state)

    expect(view.hpText.text).toBe('HP: 15')
    expect(view.actText.text).toBe('Act 2 / 3')
    expect(view.energyText.text).toBe('3')
  })
})
