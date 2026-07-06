import type { VisualTheme } from "../../../game/view/themes/theme";

export const EDEN_PRIME_THEME: VisualTheme = {
  worldId: "eden-prime",
  intrusionHue: "#ffc021",
  realityPalette: {
    title: "#fcf6d1",
    text: "#d6eaa7",
    disabled: "#75815b",
    confirm: "#d6b94a",
    cancel: "#c9b8ff",
  },
  doorGlowTint: 0xffc021,
  doorTint: 0xadff21,
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
