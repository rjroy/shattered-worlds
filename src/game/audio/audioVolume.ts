import type { UserSettings } from '../runtime/userSettings'

// ---------------------------------------------------------------------------
// Base volume constants
// ---------------------------------------------------------------------------
// Each constant is the hardcoded playback level for its channel before any
// user-controlled gain is applied. A slider at 100% (gain = 1.0) reproduces
// exactly these levels; lower slider values scale down proportionally.

export const MENU_MUSIC_BASE = 0.42 as const
export const WORLD_MUSIC_BASE = 0.45 as const
export const CARD_FX_BASE = 0.5 as const

// ---------------------------------------------------------------------------
// Gain helpers
// ---------------------------------------------------------------------------

/**
 * Compute the music-channel gain from settings.
 * Master mute wins — returns 0 regardless of slider position.
 * Otherwise returns the user's music volume (already clamped to [0,1] on load).
 */
export function musicGain(s: UserSettings): number {
  return s.masterMute ? 0 : s.musicVolume
}

/**
 * Compute the FX-channel gain from settings.
 * Master mute wins — returns 0 regardless of slider position.
 * Otherwise returns the user's FX volume (already clamped to [0,1] on load).
 */
export function fxGain(s: UserSettings): number {
  return s.masterMute ? 0 : s.fxVolume
}

// ---------------------------------------------------------------------------
// Effective volume
// ---------------------------------------------------------------------------

/**
 * Combine a per-sound base level with a channel gain multiplier.
 * This is the value passed to Phaser's `volume` option or `setVolume()`.
 */
export function effectiveVolume(base: number, gain: number): number {
  return base * gain
}
