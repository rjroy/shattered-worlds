import type { VisualTheme } from '../../../game/view/themes/theme'

// Biohazard identity: the keynote stays toxic green (the sickly intrusion of the
// outbreak), but the frame now leans into infection — acid-green targets, a
// blood-crimson destroy, warning-orange discard — so the world reads as its own
// place rather than the violet baseline. (Previously a verbatim copy of STARTER.)
export const ZOMBIE_BIG_BOX_THEME: VisualTheme = {
  worldId: 'zombie-big-box',
  intrusionHue: '#9bff6a',
  realityPalette: {
    title: '#8f9a82',
    text: '#9ad17a',
    disabled: '#5f6b54',
    confirm: '#9bff6a',
    cancel: '#e2785a',
  },
  doorGlowTint: 0x9bff6a,
  doorTint: 0x5c6e7a,
  frameStyle: {
    selectedBorder: 0xd6ff4a,      // acid yellow-green selection
    targetBorder: 0x6ad04a,        // toxic-green target (keynote)
    discardBorder: 0xff7733,       // warning-orange discard
    connectorProgress: 0x6ad04a,   // pairs with ringAccent / green target
    connectorDestroy: 0xc02633,    // infection-crimson destroy action
    connectorReturn: 0x4a9ad0,     // cool blue return-to-deck action
    ringAccent: 0x6ad04a,          // cost-ring fill, toxic-green family
    targetGlow: 0x9bff6a,          // bright toxic hover-target glow
    playableGlow: 0xd6ff4a,
    committedTarget: 0x2a5a1a,     // muted dark-moss "locked here" mark
  },
  backdrop: {
    realityKey: 'bigbox-reality',
    intrusionKey: 'zombie-intrusion',
  },
  worldCardfrontKey: 'zombie-cardfront',
}
