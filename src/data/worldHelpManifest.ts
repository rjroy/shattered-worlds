/**
 * Help overlay content for each world — shown in the in-game help screen.
 * This file has no game-logic dependency and must NOT be imported by core or
 * engine modules; it is UI-only.
 */

export interface WorldMechanicNote {
  title:  string
  detail: string
}

export interface WorldHelpData {
  mechanics: readonly WorldMechanicNote[]
}

export const worldHelpManifest: Record<string, WorldHelpData> = {
  'zombie-big-box': {
    mechanics: [
      {
        title:  'Zombies grow',
        detail: 'A Zombie in your hand deals 1 damage and adds another Zombie to the world deck at end of every turn. Clear them before they multiply.',
      },
      {
        title:  'Corpses transform',
        detail: 'A Corpse becomes a Zombie at end of turn. Corpses cannot be discarded; they must be cleared or endured.',
      },
      {
        title:  'Costly discards',
        detail: 'Discarding a Zombie costs 5 HP. Know your limits before you cut your losses.',
      },
      {
        title:  'The Walker and the Door',
        detail: 'The Walker (Act 3, cost 10) is the final hazard. Clearing it adds Summon Door to your hand. Play Summon Door to place the Door (a Hidden hazard, cost 4). Clear the Door to survive the world.',
      },
      {
        title: 'Kill energy',
        detail: 'Clearing a Zombie grants 1 energy. Chain kills to fund bigger plays.',
      },
      {
        title: 'Shelf Sweep clears the whole row',
        detail: "Shelf Sweep deals progress to every hazard in hand at once. With Creature bonus, each Zombie takes 2 progress. Chain Shelf Sweep with kill-energy Zombies for a self-funding cleanup turn.",
      },
    ],
  },
  'bird-building': {
    mechanics: [
      {
        title:  'Birds snatch your cards',
        detail: 'Discarding Sliding Debris or Gripping Talon triggers ForceDestroy — a random card from your next drawn hand is destroyed. You cannot choose which one.',
      },
      {
        title:  'Debris as ammunition',
        detail: 'Cut It Loose turns a card you destroy into progress. Pair it with the snatch hazards for a tempo gain instead of a pure loss.',
      },
      {
        title:  'The Walker and the Door',
        detail: 'The Walker (Act 3, cost 10) is the final hazard. Clearing it adds Summon Door to your hand. Play Summon Door to place the Door (a Hidden hazard, cost 4). Clear the Door to survive the world.',
      },
      {
        title: 'Steady absorbs a snatch',
        detail: 'Steady gives you one Brace charge. When the next ForceDestroy would destroy a card from your hand, Brace absorbs it instead. Stack charges with multiple Steady plays.',
      },
    ],
  },
  'highway-volcano': {
    mechanics: [
      {
        title:  'Slow blocks your best cards',
        detail: 'Gridlock and Ash Fall are Slow. Sprint and Push Through deal bonus progress against Slow hazards — keep them in hand for the clog.',
      },
      {
        title:  'Exhaust consumables',
        detail: 'Nitro and Ditch Gear are exhaust cards — they are destroyed on play, not recycled. Use them for burst tempo; you only get one shot.',
      },
      {
        title:  'Lava Flow escalates',
        detail: 'Each Lava Flow end-of-turn deals ForceDestroy and adds an Ash Fall. Kill them before they cascade.',
      },
      {
        title:  'The Walker and the Door',
        detail: 'The Walker (Act 3, cost 10) is the final hazard. Clearing it adds Summon Door to your hand. Play Summon Door to place the Door (a Hidden hazard, cost 4). Clear the Door to survive the world.',
      },
      {
        title: 'Floor It skips the world deck',
        detail: 'Floor It exiles the top two exilable cards from the world deck, removing them permanently. Use it to skip Lava Flow or Gridlock before they reach your hand — but it cannot skip The Walker or the Door.',
      },
    ],
  },
  'overgrown-mall': {
    mechanics: [
      {
        title: 'Spores pollute your deck',
        detail: 'Mall hazards add Spore cards to your discard pile or the top of your deck. A Spore does nothing when played, but playing it exhausts it and removes it for the rest of the run.',
      },
      {
        title: 'Bloom scales with Spores',
        detail: 'Bloom deals 1 progress plus 1 more for each Spore still in your hand. Pruning Spores keeps your deck clean; holding them can make Bloom hit harder.',
      },
      {
        title: 'Infestation gets faster',
        detail: 'Early hazards infest when discarded. Later hazards add Spores at end of turn or put them straight on top of your deck for the next draw.',
      },
      {
        title: 'Prune for tempo',
        detail: 'Pruning Shears destroys a card from hand and refunds energy. Use it to clear Spores or convert dead cards into a cleaner turn.',
      },
      {
        title: 'The Walker and the Door',
        detail: 'The Walker (Act 3, cost 10) is the final hazard. Clearing it adds Summon Door to your hand. Play Summon Door to place the Door (a Hidden hazard, cost 4). Clear the Door to survive the world.',
      },
    ],
  },
}
