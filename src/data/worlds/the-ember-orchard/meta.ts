import type { WorldDisplayData, WorldHelpData } from "../types";

export const THE_EMBER_ORCHARD_DISPLAY: WorldDisplayData = {
  name: "The Ember Orchard",
  tagline: "A mystical orchard that stores summer heat in star-fruit.",
  story:
    "Rows of star-fruit stored warmth until the Walker came, making the orchard count itself " +
    "wrong. The heat is real, but every dormant star is an egg hatching in the dark below.",
  difficulty: 5,
  cycle: 3,
  backgroundKey: "the-ember-orchard-bg",
};

export const THE_EMBER_ORCHARD_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Warmth now, hazards later",
      detail:
        "Dormant Stars and other gifts give you immediate benefit, but each one plants a known future threat on top of a deck. The cost is delayed, not avoided.",
    },
    {
      title: "Hazards hatch at end of turn",
      detail:
        "Some world cards transform at the end of the turn, replacing themselves with a stronger card on top of the world deck. What you leave on the board becomes worse next turn.",
    },
    {
      title: "Partial clears and discards plant threats",
      detail:
        "Leaving a hazard half-cleared or discarding it does not make it disappear. Many seed a delayed card into your draw or the world deck, so incomplete answers compound.",
    },
    {
      title: "Brace against the swarm",
      detail:
        "Ember creatures snatch cards from your hand. Brace charges absorb a snatch before it can destroy a card, so the defense rewards spend their charges on the moths and the constellation.",
    },
    {
      title: "Leave One and Star-Pruner are the pressure valves",
      detail:
        "Leave One exiles a top threat outright and braces you; Star-Pruner cuts deeper into obstructed hazards. Use them to break a hatching chain before it accelerates.",
    },
  ],
};
