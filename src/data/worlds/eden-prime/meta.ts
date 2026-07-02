import type { WorldDisplayData, WorldHelpData } from "../types";

export const EDEN_PRIME_DISPLAY: WorldDisplayData = {
  name: "Eden Prime",
  tagline: "A paradise with no word for danger learns to flinch.",
  story:
    "Fruit, insects, flowers, and herds once approached every stranger as a gift. Then the " +
    "Walker gave the valley a violet second sun, and paradise learned fear from the player's " +
    "own hand.",
  difficulty: 5,
  cycle: 5,
  backgroundKey: "eden-prime-bg",
};

export const EDEN_PRIME_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Paradise starts harmless",
      detail:
        "Many Eden hazards begin as gifts or gentle interruptions. They become dangerous when Alarm appears on cards in your hand.",
    },
    {
      title: "Greed raises Alarm",
      detail:
        "Taking fruit, drawing extra cards, and pushing large Progress turns teach the valley to panic. Alarm lasts briefly, but it can spread through authored Eden hazards.",
    },
    {
      title: "Alarm turns gifts into shocks",
      detail:
        "Alarmed hazards can force discard and redraw, return themselves to the top of the world deck, add Panic, or make Paradise Runs hit harder.",
    },
    {
      title: "Restraint calms the valley",
      detail:
        "Discard gifts, clear First Warning Cry early, and keep Progress modest to let Alarm decay before the board startles.",
    },
    {
      title: "Use the pressure valves",
      detail:
        "Gentle Approach removes Alarm, Stillness Lesson guards against the next Alarm trigger, and Hush the Valley clears a cluster while advancing the Door.",
    },
  ],
};
