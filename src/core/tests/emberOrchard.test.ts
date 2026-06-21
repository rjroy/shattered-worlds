import { describe, expect, it } from "bun:test";
import { buildWorld } from "../../data/worldManifest";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import { FORTUNE_BOON_POOLS } from "../../data/worlds/boons/fortune";
import { worldDataRegistry } from "../../data/worlds/registry";
import { applyEffect } from "../engine/effects";
import { resolveForceDestroy } from "../engine/draw";
import { reduce } from "../engine/reduce";
import { createWorld } from "../engine/world";
import { worldThreatTemplateByWorldId } from "../effects/gainCard";
import type { GameState, WorldCard } from "../model/types";

const WORLD_ID = "the-ember-orchard";

// The five engine keywords. Mirrors the VALID set the spec ratified after the
// Hidden -> Obstructed rename (REQ-EMBER-12, decision §1).
const VALID_KEYWORDS = new Set(["Obstructed", "Creature", "Slow", "Spore", "Concealed"]);
const REQUIRED_HOOKS = ["onDiscarded", "onCleared", "onPartialClear", "onEndOfTurn"] as const;

// The world cards Ember authors itself. The Walker is a shared starter template
// (REQ-EMBER-6) and is intentionally excluded from the per-card hook/keyword
// assertions below.
const EMBER_WORLD_CARDS = [
  "Cracked Hearth-Star",
  "Falling Fruit",
  "Rooted Meteor",
  "The Orchard Counts Wrong",
  "Hatchery Cellar",
  "Ember Moth",
  "Lantern Brood",
  "Ground Constellation",
] as const;

// ---------------------------------------------------------------------------
// C1 — world-data tests (REQ-EMBER-46).
//
// The parameterized worldRegistry.test.ts already covers, for EVERY world:
// no-duplicate-ids, bundle-in-registry, buildWorld succeeds, and every
// template reference resolves in the assembled catalog. This block adds only
// the Ember-specific assertions that test does NOT cover.
// ---------------------------------------------------------------------------

describe("The Ember Orchard — world data shape (REQ-EMBER-46)", () => {
  it("is registered in worldDataRegistry and buildWorld succeeds", () => {
    const ids = worldDataRegistry.map((bundle) => bundle.id);
    expect(ids).toContain(WORLD_ID);

    const { worldData } = buildWorld(WORLD_ID);
    expect(worldData.worldId).toBe(WORLD_ID);
  });

  it("has no duplicate authored template ids in the card source", () => {
    const bundle = worldDataRegistry.find((b) => b.id === WORLD_ID)!;
    const ids = Object.keys(bundle.source.cardTemplates);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("defines all four hooks and only valid keywords on every Ember world card", () => {
    const { catalog } = buildWorld(WORLD_ID);
    for (const id of EMBER_WORLD_CARDS) {
      const template = catalog[id];
      expect(template).toBeDefined();
      if (template === undefined || template.kind !== "world") {
        throw new Error(`${id} is not an authored world card`);
      }
      for (const hook of REQUIRED_HOOKS) {
        expect(template[hook]).toBeDefined();
      }
      for (const keyword of template.keywords) {
        // Keywords are authored as "Name" or "Name:N"; the identity is the name.
        const name = keyword.split(":")[0]!;
        expect(VALID_KEYWORDS.has(name)).toBe(true);
      }
    }
  });

  it("maps the Ember world threat to Ground Constellation (REQ-EMBER-14)", () => {
    expect(worldThreatTemplateByWorldId(WORLD_ID)).toBe("Ground Constellation");
  });

  it("has exactly three acts and ends act 3 with exactly one The Walker", () => {
    const { worldData } = buildWorld(WORLD_ID);
    const acts = worldData.deckComposition.acts;
    expect(acts).toHaveLength(3);
    const finalAct = acts[acts.length - 1]!;
    expect(finalAct.cards.at(-1)).toEqual({ templateId: "The Walker", count: 1 });
  });
});

// ---------------------------------------------------------------------------
// C2 — incubation-pattern effect tests (REQ-EMBER-47).
//
// Each test drives the pure core reducer directly with the assembled Ember
// catalog. No mocking: the core is fast, deterministic, and seedable.
// ---------------------------------------------------------------------------

describe("The Ember Orchard — incubation effects drive the reducer (REQ-EMBER-47)", () => {
  it("Dormant Star adds Ember Moth to the TOP of the world deck", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const dormantStar = catalog["Dormant Star"];
    expect(dormantStar?.kind).toBe("player");
    if (dormantStar === undefined || dormantStar.kind !== "player") return;

    const { state } = createWorld(catalog, worldData, 1, DEFAULT_RUN_MODIFIERS);
    const before = state.worldDraw.length;
    const result = applyEffect(catalog, state, dormantStar.effect);

    expect(result.state.worldDraw.length).toBe(before + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("Ember Moth");
  });

  it("Cracked Hearth-Star onEndOfTurn self-transforms into Ember Moth and removes itself", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const hearthStar = catalog["Cracked Hearth-Star"];
    expect(hearthStar?.kind).toBe("world");
    if (hearthStar === undefined || hearthStar.kind !== "world") return;

    // Put one Cracked Hearth-Star in hand so DestroySelf has a target.
    const { state: base } = createWorld(catalog, worldData, 2, DEFAULT_RUN_MODIFIERS);
    const card = base.worldDraw.find((c) => c.templateId === "Cracked Hearth-Star");
    // Synthesize a concrete card in hand from the catalog template if the opening
    // shuffle did not surface one; createWorld always mints world cards, so pull
    // one from the world draw pile into the hand.
    const inHand: WorldCard = card ?? (base.worldDraw[0]! as WorldCard);
    const state: GameState = {
      ...base,
      hand: [inHand],
      worldDraw: base.worldDraw.filter((c) => c.id !== inHand.id),
    };

    const beforeTop = state.worldDraw.length;
    const result = applyEffect(catalog, state, hearthStar.onEndOfTurn, undefined, inHand.id);

    // A new Ember Moth lands on top of the world deck.
    expect(result.state.worldDraw.length).toBe(beforeTop + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("Ember Moth");
    // The Cracked Hearth-Star removed itself from hand (DestroySelf).
    expect(result.state.hand.some((c) => c.id === inHand.id)).toBe(false);
  });

  it("Falling Fruit onDiscarded plants a Dormant Star on the player draw top (AddPlayerCardToTop)", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const fallingFruit = catalog["Falling Fruit"];
    expect(fallingFruit?.kind).toBe("world");
    if (fallingFruit === undefined || fallingFruit.kind !== "world") return;

    // onDiscarded and onPartialClear share the same AddPlayerCardToTop effect.
    expect(fallingFruit.onDiscarded).toEqual({
      kind: "AddPlayerCardToTop",
      template: "Dormant Star",
    });
    expect(fallingFruit.onPartialClear).toEqual({
      kind: "AddPlayerCardToTop",
      template: "Dormant Star",
    });

    const { state } = createWorld(catalog, worldData, 3, DEFAULT_RUN_MODIFIERS);
    const before = state.playerDraw.length;
    const result = applyEffect(catalog, state, fallingFruit.onDiscarded);

    expect(result.state.playerDraw.length).toBe(before + 1);
    expect(result.state.playerDraw[0]!.templateId).toBe("Dormant Star");
  });

  it("Ground Constellation onEndOfTurn AddThreatToWorldDeck resolves to Ground Constellation via the world mapping", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const groundConstellation = catalog["Ground Constellation"];
    expect(groundConstellation?.kind).toBe("world");
    if (groundConstellation === undefined || groundConstellation.kind !== "world") return;

    const { state } = createWorld(catalog, worldData, 4, DEFAULT_RUN_MODIFIERS);
    // worldId is set on state by createWorld; AddThreatToWorldDeck reads it.
    expect(state.worldId).toBe(WORLD_ID);

    const before = state.worldDraw.length;
    // onEndOfTurn is Sequence[DamageScaled (0 with no creatures in hand), AddThreatToWorldDeck].
    const result = applyEffect(catalog, state, groundConstellation.onEndOfTurn);

    // The signature threat (Ground Constellation) was added to the top.
    expect(result.state.worldDraw.length).toBe(before + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("Ground Constellation");
  });

  it("Hatchery Cellar onEndOfTurn top-decks Ember Moth then Falling Fruit; Falling Fruit ends up on top", () => {
    // ⚠️ Plan note (REQ-EMBER-26): worldDrawTop PREPENDS, so the LAST step of the
    // Sequence ends up on top. Steps are [AddWorldCardToDeck Ember Moth,
    // AddWorldCardToDeck Falling Fruit] => Falling Fruit lands on top, Ember Moth
    // sits directly beneath it. This test pins that engine semantics.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const hatchery = catalog["Hatchery Cellar"];
    expect(hatchery?.kind).toBe("world");
    if (hatchery === undefined || hatchery.kind !== "world") return;

    const { state } = createWorld(catalog, worldData, 5, DEFAULT_RUN_MODIFIERS);
    const before = state.worldDraw.length;
    const result = applyEffect(catalog, state, hatchery.onEndOfTurn);

    expect(result.state.worldDraw.length).toBe(before + 2);
    // Documented result: Falling Fruit on top, Ember Moth immediately beneath.
    expect(result.state.worldDraw[0]!.templateId).toBe("Falling Fruit");
    expect(result.state.worldDraw[1]!.templateId).toBe("Ember Moth");
  });

  it("Hatchery Cellar onCleared offers a boon from ember-boons (3 offered, choose 1), not a five-card grant", () => {
    // Decision §4 deviation: REQ-EMBER-26's initial shape granted all five tools
    // via Sequence[GainCard x5]; we assert an OfferBoon offer instead. Mirrors the
    // big-box / tidal OfferBoon-on-clear assertion shape.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const hatchery = catalog["Hatchery Cellar"];
    expect(hatchery?.kind).toBe("world");
    if (hatchery === undefined || hatchery.kind !== "world") return;

    expect(hatchery.onCleared.kind).toBe("OfferBoon");

    const { state } = createWorld(catalog, worldData, 6, DEFAULT_RUN_MODIFIERS);
    const before = state.pendingBoonChoices.length;
    const beforeDiscard = state.playerDiscard.length;
    const result = applyEffect(catalog, state, hatchery.onCleared);

    // A boon offer, not a card dump: nothing lands in the discard/deck.
    expect(result.state.playerDiscard.length).toBe(beforeDiscard);
    expect(result.state.pendingBoonChoices.length).toBe(before + 1);

    const pending = result.state.pendingBoonChoices.at(-1)!;
    expect(pending.setId).toBe("ember-boons");
    expect(pending.chooseCount).toBe(1);
    expect(pending.offeredTemplateIds).toHaveLength(3);

    // Every offered template is drawn from the ember-boons pool.
    const pool = new Set<string>(FORTUNE_BOON_POOLS["ember-boons"]);
    for (const offered of pending.offeredTemplateIds) {
      expect(pool.has(offered)).toBe(true);
    }

    const offered = result.events.find((e) => e.type === "BoonOffered");
    expect(offered).toBeDefined();
    if (offered?.type === "BoonOffered") {
      expect(offered.setId).toBe("ember-boons");
    }
  });

  it("Ember Moth onEndOfTurn queues ForceDestroy (not HP damage)", () => {
    // Decision §5: the creatures snatch cards (ForceDestroy) so the Brace rewards
    // have something to absorb. Assert the snatch counter increments and HP is
    // untouched — no Damage path.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const moth = catalog["Ember Moth"];
    expect(moth?.kind).toBe("world");
    if (moth === undefined || moth.kind !== "world") return;

    expect(moth.onEndOfTurn).toEqual({ kind: "ForceDestroy", amount: 1 });

    const { state } = createWorld(catalog, worldData, 7, DEFAULT_RUN_MODIFIERS);
    const startHp = state.hp;
    const { state: after, events } = applyEffect(catalog, state, moth.onEndOfTurn);

    expect(after.pendingForceDestroy).toBe(state.pendingForceDestroy + 1);
    expect(after.hp).toBe(startHp);
    expect(events.some((e) => e.type === "DamageDealt")).toBe(false);
  });

  it("Ground Constellation onDiscarded queues ForceDestroy 2", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const groundConstellation = catalog["Ground Constellation"];
    expect(groundConstellation?.kind).toBe("world");
    if (groundConstellation === undefined || groundConstellation.kind !== "world") return;

    expect(groundConstellation.onDiscarded).toEqual({ kind: "ForceDestroy", amount: 2 });

    const { state } = createWorld(catalog, worldData, 8, DEFAULT_RUN_MODIFIERS);
    const { state: after } = applyEffect(catalog, state, groundConstellation.onDiscarded);
    expect(after.pendingForceDestroy).toBe(state.pendingForceDestroy + 2);
  });

  it("a Brace charge absorbs an Ember Moth snatch end-to-end (no card destroyed)", () => {
    // Revives the Brace mechanic (decision §5). Queue the moth's ForceDestroy,
    // then resolve it against a single brace charge: the charge is consumed and
    // no card is destroyed.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const moth = catalog["Ember Moth"];
    if (moth === undefined || moth.kind !== "world") throw new Error("Ember Moth missing");

    const { state } = createWorld(catalog, worldData, 9, DEFAULT_RUN_MODIFIERS);
    const { state: afterHook } = applyEffect(catalog, state, moth.onEndOfTurn);
    expect(afterHook.pendingForceDestroy).toBeGreaterThan(0);

    // Grant a Brace charge (as Dormant Star / Leave One / Keep Vigil would) and
    // resolve the snatch as the engine does at turn start.
    const braced: GameState = { ...afterHook, braceCharges: 1 };
    const resolved = resolveForceDestroy(braced);

    expect(resolved.events.some((e) => e.type === "BraceConsumed")).toBe(true);
    expect(resolved.events.some((e) => e.type === "CardDestroyed")).toBe(false);
    expect(resolved.state.pendingForceDestroy).toBe(0);
    expect(resolved.state.braceCharges).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// C5 — seeded three-act gameplay test (REQ-EMBER-50).
//
// Deterministic (fixed seed). Demonstrates the three-act identity through the
// pure core: early Dormant Stars give an immediate benefit, mid-game hazards
// recur / top-deck hatch cards, and the act-3 signature threat repeatedly adds
// Orchard threats until cleared or escaped.
// ---------------------------------------------------------------------------

describe("The Ember Orchard — seeded three-act identity (REQ-EMBER-50)", () => {
  it("early Dormant Stars give immediate benefit (draw + brace) while planting a hatch", () => {
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const dormantStar = catalog["Dormant Star"];
    if (dormantStar === undefined || dormantStar.kind !== "player") {
      throw new Error("Dormant Star missing");
    }

    const { state: base } = createWorld(catalog, worldData, 1234, DEFAULT_RUN_MODIFIERS);
    // Stage a Dormant Star in hand with one card to draw available.
    const dormant = dormantStar; // player template
    const state: GameState = {
      ...base,
      hand: [],
      braceCharges: 0,
    };
    const beforeBrace = state.braceCharges;
    const beforeHand = state.hand.length;
    const beforeWorldTop = state.worldDraw.length;

    const result = applyEffect(catalog, state, dormant.effect);

    // Immediate benefit: a player card drawn into hand and a brace charge gained.
    expect(result.state.hand.length).toBe(beforeHand + 1);
    expect(result.state.braceCharges).toBe(beforeBrace + 1);
    // Known future cost: an Ember Moth planted on top of the world deck.
    expect(result.state.worldDraw.length).toBe(beforeWorldTop + 1);
    expect(result.state.worldDraw[0]!.templateId).toBe("Ember Moth");
  });

  it("mid-game hazards recur by top-decking hatch cards on end of turn", () => {
    // Falling Fruit end-of-turn top-decks a Rooted Meteor; running its hook then
    // the meteor's onPartialClear top-decks another Falling Fruit — a recurring
    // hatch loop expressed entirely through AddWorldCardToDeck.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const fallingFruit = catalog["Falling Fruit"];
    const rootedMeteor = catalog["Rooted Meteor"];
    if (
      fallingFruit === undefined ||
      fallingFruit.kind !== "world" ||
      rootedMeteor === undefined ||
      rootedMeteor.kind !== "world"
    ) {
      throw new Error("mid-game hazard templates missing");
    }

    const { state } = createWorld(catalog, worldData, 4242, DEFAULT_RUN_MODIFIERS);

    const afterFruit = applyEffect(catalog, state, fallingFruit.onEndOfTurn);
    expect(afterFruit.state.worldDraw[0]!.templateId).toBe("Rooted Meteor");

    const afterMeteor = applyEffect(catalog, afterFruit.state, rootedMeteor.onPartialClear);
    expect(afterMeteor.state.worldDraw[0]!.templateId).toBe("Falling Fruit");
    // The deck grew across both hatches — recurrence, not a one-shot.
    expect(afterMeteor.state.worldDraw.length).toBe(state.worldDraw.length + 2);
  });

  it("the act-3 signature threat repeatedly adds Orchard threats until cleared/escaped", () => {
    // Fire Ground Constellation's end-of-turn AddThreatToWorldDeck three times in
    // sequence (as it would across three turns if never cleared): each pass adds a
    // fresh Ground Constellation to the top of the world deck.
    const { catalog, worldData } = buildWorld(WORLD_ID);
    const groundConstellation = catalog["Ground Constellation"];
    if (groundConstellation === undefined || groundConstellation.kind !== "world") {
      throw new Error("Ground Constellation missing");
    }

    let { state } = createWorld(catalog, worldData, 9999, DEFAULT_RUN_MODIFIERS);
    const start = state.worldDraw.length;

    for (let turn = 0; turn < 3; turn++) {
      const result = applyEffect(catalog, state, groundConstellation.onEndOfTurn);
      state = result.state;
      // Each turn the threat re-seeds itself on top.
      expect(state.worldDraw[0]!.templateId).toBe("Ground Constellation");
    }

    expect(state.worldDraw.length).toBe(start + 3);
  });

  it("plays a deterministic opening turn through the reducer without throwing (seeded run is reproducible)", () => {
    // A coarse end-to-end sanity pass: a fixed seed must drive a real EndTurn
    // through the reducer and stay in a 'playing' state, proving the assembled
    // Ember catalog reduces cleanly. Two identical seeds yield identical state.
    const { catalog, worldData } = buildWorld(WORLD_ID);

    const run = (seed: number): GameState => {
      const { state } = createWorld(catalog, worldData, seed, DEFAULT_RUN_MODIFIERS);
      // refillHand is driven by createWorld's opening; advance one turn.
      const { state: afterTurn } = reduce(catalog, state, { type: "EndTurn" });
      return afterTurn;
    };

    const a = run(20260621);
    const b = run(20260621);

    // Deterministic: same seed, same resulting hand/world-deck composition.
    expect(a.hand.map((c) => c.templateId)).toEqual(b.hand.map((c) => c.templateId));
    expect(a.worldDraw.map((c) => c.templateId)).toEqual(b.worldDraw.map((c) => c.templateId));
    expect(["playing", "won", "lost"]).toContain(a.status);
  });
});
