import allCardsJson from "./allCards.json";
import boolPoolsJson from "./boonPools.json";
import starterJson from "./starterDecks/starter.json";
import footballerJson from "./starterDecks/footballer.json";
import harvesterJson from "./starterDecks/harvester.json";
import contractorJson from "./starterDecks/contractor.json";
import surveyorJson from "./starterDecks/surveyor.json";
import archivistJson from "./starterDecks/archivist.json";
import survivalistJson from "./starterDecks/survivalist.json";
import firemanJson from "./starterDecks/fireman.json";
import gardenerJson from "./starterDecks/gardener.json";
import stuntDriverJson from "./starterDecks/stunt-driver.json";
import { worldDataRegistry } from "./worlds/registry";
import type {
  CardCatalog,
  RawCardSource,
  WorldData,
  AssembledWorld,
  DeckComposition,
  CardCount,
} from "../core/model/catalog";
import { assembleCatalog } from "../core/model/catalog";
import { CardEffect, CardTemplateId } from "../core";

// ---------------------------------------------------------------------------
// Global card catalog — loaded once at import time from the unified file.
// All template definitions for every world and all boon sets live here.
// ---------------------------------------------------------------------------

const rawAllCards = allCardsJson as unknown as RawCardSource;
export const CARD_CATALOG: CardCatalog = assembleCatalog([rawAllCards]);

// ---------------------------------------------------------------------------
// Starter deck registry
// ---------------------------------------------------------------------------

interface StarterEntry {
  templateId: string;
  count: number;
}

const RESOLVE_STARTER_DECKS: Record<string, readonly StarterEntry[]> = {
  starter: (starterJson as unknown as { starterDeck: readonly StarterEntry[] }).starterDeck,
  footballer: (footballerJson as unknown as { starterDeck: readonly StarterEntry[] }).starterDeck,
  contractor: (contractorJson as unknown as { starterDeck: readonly StarterEntry[] }).starterDeck,
  harvester: (harvesterJson as unknown as { starterDeck: readonly StarterEntry[] }).starterDeck,
  archivist: (archivistJson as unknown as { starterDeck: readonly StarterEntry[] }).starterDeck,
  surveyor: (surveyorJson as unknown as { starterDeck: readonly StarterEntry[] }).starterDeck,
  survivalist: (survivalistJson as unknown as { starterDeck: readonly StarterEntry[] }).starterDeck,
  fireman: (firemanJson as unknown as { starterDeck: readonly StarterEntry[] }).starterDeck,
  gardener: (gardenerJson as unknown as { starterDeck: readonly StarterEntry[] }).starterDeck,
  "stunt-driver": (stuntDriverJson as unknown as { starterDeck: readonly StarterEntry[] })
    .starterDeck,
};

export const STARTER_DECK_IDS: readonly string[] = Object.keys(RESOLVE_STARTER_DECKS);

// ---------------------------------------------------------------------------
// Boon pools for fortune cards
// ---------------------------------------------------------------------------

export type BoonPoolSet = Record<string, CardTemplateId[]>;

export const FORTUNE_BOON_POOLS = boolPoolsJson as unknown as BoonPoolSet;
// ---------------------------------------------------------------------------
// World builder — returns AssembledWorld pairing the global catalog with
// a specific world's deck and chosen starter.
//
// Each world's stripped cards.json retains worldId, deckComposition and
// optional per-world settings (startLight, startHeat, onEndOfTurnPassive).
// Card templates are no longer embedded here — they live in allCards.json.
// ---------------------------------------------------------------------------

export function buildWorld(worldId: string, starterId: string = "starter"): AssembledWorld {
  // Find the bundle by id
  const bundle = worldDataRegistry.find((b) => b.id === worldId);
  if (bundle === undefined) {
    throw new Error(
      `Unknown world id: ${worldId}. Registered: ${worldDataRegistry.map((b) => b.id).join(", ")}`,
    );
  }

  const descriptor = bundle.deck.cardsImport as Record<string, unknown>;
  if (!descriptor || !descriptor.deckComposition) {
    throw new Error(`World "${worldId}" deck data not loaded`);
  }

  const starterDeck = RESOLVE_STARTER_DECKS[starterId];
  if (starterDeck === undefined) {
    throw new Error(
      `Unknown starter deck: ${starterId}. Available: ${Object.keys(RESOLVE_STARTER_DECKS).join(", ")}`,
    );
  }

  const worldData: WorldData = {
    worldId: bundle.id,
    deckComposition: descriptor.deckComposition as DeckComposition,
    starterDeck: starterDeck as CardCount[],
    startHeat: (descriptor.startHeat as number) ?? 0,
    startLight: (descriptor.startLight as number) ?? 0,
    onEndOfTurnPassive: descriptor.onEndOfTurnPassive as CardEffect,
  };

  return {
    catalog: CARD_CATALOG,
    worldData,
  };
}

// ---------------------------------------------------------------------------
// Public manifest — Record<worldId, (starterId) => AssembledWorld>
// ---------------------------------------------------------------------------

export const worldManifest = Object.fromEntries(
  worldDataRegistry.map((bundle) => [
    bundle.id,
    (starterId: string = "starter") => buildWorld(bundle.id, starterId),
  ]),
) as Record<string, (starterId: string) => AssembledWorld>;
