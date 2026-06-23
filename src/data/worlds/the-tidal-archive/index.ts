import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import { THE_TIDAL_ARCHIVE_THEME } from "./theme";
import { THE_TIDAL_ARCHIVE_DISPLAY, THE_TIDAL_ARCHIVE_HELP } from "./meta";

export const THE_TIDAL_ARCHIVE_BUNDLE: WorldDataBundle = {
  id: "the-tidal-archive",
  deck: { cardsImport: cardsJson },
  theme: THE_TIDAL_ARCHIVE_THEME,
  display: THE_TIDAL_ARCHIVE_DISPLAY,
  help: THE_TIDAL_ARCHIVE_HELP,
  musicKey: "music-the-tidal-archive",
};
