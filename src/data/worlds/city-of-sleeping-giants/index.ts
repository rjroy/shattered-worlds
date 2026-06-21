import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import type { RawCardSource } from "../../../core/model/catalog";
import { CITY_OF_SLEEPING_GIANTS_THEME } from "./theme";
import { CITY_OF_SLEEPING_GIANTS_DISPLAY, CITY_OF_SLEEPING_GIANTS_HELP } from "./meta";

export const CITY_OF_SLEEPING_GIANTS_BUNDLE: WorldDataBundle = {
  id: "city-of-sleeping-giants",
  source: cardsJson as unknown as RawCardSource,
  theme: CITY_OF_SLEEPING_GIANTS_THEME,
  display: CITY_OF_SLEEPING_GIANTS_DISPLAY,
  help: CITY_OF_SLEEPING_GIANTS_HELP,
  musicKey: "music-city-of-sleeping-giants",
};
