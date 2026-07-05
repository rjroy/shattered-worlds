import type { VisualTheme } from "../../../game/view/themes/theme";

// Warm amber-gold identity: the trilogy's finale resolves toward the returning
// warmth Act III builds to, rather than reprising questions' ember-orange
// escalation thread or answers' cool grey-blue numbness directly. VisualTheme
// stays one flat palette per world (no per-act switching, see this world's
// plan Step 14) — the three-act visual arc lives in card inset art direction
// instead (see insets/README.md's three Direction subsections). Return still
// reads cool per theme-authoring.md's V2, popping the blue-grey connector off
// this otherwise warm field.
export const THE_BEGINNING_THEME: VisualTheme = {
  worldId: "the-beginning",
  intrusionHue: "#d9a45c",
  realityPalette: {
    title: "#f2e2c4",
    text: "#c9a877",
    disabled: "#6b5a45",
    confirm: "#e0b054",
    cancel: "#8a7a6a",
  },
  doorGlowTint: 0xd9a45c,
  doorTint: 0x6b5a45,
  frameStyle: {
    selectedBorder: 0xe0b054,
    targetBorder: 0xd9a45c,
    discardBorder: 0xb5453f,
    connectorProgress: 0xe0b054,
    connectorDestroy: 0xb5453f,
    connectorReturn: 0x5c7a94,
    ringAccent: 0xd9a45c,
    targetGlow: 0xf2e2c4,
    playableGlow: 0xe0b054,
    committedTarget: 0x3a3228,
    pickedBorder: 0xe8c47a,
  },
  backdrop: {
    realityKey: "the-beginning-bg",
    intrusionKey: "the-beginning-overlay",
  },
  // No cardfront art exists yet for this world (see assetBindings.ts note) —
  // omitted rather than pointing at a nonexistent key; presentation.ts falls
  // back to the generic "cardfront" key when this is undefined.
};
