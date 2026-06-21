import type { VisualTheme } from "../../../game/view/themes/theme";

export const CITY_OF_SLEEPING_GIANTS_THEME: VisualTheme = {
  worldId: "city-of-sleeping-giants",
  intrusionHue: "#9d6cff",
  realityPalette: {
    title: "#eae4ff",
    text: "#b9a8e6",
    disabled: "#6a6080",
    confirm: "#35e0a0",
    cancel: "#6fd8e6",
  },
  doorGlowTint: 0x9d6cff,
  doorTint: 0x6fd8e6,
  frameStyle: {
    selectedBorder: 0x35e0a0,
    targetBorder: 0x9d6cff,
    discardBorder: 0xff6bb0,
    connectorProgress: 0x35e0a0,
    connectorDestroy: 0xff6bb0,
    connectorReturn: 0x6fd8e6,
    ringAccent: 0x9d6cff,
    targetGlow: 0xf4f0ff,
    playableGlow: 0x35e0a0,
    committedTarget: 0x2a2440,
    pickedBorder: 0x66f0b8,
  },
  backdrop: {
    realityKey: "city-of-sleeping-giants-bg",
    intrusionKey: "city-of-sleeping-giants-overlay",
  },
  worldCardfrontKey: "city-of-sleeping-giants-cardfront",
};
