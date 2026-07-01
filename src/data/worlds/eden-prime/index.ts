import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import { EDEN_PRIME_THEME } from "./theme";
import { EDEN_PRIME_DISPLAY, EDEN_PRIME_HELP } from "./meta";

export const EDEN_PRIME_BUNDLE: WorldDataBundle = {
  id: "eden-prime",
  deck: { cardsImport: cardsJson },
  theme: EDEN_PRIME_THEME,
  display: EDEN_PRIME_DISPLAY,
  help: EDEN_PRIME_HELP,
  musicKey: "music-eden-prime",
};
