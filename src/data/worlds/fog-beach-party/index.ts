import type { WorldDataBundle } from "../types";
import cardsJson from "./cards.json";
import type { RawCardSource } from "../../../core/model/catalog";
import { FOG_BEACH_PARTY_THEME } from "./theme";
import { FOG_BEACH_PARTY_DISPLAY, FOG_BEACH_PARTY_HELP } from "./meta";

export const FOG_BEACH_PARTY_BUNDLE: WorldDataBundle = {
  id: "fog-beach-party",
  source: cardsJson as unknown as RawCardSource,
  theme: FOG_BEACH_PARTY_THEME,
  display: FOG_BEACH_PARTY_DISPLAY,
  help: FOG_BEACH_PARTY_HELP,
  musicKey: "music-fog-beach-party",
  usesLight: true,
};
