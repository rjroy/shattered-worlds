import type { WorldDisplayData, WorldHelpData } from '../types'

export const HIGHWAY_VOLCANO_DISPLAY: WorldDisplayData = {
  name: "Highway Eruption",
  tagline: "Rush hour. Lava flow. Pick one.",
  story:
    "The highway is packed with cars, but no one is honking. The rumbling starts as a low vibration, but quickly escalates into a deafening roar. The ground splits open.",
  backgroundKey: "highway-volcano-bg",
}

export const HIGHWAY_VOLCANO_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Slow blocks your best cards",
      detail:
        "Gridlock and Ash Fall are Slow. Sprint and Push Through deal bonus progress against Slow hazards — keep them in hand for the clog.",
    },
    {
      title: "Exhaust consumables",
      detail:
        "Nitro and Ditch Gear are exhaust cards — they are destroyed on play, not recycled. Use them for burst tempo; you only get one shot.",
    },
    {
      title: "Lava Flow escalates",
      detail:
        "Each Lava Flow end-of-turn deals ForceDestroy and adds an Ash Fall. Kill them before they cascade.",
    },
    {
      title: "Floor It skips the world deck",
      detail:
        "Floor It exiles the top two exilable cards from the world deck, removing them permanently. Use it to skip Lava Flow or Gridlock before they reach your hand — but it cannot skip The Walker or the Door.",
    },
  ],
}
