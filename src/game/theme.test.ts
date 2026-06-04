import { describe, expect, it } from 'bun:test'
import { selectTheme, ZOMBIE_BIG_BOX_THEME } from './theme'

describe('selectTheme', () => {
  it('returns zombie-big-box theme for that worldId', () => {
    const theme = selectTheme('zombie-big-box')
    expect(theme.worldId).toBe('zombie-big-box')
    expect(theme.intrusionHue).toBe('#9bff6a')
    expect(theme.walker).toBeDefined()
  })

  it('returns default (zombie-big-box) for unknown worldId', () => {
    const theme = selectTheme('unknown-world')
    expect(theme.worldId).toBe('zombie-big-box')
  })

  it('backdrop keys are strings (not URLs)', () => {
    expect(typeof ZOMBIE_BIG_BOX_THEME.backdrop.realityKey).toBe('string')
    expect(typeof ZOMBIE_BIG_BOX_THEME.backdrop.intrusionKey).toBe('string')
  })

  it('frameStyle contains numeric Phaser colors (hex integers)', () => {
    expect(typeof ZOMBIE_BIG_BOX_THEME.frameStyle.playerBg).toBe('number')
    expect(typeof ZOMBIE_BIG_BOX_THEME.frameStyle.worldBg).toBe('number')
    expect(typeof ZOMBIE_BIG_BOX_THEME.frameStyle.borderColor).toBe('number')
  })
})
