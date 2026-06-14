import type { WorldDisplayData, WorldHelpData } from '../types'

export const BIRD_BUILDING_DISPLAY: WorldDisplayData = {
  name: "Last Day at the Office",
  tagline: "You were going to quit anyway.",
  story:
    "The office is eerily quiet. The hum of the fluorescent lights is punctuated by the occasional thud and fluttering sound from the ceiling. A girder sized claw pierces through the side of the building as it is lifted into the air.",
  backgroundKey: "bird-building-bg",
}

export const BIRD_BUILDING_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Birds snatch your cards",
      detail:
        "Discarding some hazards result in a random card being destroyed from your  next hand.",
    },
    {
      title: "Debris as ammunition",
      detail:
        "Cut It Loose turns a card you destroy into progress. Pair it with the snatch hazards for a tempo gain instead of a pure loss.",
    },
    {
      title: "Steady absorbs a snatch",
      detail:
        "Steady gives you one Brace charge. When the next ForceDestroy would destroy a card from your hand, Brace absorbs it instead. Stack charges with multiple Steady plays.",
    },
  ],
}
