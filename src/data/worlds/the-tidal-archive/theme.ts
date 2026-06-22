import type { VisualTheme } from "../../../game/view/themes/theme";

export const THE_TIDAL_ARCHIVE_THEME: VisualTheme = {
  worldId: "the-tidal-archive",
  intrusionHue: "#2dceb1",
  realityPalette: {
    title: "#eafcf7",
    text: "#9fe3d6",
    disabled: "#6d8a86",
    confirm: "#ffcf8a",
    cancel: "#7fb8ad",
  },
  doorGlowTint: 0x2dceb1,
  doorTint: 0x49d7be,
  frameStyle: {
    selectedBorder: 0xffcf8a,
    targetBorder: 0x4fd9c2,
    discardBorder: 0xff6b5e,
    connectorProgress: 0x4fd9c2,
    connectorDestroy: 0xff6b5e,
    connectorReturn: 0x5b9bd5,
    ringAccent: 0x4fd9c2,
    targetGlow: 0xbdf6ec,
    playableGlow: 0xffcf8a,
    committedTarget: 0x2c4f4a,
    pickedBorder: 0xffc266,
  },
  backdrop: {
    realityKey: "the-tidal-archive-bg",
    intrusionKey: "the-tidal-archive-overlay",
  },
  worldCardfrontKey: "the-tidal-archive-cardfront",
};
