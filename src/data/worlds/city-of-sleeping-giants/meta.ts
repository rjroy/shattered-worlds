import type { WorldDisplayData, WorldHelpData } from "../types";

export const CITY_OF_SLEEPING_GIANTS_DISPLAY: WorldDisplayData = {
  name: "City of Sleeping Giants",
  tagline:
    "A violet metropolis raised across the bodies of sleeping giants. Now the giants are starting to remember.",
  story:
    "The city was built clever: vein-roads and bone anchors threaded between vast sleeping bodies, a violet skyline laced with cyan transit and emerald wards that kept the giants under. It was beautiful while it slept. Then the Walker crossed the districts and the bodies began to remember the route. A tremor you ignore returns as a fingerquake; a district you exploit is recalled into the body at a larger scale. The same movement comes back, heavier each time, until the giant turns fully in its sleep. The Door waits somewhere past the last ward, if the city is still standing when you reach it.",
  difficulty: 5,
  backgroundKey: "city-of-sleeping-giants-bg",
};

export const CITY_OF_SLEEPING_GIANTS_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Unresolved movement returns",
      detail:
        "Tremors and reflexes you leave half-cleared or discard do not vanish. Many top-deck a stronger body-reflex hazard, so an incomplete answer brings the same movement back at a larger scale.",
    },
    {
      title: "Hazards transform at end of turn",
      detail:
        "Some districts replace themselves at the end of the turn, putting their reflex successor on top of the world deck. What you leave standing becomes a worse problem next turn.",
    },
    {
      title: "Survey and quiet the next movement",
      detail:
        "Surveyor rewards let you exile a coming hazard, brace against a snatch, or read the body's contours. Spend them to break a recurring chain before it densifies.",
    },
    {
      title: "Brace against the shake",
      detail:
        "The giant's movement shakes cards loose from your hand. Brace charges absorb a snatch before it can destroy a card, so the defense rewards pay off against the tremors and the Giant's turn.",
    },
    {
      title: "Follow The Vein trades tempo for a known future",
      detail:
        "Follow The Vein draws and refunds energy now, but top-decks a Vein-Road Surge you will have to answer. The signature threat keeps returning known problems until you clear it, quiet the deck, or reach the Door.",
    },
  ],
};
