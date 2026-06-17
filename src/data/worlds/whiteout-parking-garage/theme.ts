import type { VisualTheme } from "../../../game/view/themes/theme";

export const WHITEOUT_PARKING_GARAGE_THEME: VisualTheme = {
  worldId: "whiteout-parking-garage",
  intrusionHue: "#bfe9ff",
  realityPalette: {
    title: "#f4fbff",
    text: "#b7d9e8",
    disabled: "#71818a",
    confirm: "#ffd17a",
    cancel: "#8fb0c4",
  },
  doorGlowTint: 0xbfe9ff,
  doorTint: 0x8fb0c4,
  frameStyle: {
    selectedBorder: 0xffd17a,
    targetBorder: 0xbfe9ff,
    discardBorder: 0xff9a3d,
    connectorProgress: 0xbfe9ff,
    connectorDestroy: 0xff6b3d,
    connectorReturn: 0x8fb0c4,
    ringAccent: 0xbfe9ff,
    targetGlow: 0xe8f8ff,
    playableGlow: 0xffd17a,
    committedTarget: 0x344a58,
    pickedBorder: 0xffc266,
  },
  backdrop: {
    realityKey: "whiteout-parking-garage-bg",
    intrusionKey: "whiteout-parking-garage-overlay",
  },
  worldCardfrontKey: "whiteout-parking-garage-cardfront",
};
