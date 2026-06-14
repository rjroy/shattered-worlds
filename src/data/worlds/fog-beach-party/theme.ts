import type { VisualTheme } from "../../../game/view/themes/theme";

// Place-vs-disaster identity (REQ-FOG-30/31/32): a warm golden-hour beach
// party drowned by cold fog. Reality leans amber/coral (the party); the
// intrusion is a cool desaturated blue-grey (the fog rolling in), the dominant
// tonal shift and distinct at a glance from every other shipped world.
export const FOG_BEACH_PARTY_THEME: VisualTheme = {
  worldId: "fog-beach-party",
  intrusionHue: "#7d93a6",
  realityPalette: {
    title: "#f2c98a",
    text: "#f0b070",
    disabled: "#7a7066",
    confirm: "#ffd9a0",
    cancel: "#9fb6c4",
  },
  doorGlowTint: 0x7d93a6,
  doorTint: 0x5d6770,
  frameStyle: {
    selectedBorder: 0xffd24a,
    targetBorder: 0xf0b070,
    discardBorder: 0xff9a3d,
    connectorProgress: 0xf0b070,
    connectorDestroy: 0xff4f5f,
    connectorReturn: 0x8a88ff,
    ringAccent: 0xf0b070,
    targetGlow: 0xffe2b0,
    playableGlow: 0xffd24a,
    committedTarget: 0x5a4a36,
  },
  backdrop: {
    realityKey: "fog-beach-party-bg",
    intrusionKey: "fog-beach-party-overlay",
  },
  worldCardfrontKey: "fog-beach-party-cardfront",
};
