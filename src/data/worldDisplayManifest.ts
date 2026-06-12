/**
 * Display-only metadata for each world — shown on the world-select screen.
 * This file has no game-logic dependency and must NOT be imported by core or
 * engine modules; it is UI-only.
 */

export interface WorldDisplayData {
  name:    string  // Display name shown on the world card
  tagline: string  // One punchy line beneath the name
  story:   string  // 2–4 sentences of mood. No mechanics.
  backgroundKey?: string  // Optional background image for the world card
}

export const worldDisplayManifest: Record<string, WorldDisplayData> = {
  'zombie-big-box': {
    name:    'The Big Box',
    tagline: 'The mindless masses shuffle the aisles.',
    story:   'The store never closes. You\'re halfway through a shift when the lights start flickering — the kind of flicker that isn\'t a power surge. The PA goes silent mid-announcement. Something is moving in the stockroom.',
    backgroundKey: 'bigbox-reality',
  },
  'bird-building': {
    name:    'Last Day at the Office',
    tagline: 'You were going to quit anyway.',
    story:   'The office is eerily quiet. The hum of the fluorescent lights is punctuated by the occasional thud and fluttering sound from the ceiling. A girder sized claw pierces through the side of the building as it is lifted into the air.',
    backgroundKey: 'bird-building-bg',
  },
  'highway-volcano': {
    name:    'Highway Volcano',
    tagline: 'Rush hour. Lava flow. Pick one.',
    story:   'The highway is packed with cars, but no one is honking. The rumbling starts as a low vibration, but quickly escalates into a deafening roar. The ground splits open.',
    backgroundKey: 'highway-volcano-bg',
  },
  'overgrown-mall': {
    name:    'Overgrown Mall',
    tagline: 'The garden level kept growing.',
    story:   'The skylight gave way before the alarms did. Vines move through the concourse faster than evacuation signs can point, turning kiosks and planters into a damp green maze. Somewhere past the food court, the emergency doors are already buried.',
    backgroundKey: 'overgrown-mall-bg',
  },
}
