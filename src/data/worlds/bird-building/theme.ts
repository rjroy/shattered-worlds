import type { VisualTheme } from '../../../game/view/themes/theme'

// Sky-and-feather identity: the office tower is carried into open air, so the
// keynote is a bright sky blue. Return actions shift to a cool violet so they
// stay distinct from the blue targets (frameStyle roles still read warm=danger,
// cool=retreat — see theme-authoring rule V2).
export const BIRD_BUILDING_THEME: VisualTheme = {
  worldId: 'bird-building',
  intrusionHue: '#7cc6ff',
  realityPalette: {
    title: '#9aa3b2',
    text: '#6ab0e2',
    disabled: '#5f707c',
    confirm: '#88ee88',
    cancel: '#e29266',
  },
  doorGlowTint: 0x7cc6ff,
  doorTint: 0x6a7686,
  frameStyle: {
    selectedBorder: 0xffe066,      // gold selection, theme-neutral
    targetBorder: 0x44aaff,        // sky-blue target (keynote)
    discardBorder: 0xff8800,       // warm discard
    connectorProgress: 0x44aaff,   // pairs with ringAccent / targetBorder blue
    connectorDestroy: 0xff4444,    // warm red destroy
    connectorReturn: 0xaa88ff,     // cool violet return, distinct from blue target
    ringAccent: 0x44aaff,          // cost-ring fill, blue family
    targetGlow: 0x88cfff,          // bright sky hover-target glow
    playableGlow: 0xffe066,
    committedTarget: 0x274a6a,     // muted deep-blue "locked here" mark
  },
  backdrop: {
    realityKey: 'bird-building-bg',
    intrusionKey: 'bird-building-overlay',
  },
  worldCardfrontKey: 'bird-building-cardfront',
}
