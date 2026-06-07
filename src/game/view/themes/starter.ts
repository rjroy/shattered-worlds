import { VisualTheme } from './theme'

// Canonical baseline + fallback for any unthemed world. Keyed to the documented
// "intrusion violet" of the visual direction (see .lore/reference/visual-
// direction.html), so unknown worlds read as the arcane default rather than
// borrowing another world's identity.
export const STARTER: VisualTheme = {
  worldId: 'starter',
  intrusionHue: '#b98aff',
  realityPalette: {
    title: '#9aa3b2',
    text: '#8ab0e2',
    disabled: '#5f707c',
    confirm: '#88ee88',
    cancel: '#e29266',
  },
  doorGlowTint: 0xb98aff,
  doorTint: 0x5c6e7a,
  frameStyle: {
    selectedBorder: 0xffe066,      // gold selection
    targetBorder: 0xb98aff,        // intrusion-violet target (keynote)
    discardBorder: 0xff8800,       // warm discard
    connectorProgress: 0xb98aff,   // pairs with ringAccent / violet target
    connectorDestroy: 0xff4444,    // warm red destroy action
    connectorReturn: 0x44aaff,     // cool blue return-to-deck action
    ringAccent: 0xb98aff,          // cost-ring fill, violet family
    targetGlow: 0xd0b3ff,          // bright violet hover-target glow
    committedTarget: 0x4a3a6a,     // muted deep-violet "locked here" mark
  },
  backdrop: {
    realityKey: 'reality',
    intrusionKey: 'intrusion',
  },
  worldCardfrontKey: 'cardfront',
}
