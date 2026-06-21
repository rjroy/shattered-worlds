import type { WorldDisplayData, WorldHelpData } from "../types";

export const WHITEOUT_PARKING_GARAGE_DISPLAY: WorldDisplayData = {
  name: "Whiteout Parking Garage",
  tagline: "An empty concrete deck was already cold. Now the new ice age starts there.",
  story:
    "The upper level was gray, salted, and impersonal before the impossible. The Walker crossed the ramp, bringing a sideways blizzard that sealed cars into stalls and froze every tool in your hand. The Door opens past the exit lane, under ice thick enough to remember you.",
  difficulty: 3,
  backgroundKey: "whiteout-parking-garage-bg",
};

export const WHITEOUT_PARKING_GARAGE_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Frozen cards cannot be played",
      detail:
        "Whiteout hazards freeze player cards in your hand. A frozen card stays visible and stays in hand, but it is locked out of playable actions until it thaws.",
    },
    {
      title: "Heat is spendable",
      detail:
        "Heat does not decay. Gain it with warm-up cards, then spend it to thaw key frozen cards before the hand lock compounds.",
    },
    {
      title: "Burn cards for warmth",
      detail:
        "Some cards let you destroy cards in hand for Heat. Frozen cards are legal burn targets, so a locked card can still become an emergency way out.",
    },
    {
      title: "Time thaws slowly",
      detail:
        "Frozen counters tick down at the start of each turn before energy and refill. When the counter reaches 0, that card remains in hand and can be used that turn.",
    },
    {
      title: "The garage punishes a frozen hand",
      detail:
        "The final freeze threat keeps locking cards and deals extra damage for each frozen card you are carrying. Thawing is survival, not just convenience.",
    },
  ],
};
