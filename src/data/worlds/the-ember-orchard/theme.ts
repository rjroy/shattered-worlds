import type { VisualTheme } from "../../../game/view/themes/theme";

export const THE_EMBER_ORCHARD_THEME: VisualTheme = {
  worldId: "the-ember-orchard",
  intrusionHue: "#d45cff",
  realityPalette: {
    title: "#fff2d6",
    text: "#f0c98a",
    disabled: "#8a7355",
    confirm: "#ffce6b",
    cancel: "#b58fc4",
  },
  doorGlowTint: 0xd45cff,
  doorTint: 0xb58fc4,
  frameStyle: {
    selectedBorder: 0xffce6b,
    targetBorder: 0xd45cff,
    discardBorder: 0xff6b3d,
    connectorProgress: 0xffce6b,
    connectorDestroy: 0xff5a2d,
    connectorReturn: 0xb58fc4,
    ringAccent: 0xd45cff,
    targetGlow: 0xf3d9ff,
    playableGlow: 0xffce6b,
    committedTarget: 0x4a3a26,
    pickedBorder: 0xffc266,
  },
  backdrop: {
    realityKey: "the-ember-orchard-bg",
    intrusionKey: "the-ember-orchard-overlay",
  },
  worldCardfrontKey: "the-ember-orchard-cardfront",
};
