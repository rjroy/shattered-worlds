import type { VisualTheme } from "../../../game/view/themes/theme";

export const EDEN_PRIME_THEME: VisualTheme = {
  worldId: "eden-prime",
  intrusionHue: "#ff9b21",
  doorGlowTint: 0xff9b21,
  doorTint: 0xadff21,
  realityPalette: {
    title: "#fcf6d1",
    text: "#d6eaa7",
    disabled: "#75815b",
    confirm: "#acd64a",
    cancel: "#b56948",
  },
  frameStyle: {
    selectedBorder: 0xd6b94a,
    targetBorder: 0xb8d86c,
    discardBorder: 0xff8068,
    connectorProgress: 0xd6b94a,
    connectorDestroy: 0xff8068,
    connectorReturn: 0xc9b8ff,
    ringAccent: 0xb8d86c,
    targetGlow: 0xf8ffe6,
    playableGlow: 0xd6b94a,
    committedTarget: 0x344022,
    pickedBorder: 0xe4cd62,
  },
  backdrop: {
    realityKey: "eden-prime-bg",
    intrusionKey: "eden-prime-overlay",
  },
  worldCardfrontKey: "eden-prime-cardfront",
};
