/**
 * Display-only metadata for each world — shown on the world-select screen.
 * This file has no game-logic dependency and must NOT be imported by core or
 * engine modules; it is UI-only.
 */

export interface WorldDisplayData {
  name:    string  // Display name shown on the world card
  tagline: string  // One punchy line beneath the name
  story:   string  // 2–4 sentences of mood. No mechanics.
}

export const worldDisplayManifest: Record<string, WorldDisplayData> = {
  'zombie-big-box': {
    name:    'The Big Box',
    tagline: 'Corporate hell meets the undead.',
    story:   'The store never closes. You\'re halfway through a shift when the lights start flickering — the kind of flicker that isn\'t a power surge. The PA goes silent mid-announcement. Something is moving in the stockroom.',
  },
  'bird-building': {
    name:    'Bird Building',
    tagline: 'The floors keep moving. So do the birds.',
    story:   'Coming soon…',
  },
  'highway-volcano': {
    name:    'Highway Volcano',
    tagline: 'Rush hour. Lava flow. Pick one.',
    story:   'Coming soon…',
  },
}
