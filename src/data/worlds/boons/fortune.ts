import type { CardTemplateId } from "../../../core/model/types";

/**
 * A boon set is a pool of self-contained player cards that can be offered to
 * the player as rewards (via OfferBoon effects). Each set has a name and a
 * list of template ids. All card templates live in the unified allCards.json;
 * this file only tracks which ids belong together per set.
 */
export type BoonSetDefinition = {
  readonly setName: string;
  readonly templateIds: readonly CardTemplateId[];
};

export const BOON_SETS = {
  "fortune-v1": {
    setName: "Fortune Tokens",
    templateIds: ["Lucky Break", "Second Wind", "Found Tool", "Clear Path", "Steady Nerve"],
  },
  "big-box-boons": {
    setName: "Big Box Boons",
    templateIds: ["React to Noise", "Fast Sweep", "Listen", "player-scream", "Plan"],
  },
  "whiteout-boons": {
    setName: "Whiteout Boons",
    templateIds: ["Ice Scraper", "Burn The Manual", "Space Heater", "Jumper Cables"],
  },
  "tidal-boons": {
    setName: "Tidal Boons",
    templateIds: [
      "Mark the Shelf",
      "Cross-Reference",
      "Waterproof Notes",
      "Anchor the Memory",
      "Shelf Map",
    ],
  },
  // Ember's Hatchery Harvest offer. Only the five *self-contained* tools live
  // here (the three originals plus Keep Vigil and Bank the Heat). The two
  // hazard-spawning rewards (Take One, Glasshouse Lantern) and Dormant Star
  // reference Ember world cards, so they are authored in the-ember-orchard/cards.json
  // and granted via GainCard instead.
  "ember-boons": {
    setName: "Hatchery Boons",
    templateIds: [
      "Leave One",
      "Star-Pruner",
      "Constellation Shears",
      "Keep Vigil",
      "Bank the Heat",
    ],
  },
  // City of Sleeping Giants' Surveyor's Kit offer. Only the four *self-contained*
  // tools live here. The fifth reward (Follow The Vein) top-decks the Vein-Road Surge
  // *world* card, so it cannot live in a boon set; it is authored in
  // city-of-sleeping-giants/cards.json and granted via GainCard on Vein-Road Surge's
  // onCleared instead. Bone Pin's Modal references Quiet Survey / Brace The Ward,
  // both in this set, so it resolves.
  "giants-boons": {
    setName: "Surveyor Boons",
    templateIds: ["Quiet Survey", "Brace The Ward", "Bone Pin", "Contour Map"],
  },
} as const satisfies Record<string, BoonSetDefinition>;

export const FORTUNE_BOON_POOLS = {
  "fortune-v1": BOON_SETS["fortune-v1"].templateIds,
  "big-box-boons": BOON_SETS["big-box-boons"].templateIds,
  "tidal-boons": BOON_SETS["tidal-boons"].templateIds,
  "ember-boons": BOON_SETS["ember-boons"].templateIds,
  "giants-boons": BOON_SETS["giants-boons"].templateIds,
} as const;
