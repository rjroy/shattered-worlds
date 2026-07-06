import type { WorldDisplayData, WorldHelpData } from "../types";

export const QUESTIONS_DISPLAY: WorldDisplayData = {
  name: "Questions",
  tagline: "The waiting room doesn't end when you leave it.",
  story:
    "The monitor keeps beeping. The test results sit on the counter, unopened. Somewhere a " +
    "phone rings and rings, and no one you love is answering it. Nothing here explains itself " +
    "— it just keeps costing more, the longer you let it wait.",
  difficulty: 3,
  cycle: 5,
  backgroundKey: "questions-bg",
};

export const QUESTIONS_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Denial taxes itself",
      detail:
        "Some hazards carry a self-authored Denial value. Every point of Denial on a card " +
        "adds directly to what it costs to clear — leaving the card alone doesn't make it " +
        "any cheaper.",
    },
    {
      title: "Anger taxes everything nearby",
      detail:
        "A card carrying Anger raises the clear cost of every card in your hand, not just " +
        "its own. One Anger source is enough to make an unrelated card more expensive to " +
        "deal with.",
    },
    {
      title: "Destiny's cost is a running total",
      detail:
        "Destiny has no bespoke cost effect of its own — its price is simply the sum of " +
        "whatever Denial and Anger have accumulated elsewhere in your hand, so its cost is a " +
        "direct readout of how much has gone unaddressed.",
    },
    {
      title: "Two reward cards strip these tags",
      detail:
        "Ask The Question removes Denial from a target card; Let It Out removes Anger. Both " +
        "are the only way to bring a taxed card's cost back down mid-run.",
    },
    {
      title: "A small comfort sits outside the system",
      detail:
        "Sit With It a While offers a minor choice between healing and thawing frozen cards " +
        "— a brief respite, not a way to manage Denial or Anger.",
    },
  ],
};
