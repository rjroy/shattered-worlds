import type { VisualTheme } from "../../../game/view/themes/theme";

// Cooler and more desaturated than questions' muted sage-green — this world
// pushes further toward a flat, grey-blue numbness rather than warming up.
// World 15's own Act II is specced to reprise this exact grey-blue signature
// before that trilogy's arc moves elsewhere; questions and answers together
// are the "numb" end of the three end-worlds, not the "hot" one.
export const ANSWERS_THEME: VisualTheme = {
  worldId: "answers",
  intrusionHue: "#8a95a3",
  realityPalette: {
    title: "#dfe2e6",
    text: "#9aa3ac",
    disabled: "#5d636a",
    confirm: "#b08a5a",
    cancel: "#8f8fa0",
  },
  doorGlowTint: 0x8a95a3,
  doorTint: 0x5d636a,
  frameStyle: {
    selectedBorder: 0xb08a5a,
    targetBorder: 0x8a95a3,
    discardBorder: 0xa8453d,
    connectorProgress: 0xb08a5a,
    connectorDestroy: 0xa8453d,
    connectorReturn: 0x8f8fa0,
    ringAccent: 0x8a95a3,
    targetGlow: 0xdfe2e6,
    playableGlow: 0xb08a5a,
    committedTarget: 0x33363a,
    pickedBorder: 0xc2996a,
  },
  backdrop: {
    realityKey: "answers-bg",
    intrusionKey: "answers-overlay",
  },
  // No cardfront art exists yet for this world (see assetBindings.ts note) —
  // omitted rather than pointing at a nonexistent key; presentation.ts falls
  // back to the generic "cardfront" key when this is undefined.
};
