import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import type { RawCardSource } from "../../../core/model/catalog";
import { WHITEOUT_PARKING_GARAGE_THEME } from "./theme";
import { WHITEOUT_PARKING_GARAGE_DISPLAY, WHITEOUT_PARKING_GARAGE_HELP } from "./meta";

export const WHITEOUT_PARKING_GARAGE_BUNDLE: WorldDataBundle = {
  id: "whiteout-parking-garage",
  source: cardsJson as unknown as RawCardSource,
  theme: WHITEOUT_PARKING_GARAGE_THEME,
  display: WHITEOUT_PARKING_GARAGE_DISPLAY,
  help: WHITEOUT_PARKING_GARAGE_HELP,
  musicKey: "music-whiteout-parking-garage",
  usesHeat: true,
};
