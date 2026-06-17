import type { RunModifiers } from "../../data/unlocks/types";
import type { CardCatalog } from "../model/catalog";
import type { CardTemplateId, GameEvent, GameState } from "../model/types";
import { nextFloat, shuffle } from "./rng";

type ActBoonModifier = NonNullable<RunModifiers["actBoon"]>;

export function createActBoonOffer(
  catalog: CardCatalog,
  state: GameState,
  actBoon: ActBoonModifier,
  act: number,
): { state: GameState; event: GameEvent } {
  const legalIds: CardTemplateId[] = [];
  const seen = new Set<CardTemplateId>();

  for (const templateId of actBoon.poolTemplateIds) {
    if (seen.has(templateId)) continue;
    seen.add(templateId);

    const template = catalog[templateId];
    if (template?.kind === "player" && template.exhaust === true) {
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
  const offeredTemplateIds =
    shuffledIds.length >= actBoon.offeredCount
      ? shuffledIds.slice(0, actBoon.offeredCount)
      : shuffledIds;

  return {
    state: {
      ...state,
      rng: nextRng,
      pendingActBoon: {
        act,
        poolId: actBoon.poolId,
        offeredTemplateIds,
        chooseCount: 1,
      },
    },
    event: { type: "ActBoonOffered", act, templateIds: offeredTemplateIds },
  };
}
