import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import type { RawCardSource } from "../../../core/model/catalog";
import { THE_EMBER_ORCHARD_THEME } from "./theme";
import { THE_EMBER_ORCHARD_DISPLAY, THE_EMBER_ORCHARD_HELP } from "./meta";

export const THE_EMBER_ORCHARD_BUNDLE: WorldDataBundle = {
  id: "the-ember-orchard",
  source: cardsJson as unknown as RawCardSource,
  theme: THE_EMBER_ORCHARD_THEME,
  display: THE_EMBER_ORCHARD_DISPLAY,
  help: THE_EMBER_ORCHARD_HELP,
  musicKey: "music-the-ember-orchard",
};
