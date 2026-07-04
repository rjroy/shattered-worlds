import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import { ANSWERS_THEME } from "./theme";
import { ANSWERS_DISPLAY, ANSWERS_HELP } from "./meta";

export const ANSWERS_BUNDLE: WorldDataBundle = {
  id: "answers",
  deck: { cardsImport: cardsJson },
  theme: ANSWERS_THEME,
  display: ANSWERS_DISPLAY,
  help: ANSWERS_HELP,
  musicKey: "music-answers",
};
