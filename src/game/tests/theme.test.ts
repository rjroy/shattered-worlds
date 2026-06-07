import { describe, expect, it } from 'bun:test'
import { selectTheme, themeManifest } from '../view/themes/themeManifest'
import { STARTER } from '../view/themes/starter'
import { ZOMBIE_BIG_BOX_THEME } from '../view/themes/zombie-big-box'

describe('selectTheme', () => {
  it('returns zombie-big-box theme for that worldId', () => {
    const theme = selectTheme('zombie-big-box')
    expect(theme.worldId).toBe('zombie-big-box')
    expect(theme.intrusionHue).toBe('#9bff6a')
  })

  it('returns default (starter) for unknown worldId', () => {
    const theme = selectTheme('unknown-world')
    expect(theme.worldId).toBe('starter')
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

  it('returns the bird-building theme for that worldId', () => {
    const theme = selectTheme('bird-building')
    expect(theme.worldId).toBe('bird-building')
    expect(theme.backdrop.realityKey).toBe('bird-building-bg')
    expect(theme.backdrop.intrusionKey).toBe('bird-building-overlay')
    expect(theme.worldCardfrontKey).toBe('bird-building-cardfront')
  })

  it('returns the highway-volcano theme for that worldId', () => {
    const theme = selectTheme('highway-volcano')
    expect(theme.worldId).toBe('highway-volcano')
    expect(theme.backdrop.realityKey).toBe('highway-volcano-bg')
    expect(theme.backdrop.intrusionKey).toBe('highway-volcano-overlay')
    expect(theme.worldCardfrontKey).toBe('highway-volcano-cardfront')
  })
})

// ---------------------------------------------------------------------------
// Each theme must read as its own place. Guards the regression where
// zombie-big-box was a verbatim copy of the starter palette: no two themes
// (including the starter baseline) may share an intrusionHue.
// ---------------------------------------------------------------------------

describe('theme color identity is distinct per world', () => {
  const themes = [STARTER, ...Object.values(themeManifest)]

  it('every registered theme has a unique intrusionHue', () => {
    const hues = themes.map((t) => t.intrusionHue)
    expect(new Set(hues).size).toBe(hues.length)
  })

  it('zombie-big-box no longer shares the starter palette', () => {
    expect(ZOMBIE_BIG_BOX_THEME.intrusionHue).not.toBe(STARTER.intrusionHue)
    expect(ZOMBIE_BIG_BOX_THEME.frameStyle.targetBorder).not.toBe(STARTER.frameStyle.targetBorder)
  })
})
