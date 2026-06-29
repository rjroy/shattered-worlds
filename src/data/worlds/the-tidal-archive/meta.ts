import type { WorldDisplayData, WorldHelpData } from "../types";

export const THE_TIDAL_ARCHIVE_DISPLAY: WorldDisplayData = {
  name: "The Tidal Archive",
  tagline: "A floating library that remebers everything by where it was kept.",
  story:
    "Calm turquoise waters and gold-lit stacks kept every memory filed by place, until the " +
    "Walker crossed it and broke the index. Buildings now drift from their histories, roads bend " +
    "back into yesterday.",
  difficulty: 3,
  cycle: 3,
  backgroundKey: "the-tidal-archive-bg",
};

export const THE_TIDAL_ARCHIVE_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Tidal Memory returns your discards",
      detail:
        "At the end of every turn the Archive recalls one card from your discard pile to the top of your draw pile. A discarded card is not gone here; it is a place the tide can revisit.",
    },
    {
      title: "Hazards change what returns",
      detail:
        "Some hazards recall a different discard than the usual latest one, choosing the cheapest card or pulling a Panic to the top. Read which card the tide is about to hand back before you commit a turn.",
    },
    {
      title: "Recurrence floods the world deck",
      detail:
        "Other hazards add a repeating threat to the top of the world deck, so clearing one problem can put the next one directly in your path. Clearing is rarely pure upside.",
    },
    {
      title: "Tidal rewards set the top of your deck",
      detail:
        "Reward cards like Mark the Shelf and Shelf Map let you choose which discard returns to the top, turning the discard pile into deliberately planned future draws.",
    },
    {
      title: "Anchor against a snatch",
      detail:
        "The rising books can grab a card from your hand outright. Anchor the Memory braces against the next such snatch, so save it for the turn the creature is about to act.",
    },
  ],
};
