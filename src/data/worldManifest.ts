import { CatalogError } from "../core";
import { assembleCatalog } from "../core/model/catalog";
import type { RawCardSource, WorldData, AssembledWorld } from "../core/model/catalog";
import basicJson from "./worlds/starters/basic.json";
import starterJson from "./worlds/starters/starter.json";
import footballerJson from "./worlds/starters/footballer.json";
import { worldDataRegistry } from "./worlds/registry";
import { BOON_SETS } from "./worlds/boons/fortune";

const BASIC_SOURCE = basicJson as unknown as RawCardSource;

const STARTER_SOURCES = [
  starterJson as unknown as RawCardSource,
  footballerJson as unknown as RawCardSource,
];

const BOON_SET_SOURCES = Object.values(BOON_SETS).map((set) => set.source);

/**
 * Build a world by merging the shared starter source with one world-specific
 * source: the merged catalog holds both, the world descriptor pairs the starter
 * deck with the world's own act composition.
 */
function makeWorldBuilder(worldSource: RawCardSource): (starterId: string) => AssembledWorld {
  return (starterId: string) => {
    console.log(`Make world with starter: ${starterId}`);
    if (BASIC_SOURCE === undefined || worldSource === undefined) {
      throw new CatalogError("JSON not available in Phaser cache");
    }

    // The starter source is always available and must be present.
    const starterSource = STARTER_SOURCES.find((s) => s.worldId === starterId);

    // Fail fast on an authoring mistake: the starter source must carry the
    // shared deck, and each world source must carry its own act composition.
    // A missing field here would otherwise surface as a confusing crash mid-run.
    if (starterSource === undefined || starterSource.starterDeck === undefined) {
      throw new CatalogError(`Could not find starter deck for "${starterId}"`);
    }
    if (worldSource.deckComposition === undefined) {
      throw new CatalogError(`world "${worldSource.worldId}" is missing deckComposition`);
    }

    const catalog = assembleCatalog([BASIC_SOURCE, ...BOON_SET_SOURCES, worldSource]);
    const worldData: WorldData = {
      worldId: worldSource.worldId,
      starterDeck: starterSource.starterDeck,
      deckComposition: worldSource.deckComposition,
      // Spread only when present so exactOptionalPropertyTypes stays satisfied
      // (omitted means default 0 in createWorld; non-Fog sources omit it).
      ...(worldSource.startLight !== undefined ? { startLight: worldSource.startLight } : {}),
      ...(worldSource.startHeat !== undefined ? { startHeat: worldSource.startHeat } : {}),
      ...(worldSource.onEndOfTurnPassive !== undefined
        ? { onEndOfTurnPassive: worldSource.onEndOfTurnPassive }
        : {}),
    };

    return { catalog, worldData };
  };
}

export const worldManifest: Record<string, (starterId: string) => AssembledWorld> =
  Object.fromEntries(
    worldDataRegistry.map((bundle) => [bundle.id, makeWorldBuilder(bundle.source)]),
  );

export function buildWorld(worldId: string, starterId: string = "starter"): AssembledWorld {
  const builder = worldManifest[worldId];
  if (typeof builder !== "function") {
    throw new CatalogError(`No world builder found for worldId "${worldId}"`);
  }
  return builder(starterId);
}
