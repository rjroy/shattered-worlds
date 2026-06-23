import { describe, expect, it } from 'bun:test'

import {
  CARD_FX_BASE,
  MENU_MUSIC_BASE,
  WORLD_MUSIC_BASE,
  effectiveVolume,
  fxGain,
  musicGain,
} from './audioVolume'
import type { UserSettings } from '../runtime/userSettings'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function settings(
  overrides: Partial<Pick<UserSettings, 'musicVolume' | 'fxVolume' | 'masterMute'>> = {},
): UserSettings {
  return {
    version: 2,
    confirmationMode: 'always',
    detailedHoverPreviews: true,
    musicVolume: 1.0,
    fxVolume: 0.5,
    masterMute: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Base constants are the known hardcoded values
// ---------------------------------------------------------------------------

describe('base constants', () => {
  it('MENU_MUSIC_BASE is 0.42', () => {
    expect(MENU_MUSIC_BASE).toBe(0.42)
  })

  it('WORLD_MUSIC_BASE is 0.45', () => {
    expect(WORLD_MUSIC_BASE).toBe(0.45)
  })

  it('CARD_FX_BASE is 0.5', () => {
    expect(CARD_FX_BASE).toBe(0.5)
  })
})

// ---------------------------------------------------------------------------
// musicGain
// ---------------------------------------------------------------------------

describe('musicGain', () => {
  it('returns the slider value when not muted', () => {
    expect(musicGain(settings({ musicVolume: 1.0 }))).toBe(1.0)
    expect(musicGain(settings({ musicVolume: 0.5 }))).toBe(0.5)
    expect(musicGain(settings({ musicVolume: 0.25 }))).toBe(0.25)
  })

  it('returns 0 when slider is at 0%', () => {
    expect(musicGain(settings({ musicVolume: 0 }))).toBe(0)
  })

  it('returns 0 regardless of slider when master muted', () => {
    expect(musicGain(settings({ masterMute: true, musicVolume: 1.0 }))).toBe(0)
    expect(musicGain(settings({ masterMute: true, musicVolume: 0.75 }))).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// fxGain
// ---------------------------------------------------------------------------

describe('fxGain', () => {
  it('returns the slider value when not muted', () => {
    expect(fxGain(settings({ fxVolume: 1.0 }))).toBe(1.0)
    expect(fxGain(settings({ fxVolume: 0.5 }))).toBe(0.5)
    expect(fxGain(settings({ fxVolume: 0 }))).toBe(0)
  })

  it('returns 0 regardless of slider when master muted', () => {
    expect(fxGain(settings({ masterMute: true, fxVolume: 1.0 }))).toBe(0)
    expect(fxGain(settings({ masterMute: true, fxVolume: 0.5 }))).toBe(0)
  })

  it('default FX volume (0.5) produces gain of 0.5', () => {
    expect(fxGain(settings())).toBe(0.5)
  })
})

// ---------------------------------------------------------------------------
// effectiveVolume
// ---------------------------------------------------------------------------

describe('effectiveVolume', () => {
  it('multiplies base by gain', () => {
    expect(effectiveVolume(1.0, 1.0)).toBe(1.0)
    expect(effectiveVolume(1.0, 0.5)).toBe(0.5)
    expect(effectiveVolume(0.42, 0.75)).toBeCloseTo(0.315)
  })

  it('returns 0 when gain is 0 (mute or slider at bottom)', () => {
    expect(effectiveVolume(MENU_MUSIC_BASE, 0)).toBe(0)
    expect(effectiveVolume(WORLD_MUSIC_BASE, 0)).toBe(0)
    expect(effectiveVolume(CARD_FX_BASE, 0)).toBe(0)
  })

  it('100% gain reproduces the base level exactly', () => {
    expect(effectiveVolume(MENU_MUSIC_BASE, 1.0)).toBe(MENU_MUSIC_BASE)
    expect(effectiveVolume(WORLD_MUSIC_BASE, 1.0)).toBe(WORLD_MUSIC_BASE)
    expect(effectiveVolume(CARD_FX_BASE, 1.0)).toBe(CARD_FX_BASE)
  })

  it('default settings produce expected effective volumes', () => {
    // Music: 100% × base → unchanged
    const musicVol = effectiveVolume(MENU_MUSIC_BASE, musicGain(settings()))
    expect(musicVol).toBe(0.42)

    // FX: 50% × base → halved
    const fxVol = effectiveVolume(CARD_FX_BASE, fxGain(settings()))
    expect(fxVol).toBe(0.25)
  })
})
