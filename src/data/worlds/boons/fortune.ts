import type { RawCardSource } from "../../../core/model/catalog";
import type { CardTemplateId } from "../../../core/model/types";
import fortuneJson from "./fortune.json";
import bigBoxJson from "./big-box.json";
import tidalJson from "./tidal.json";

export const FORTUNE_BOON_SOURCE = fortuneJson as unknown as RawCardSource;
export const BIG_BOX_BOON_SOURCE = bigBoxJson as unknown as RawCardSource;
export const TIDAL_BOON_SOURCE = tidalJson as unknown as RawCardSource;

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
    templateIds: ["React to Noise", "Fast Sweep", "Listen"],
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
} as const satisfies Record<string, BoonSetDefinition>;

export const FORTUNE_BOON_POOLS = {
  "fortune-v1": BOON_SETS["fortune-v1"].templateIds,
  "big-box-boons": BOON_SETS["big-box-boons"].templateIds,
  "tidal-boons": BOON_SETS["tidal-boons"].templateIds,
} as const;
