import type { VisualTheme } from "../../../game/view/themes/theme";

export const NEW_DERELICT_THEME: VisualTheme = {
  worldId: "new-derelict",
  intrusionHue: "#eee8ff",
  realityPalette: {
    title: "#e9ffff",
    text: "#b7d8d8",
    disabled: "#647777",
    confirm: "#63d5df",
    cancel: "#ff7766",
  },
  doorGlowTint: 0xeee8ff,
  doorTint: 0xa58cff,
  frameStyle: {
    selectedBorder: 0x63d5df,
    targetBorder: 0x83d9ce,
    discardBorder: 0xff7766,
    connectorProgress: 0x63d5df,
    connectorDestroy: 0xff7766,
    connectorReturn: 0xb8a6ff,
    ringAccent: 0x63d5df,
    targetGlow: 0xe9ffff,
    playableGlow: 0x63d5df,
    committedTarget: 0x263c3e,
    pickedBorder: 0xffb05c,
  },
  backdrop: {
    realityKey: "new-derelict-bg",
    intrusionKey: "new-derelict-overlay",
  },
  worldCardfrontKey: "new-derelict-cardfront",
};
