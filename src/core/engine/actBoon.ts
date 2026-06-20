import type { RunModifiers } from "../../data/unlocks/types";
import type { CardCatalog } from "../model/catalog";
import type {
  BoonChoiceSource,
  CardTemplateId,
  GameEvent,
  GameState,
  PendingBoonChoice,
} from "../model/types";
import { nextFloat, shuffle } from "./rng";

type ActBoonModifier = NonNullable<RunModifiers["actBoon"]>;

type BoonOfferConfig =
  | {
      readonly source: "act";
      readonly act: number;
      readonly setId: string;
      readonly setName: string;
      readonly poolTemplateIds: readonly CardTemplateId[];
      readonly offeredCount: number;
      readonly chooseCount: number;
      readonly bToDiscard?: boolean;
    }
  | {
      readonly source: Exclude<BoonChoiceSource, "act">;
      readonly setId: string;
      readonly setName: string;
      readonly poolTemplateIds: readonly CardTemplateId[];
      readonly offeredCount: number;
      readonly chooseCount: number;
      readonly bToDiscard?: boolean;
    };

export function createBoonOffer(
  catalog: CardCatalog,
  state: GameState,
  config: BoonOfferConfig,
): { state: GameState; event: GameEvent | null } {
  const legalIds: CardTemplateId[] = [];
  const seen = new Set<CardTemplateId>();

  for (const templateId of config.poolTemplateIds) {
    if (seen.has(templateId)) continue;
    seen.add(templateId);

    const template = catalog[templateId];
    if (template?.kind === "player") {
      legalIds.push(templateId);
    }
  }

  const [shuffledIds, shuffledRng] = shuffle(legalIds, state.rng);
  const rngWasAdvanced =
    shuffledRng.a !== state.rng.a ||
    shuffledRng.b !== state.rng.b ||
    shuffledRng.c !== state.rng.c ||
    shuffledRng.d !== state.rng.d;
  let nextRng = shuffledRng;
  if (!rngWasAdvanced) {
    [, nextRng] = nextFloat(shuffledRng);
  }

  if (legalIds.length === 0) {
    return { state: { ...state, rng: nextRng }, event: null };
  }

  const offeredTemplateIds =
    shuffledIds.length >= config.offeredCount
      ? shuffledIds.slice(0, config.offeredCount)
      : shuffledIds;

  const pending: PendingBoonChoice =
    config.source === "act"
      ? {
          source: "act",
          act: config.act,
          setId: config.setId,
          setName: config.setName,
          offeredTemplateIds,
          chooseCount: config.chooseCount,
          bToDiscard: config.bToDiscard ?? false,
        }
      : {
          source: config.source,
          setId: config.setId,
          setName: config.setName,
          offeredTemplateIds,
          chooseCount: config.chooseCount,
          bToDiscard: config.bToDiscard ?? false,
        };

  const event: GameEvent =
    config.source === "act"
      ? {
          type: "BoonOffered",
          source: "act",
          setId: config.setId,
          setName: config.setName,
          act: config.act,
          templateIds: offeredTemplateIds,
        }
      : {
          type: "BoonOffered",
          source: config.source,
          setId: config.setId,
          setName: config.setName,
          templateIds: offeredTemplateIds,
        };

  return {
    state: {
      ...state,
      rng: nextRng,
      pendingBoonChoices: [...state.pendingBoonChoices, pending],
    },
    event,
  };
}

export function createActBoonOffer(
  catalog: CardCatalog,
  state: GameState,
  actBoon: ActBoonModifier,
  act: number,
): { state: GameState; event: GameEvent | null } {
  return createBoonOffer(catalog, state, {
    source: "act",
    act,
    setId: actBoon.poolId,
    setName: actBoon.poolName,
    poolTemplateIds: actBoon.poolTemplateIds,
    offeredCount: actBoon.offeredCount,
    chooseCount: actBoon.chooseCount,
    bToDiscard: actBoon.bToDiscard ?? false,
  });
}
