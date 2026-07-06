import type { WorldDisplayData, WorldHelpData } from "../types";

export const ANSWERS_DISPLAY: WorldDisplayData = {
  name: "Answers",
  tagline: "You keep asking the universe why.",
  story:
    "The broker has no office, no hand to shake. It speaks in the shape of every " +
    "impossible if: if you had called sooner, if you had noticed, if you could give up enough " +
    "of yourself to make the answer change. The universe never answers. It only lets the " +
    "questions keep returning, heavier each time, until even getting out of bed feels like " +
    "another condition you failed to meet.",
  difficulty: 3,
  cycle: 5,
  backgroundKey: "answers-bg",
};

export const ANSWERS_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Bargaining taxes everything but itself",
      detail:
        "Some hazards carry a self-authored Bargaining value. Every point of Bargaining on a " +
        "card raises what every other card in your hand costs to clear — the card carrying it " +
        "pays nothing extra from its own value.",
    },
    {
      title: "Depression taxes only itself",
      detail:
        "Some hazards carry a self-authored Depression value that adds directly to what that " +
        "same card costs to clear. It doesn't spread to anything else in hand.",
    },
    {
      title: "Destiny's cost is a running total",
      detail:
        "Destiny carries no tax of its own — its price only rises when something else in your " +
        "hand is carrying Bargaining. Left unaddressed, that's the only thing driving its cost " +
        "up.",
    },
    {
      title: "Two reward cards strip these tags",
      detail:
        "Call In The Favor removes Bargaining from a target card; Let It Sit removes " +
        "Depression. Both are the only way to bring a taxed card's cost back down mid-run.",
    },
    {
      title: "Destiny is the same entity Questions carries",
      detail:
        "The Destiny card that appears late in this world is not a new one — it's the " +
        "identical card carried over from Questions, reused rather than reauthored. Clearing " +
        "it ends the run in victory, the same way Door does.",
    },
  ],
};
