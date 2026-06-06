export interface FrameStyle {
  selectedBorder: number
  targetBorder: number
  discardBorder: number
  connectorProgress: number  // accent line for a progress/deal action; pairs with ringAccent
  connectorDestroy: number   // red, for destroy actions
  connectorReturn: number    // cool/blue, for return-to-deck actions
  ringAccent: number         // cost-ring fill color (targetBorder green family)
  targetGlow: number         // hover-target emphasis tint/glow
  committedTarget: number    // muted "already locked here" mark
}

export interface VisualTheme {
  worldId: string
  intrusionHue: string
  realityPalette: {
    title: string
    text: string
    disabled: string
    confirm: string
    cancel: string
  }
  frameStyle: FrameStyle
  doorGlowTint?: number          // optional tint for the door glow (Phaser hex int); if not set, glow is default color
  doorTint?: number              // optional tint for the door (Phaser hex int); if not set, door is default color
  backdrop: {
    realityKey: string            // 'bigbox-reality'
    intrusionKey: string          // 'zombie-intrusion'
  }
  worldCardfrontKey?: string      // theme-specific frame for world/hazard cards; falls back to 'cardfront'
}

export const ZOMBIE_BIG_BOX_THEME: VisualTheme = {
  worldId: 'zombie-big-box',
  intrusionHue: '#9bff6a',
  realityPalette: {
    title: '#9aa3b2',
    text: '#6a96e2',
    disabled: '#5f707c',
    confirm: '#88ee88',
    cancel: '#e29266',
  },
  doorGlowTint: 0x9bff6a,
  doorTint: 0x5c6e7a,
  frameStyle: {
    selectedBorder: 0xffee44,
    targetBorder: 0x44ee44,
    discardBorder: 0xff8800,
    connectorProgress: 0x44ee44,  // pairs with ringAccent (targetBorder green)
    connectorDestroy: 0xff4444,   // red destroy action
    connectorReturn: 0x44aaff,    // cool blue return-to-deck action
    ringAccent: 0x44ee44,         // cost-ring fill, targetBorder green family
    targetGlow: 0x88ffaa,         // bright green hover-target glow
    committedTarget: 0x2a6a3a,    // muted dark green "locked here" mark
  },
  backdrop: {
    realityKey: 'bigbox-reality',
    intrusionKey: 'zombie-intrusion',
  },
  worldCardfrontKey: 'zombie-cardfront',
}

const THEMES: Record<string, VisualTheme> = {
  'zombie-big-box': ZOMBIE_BIG_BOX_THEME,
}

export function selectTheme(worldId: string): VisualTheme {
  return THEMES[worldId] ?? 'starter'
}

export function getRealityPalette(
  theme: VisualTheme,
  index: keyof VisualTheme['realityPalette'],
  defaultColor: string
): string {
  return theme.realityPalette[index] ?? defaultColor
}

