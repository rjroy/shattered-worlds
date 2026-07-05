import type { WorldDisplayData, WorldHelpData } from "../types";

export const THE_BEGINNING_DISPLAY: WorldDisplayData = {
  name: "The Beginning",
  tagline: "Acceptance is not surrender. It is the first breath after.",
  story:
    "The old reflexes still arrive first: deny it, rage at it, bargain with the shape of it, " +
    "go still beneath it. Acceptance does not make any of them vanish, and it does not let " +
    "you force your way through. It only gives you one honest place to stand while the next " +
    "thing asks to be carried, named, or finally set down. Healing begins here, but it begins " +
    "small, uneven, and still tired.",
  difficulty: 4,
  cycle: 5,
  backgroundKey: "the-beginning-bg",
};

export const THE_BEGINNING_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Denial and Anger return, faster",
      detail:
        "Some hazards carry a self-authored Denial or Anger value, same as Questions — but " +
        "these reach their own threshold effects alone, without needing a second card to help.",
    },
    {
      title: "Bargaining and Depression return, gentler",
      detail:
        "Some hazards carry a self-authored Bargaining or Depression value, same as Answers — " +
        "but these need a second card carrying the same tag before their threshold effects " +
        "trigger.",
    },
    {
      title: "Four reward cards strip these tags — and do one thing more",
      detail:
        "Say It Out Loud, Put It Down, Close the Book On It, and Set It Down each remove one " +
        "of the four returning tags from a target card, the same shape as every reward card " +
        "before them. Each also applies Acceptance to whatever else is sitting in your hand, " +
        "if it's the kind of thing that responds to it.",
    },
    {
      title: "Acceptance lowers a cost instead of raising it",
      detail:
        "Unlike every other tag in this trilogy, Acceptance makes a card cheaper to clear the " +
        "more of it a card is carrying. It decays over time like the others, and reapplying it " +
        "refreshes the value rather than stacking it.",
    },
    {
      title: "Destiny is the same entity Questions and Answers carry",
      detail:
        "The Destiny card that appears late in this world is not a new one — it's the " +
        "identical card carried over from Questions and Answers, reused rather than " +
        "reauthored. Clearing it completes the run, the same way Door does.",
    },
  ],
};
