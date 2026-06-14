import type { WorldDisplayData, WorldHelpData } from '../types'

export const ZOMBIE_BIG_BOX_DISPLAY: WorldDisplayData = {
  name: "The Big Box",
  tagline: "The mindless masses shuffle the aisles.",
  story:
    "The store never closes. You're halfway through a shift when the lights start flickering — the kind of flicker that isn't a power surge. The PA goes silent mid-announcement. Something is moving in the stockroom.",
  backgroundKey: "bigbox-reality",
}

export const ZOMBIE_BIG_BOX_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Zombies Multiply",
      detail: "Multiple cards lead to Zombie's be added into the world deck.",
    },
    {
      title: "Damaging Effects",
      detail:
        "Zombies deal damage when ignored, discarded, or not completely cleared. There are additional cards that also do damage when ignored.",
    },
    {
      title: "Row Clears",
      detail: "Some bonus cards provide the ability to apply progress to all visible hazards.",
    },
  ],
}
