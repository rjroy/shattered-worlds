import { reduce } from "../engine/reduce";
import { isConcealed } from "../model/keywords";
import type { Card, CardId, GameEvent, GameState } from "../model/types";
import type { CardCatalog } from "../model/catalog";

export type ActionPreviewSeverity = "info" | "notice" | "warning" | "danger";

export type ActionPreviewRisk = "none" | "attention" | "harmful";

export type ActionPreview = {
  readonly action: GameEventAction;
  readonly events: readonly GameEvent[];
  readonly summaryLines: readonly string[];
  readonly severity: ActionPreviewSeverity;
  readonly risk: ActionPreviewRisk;
  readonly previewable: boolean;
  readonly error?: string;
};

type GameEventAction = Parameters<typeof reduce>[2];

type ResourceCursor = {
  hp: number;
  energy: number;
  light: number;
  heat: number;
  braceCharges: number;
};

type PreviewContext = {
  before: GameState;
  after: GameState;
  beforeCards: ReadonlyMap<CardId, Card>;
  afterCards: ReadonlyMap<CardId, Card>;
  cursor: ResourceCursor;
  maskedResources: Set<keyof ResourceCursor>;
};

type ProgressEvent = Extract<GameEvent, { type: "ProgressDealt" }>;
type HazardResolvedEvent = Extract<GameEvent, { type: "HazardResolved" }>;
type HazardPartialEvent = Extract<GameEvent, { type: "HazardPartial" }>;

const EMPTY_EVENTS: readonly GameEvent[] = [];
const EMPTY_LINES: readonly string[] = [];

/**
 * Concealment warning copy emitted into `summaryLines`. Exported so renderer-side
 * trimming (e.g. the minimal hover preview) can recognise a concealment warning
 * by exact match rather than guessing at substrings.
 */
export const CONCEALED_EFFECT_WARNING = "Effect is concealed. Beware.";
export const CONCEALED_HAZARD = "a concealed hazard";
export const CONCEALED_HOOK_WARNING = "concealed hazard effects may trigger";

/**
 * The full set of concealment-warning lines a summary may contain. A line counts
 * as a concealment warning if it equals one of these or embeds CONCEALED_HAZARD
 * (e.g. "a concealed hazard would clear"). Used by the renderer's minimal-preview
 * filter to keep these warnings visible even when detail is trimmed.
 */
export function isConcealmentWarning(line: string): boolean {
  return (
    line === CONCEALED_EFFECT_WARNING ||
    line === CONCEALED_HOOK_WARNING ||
    line.includes(CONCEALED_HAZARD)
  );
}

export function previewAction(
  catalog: CardCatalog,
  state: GameState,
  action: GameEventAction,
): ActionPreview {
  try {
    const result = reduce(catalog, state, action);
    const risk = classifyRisk(state, result.state, result.events, action);
    return {
      action,
      events: result.events,
      summaryLines: summarizeEvents(state, result.state, result.events),
      severity: severityForRisk(risk, result.events.length),
      risk,
      previewable: true,
    };
  } catch (error) {
    return {
      action,
      events: EMPTY_EVENTS,
      summaryLines: EMPTY_LINES,
      severity: "info",
      risk: "none",
      previewable: false,
      error: error instanceof Error ? error.message : "Action cannot be previewed",
    };
  }
}

function summarizeEvents(
  before: GameState,
  after: GameState,
  events: readonly GameEvent[],
): readonly string[] {
  const context: PreviewContext = {
    before,
    after,
    beforeCards: cardMap(before),
    afterCards: cardMap(after),
    cursor: {
      hp: before.hp,
      energy: before.energy,
      light: before.light,
      heat: before.heat,
      braceCharges: before.braceCharges,
    },
    maskedResources: new Set(),
  };

  // Index, by event, after which every hidden-flow summary must go generic.
  // Once a concealed source has altered deck composition (drew/discarded/
  // destroyed player cards, or spawned a world hazard), the turn-end discard and
  // refill summaries would leak how many hidden cards moved or which hazard the
  // fog spawned. Derived from provenance: the first concealed-source event that
  // touches card flow. Its canonical case is a concealed hook spawning a world
  // card — its later (refill-time) HazardAdded/CardsDrawn events are unstamped,
  // so they are masked by index rather than by their own (absent) provenance.
  const maskFlowAfterIndex = hiddenFlowTaintIndex(events, context);

  const lines: string[] = [];
  let concealedWarningEmitted = false;
  const progress = events.filter((event): event is ProgressEvent => event.type === "ProgressDealt");
  const resolved = events.filter(
    (event): event is HazardResolvedEvent => event.type === "HazardResolved",
  );
  const partial = events.filter(
    (event): event is HazardPartialEvent => event.type === "HazardPartial",
  );
  const shouldAggregateProgress = progress.length > 1 || resolved.length > 1 || partial.length > 1;
  let aggregateProgressEmitted = false;
  let anyConcealed = false;

  for (let index = 0; index < events.length; index++) {
    const event = events[index]!;

    // Events that come from a concealed source (its hook fired) reveal nothing
    // beyond the generic warning. We still advance the resource cursor for any
    // resource change so a later visible change reads its delta from the masked
    // value rather than the pre-hook value.
    if (eventIsConcealed(event, context)) {
      anyConcealed = true;
      maskConcealedResource(event, context);
      if (!concealedWarningEmitted) {
        pushUnique(lines, CONCEALED_HOOK_WARNING);
        concealedWarningEmitted = true;
      }
      continue;
    }

    // Downstream taint: a hidden-flow event after a concealed source disturbed
    // deck composition mixes hidden and visible cards (or names a fog-spawned
    // hazard), so summarize it generically.
    if (maskFlowAfterIndex !== null && index >= maskFlowAfterIndex) {
      const masked = summarizeMaskedHiddenFlowEvent(event, context);
      if (masked !== null) {
        lines.push(...masked);
        continue;
      }
    }

    if (isProgressFamily(event) && shouldAggregateProgress) {
      if (!aggregateProgressEmitted) {
        lines.push(...summarizeAggregatedProgress(progress, resolved, partial, context));
        aggregateProgressEmitted = true;
      }
      continue;
    }

    lines.push(...summarizeEvent(event, context));
  }

  if (after.pendingForceDestroy > 0) {
    const finalDestroy = Math.max(0, after.pendingForceDestroy - after.braceCharges);
    const usedBrace = Math.min(after.pendingForceDestroy, after.braceCharges);
    if (finalDestroy > 0) {
      lines.push(`Destroy ${finalDestroy} player card at the start of the next turn.`);
    }
    if (usedBrace > 0) {
      lines.push(updateResource(context, "braceCharges", "Brace", after.braceCharges - usedBrace));
    }
  }

  // A concealed hazard touched by a broad effect (DealProgressAll) is named only
  // generically; flag that hidden hooks may have fired, once.
  if (anyConcealed) pushUnique(lines, CONCEALED_HOOK_WARNING);

  return lines;
}

/**
 * True when an event's provenance traces to a world card that is concealed at
 * the preview's Light level. Provenance (`sourceCardId`) is stamped at the
 * applyEffect boundary with the id of the world card whose hook emitted it.
 */
function eventIsConcealed(event: GameEvent, context: PreviewContext): boolean {
  if (event.sourceCardId === undefined) return false;
  return isConcealedCard(event.sourceCardId, context);
}

/**
 * The earliest event index after which hidden-flow summaries must go generic, or
 * `null` when none applies.
 *
 * The index is the first concealed-source event that disturbs deck composition
 * (a concealed Draw/discard/destroy, or a concealed world-deck spawn). After it,
 * turn-end discard and world-refill summaries blend hidden and visible cards, so
 * downstream unstamped refill events (HazardAdded/CardsDrawn) are masked by
 * index. Deferred ForceDestroy now carries provenance (pendingForceDestroySource
 * stamps its CardDestroyed/BraceConsumed), so it is masked directly by
 * `eventIsConcealed` and needs no static detection here.
 */
function hiddenFlowTaintIndex(
  events: readonly GameEvent[],
  context: PreviewContext,
): number | null {
  for (let index = 0; index < events.length; index++) {
    const event = events[index]!;
    if (eventIsConcealed(event, context) && disturbsDeckComposition(event)) {
      return index;
    }
  }
  return null;
}

/**
 * Whether a concealed-source event alters which cards are in the player or world
 * deck — the precondition for downstream refill summaries leaking hidden cards.
 */
function disturbsDeckComposition(event: GameEvent): boolean {
  switch (event.type) {
    case "CardsDrawn":
    case "CardsDiscarded":
    case "CardDestroyed":
    case "CardsBurnedForHeat":
    case "WorldCardsReturned":
    case "WorldCardsExiled":
      return true;
    case "CardGained":
      return true;
    default:
      return false;
  }
}

function isProgressFamily(event: GameEvent): boolean {
  return (
    event.type === "ProgressDealt" ||
    event.type === "HazardResolved" ||
    event.type === "HazardPartial"
  );
}

function summarizeAggregatedProgress(
  progress: readonly ProgressEvent[],
  resolved: readonly HazardResolvedEvent[],
  partial: readonly HazardPartialEvent[],
  context: PreviewContext,
): string[] {
  const lines: string[] = [];
  if (progress.length > 0) {
    const visibleProgress = progress.filter((event) => !isConcealedEventHazard(event, context));
    const concealedCount = progress.length - visibleProgress.length;
    if (visibleProgress.length > 0) {
      const totalProgress = sum(visibleProgress.map((event) => event.amount));
      lines.push(
        `Make ${totalProgress} total Progress across ${visibleProgress.length} ${plural(
          "hazard",
          visibleProgress.length,
        )}`,
      );
    }
    if (concealedCount > 0) {
      pushUnique(lines, CONCEALED_EFFECT_WARNING);
      lines.push(
        concealedCount === 1
          ? `Make Progress on ${CONCEALED_HAZARD}`
          : `Make Progress on ${concealedCount} concealed hazards`,
      );
    }
  }

  if (resolved.length > 0) {
    const visibleResolved = resolved.filter((event) => !isConcealedEventHazard(event, context));
    const concealedCount = resolved.length - visibleResolved.length;
    if (visibleResolved.length > 0) {
      lines.push(
        visibleResolved.length === 1
          ? `Clear ${cardName(visibleResolved[0]!.hazardId, visibleResolved[0]!.templateId, context)}`
          : `Clear ${visibleResolved.length} hazards: ${listNames(
              visibleResolved.map((event) => cardName(event.hazardId, event.templateId, context)),
            )}`,
      );
    }
    if (concealedCount > 0) {
      lines.push(
        concealedCount === 1
          ? `${CONCEALED_HAZARD} would clear`
          : `${concealedCount} concealed hazards would clear`,
      );
    }
  }

  if (partial.length > 0) {
    const visiblePartial = partial.filter((event) => !isConcealedEventHazard(event, context));
    const concealedCount = partial.length - visiblePartial.length;
    if (visiblePartial.length > 0) {
      lines.push(
        visiblePartial.length === 1
          ? `Partial resolve on ${cardName(
              visiblePartial[0]!.hazardId,
              visiblePartial[0]!.templateId,
              context,
            )}`
          : `Partial resolves on ${visiblePartial.length} ${plural(
              "hazard",
              visiblePartial.length,
            )}`,
      );
    }
    if (concealedCount > 0) {
      pushUnique(lines, CONCEALED_HOOK_WARNING);
    }
  }

  return lines;
}

function summarizeEvent(event: GameEvent, context: PreviewContext): readonly string[] {
  switch (event.type) {
    case "CardPlayed":
      return [`Play ${cardName(event.cardId, event.templateId, context)}`];
    case "ProgressDealt": {
      if (isConcealedEventHazard(event, context)) {
        return [CONCEALED_EFFECT_WARNING, `Make Progress on ${CONCEALED_HAZARD}`];
      }
      const card =
        context.beforeCards.get(event.hazardId) ?? context.afterCards.get(event.hazardId);
      const cost = card?.kind === "world" ? card.cost : undefined;
      const progress =
        cost !== undefined ? ` (${Math.min(event.hazardTurnTotal, cost)}/${cost})` : "";
      return [
        `Make ${event.amount} Progress on ${cardName(
          event.hazardId,
          event.templateId,
          context,
        )}${progress}`,
      ];
    }
    case "HazardResolved":
      return isConcealedEventHazard(event, context)
        ? [`${CONCEALED_HAZARD} would clear`]
        : [`Clear ${cardName(event.hazardId, event.templateId, context)}`];
    case "HazardPartial":
      return isConcealedEventHazard(event, context)
        ? [CONCEALED_HOOK_WARNING]
        : [`Partial resolve on ${cardName(event.hazardId, event.templateId, context)}`];
    case "HazardDiscarded":
      return isConcealedEventHazard(event, context)
        ? [CONCEALED_EFFECT_WARNING, `Discard ${CONCEALED_HAZARD}`]
        : [`Discard ${cardName(event.cardId, event.templateId, context)}`];
    case "DamageDealt":
      return [`Take ${event.amount} damage`];
    case "HpChanged":
      return [updateResource(context, "hp", "HP", event.hp)];
    case "HealReceived":
      return [`Heal ${event.amount} HP`];
    case "EnergyChanged":
      return [updateResource(context, "energy", "Energy", event.energy)];
    case "LightChanged":
      return [updateResource(context, "light", "Light", event.light)];
    case "HeatChanged":
      return [updateResource(context, "heat", "Heat", event.heat)];
    case "BraceChanged":
      return [updateResource(context, "braceCharges", "Brace", event.braceCharges)];
    case "BraceConsumed":
      return [`Brace absorbs ${event.absorbed}; ${event.remaining} remaining`];
    case "CardsDiscarded":
      return [
        `Discard ${event.cardIds.length} ${plural("card", event.cardIds.length)}: ${listNames(
          namesFromIds(event.cardIds, event.templateIds, context),
        )}`,
      ];
    case "CardDestroyed":
      return [
        `Destroy ${event.ids.length} ${plural("card", event.ids.length)}: ${listNames(
          namesFromIds(event.ids, event.templateIds, context),
        )}`,
      ];
    case "CardsFrozen":
      return [`Freeze ${event.ids.length} ${plural("card", event.ids.length)} at random`];
    case "CardsThawed":
      return [
        `Thaw ${event.ids.length} ${plural("card", event.ids.length)}: ${listNames(
          namesFromIds(event.ids, event.templateIds, context),
        )}`,
      ];
    case "CardsBurnedForHeat":
      return [
        `Burn ${event.ids.length} ${plural("card", event.ids.length)} for Heat: ${listNames(
          namesFromIds(event.ids, event.templateIds, context),
        )}`,
      ];
    case "WorldCardsReturned":
      return [
        `Return ${event.ids.length} world ${plural("card", event.ids.length)}: ${listNames(
          namesFromIds(event.ids, event.templateIds, context),
        )}`,
      ];
    case "WorldCardsExiled":
      return [
        `Exile ${event.ids.length} world ${plural("card", event.ids.length)}: ${listNames(
          namesFromIds(event.ids, event.templateIds, context),
        )}`,
      ];
    case "HazardAdded":
      // Hide the details of this action.
      // Don't review hidden information. Also its a duplicate of CardsDrawn.
      return [];
    case "BoonOffered":
      return [`Boon offered from ${event.setName}`];
    case "BoonCardGranted":
      return [`Gain boon ${event.templateId} to ${destLabel(event.dest)}`];
    case "ActAdvanced":
      return [`Advance to Act ${event.act + 1}`];
    case "WorldWon":
      return ["Win the world"];
    case "WorldLost":
      return ["Lose the world"];
    case "CardGained":
      // GainRandomCard stamps setName on its grant event (D3): the roll is
      // unrevealed until commit, so name the pool, never the rolled
      // template or its rarity. Fixed grants (GainCard and friends) leave
      // setName undefined and keep naming the template — they were always
      // authored/revealed, not a blind roll.
      return event.setName !== undefined
        ? [`Gain a random card from ${event.setName}`]
        : [`Gain ${event.templateId} to ${destLabel(event.dest)}`];
    case "CardsDrawn":
      return [
        `Draw ${event.ids.length} ${event.bHazard ? "world" : "player"} ${plural("card", event.ids.length)}`,
      ];
    case "DeckShuffled":
      return ["Shuffle the deck"];
    case "TurnEnded":
      return ["End the turn"];
    case "PlayerDiscardRecalled":
      return [
        `Recall ${event.cardIds.length} ${plural("card", event.cardIds.length)} from discard to the top of your deck`,
      ];
  }
}

function classifyRisk(
  before: GameState,
  after: GameState,
  events: readonly GameEvent[],
  action: GameEventAction,
): ActionPreviewRisk {
  if (
    (action.type === "EndTurn" && hasConcealedWorldCard(before)) ||
    events.some(
      (event) => isHarmfulEvent(event) || eventTouchesConcealedHazard(event, before, after),
    ) ||
    after.pendingForceDestroy > after.braceCharges
  ) {
    return "harmful";
  }

  if (events.some(isAttentionEvent)) {
    return "attention";
  }

  return "none";
}

function isHarmfulEvent(event: GameEvent): boolean {
  switch (event.type) {
    case "DamageDealt":
    case "WorldLost":
    case "CardsDiscarded":
    case "CardsFrozen":
    case "CardsBurnedForHeat":
      return true;
    case "HeatChanged":
      return event.delta < 0;
    default:
      return false;
  }
}

function isAttentionEvent(event: GameEvent): boolean {
  switch (event.type) {
    case "CardDestroyed":
    case "HazardResolved":
    case "HazardPartial":
    case "WorldCardsReturned":
    case "WorldCardsExiled":
    case "HazardAdded":
    case "BoonOffered":
    case "BoonCardGranted":
    case "ActAdvanced":
    case "WorldWon":
      return true;
    case "CardGained":
      return event.dest === "worldDraw" || event.dest === "worldDrawTop";
    default:
      return false;
  }
}

function eventTouchesConcealedHazard(
  event: GameEvent,
  before: GameState,
  after: GameState,
): boolean {
  switch (event.type) {
    case "ProgressDealt":
    case "HazardResolved":
    case "HazardPartial":
      return isConcealedHazard(event.hazardId, before, after);
    case "HazardDiscarded":
      return isConcealedHazard(event.cardId, before, after);
    case "WorldCardsReturned":
    case "WorldCardsExiled":
      return event.ids.some((id) => isConcealedHazard(id, before, after));
    default:
      return false;
  }
}

function isConcealedHazard(id: CardId, before: GameState, after: GameState): boolean {
  const card = cardById(id, before) ?? cardById(id, after);
  return card?.kind === "world" && isConcealed(card, before.light);
}

function isConcealedEventHazard(
  event:
    | ProgressEvent
    | HazardResolvedEvent
    | HazardPartialEvent
    | Extract<GameEvent, { type: "HazardDiscarded" }>,
  context: PreviewContext,
): boolean {
  const id = event.type === "HazardDiscarded" ? event.cardId : event.hazardId;
  return isConcealedCard(id, context);
}

function isConcealedCard(id: CardId, context: PreviewContext): boolean {
  const card = context.beforeCards.get(id) ?? context.afterCards.get(id);
  return card?.kind === "world" && isConcealed(card, context.before.light);
}

function hasConcealedWorldCard(state: GameState): boolean {
  return state.hand.some((card) => card.kind === "world" && isConcealed(card, state.light));
}

function severityForRisk(risk: ActionPreviewRisk, eventCount: number): ActionPreviewSeverity {
  if (risk === "harmful") return "danger";
  if (risk === "attention") return "warning";
  return eventCount > 0 ? "notice" : "info";
}

function cardMap(state: GameState): ReadonlyMap<CardId, Card> {
  return new Map(
    [
      ...state.hand,
      ...state.playerDraw,
      ...state.playerDiscard,
      ...state.worldDraw,
      ...state.acts.flat(),
    ].map((card) => [card.id, card]),
  );
}

function cardById(id: CardId, state: GameState): Card | undefined {
  return (
    state.hand.find((card) => card.id === id) ??
    state.playerDraw.find((card) => card.id === id) ??
    state.playerDiscard.find((card) => card.id === id) ??
    state.worldDraw.find((card) => card.id === id) ??
    state.acts.flat().find((card) => card.id === id)
  );
}

function cardName(id: CardId, templateId: string, context: PreviewContext): string {
  if (isConcealedCard(id, context)) return CONCEALED_HAZARD;
  return context.beforeCards.get(id)?.name ?? context.afterCards.get(id)?.name ?? templateId;
}

function namesFromIds(
  ids: readonly CardId[],
  templateIds: readonly string[],
  context: PreviewContext,
): string[] {
  return ids.map((id, index) => cardName(id, templateIds[index] ?? id, context));
}

/**
 * Generic, name-free summary for a hidden-flow event downstream of a concealed
 * deck disturbance. Returns `null` when the event is NOT hidden-flow, so the
 * caller falls through to the normal (named) summary for unaffected events such
 * as resource changes that happen to follow the taint point.
 */
function summarizeMaskedHiddenFlowEvent(
  event: GameEvent,
  context: PreviewContext,
): readonly string[] | null {
  switch (event.type) {
    case "CardsDiscarded":
      return ["Discard player cards"];
    case "DeckShuffled":
      return ["Deck changes"];
    case "CardsFrozen":
      return ["Freeze player cards"];
    case "CardsThawed":
      return ["Thaw player cards"];
    case "HazardAdded":
      // A world card the fog spawned has surfaced via the refill — never name it.
      return ["A concealed hazard joins the world"];
    case "CardsDrawn":
      return ["Draw cards"];
    case "CardDestroyed":
      return event.ids.some((id) => cardKind(id, context) === "player")
        ? ["Destroy player cards"]
        : null;
    case "CardsBurnedForHeat":
      return event.ids.some((id) => cardKind(id, context) === "player")
        ? ["Burn player cards for Heat"]
        : null;
    case "CardGained":
      return event.dest === "playerDiscard" || event.dest === "playerDrawTop"
        ? ["Gain card to player deck"]
        : null;
    default:
      return null;
  }
}

function cardKind(id: CardId, context: PreviewContext): Card["kind"] | undefined {
  return (context.beforeCards.get(id) ?? context.afterCards.get(id))?.kind;
}

function maskConcealedResource(event: GameEvent, context: PreviewContext): void {
  switch (event.type) {
    case "HpChanged":
      context.cursor.hp = event.hp;
      context.maskedResources.add("hp");
      break;
    case "EnergyChanged":
      context.cursor.energy = event.energy;
      context.maskedResources.add("energy");
      break;
    case "LightChanged":
      context.cursor.light = event.light;
      context.maskedResources.add("light");
      break;
    case "HeatChanged":
      context.cursor.heat = event.heat;
      context.maskedResources.add("heat");
      break;
    case "BraceChanged":
      context.cursor.braceCharges = event.braceCharges;
      context.maskedResources.add("braceCharges");
      break;
  }
}

function updateResource(
  context: PreviewContext,
  key: keyof ResourceCursor,
  label: string,
  after: number,
): string {
  const cursor = context.cursor;
  const before = cursor[key];
  cursor[key] = after;
  if (context.maskedResources.delete(key)) return `${label} changes`;
  return resourceLine(label, before, after);
}

function resourceLine(label: string, before: number, after: number): string {
  const delta = after - before;
  if (delta === 0) return `${label} stays ${after}`;
  return `${label} ${before} -> ${after} (${delta > 0 ? "+" : ""}${delta})`;
}

function destLabel(dest: string): string {
  switch (dest) {
    case "hand":
      return "hand";
    case "playerDiscard":
      return "discard";
    case "playerDrawTop":
      return "top of deck";
    case "worldDrawTop":
      return "top of world deck";
    default:
      return dest;
  }
}

function listNames(names: readonly string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

function plural(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function pushUnique(lines: string[], line: string): void {
  if (!lines.includes(line)) lines.push(line);
}
