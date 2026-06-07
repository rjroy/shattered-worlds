import { VisualTheme } from './theme'

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

