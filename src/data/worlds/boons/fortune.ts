import type { RawCardSource } from "../../../core/model/catalog";
import type { CardTemplateId } from "../../../core/model/types";
import fortuneJson from "./fortune.json";

export const FORTUNE_BOON_SOURCE = fortuneJson as unknown as RawCardSource;

export type BoonSetDefinition = {
  readonly source: RawCardSource;
  readonly templateIds: readonly CardTemplateId[];
};

export const BOON_SETS = {
  "fortune-v1": {
    source: FORTUNE_BOON_SOURCE,
    templateIds: [
      "Lucky Break",
      "Second Wind",
      "Found Tool",
      "Clear Path",
      "Steady Nerve",
    ],
  },
} as const satisfies Record<string, BoonSetDefinition>;

export const FORTUNE_BOON_POOLS = {
  "fortune-v1": BOON_SETS["fortune-v1"].templateIds,
} as const;
