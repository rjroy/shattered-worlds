import type { WorldDisplayData, WorldHelpData } from '../types'

export const OVERGROWN_MALL_DISPLAY: WorldDisplayData = {
  name: "Mall Reclaimnation",
  tagline: "The mall is being reclaimed by nature. As you watch.",
  story:
    "The skylight gave way before the alarms did. Vines move through the concourse faster than evacuation signs can point, turning kiosks and planters into a damp green maze. Somewhere past the food court, the emergency doors are already buried.",
  backgroundKey: "overgrown-mall-bg",
}

export const OVERGROWN_MALL_HELP: WorldHelpData = {
  mechanics: [
    {
      title: "Spores pollute your deck",
      detail:
        "Mall hazards add Spore cards to your discard pile or the top of your deck. A Spore does nothing when played, but playing it exhausts it and removes it for the rest of the run.",
    },
    {
      title: "Bloom scales with Spores",
      detail:
        "Bloom deals 1 progress plus 1 more for each Spore still in your hand. Pruning Spores keeps your deck clean; holding them can make Bloom hit harder.",
    },
    {
      title: "Infestation gets faster",
      detail:
        "Early hazards infest when discarded. Later hazards add Spores at end of turn or put them straight on top of your deck for the next draw.",
    },
    {
      title: "Prune for tempo",
      detail:
        "Pruning Shears destroys a card from hand and refunds energy. Use it to clear Spores or convert dead cards into a cleaner turn.",
    },
  ],
}
