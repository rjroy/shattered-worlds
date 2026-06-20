import type { IconId } from "./effectGlyphs";

export interface TooltipCopy {
  title: string;
  body: string;
}

export const EFFECT_ICON_TOOLTIPS: Record<IconId, TooltipCopy> = {
  progress: {
    title: "Progress",
    body: "Add Progress to the hazard you target.",
  },
  progressAll: {
    title: "Progress all",
    body: "Add Progress to every visible hazard at once.",
  },
  draw: {
    title: "Draw",
    body: "Draw cards from your player deck.",
  },
  worldDraw: {
    title: "World draw",
    body: "Draw hazard cards from the world deck.",
  },
  hp: {
    title: "HP",
    body: "Heal your HP or take damage.",
  },
  energy: {
    title: "Energy",
    body: "Gain Energy to spend on player cards.",
  },
  light: {
    title: "Light",
    body: "Reveals cards that are Concealed.",
  },
  heat: {
    title: "Heat",
    body: "Spend Heat to thaw frozen cards.",
  },
  freeze: {
    title: "Freeze",
    body: "Frozen cards cannot be played until thawed.",
  },
  thaw: {
    title: "Thaw",
    body: "Remove frozen state from player cards.",
  },
  discard: {
    title: "Discard",
    body: "Discard a card from your hand.",
  },
  destroy: {
    title: "Destroy",
    body: "Remove a card for the rest of the run.",
  },
  exile: {
    title: "Exile",
    body: "Remove cards from the top of the world deck.",
  },
  return: {
    title: "Return",
    body: "Send world cards back into the world deck.",
  },
  addCard: {
    title: "Gain card",
    body: "Add a named card to the associated deck.",
  },
  randomCard: {
    title: "Random card",
    body: "Gain a random card from a named pool — the reward, not a specific card or tier, is guaranteed.",
  },
  brace: {
    title: "Brace",
    body: "Prevent random card destroy effects.",
  },
  survive: {
    title: "Survive",
    body: "Endure the world's end and press on.",
  },
  vanish: {
    title: "Vanish",
    body: "This card exhausts: one use, then it is gone.",
  },
  eachTurn: {
    title: "Each turn",
    body: "Fires when you end the turn with this hazard still in hand.",
  },
  onDiscard: {
    title: "If discarded",
    body: "Fires if you discard the hazard.",
  },
  onClear: {
    title: "Clear it",
    body: "Fires when you fully clear the hazard.",
  },
  onPartialClear: {
    title: "Partial clear",
    body: "Fires when you make some Progress, but not enough to clear.",
  },
};

export const ENERGY_COST_TOOLTIP: TooltipCopy = {
  title: "Energy cost",
  body: "Spend this much Energy to play the card.",
};

export const PROGRESS_RING_TOOLTIP: TooltipCopy = {
  title: "Progress ring",
  body: "Progress fills this ring. When it reaches the number, the hazard clears.",
};
