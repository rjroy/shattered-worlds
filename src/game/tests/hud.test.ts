import { describe, it, expect } from 'bun:test'
import { updateHUD } from '../view/hud'
import type { GameState } from '../../core/index'

// ---------------------------------------------------------------------------
// Fakes
//
// updateHUD only mutates the text content of refs.energyText, refs.hpText,
// and refs.actText by calling setText(). We fake these Text objects to
// capture the text that was set, so we can assert the correct value for a
// known state without needing a real Phaser runtime or canvas.
// ---------------------------------------------------------------------------

interface FakeText {
  text: string
  setText(content: string): void
}

function makeFakeText(): FakeText {
  return {
    text: '',
    setText(content: string): void {
      this.text = content
    },
  }
}

function makeFakeRefs(): {
  refs: {
    container: unknown
    hpText: FakeText
    actText: FakeText
    energyText: FakeText
  }
  energyText: FakeText
} {
  const energyText = makeFakeText()
  const refs = {
    container: {},
    hpText: makeFakeText(),
    actText: makeFakeText(),
    energyText,
  }
  return { refs, energyText }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateHUD', () => {
  it('sets energyText to the current energy value', () => {
    const { refs, energyText } = makeFakeRefs()
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
      status: 'playing',
      worldId: 'test-world',
      rng: { a: 1, b: 2, c: 3, d: 4 },
      nextId: 1,
    }

    updateHUD(refs as never, state)

    expect(energyText.text).toBe('5')
  })

  it('formats energy correctly with different values', () => {
    const { refs, energyText } = makeFakeRefs()
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
      status: 'playing',
      worldId: 'test-world',
      rng: { a: 1, b: 2, c: 3, d: 4 },
      nextId: 1,
    }

    updateHUD(refs as never, state)
    expect(energyText.text).toBe('0')

    state.energy = 10
    updateHUD(refs as never, state)
    expect(energyText.text).toBe('10')
  })

  it('updates HP and act text alongside energy', () => {
    const { refs } = makeFakeRefs()
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
      status: 'playing',
      worldId: 'test-world',
      rng: { a: 1, b: 2, c: 3, d: 4 },
      nextId: 1,
    }

    updateHUD(refs as never, state)

    expect(refs.hpText.text).toBe('HP: 15')
    expect(refs.actText.text).toBe('Act 2 / 3')
    expect(refs.energyText.text).toBe('3')
  })
})
