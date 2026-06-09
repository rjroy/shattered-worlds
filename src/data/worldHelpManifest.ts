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
    ],
  },
  'bird-building': {
    mechanics: [
      {
        title:  'Mechanic notes coming',
        detail: 'This world\'s mechanics are still being tuned. Notes will be added after rebalancing.',
      },
    ],
  },
  'highway-volcano': {
    mechanics: [
      {
        title:  'Mechanic notes coming',
        detail: 'This world\'s mechanics are still being tuned. Notes will be added after rebalancing.',
      },
    ],
  },
}
