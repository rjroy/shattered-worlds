import { describe, expect, it } from 'bun:test'
import { selectTheme, ZOMBIE_BIG_BOX_THEME } from '../view/theme'

describe('selectTheme', () => {
  it('returns zombie-big-box theme for that worldId', () => {
    const theme = selectTheme('zombie-big-box')
    expect(theme.worldId).toBe('zombie-big-box')
    expect(theme.intrusionHue).toBe('#9bff6a')
  })

  it('returns default (zombie-big-box) for unknown worldId', () => {
    const theme = selectTheme('unknown-world')
    expect(theme.worldId).toBe('zombie-big-box')
  })

  it('backdrop keys are strings (not URLs)', () => {
    expect(typeof ZOMBIE_BIG_BOX_THEME.backdrop.realityKey).toBe('string')
    expect(typeof ZOMBIE_BIG_BOX_THEME.backdrop.intrusionKey).toBe('string')
  })

  it('frameStyle contains numeric feedback colors (hex integers)', () => {
    expect(typeof ZOMBIE_BIG_BOX_THEME.frameStyle.connectorProgress).toBe('number')
    expect(typeof ZOMBIE_BIG_BOX_THEME.frameStyle.connectorDestroy).toBe('number')
    expect(typeof ZOMBIE_BIG_BOX_THEME.frameStyle.connectorReturn).toBe('number')
    expect(typeof ZOMBIE_BIG_BOX_THEME.frameStyle.ringAccent).toBe('number')
    expect(typeof ZOMBIE_BIG_BOX_THEME.frameStyle.targetGlow).toBe('number')
    expect(typeof ZOMBIE_BIG_BOX_THEME.frameStyle.committedTarget).toBe('number')
  })

  it('zombie-big-box has a world cardfront texture key', () => {
    expect(ZOMBIE_BIG_BOX_THEME.worldCardfrontKey).toBe('zombie-cardfront')
  })
})
