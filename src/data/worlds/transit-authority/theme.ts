import type { VisualTheme } from "../../../game/view/themes/theme";

// Sodium-amber station light identity, invaded by quarantine crimson and a
// violet warning band. The keynote (intrusionHue/doorGlowTint) is the
// quarantine crimson from REQ-TRANSIT-34; amber-gold carries progress/board
// accents (station light, on-schedule), steel-blue carries return/retreat
// (cool, pulls off the warm field per theme-authoring V2), and violet marks
// the quarantine band (ringAccent/targetBorder) so the frame reads distinctly
// from city-of-sleeping-giants' violet-cyan keynote at a glance.
export const TRANSIT_AUTHORITY_THEME: VisualTheme = {
  worldId: "transit-authority",
  intrusionHue: "#e23a5e",
  realityPalette: {
    title: "#fdeacb",
    text: "#d9b98a",
    disabled: "#7d766e",
    confirm: "#f0a83c",
    cancel: "#5c8fc4",
  },
  doorGlowTint: 0xe23a5e,
  doorTint: 0xa855d9,
  frameStyle: {
    selectedBorder: 0xf0a83c,
    targetBorder: 0xa855d9,
    discardBorder: 0xe23a5e,
    connectorProgress: 0xf0a83c,
    connectorDestroy: 0xe23a5e,
    connectorReturn: 0x5c8fc4,
    ringAccent: 0xa855d9,
    targetGlow: 0xfff0d9,
    playableGlow: 0xf0a83c,
    committedTarget: 0x3a2e42,
    pickedBorder: 0xffb84d,
  },
  backdrop: {
    realityKey: "transit-authority-bg",
    intrusionKey: "transit-authority-overlay",
  },
  worldCardfrontKey: "transit-authority-cardfront",
};
