import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import { QUESTIONS_THEME } from "./theme";
import { QUESTIONS_DISPLAY, QUESTIONS_HELP } from "./meta";

export const QUESTIONS_BUNDLE: WorldDataBundle = {
  id: "questions",
  deck: { cardsImport: cardsJson },
  theme: QUESTIONS_THEME,
  display: QUESTIONS_DISPLAY,
  help: QUESTIONS_HELP,
  musicKey: "music-questions",
};
