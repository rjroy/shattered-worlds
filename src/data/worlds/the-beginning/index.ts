import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import { THE_BEGINNING_THEME } from "./theme";
import { THE_BEGINNING_DISPLAY, THE_BEGINNING_HELP } from "./meta";

export const THE_BEGINNING_BUNDLE: WorldDataBundle = {
  id: "the-beginning",
  deck: { cardsImport: cardsJson },
  theme: THE_BEGINNING_THEME,
  display: THE_BEGINNING_DISPLAY,
  help: THE_BEGINNING_HELP,
  musicKey: "music-the-beginning",
};
