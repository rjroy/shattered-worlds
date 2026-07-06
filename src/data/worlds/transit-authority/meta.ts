import type { WorldDisplayData, WorldHelpData } from "../types";

export const TRANSIT_AUTHORITY_DISPLAY: WorldDisplayData = {
  name: "The Transit Authority",
  tagline: "The most competent transit system in the multiverse.",
  story:
    "The Transit Authority is a glass-roofed terminal that routes any contradiction, provided it " +
    "has a platform, a fare, and an arrival time. Then the Walker arrives as a passenger the " +
    "system cannot process, and it responds by changes the route. Departure boards flip to " +
    "SERVICE SUSPENDED and ENTITY DETECTED as the terminal quarantines every realm.",
  difficulty: 3,
  cycle: 4,
  backgroundKey: "transit-authority-bg",
};

export const TRANSIT_AUTHORITY_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Hazards reassign the next card",
      detail:
        "Left unanswered, hazards pin forced connections to the top of your deck and top-deck " +
        "world hazards as reassigned departures — the system decides what comes next for both decks.",
    },
    {
      title: "Some hazards force transfers",
      detail:
        "Certain hazards force a transfer: discard then draw. Treat forced motion as attempted " +
        "boarding, not free tempo.",
    },
    {
      title: "Rewards refuse or reclaim the route",
      detail:
        "Some rewards exile the next assigned departures before they arrive; others pin your own " +
        "chosen card to the top of your deck, proving you control the route instead of the system.",
    },
    {
      title: "Board Anyway trades a known reroute for tempo",
      detail:
        "Board Anyway clears now and refunds energy, but accepts a known reassignment onto the " +
        "world deck in exchange.",
    },
    {
      title: "Reroute taxes the reassigned card",
      detail:
        "Reassigned world cards carry a transient Reroute keyword that raises their own clear cost " +
        "by one per stack. Check the Board and Express Transfer strip Reroute from cards in hand as " +
        "part of refusing the assigned route.",
    },
    {
      title: "Entity Detected reroutes everything",
      detail:
        "The signature threat repeatedly reroutes the network until it is cleared, its assigned " +
        "routes are exiled, or the Door is reached.",
    },
  ],
};
