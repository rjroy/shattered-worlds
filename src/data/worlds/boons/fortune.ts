import type { RawCardSource } from "../../../core/model/catalog";
import fortuneJson from "./fortune.json";

export const FORTUNE_BOON_SOURCE = fortuneJson as unknown as RawCardSource;

export const FORTUNE_BOON_POOLS = {
  "fortune-v1": [
    "Lucky Break",
    "Second Wind",
    "Found Tool",
    "Clear Path",
    "Steady Nerve",
  ],
} as const;
