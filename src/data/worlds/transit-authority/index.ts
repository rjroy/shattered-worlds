import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import { TRANSIT_AUTHORITY_THEME } from "./theme";
import { TRANSIT_AUTHORITY_DISPLAY, TRANSIT_AUTHORITY_HELP } from "./meta";

export const TRANSIT_AUTHORITY_BUNDLE: WorldDataBundle = {
  id: "transit-authority",
  deck: { cardsImport: cardsJson },
  theme: TRANSIT_AUTHORITY_THEME,
  display: TRANSIT_AUTHORITY_DISPLAY,
  help: TRANSIT_AUTHORITY_HELP,
  musicKey: "music-transit-authority",
};
