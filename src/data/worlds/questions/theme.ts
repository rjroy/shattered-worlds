import type { VisualTheme } from "../../../game/view/themes/theme";

// Muted, desaturated, cool-neutral palette — waiting-room fluorescents and
// hospital-monitor ash, not the icy saturated blue of whiteout-parking-garage.
// This world sits at the "numb before the fire" end of the trilogy; World 15
// reprises a hotter, more saturated variant of this same signature.
export const QUESTIONS_THEME: VisualTheme = {
  worldId: "questions",
  intrusionHue: "#9fae9a",
  realityPalette: {
    title: "#e8e6e0",
    text: "#b3b0a6",
    disabled: "#6e6a62",
    confirm: "#c9a86a",
    cancel: "#9a94a8",
  },
  doorGlowTint: 0x9fae9a,
  doorTint: 0x6e6a62,
  frameStyle: {
    selectedBorder: 0xc9a86a,
    targetBorder: 0x9fae9a,
    discardBorder: 0xb5493f,
    connectorProgress: 0xc9a86a,
    connectorDestroy: 0xb5493f,
    connectorReturn: 0x9a94a8,
    ringAccent: 0x9fae9a,
    targetGlow: 0xe8e6e0,
    playableGlow: 0xc9a86a,
    committedTarget: 0x3a3a36,
    pickedBorder: 0xd4b880,
  },
  backdrop: {
    realityKey: "questions-bg",
    intrusionKey: "questions-overlay",
  },
  worldCardfrontKey: "questions-cardfront",
};
