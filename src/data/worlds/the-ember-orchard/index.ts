import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import { THE_EMBER_ORCHARD_THEME } from "./theme";
import { THE_EMBER_ORCHARD_DISPLAY, THE_EMBER_ORCHARD_HELP } from "./meta";

export const THE_EMBER_ORCHARD_BUNDLE: WorldDataBundle = {
  id: "the-ember-orchard",
  deck: { cardsImport: cardsJson },
  theme: THE_EMBER_ORCHARD_THEME,
  display: THE_EMBER_ORCHARD_DISPLAY,
  help: THE_EMBER_ORCHARD_HELP,
  musicKey: "music-the-ember-orchard",
};
