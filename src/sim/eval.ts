/**
 * Survival evaluation for the sim agent.
 *
 * `evaluate` scores a `GameState` by *distance from death*: higher means safer.
 * The score is a MIN-OF-MARGINS shape — each survival axis is reduced to a
 * normalized "margin" in [0, 1] (0 == at the brink of that failure, 1 == far
 * from it), and the overall survival term is dominated by the WORST axis. This
 * makes the agent triage the nearest way to die rather than average its dangers
 * away: a state that is one hit from an HP loss must not look safe just because
 * its deck is deep.
 *
 * Shape (see `evaluate`):
 *   survival = worstAxisWeight * min(deathFloorMargins)              // dominates
 *            + spreadWeight    * (Σ axisWeight_i·margin_i / Σ axisWeight_i)
 *                                                                    // bounded tie-break
 *   score    = survival + escapeWeight   * escapeProximity          // win opportunity
 *                       + progressWeight * forwardProgress          // anti-plateau
 *
 * The escape and progress terms are both additive opportunity bonuses, never
 * folded into the survival min. `forwardProgress` was meant as a
 * tie-break-magnitude push to keep a comfortable, non-progressing board from
 * being a local optimum the agent never leaves (REQ-SCC-7), but it is currently
 * DISABLED (progressWeight 0) because verification showed it is net-harmful; see
 * the progressWeight default comment. Escape proximity drives termination today.
 *
 * The spread is a WEIGHTED AVERAGE of the axis margins (normalized by the axis
 * weight sum), so it lands in [0, 1] and contributes at most `spreadWeight`
 * total. With `worstAxisWeight` ≫ `spreadWeight` (100 vs 1), the spread can only
 * shift the score within a `spreadWeight / worstAxisWeight` band of the worst
 * axis (~0.01). REQ-SCC-3: a worst-axis margin gap larger than that band always
 * decides the comparison, so a board that dies next turn can never outscore one
 * that survives by looking healthy on the other axes.
 *
 * The min only spans the axes that can *individually* end the world (HP,
 * player-card starvation, deck/world exhaustion). Energy modulates how many
 * options a turn has but never kills on its own, so it rides only in the small
 * weighted spread, never the min. Escape is an *opportunity* bonus, not a death
 * floor: an unreachable exit must not drag a perfectly safe state's score down,
 * so it is added on top rather than folded into the min.
 *
 * REQ-SCC-4: this module reads STRUCTURED STATE ONLY. It never matches card
 * names; every signal (including the escape detection) is derived from effect
 * `kind`s and numeric fields. Pure, deterministic, no I/O, no mutation.
 */
import type { CardEffect, GameState } from "../core/model/types";
import { WORLD_CONSTS, effectiveHandSize } from "../core/engine/world";

/**
 * Per-axis weights and risk knobs for {@link evaluate}. K and lookahead depth
 * belong to the policy, not here; this carries only how the axes are weighed
 * against one another and what counts as "comfortably safe" on each.
 */
export interface EvalWeights {
  // --- min-of-margins survival shape ---
  /** Multiplier on the worst death-floor margin. The dominant survival term. */
  worstAxisWeight: number;
  /**
   * Multiplier on the normalized weighted average of all axis margins. A pure
   * tie-break: kept ≪ `worstAxisWeight` (see DEFAULT_EVAL_WEIGHTS) so it can
   * never override a meaningful worst-axis difference (REQ-SCC-3).
   */
  spreadWeight: number;
  /**
   * Multiplier on escape proximity. Set high so a ready, safe escape (proximity
   * near 1) outweighs any survival score and the agent triages toward winning.
   */
  escapeWeight: number;
  /**
   * Multiplier on forward world-progress (see `forwardProgress`). Intended as a
   * tie-break-magnitude anti-stall nudge (REQ-SCC-7), but currently DISABLED
   * (default 0): verification showed every positive value is net-harmful. See
   * the rationale on the default below.
   */
  progressWeight: number;
  /** Score for an already-decided survival (status "won"). Ceiling: must exceed
   *  any non-terminal score so reaching a win always dominates. */
  wonScore: number;

  // --- per-axis contributions inside the spread sum ---
  /** Weight of the HP margin in the spread tie-break. */
  hpAxisWeight: number;
  /** Weight of the player-card-availability margin in the spread tie-break. */
  playerAvailAxisWeight: number;
  /** Weight of the deck/world-exhaustion margin in the spread tie-break. */
  exhaustionAxisWeight: number;
  /** Weight of the energy margin in the spread tie-break (energy is secondary). */
  energyAxisWeight: number;

  // --- comfort scales: the raw amount that maps to a 0.5 margin via x/(x+scale) ---
  /** HP that counts as comfortably safe. */
  hpComfort: number;
  /** Free hand slots for player cards at next refill that count as comfortable. */
  playerRoomComfort: number;
  /** Player cards in supply (draw + discard + recycling hand) that count as safe. */
  playerSupplyComfort: number;
  /** Total cards left across draw/discard/world/acts that count as a safe runway. */
  runwayComfort: number;
  /** Energy that counts as a comfortable per-turn budget. */
  energyComfort: number;
  /** Expected frozen cards a single point of heat can thaw. Converts the stored
   *  warmth into slot relief so frozen pressure funnels into the player-card
   *  availability axis rather than standing as its own min-term. */
  heatThawEfficiency: number;
}

export const DEFAULT_EVAL_WEIGHTS: EvalWeights = {
  worstAxisWeight: 100,
  // Tie-break only. The normalized spread is in [0, 1], so spreadWeight is the
  // most it can move the score. At 1 vs worstAxisWeight 100, any worst-axis gap
  // above ~0.01 (spreadWeight / worstAxisWeight) dominates the spread (REQ-SCC-3).
  spreadWeight: 1,
  escapeWeight: 200,
  // DISABLED (set to 0) pending redesign. The intent was a tie-break-magnitude
  // anti-stall nudge (REQ-SCC-7), but empirical verification across all 9 worlds
  // showed every positive value is net-counterproductive: it raises total
  // completeness caps (pw0=32, pw1=37, pw2=46, pw4=53 over N=100 K=5) and flips
  // wins to losses/caps. The cause is margin saturation: on a comfortable board
  // all survival axes saturate near the same value, so the worst-axis `min`
  // differences between candidate moves shrink below the ~0.02 progress band and
  // the nudge stops being a tie-break and instead steers the agent toward
  // depleting the world at the cost of survival. In recurrence worlds
  // (overgrown-mall) the depletion target is unreachable, so the agent thrashes
  // and caps MORE (7 -> 25). The `forwardProgress` signal is kept below for a
  // future redesign (e.g. gate the term on a high worst-axis margin, or use a
  // recurrence-immune signal), but it must stay weighted 0 until one is proven.
  progressWeight: 0,
  wonScore: 1000,

  hpAxisWeight: 1,
  playerAvailAxisWeight: 1,
  exhaustionAxisWeight: 1,
  energyAxisWeight: 0.5,

  hpComfort: 6,
  playerRoomComfort: 1,
  playerSupplyComfort: 4,
  runwayComfort: 8,
  energyComfort: 2,
  heatThawEfficiency: 1,
};

/**
 * Saturating margin: 0 when `amount <= 0`, 0.5 at `amount === scale`, and
 * approaching 1 as `amount` grows. Keeps every axis in [0, 1] so the min and
 * weighted sum are comparable. `scale` is assumed positive.
 */
function saturate(amount: number, scale: number): number {
  if (amount <= 0) return 0;
  return amount / (amount + scale);
}

/**
 * World cards still in play: the world draw pile, the unshuffled `acts`, and the
 * world cards currently in hand. Shared by `measureEvalAxes` (surfaced as
 * `worldCardsRemaining`) and `forwardProgress` so both read one definition and
 * cannot drift. Recurrence that returns a card to the deck raises this count.
 */
function countWorldCardsRemaining(state: GameState): number {
  let count = state.worldDraw.length;
  for (const act of state.acts) count += act.length;
  for (const card of state.hand) if (card.kind === "world") count++;
  return count;
}

/**
 * Whether an effect tree resolves to a given effect `kind`, recursing through
 * the only composite effects (Modal branches and Sequence steps). This is how
 * the escape signal is found without ever naming a card: a `SurviveWorld` leaf
 * anywhere in the tree means the effect can win the world.
 */
function effectContainsKind(effect: CardEffect, kind: CardEffect["kind"]): boolean {
  if (effect.kind === kind) return true;
  if (effect.kind === "Modal") return effect.branches.some((b) => effectContainsKind(b, kind));
  if (effect.kind === "Sequence") return effect.steps.some((s) => effectContainsKind(s, kind));
  return false;
}

/**
 * Every raw and normalized quantity {@link evaluate} needs, plus the extras
 * telemetry wants (REQ-SCC "completeness agent performance stats" plan step
 * 2). `evaluate` and any future posthoc telemetry both read these fields
 * instead of recomputing the underlying formulas, so the two can never drift
 * apart. Pure function of `GameState`: works identically whether the caller
 * passes the honest determinized view or committed ground truth — it is the
 * caller's choice of `state` that decides which one it measures, this module
 * has no opinion. Nothing here reads card names or exposes anything not
 * already derivable from `GameState`.
 */
export interface EvalAxes {
  /** Axis 1 — current HP. Death is `hp <= 0`. */
  hp: number;
  /** Saturated margin on `hp` (0 at the brink, approaching 1 when comfortable). */
  hpMargin: number;

  /**
   * Axis 2 — free hand slots for player cards predicted at the next refill,
   * after world cards (which persist), net frozen player cards (frozen minus
   * heat-thaw relief), and the refill's forced world draw take their slots.
   */
  predictedPlayerRoom: number;
  /** Saturated margin on `predictedPlayerRoom`. */
  playerRoomMargin: number;
  /**
   * Axis 2 — player cards left to draw: the player draw pile, the player
   * discard, and the unfrozen player cards in hand that recycle to discard.
   */
  playerSupply: number;
  /** Saturated margin on `playerSupply`. */
  playerSupplyMargin: number;
  /**
   * Combined player-card-availability margin: `min(playerRoomMargin,
   * playerSupplyMargin)`. A turn start with zero player cards drawn is an
   * instant "noPlayerCards" loss (reduce.ts); both room and supply must hold
   * to avoid it, so the worse of the two governs.
   */
  playerAvailabilityMargin: number;

  /**
   * Axis 4 — total cards left across the player draw, player discard, world
   * draw, and act piles. The "exhausted"/"worldLivelock" losses fire when all
   * of these are empty.
   */
  runwayRemaining: number;
  /** Saturated margin on `runwayRemaining`. */
  runwayMargin: number;

  /** Axis 6 — live per-turn energy budget. */
  energy: number;
  /** Saturated margin on `energy`. */
  energyMargin: number;

  /** Axis 5 — escape signal, in [0, 1]. See `escapeProximity` below. */
  escapeProximity: number;

  /**
   * World cards remaining across `worldDraw`, the unshuffled `acts`, and the
   * hand — `forwardProgress`'s raw input (its own transformed 0..1 value is
   * not carried here; callers that want it can call `forwardProgress`
   * directly). Recurrence that returns a card to the deck raises this count
   * back up, same as it does for `forwardProgress`.
   */
  worldCardsRemaining: number;
}

/**
 * Computes every axis in {@link EvalAxes} from `state` in one pass, so
 * `evaluate`'s scoring and any posthoc telemetry share one definition of each
 * quantity and cannot drift apart. See the per-field docs above for what each
 * value means and which loss condition it tracks.
 */
export function measureEvalAxes(state: GameState, w: EvalWeights): EvalAxes {
  const hp = state.hp;
  const hpMargin = saturate(hp, w.hpComfort);

  // --- player-card availability (axis 2) vs hand-flood pressure ---
  const worldInHand = state.hand.filter((c) => c.kind === "world").length;
  const frozenPlayer = state.hand.filter(
    (c) => c.kind === "player" && (c.frozen ?? 0) > 0,
  ).length;
  const unfrozenPlayerInHand = state.hand.filter(
    (c) => c.kind === "player" && (c.frozen ?? 0) <= 0,
  ).length;

  // Frozen relief: heat can thaw some frozen cards back into usable slots.
  // Frozen pressure is folded into the player-availability axis rather than
  // given its own min-term: frozen player cards occupy slots, less whatever
  // the stored heat can thaw.
  const netFrozen = Math.max(0, frozenPlayer - state.heat * w.heatThawEfficiency);

  // The refill forces a world draw (min 1 while world cards remain), pushing
  // more world cards into the hand and squeezing player-card room further.
  // Mirror refillHand (core/engine/draw.ts): the forced draw is capped by the
  // free hand room AND by the world cards that actually remain, so a nearly
  // exhausted world deck does not over-count occupied slots (and the
  // worldRemainingForRefill clamp also collapses the draw to 0 when no world
  // cards exist). This local count excludes hand contents (already tracked via
  // worldInHand) and is distinct from `worldCardsRemaining` below, which does
  // include the hand.
  const worldRemainingForRefill =
    state.worldDraw.length + state.acts.reduce((sum, act) => sum + act.length, 0);
  const refillRoom = Math.max(0, effectiveHandSize(state) - worldInHand);
  const forcedWorldDraw = Math.min(
    Math.max(1, WORLD_CONSTS.startWorldCards - worldInHand),
    refillRoom,
    worldRemainingForRefill,
  );

  const occupiedSlots = worldInHand + netFrozen + forcedWorldDraw;
  const predictedPlayerRoom = effectiveHandSize(state) - occupiedSlots;

  const playerSupply =
    state.playerDraw.filter((c) => c.kind === "player").length +
    state.playerDiscard.filter((c) => c.kind === "player").length +
    unfrozenPlayerInHand;

  const playerRoomMargin = saturate(predictedPlayerRoom, w.playerRoomComfort);
  const playerSupplyMargin = saturate(playerSupply, w.playerSupplyComfort);
  // Both must hold to draw a player card next turn, so the worse one governs.
  const playerAvailabilityMargin = Math.min(playerRoomMargin, playerSupplyMargin);

  // --- deck/world-exhaustion proximity (axis 4) ---
  const runwayRemaining =
    state.playerDraw.length +
    state.playerDiscard.length +
    state.worldDraw.length +
    state.acts.reduce((sum, act) => sum + act.length, 0);
  const runwayMargin = saturate(runwayRemaining, w.runwayComfort);

  // --- energy (axis 6) ---
  const energy = state.energy;
  const energyMargin = saturate(energy, w.energyComfort);

  // --- world cards remaining: forwardProgress's raw input, hand included ---
  const worldCardsRemaining = countWorldCardsRemaining(state);

  return {
    hp,
    hpMargin,
    predictedPlayerRoom,
    playerRoomMargin,
    playerSupply,
    playerSupplyMargin,
    playerAvailabilityMargin,
    runwayRemaining,
    runwayMargin,
    energy,
    energyMargin,
    escapeProximity: escapeProximity(state),
    worldCardsRemaining,
  };
}

/**
 * Axis 5 — escape signal, in [0, 1]. Detected purely from effect structure:
 *
 *   - An immediate, safe win: a non-frozen, affordable player card in hand
 *     whose effect tree resolves to `SurviveWorld`. Proximity 1.
 *   - Otherwise the escape objective: a world card in hand whose resolution
 *     hooks lead to `SurviveWorld` (clearing it wins). Proximity is how close
 *     its accumulated progress is to its clear cost.
 *
 * No card names are used — the exit is recognized by the `SurviveWorld` effect
 * kind on cards and their hooks (REQ-SCC-4).
 */
function escapeProximity(view: GameState): number {
  const playerEscapeReady = view.hand.some(
    (c) =>
      c.kind === "player" &&
      (c.frozen ?? 0) <= 0 &&
      c.energyCost <= view.energy &&
      effectContainsKind(c.effect, "SurviveWorld"),
  );
  if (playerEscapeReady) return 1;

  let best = 0;
  for (const card of view.hand) {
    if (card.kind !== "world") continue;
    const leadsToSurvive =
      effectContainsKind(card.onCleared, "SurviveWorld") ||
      effectContainsKind(card.onPartialClear, "SurviveWorld") ||
      effectContainsKind(card.onEndOfTurn, "SurviveWorld") ||
      effectContainsKind(card.onDiscarded, "SurviveWorld");
    if (!leadsToSurvive) continue;

    const progress = view.progress[card.id] ?? 0;
    const fraction = card.cost <= 0 ? 1 : Math.min(1, progress / card.cost);
    if (fraction > best) best = fraction;
  }
  return best;
}

/**
 * Cards that count as "world content still to be consumed": one point that maps
 * to a 0.5 forward-progress reward via the inverse-saturating curve below. With
 * a typical full world deck of ~25-35 cards the early reward sits near 0.15-0.25
 * and climbs steeply only as the last few cards are cleared, so the push toward
 * termination is gentle in the open and strongest exactly at the stall point: a
 * near-empty world with only the exit chain left.
 */
const WORLD_CONSUME_SCALE = 8;

/**
 * Forward world-progress, in (0, 1]. Read from STRUCTURED state only (no card
 * names; REQ-SCC-4): the counts of world cards still in play.
 *
 * The signal is how DEPLETED the world is — total world content remaining across
 * the draw pile, the unshuffled acts, and the hand, run through an inverse
 * saturate so it rises toward 1 as that count falls toward 0. Act advancement
 * only moves cards from `acts` into `worldDraw`, so this total decreases
 * monotonically across the whole world regardless of act boundaries; it falls as
 * world cards are consumed and the world ends when the last one (the Door) clears.
 *
 * Counting cards-REMAINING (not progress-for-its-own-sake) is deliberate: it
 * rewards genuine consumption and PENALIZES recurrence — a card that recurs back
 * into the deck (some worlds' recurrence mechanics) raises the count again, so
 * the agent cannot farm the term by re-progressing recurring cards; it must
 * actually deplete the world.
 *
 * It is NOT an escape signal (that is `escapeProximity`): it rewards advancing
 * the world even before any `SurviveWorld` door is reachable.
 */
function forwardProgress(view: GameState): number {
  const worldRemaining = countWorldCardsRemaining(view);
  return WORLD_CONSUME_SCALE / (worldRemaining + WORLD_CONSUME_SCALE);
}

/**
 * Survival score for `view`: higher == safer. See the file header for the
 * min-of-margins shape. Terminal states short-circuit: a won world is the
 * safest possible outcome, a lost world the least.
 */
export function evaluate(view: GameState, weights: EvalWeights): number {
  if (view.status === "won") return weights.wonScore;
  if (view.status === "lost") return 0;

  // Single shared measurement: telemetry that later calls `measureEvalAxes`
  // directly on committed state reads the exact same axis definitions used
  // for scoring here, so the two can never drift apart.
  const axes = measureEvalAxes(view, weights);

  // Worst death-floor axis dominates so the agent triages the nearest failure.
  const worst = Math.min(axes.hpMargin, axes.playerAvailabilityMargin, axes.runwayMargin);

  // Tie-break: a weighted AVERAGE of the axis margins, normalized by the axis
  // weight sum so it stays in [0, 1] and contributes at most `spreadWeight`. It
  // rewards improving non-worst axes without ever letting a healthy axis mask a
  // deadly one (REQ-SCC-3). If all axis weights are 0 the spread is simply 0.
  const axisWeightSum =
    weights.hpAxisWeight +
    weights.playerAvailAxisWeight +
    weights.exhaustionAxisWeight +
    weights.energyAxisWeight;
  const weightedMargins =
    weights.hpAxisWeight * axes.hpMargin +
    weights.playerAvailAxisWeight * axes.playerAvailabilityMargin +
    weights.exhaustionAxisWeight * axes.runwayMargin +
    weights.energyAxisWeight * axes.energyMargin;
  const spread = axisWeightSum > 0 ? weightedMargins / axisWeightSum : 0;

  const escape = weights.escapeWeight * axes.escapeProximity;

  // Plateau-breaking gradient (REQ-SCC-7): a push toward advancing the world,
  // additive like escape and never folded into the survival min. DISABLED by
  // default (progressWeight 0) because verification showed it is net-harmful;
  // see the progressWeight default comment. The math stays wired so a future
  // redesign can re-enable it with a single weight change. `forwardProgress`
  // is intentionally not part of `EvalAxes` (only its raw input,
  // `worldCardsRemaining`, is) since its transformed value is scoring-only.
  const progress = weights.progressWeight * forwardProgress(view);

  return weights.worstAxisWeight * worst + weights.spreadWeight * spread + escape + progress;
}
