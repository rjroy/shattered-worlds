/**
 * Seeded-replay determinism for a Tidal Archive run segment (REQ-TIDAL-58).
 *
 * The Tidal Archive's three displacement mechanisms all move real card
 * instances between zones, so a replay must reproduce them byte-for-byte. This
 * test drives ONE segment that exercises all three in order and asserts that
 * two independent runs from the SAME seed reach deepEqual final state with an
 * identical event sequence:
 *
 *   1. Hazard recall at end of turn — `The Same Footprint` recalls `Panic`
 *      from the player discard pile with its `panicFirst` policy.
 *   2. Player chooser top-deck — playing `Mark the Shelf` with a chosen
 *      `recallIds` returns a specific discard to the top of the draw pile.
 *   3. Passive recall after hand discard — `EndTurn` discards the unretained
 *      hand, then the Tidal Memory passive (`RecallPlayerDiscard latest`)
 *      recalls one card to the top before the next-turn refill.
 *
 * Determinism is the guarantee under test: same seed + same actions ⇒ same final
 * state and same ordered events. The segment is built from `buildWorld(
 * "the-tidal-archive")` so it runs against the real assembled Tidal catalog.
 */
import { describe, expect, it } from "bun:test";
import { buildWorld } from "../../data/worldManifest";
import { createWorld } from "../engine/world";
import { mintCard } from "../model/cards";
import { reduce } from "../engine/reduce";
import type { GameState, GameEvent, PlayerCard, WorldCard } from "../model/types";

const WORLD_ID = "the-tidal-archive";

const { catalog, worldData } = buildWorld(WORLD_ID);

interface SegmentRun {
  state: GameState;
  events: GameEvent[];
  /** Card id chosen via Mark the Shelf, captured so assertions can find it. */
  markedId: string;
}

/**
 * Run the deterministic Tidal segment from a fixed seed and return the final
 * state plus the full ordered event stream across every dispatch.
 *
 * The starting state is built explicitly (piles cleared, exact cards placed) so
 * the only randomness in play is the seeded run RNG threaded through reduce —
 * which is precisely what the replay guarantee covers.
 */
function runSegment(seed: number): SegmentRun {
  // createWorld with a fixed seed gives a valid nextId/rng chain; mintCard
  // threads both forward so every minted id is deterministic for this seed.
  const { state: base } = createWorld(catalog, worldData, seed);

  const [hazard, s1] = mintCard(catalog, base, "The Same Footprint");
  const [markShelf, s2] = mintCard(catalog, s1, "Mark the Shelf");
  const [discardA, s3] = mintCard(catalog, s2, "Panic"); // sits in discard, recalled by hazard
  const [discardB, s4] = mintCard(catalog, s3, "Explore"); // sits in discard, chosen by Mark the Shelf
  const [handFiller, s5] = mintCard(catalog, s4, "Sprint"); // unretained; feeds the passive at end turn

  const hazardCard = hazard as WorldCard;
  const markCard = markShelf as PlayerCard;
  const discardACard = discardA as PlayerCard;
  const discardBCard = discardB as PlayerCard;
  const fillerCard = handFiller as PlayerCard;

  // Hand holds the hazard through end of turn, Mark the Shelf to play, and a filler that
  // will be discarded at end of turn so the passive has something to recall.
  // playerDiscard is seeded with a chooser target and Panic for the hazard.
  const start: GameState = {
    ...s5,
    hand: [hazardCard, markCard, fillerCard],
    playerDraw: [],
    playerDiscard: [discardBCard, discardACard],
    worldDraw: [],
    acts: [],
    progress: {},
    energy: 3,
    hp: 20,
    status: "playing",
  };

  // 1. Play Mark the Shelf choosing a specific discard to top-deck.
  const recallTargetId = pickRecallTarget(start);
  const r1 = reduce(catalog, start, {
    type: "PlayCard",
    cardId: markCard.id,
    recallIds: [recallTargetId],
  });

  // 2. EndTurn → hazard recall → hand discard → Tidal Memory recall → refill.
  const r2 = reduce(catalog, r1.state, { type: "EndTurn" });

  return {
    state: r2.state,
    events: [...r1.events, ...r2.events],
    markedId: recallTargetId,
  };
}

/**
 * Resolve a legal `recallTarget` id for Mark the Shelf from the live discard
 * pile, deterministically (head of the pile). Throws if none exist so the test
 * fails loudly rather than dispatching an illegal action.
 */
function pickRecallTarget(state: GameState): string {
  const target = state.playerDiscard[0];
  if (target === undefined) {
    throw new Error("Tidal replay segment expected a non-empty discard for Mark the Shelf");
  }
  return target.id;
}

describe("Tidal Archive seeded replay segment (REQ-TIDAL-58)", () => {
  it("exercises hazard recall, player chooser, and passive recall in one segment", () => {
    const run = runSegment(2026);
    const eventTypes = run.events.map((e) => e.type);

    // Three distinct recall events fire across the segment: the hazard's
    // onDiscarded recall, the Mark the Shelf chooser, and the end-turn passive.
    const recalls = run.events.filter(
      (e): e is Extract<GameEvent, { type: "PlayerDiscardRecalled" }> =>
        e.type === "PlayerDiscardRecalled",
    );
    expect(recalls.length).toBe(3);

    const sources = recalls.map((e) => e.source);
    // Hazard onDiscarded (latest), player chooser (playerSelected), passive (latest).
    expect(sources.filter((s) => s === "latest").length).toBe(1);
    expect(sources.filter((s) => s === "random").length).toBe(0);
    expect(sources.filter((s) => s === "lowestCost").length).toBe(0);
    expect(sources.filter((s) => s === "highestCost").length).toBe(0);
    expect(sources.filter((s) => s === "panicFirst").length).toBe(1);
    expect(sources.filter((s) => s === "playerSelected").length).toBe(1);

    // The hazard discard itself happened, and a card was played.
    expect(eventTypes).toContain("CardPlayed");

    // The chosen card landed on top of the draw pile via the chooser, then was
    // drawn into the next hand during the end-turn refill.
    expect(run.state.hand.some((c) => c.id === run.markedId)).toBe(true);
  });

  it("two runs from the same seed produce deepEqual final state and identical events", () => {
    const a = runSegment(2026);
    const b = runSegment(2026);

    // Full structural equality of the final game state — instance ids, zone
    // contents, rng, nextId, hp, everything.
    expect(a.state).toEqual(b.state);

    // The ordered event stream (the renderer's animation script) is identical.
    expect(a.events).toEqual(b.events);
    expect(a.markedId).toBe(b.markedId);
  });

  it("a different seed is still internally consistent (no shared mutable state)", () => {
    // Replaying the same seed twice matches; this guards against the trivial
    // failure mode where runSegment is accidentally order-dependent on a shared
    // module-level mutable. A second seed simply must run to completion and stay
    // self-consistent across its own replay.
    const c1 = runSegment(7);
    const c2 = runSegment(7);
    expect(c1.state).toEqual(c2.state);
    expect(c1.events).toEqual(c2.events);
  });
});
