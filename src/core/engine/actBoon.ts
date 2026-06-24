import type { RunModifiers } from "../../data/unlocks/types";
import type { CardCatalog } from "../model/catalog";
import type {
  BoonChoiceSource,
  CardTemplateId,
  GameEvent,
  GameState,
  PendingBoonChoice,
} from "../model/types";
import { filterLegalPlayerCandidates, weightedDraw } from "./weightedDraw";

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
  const legalIds = filterLegalPlayerCandidates(catalog, config.poolTemplateIds);

  const { templateIds: offeredTemplateIds, rng: nextRng } = weightedDraw(
    catalog,
    state.rng,
    legalIds,
    config.offeredCount,
    state.runModifiers.rarityBonus,
  );

  if (legalIds.length === 0) {
    return { state: { ...state, rng: nextRng }, event: null };
  }

  const offeredRarities = offeredTemplateIds.map((id) => catalog[id]?.rarity ?? "common");

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
          rarities: offeredRarities,
        }
      : {
          type: "BoonOffered",
          source: config.source,
          setId: config.setId,
          setName: config.setName,
          templateIds: offeredTemplateIds,
          rarities: offeredRarities,
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
