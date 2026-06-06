import { describe, it, expect } from 'bun:test'
import { PileLayer } from './piles'

// ---------------------------------------------------------------------------
// Stubs
//
// PileLayer's constructor only calls scene.add.container(x, y); worldPileCenter
// reads back the world pile container's live (x, y). We fake scene.add.container
// to return a minimal object carrying the x/y it was created with, so the test
// pins the accessor to the *real* pile position rather than a hardcoded guess.
// ---------------------------------------------------------------------------

interface FakeContainer {
  x: number
  y: number
}

function makeFakeScene(): { scene: unknown; containers: FakeContainer[] } {
  const containers: FakeContainer[] = []
  const scene = {
    add: {
      container(x: number, y: number): FakeContainer {
        const c: FakeContainer = { x, y }
        containers.push(c)
        return c
      },
    },
  }
  return { scene, containers }
}

describe('PileLayer.worldPileCenter', () => {
  it('reads the world pile container position (second container created), not a hardcoded point', () => {
    const { scene, containers } = makeFakeScene()
    const pile = new PileLayer(scene as never)

    // Constructor creates the player pile first, then the world pile.
    const worldContainer = containers[1]
    expect(worldContainer).toBeDefined()

    const center = pile.worldPileCenter()
    expect(center.x).toBe(worldContainer!.x)
    // y is lifted toward the visual middle of the stack, above the anchor.
    expect(center.y).toBeLessThan(worldContainer!.y)
  })

  it('tracks the live container x if it moves (not a frozen snapshot)', () => {
    const { scene, containers } = makeFakeScene()
    const pile = new PileLayer(scene as never)
    const worldContainer = containers[1]!

    worldContainer.x = 999
    expect(pile.worldPileCenter().x).toBe(999)
  })
})
