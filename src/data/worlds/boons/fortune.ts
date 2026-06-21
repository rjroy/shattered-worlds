import type { RawCardSource } from "../../../core/model/catalog";
import type { CardTemplateId } from "../../../core/model/types";
import fortuneJson from "./fortune.json";
import bigBoxJson from "./big-box.json";
import tidalJson from "./tidal.json";
import emberJson from "./ember.json";
import giantsJson from "./giants.json";

export const FORTUNE_BOON_SOURCE = fortuneJson as unknown as RawCardSource;
export const BIG_BOX_BOON_SOURCE = bigBoxJson as unknown as RawCardSource;
export const TIDAL_BOON_SOURCE = tidalJson as unknown as RawCardSource;
export const EMBER_BOON_SOURCE = emberJson as unknown as RawCardSource;
export const GIANTS_BOON_SOURCE = giantsJson as unknown as RawCardSource;

export type BoonSetDefinition = {
  readonly source: RawCardSource;
  readonly templateIds: readonly CardTemplateId[];
};

export const BOON_SETS = {
  "fortune-v1": {
    source: FORTUNE_BOON_SOURCE,
    templateIds: ["Lucky Break", "Second Wind", "Found Tool", "Clear Path", "Steady Nerve"],
  },
  "big-box-boons": {
    source: BIG_BOX_BOON_SOURCE,
    templateIds: ["React to Noise", "Fast Sweep", "Listen", "player-scream", "Plan"],
  },
  "tidal-boons": {
    source: TIDAL_BOON_SOURCE,
    templateIds: [
      "Mark the Shelf",
      "Cross-Reference",
      "Waterproof Notes",
      "Anchor the Memory",
      "Shelf Map",
    ],
  },
  // Ember's Hatchery Harvest offer. Only the five *self-contained* tools live
  // here (the three originals plus Keep Vigil and Bank the Heat): a globally-merged
  // boon source must resolve in every world catalog, and the worldManifest sync
  // test requires templateIds to equal the source's cardTemplates exactly. The two
  // hazard-spawning rewards (Take One, Glasshouse Lantern) and Dormant Star
  // reference Ember world cards, so they are authored in the-ember-orchard/cards.json
  // and granted via GainCard instead — see the deviation note in the plan/retro.
  "ember-boons": {
    source: EMBER_BOON_SOURCE,
    templateIds: [
      "Leave One",
      "Star-Pruner",
      "Constellation Shears",
      "Keep Vigil",
      "Bank the Heat",
    ],
  },
  // City of Sleeping Giants' Surveyor's Kit offer. Only the four *self-contained*
  // tools live here. Same constraint as ember-boons: a globally-merged boon source
  // must resolve in every world catalog, and the worldManifest sync test requires
  // templateIds to equal the source's cardTemplates exactly. The fifth reward
  // (Follow The Vein) top-decks the Vein-Road Surge *world* card, so it cannot
  // live in a boon set; it is authored in city-of-sleeping-giants/cards.json and
  // granted via GainCard on Vein-Road Surge's onCleared instead. Bone Pin's Modal
  // references Quiet Survey / Brace The Ward, both in this set, so it resolves.
  "giants-boons": {
    source: GIANTS_BOON_SOURCE,
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
