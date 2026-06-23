import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import { WHITEOUT_PARKING_GARAGE_THEME } from "./theme";
import { WHITEOUT_PARKING_GARAGE_DISPLAY, WHITEOUT_PARKING_GARAGE_HELP } from "./meta";

export const WHITEOUT_PARKING_GARAGE_BUNDLE: WorldDataBundle = {
  id: "whiteout-parking-garage",
  deck: { cardsImport: cardsJson },
  theme: WHITEOUT_PARKING_GARAGE_THEME,
  display: WHITEOUT_PARKING_GARAGE_DISPLAY,
  help: WHITEOUT_PARKING_GARAGE_HELP,
  musicKey: "music-whiteout-parking-garage",
  usesHeat: true,
};
