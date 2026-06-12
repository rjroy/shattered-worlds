import { VisualTheme } from './theme'

// Ember-and-ash identity: the eruption washes the highway in molten orange. The
// keynote is ember, which collides with the conventional warm "destroy" red, so
// target uses ember-orange and destroy uses a crimson that stays legible against
// it; return goes cool blue to pop off the warm field (theme-authoring rule V2).
export const HIGHWAY_VOLCANO_THEME: VisualTheme = {
  worldId: 'highway-volcano',
  intrusionHue: '#ff6a3c',
  realityPalette: {
    title: '#b0a59a',
    text: '#e2a766',
    disabled: '#7c706a',
    confirm: '#88ee88',
    cancel: '#ff8a66',
  },
  doorGlowTint: 0xff6a3c,
  doorTint: 0x5c4a44,
  frameStyle: {
    selectedBorder: 0xffd24a,      // amber-gold selection
    targetBorder: 0xff7a3c,        // ember target (keynote)
    discardBorder: 0xffaa33,       // warm amber discard
    connectorProgress: 0xff7a3c,   // pairs with ringAccent / ember target
    connectorDestroy: 0xff0033,    // crimson destroy, distinct from ember
    connectorReturn: 0x44aaff,     // cool blue return, pops off the warm field
    ringAccent: 0xff7a3c,          // cost-ring fill, ember family
    targetGlow: 0xffb38a,          // hot hover-target glow
    playableGlow: 0xffd24a,       
    committedTarget: 0x7a3a2a,     // muted dark-ember "locked here" mark
  },
  backdrop: {
    realityKey: 'highway-volcano-bg',
    intrusionKey: 'highway-volcano-overlay',
  },
  worldCardfrontKey: 'highway-volcano-cardfront',
}
