import { describe, it, expect } from 'bun:test'
import { selectCardFrontKey } from './render'
import { selectTheme } from './theme'
import type { PlayerCard, WorldCard } from '../core/index'
import type { VisualTheme } from './theme'

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const playerCardZombie: PlayerCard = {
  kind: 'player',
  id: '1',
  name: 'Sprint',
  sourceWorldId: 'zombie-big-box',
  effect: { kind: 'Draw', player: 1 },
}

const playerCardUnknown: PlayerCard = {
  kind: 'player',
  id: '2',
  name: 'Explore',
  sourceWorldId: 'unknown-world',
  effect: { kind: 'Draw', player: 1 },
}

const worldCard: WorldCard = {
  kind: 'world',
  id: '3',
  name: 'The Horde',
  cost: 3,
  keywords: [],
  discardable: false,
  penalty: { kind: 'None' },
  reward: { kind: 'None' },
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
