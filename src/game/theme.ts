export interface FrameStyle {
  borderColor: number        // Phaser hex int for card border
  playerBg: number           // Phaser hex int for player card background
  worldBg: number            // Phaser hex int for world card background
  selectedBorder: number
  targetBorder: number
  discardBorder: number
}

export interface GrainSpec {
  density: number            // 0-1, static per-theme constant for now
  contrast: number           // 0-1
}

export interface VisualTheme {
  worldId: string
  intrusionHue: string           // '#9bff6a' for zombie-big-box (fluorescent green)
  realityPalette: string[]       // 2-4 desaturated slate hex strings for UI accents
  frameStyle: FrameStyle
  grain: GrainSpec
  backdrop: {
    realityKey: string            // 'bigbox-reality'
    intrusionKey: string          // 'zombie-intrusion'
  }
  walker?: {
    textureKey: string            // 'zombie-walker'
  }
  worldCardfrontKey?: string      // theme-specific frame for world/hazard cards; falls back to 'cardfront'
}

export const ZOMBIE_BIG_BOX_THEME: VisualTheme = {
  worldId: 'zombie-big-box',
  intrusionHue: '#9bff6a',
  realityPalette: ['#8a9ba8', '#5c6e7a', '#3d4f5e', '#2a3540'],
  frameStyle: {
    borderColor: 0x3d4f5e,
    playerBg: 0x1a2a3a,
    worldBg: 0x2a1a1a,
    selectedBorder: 0xffee44,
    targetBorder: 0x44ee44,
    discardBorder: 0xff8800,
  },
  grain: { density: 0.12, contrast: 0.4 },
  backdrop: {
    realityKey: 'bigbox-reality',
    intrusionKey: 'zombie-intrusion',
  },
  walker: {
    textureKey: 'zombie-walker',
  },
  worldCardfrontKey: 'zombie-cardfront',
}

const THEMES: Record<string, VisualTheme> = {
  'zombie-big-box': ZOMBIE_BIG_BOX_THEME,
}

export function selectTheme(worldId: string): VisualTheme {
  return THEMES[worldId] ?? ZOMBIE_BIG_BOX_THEME
}
