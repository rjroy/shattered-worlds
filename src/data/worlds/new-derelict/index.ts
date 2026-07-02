import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import { NEW_DERELICT_DISPLAY, NEW_DERELICT_HELP } from "./meta";
import { NEW_DERELICT_THEME } from "./theme";

export const NEW_DERELICT_BUNDLE: WorldDataBundle = {
  id: "new-derelict",
  deck: { cardsImport: cardsJson },
  theme: NEW_DERELICT_THEME,
  display: NEW_DERELICT_DISPLAY,
  help: NEW_DERELICT_HELP,
  // Temporary authorized reuse until New Derelict receives a dedicated track.
  musicKey: "music-eden-prime",
};
