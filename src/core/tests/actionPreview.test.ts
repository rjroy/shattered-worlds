import { describe, expect, it } from "bun:test";
import { previewAction } from "../view/actionPreview";
import {
  catalog,
  makePlayerCard,
  makeState,
  makeWorldCard,
  mintPlayer,
  mintPlayers,
  mintWorld,
  mintWorlds,
} from "./testFixture";
import type { GameState, PlayerCard, WorldCard } from "../model/types";

function linesText(state: GameState, action: Parameters<typeof previewAction>[2]): string {
  return previewAction(catalog, state, action).summaryLines.join("\n");
}

describe("previewAction", () => {
  it("previews simple DealProgress without committing the returned state", () => {
    const [explore, s1] = mintPlayer(makeState(), "Explore");
    const [rubble, s2] = mintWorld(s1, "Rubble");
    const state = { ...s2, hand: [explore, rubble], energy: 0 };

    const preview = previewAction(catalog, state, {
      type: "PlayCard",
      cardId: explore.id,
      targetId: rubble.id,
    });

    expect(preview.previewable).toBe(true);
    expect(preview.events.map((event) => event.type)).toContain("ProgressDealt");
    expect(preview.events.map((event) => event.type)).toContain("HazardResolved");
    expect(preview.risk).toBe("attention");
    expect(preview.severity).toBe("warning");
    expect(preview.summaryLines).toContain("Make 1 Progress on Rubble (1/1)");
    expect(preview.summaryLines).toContain("Clear Rubble");
    expect(state.hand).toEqual([explore, rubble]);
    expect(state.progress).toEqual({});
  });

  it("summarizes clear hooks from the reducer event stream", () => {
    const [explore, s1] = mintPlayer(makeState(), "Explore");
    const [strangeSounds, s2] = mintWorld(s1, "Strange Sounds");
    const state = {
      ...s2,
      hand: [explore, strangeSounds],
      progress: { [strangeSounds.id]: 1 },
    };

    const text = linesText(state, {
      type: "PlayCard",
      cardId: explore.id,
      targetId: strangeSounds.id,
    });

    expect(text).toContain("Clear Strange Sounds");
    expect(text).toContain("Boon offered");
    expect(
      previewAction(catalog, state, {
        type: "PlayCard",
        cardId: explore.id,
        targetId: strangeSounds.id,
      }).risk,
    ).toBe("attention");
  });

  it("summarizes partial hooks and marks damage as harmful", () => {
    const [explore, s1] = mintPlayer(makeState({ hp: 10 }), "Explore");
    const [zombie, s2] = mintWorld(s1, "Zombie");
    const state = { ...s2, hand: [explore, zombie] };

    const preview = previewAction(catalog, state, {
      type: "PlayCard",
      cardId: explore.id,
      targetId: zombie.id,
    });
    const text = preview.summaryLines.join("\n");

    expect(preview.risk).toBe("harmful");
    expect(preview.severity).toBe("danger");
    expect(text).toContain("Partial resolve on Zombie");
    expect(text).toContain("Take 1 damage");
    expect(text).toContain("HP 10 -> 9 (-1)");
  });

  it("aggregates repeated outcomes for DealProgressAll", () => {
    const [sweep, s1] = mintPlayer(makeState(), "Shelf Sweep");
    const [zombies, s2] = mintWorlds(s1, "Zombie", 3);
    const state = {
      ...s2,
      hand: [sweep, ...zombies],
      energy: 2,
      progress: Object.fromEntries(zombies.map((zombie) => [zombie.id, 1])),
    };

    const preview = previewAction(catalog, state, {
      type: "PlayCard",
      cardId: sweep.id,
    });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    expect(preview.risk).toBe("attention");
    expect(text).toContain("Make 6 total Progress across 3 hazards");
    expect(text).toContain("Clear 3 hazards");
    expect(text).not.toContain("Partial effects trigger");
  });

  it("masks concealed broad-effect previews without leaking hidden card data or hook text", () => {
    const sweep = makePlayerCard({
      id: "searchlight",
      templateId: "Searchlight",
      name: "Searchlight",
      energyCost: 0,
      effect: { kind: "DealProgressAll", base: 1, bonus: { tag: "Obstructed", amount: 2 } },
    });
    const concealed = makeWorldCard({
      id: "mist",
      templateId: "Something in the Mist",
      name: "Something in the Mist",
      cost: 9,
      keywords: [{ name: "Concealed", value: 5 }, { name: "Obstructed" }, { name: "Creature" }],
      onPartialClear: { kind: "Damage", amount: 7 },
    });
    const state = makeState({ hand: [sweep, concealed], hp: 10, light: 0 });

    const preview = previewAction(catalog, state, {
      type: "PlayCard",
      cardId: sweep.id,
    });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    expect(preview.risk).toBe("harmful");
    expect(preview.severity).toBe("danger");
    expect(text).toContain("Effect is concealed. Beware.");
    expect(text).toContain("Make Progress on a concealed hazard");
    expect(text).toContain("concealed hazard effects may trigger");
    expect(text).not.toContain("Something in the Mist");
    expect(text).not.toContain("Obstructed");
    expect(text).not.toContain("Creature");
    expect(text).not.toContain("(3/9)");
    expect(text).not.toContain("Take 7 damage");
    expect(text).not.toContain("HP 10 -> 3 (-7)");
  });

  it("summarizes visible and concealed broad-effect hazards separately", () => {
    const sweep = makePlayerCard({
      id: "searchlight",
      templateId: "Searchlight",
      name: "Searchlight",
      energyCost: 0,
      effect: { kind: "DealProgressAll", base: 1, bonus: { tag: "Obstructed", amount: 2 } },
    });
    const visible = makeWorldCard({
      id: "visible-zombie",
      templateId: "Zombie",
      name: "Zombie",
      cost: 5,
      keywords: [{ name: "Creature" }],
    });
    const concealed = makeWorldCard({
      id: "mist",
      templateId: "Something in the Mist",
      name: "Something in the Mist",
      cost: 9,
      keywords: [{ name: "Concealed", value: 5 }, { name: "Obstructed" }],
      onPartialClear: { kind: "Damage", amount: 4 },
    });
    const state = makeState({ hand: [sweep, visible, concealed], hp: 10, light: 0 });

    const preview = previewAction(catalog, state, {
      type: "PlayCard",
      cardId: sweep.id,
    });
    const text = preview.summaryLines.join("\n");

    expect(text).toContain("Make 1 total Progress across 1 hazard");
    expect(text).toContain("Partial resolve on Zombie");
    expect(text).toContain("Make Progress on a concealed hazard");
    expect(text).toContain("concealed hazard effects may trigger");
    expect(text).not.toContain("Something in the Mist");
    expect(text).not.toContain("(3/9)");
    expect(text).not.toContain("Take 4 damage");
  });

  it("uses generic clear copy for concealed hazards that broad effects would clear", () => {
    const sweep = makePlayerCard({
      id: "searchlight",
      templateId: "Searchlight",
      name: "Searchlight",
      energyCost: 0,
      effect: { kind: "DealProgressAll", base: 1, bonus: { tag: "Obstructed", amount: 2 } },
    });
    const concealed = makeWorldCard({
      id: "mist",
      templateId: "Something in the Mist",
      name: "Something in the Mist",
      cost: 3,
      keywords: [{ name: "Concealed", value: 5 }, { name: "Obstructed" }],
      onCleared: { kind: "Damage", amount: 6 },
    });
    const state = makeState({ hand: [sweep, concealed], hp: 10, light: 0 });

    const preview = previewAction(catalog, state, {
      type: "PlayCard",
      cardId: sweep.id,
    });
    const text = preview.summaryLines.join("\n");

    expect(preview.risk).toBe("harmful");
    expect(text).toContain("a concealed hazard would clear");
    expect(text).toContain("concealed hazard effects may trigger");
    expect(text).not.toContain("Something in the Mist");
    expect(text).not.toContain("(3/3)");
    expect(text).not.toContain("Take 6 damage");
    expect(text).not.toContain("HP 10 -> 4 (-6)");
  });

  it("marks adding a world card to the world deck as attention", () => {
    const [summonDoor, s1] = mintPlayer(makeState({ energy: 6 }), "Summon Door");
    const state = { ...s1, hand: [summonDoor], energy: 6, worldDraw: [] };

    const preview = previewAction(catalog, state, { type: "PlayCard", cardId: summonDoor.id });

    expect(preview.previewable).toBe(true);
    expect(preview.events).toContainEqual(
      expect.objectContaining({ type: "CardGained", templateId: "Door", dest: "worldDraw" }),
    );
    expect(preview.risk).toBe("attention");
    expect(preview.severity).toBe("warning");
    expect(preview.summaryLines).toContain("Gain Door to worldDraw");
  });

  it("marks adding a world card to the top of the world deck as attention", () => {
    const topCatalog = {
      ...catalog,
      "Stack Zombie": {
        kind: "player" as const,
        name: "Stack Zombie",
        effect: { kind: "AddWorldCardToDeck" as const, template: "Zombie", bTop: true },
      },
    };
    const [stackZombie, s1] = mintPlayer(makeState(), "Stack Zombie", topCatalog);
    const state = { ...s1, hand: [stackZombie], worldDraw: [] };

    const preview = previewAction(topCatalog, state, { type: "PlayCard", cardId: stackZombie.id });

    expect(preview.previewable).toBe(true);
    expect(preview.events).toContainEqual(
      expect.objectContaining({ type: "CardGained", templateId: "Zombie", dest: "worldDrawTop" }),
    );
    expect(preview.risk).toBe("attention");
    expect(preview.severity).toBe("warning");
    expect(preview.summaryLines).toContain("Gain Zombie to top of world deck");
  });

  it("previews DiscardHazard penalties", () => {
    const [zombie, s1] = mintWorld(makeState({ hp: 10 }), "Zombie");
    const state = { ...s1, hand: [zombie] };

    const preview = previewAction(catalog, state, { type: "DiscardHazard", cardId: zombie.id });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    expect(preview.risk).toBe("harmful");
    expect(text).toContain("Discard Zombie");
    expect(text).toContain("Take 5 damage");
    expect(text).toContain("HP 10 -> 5 (-5)");
  });

  it("previews EndTurn hooks, discarded hand cards, and refill deltas", () => {
    const [rubble, s1] = mintWorld(makeState({ hp: 10 }), "Rubble");
    const [explore, s2] = mintPlayer(s1, "Explore");
    const [drawCards, s3] = mintPlayers(s2, "Explore", 2);
    const state = {
      ...s3,
      hand: [rubble, explore],
      playerDraw: drawCards,
      energy: 0,
    };

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    expect(preview.risk).toBe("harmful");
    expect(text).toContain("End the turn");
    expect(text).toContain("Take 1 damage");
    expect(text).toContain("Discard 1 card: Explore");
    expect(text).toContain("Energy 0 -> 1 (+1)");
    expect(text).toContain("Draw 3 player cards");
  });

  it("keeps visible EndTurn hook consequences while masking concealed hooks", () => {
    const visible = makeWorldCard({
      id: "signal-fire",
      templateId: "Signal Fire",
      name: "Signal Fire",
      onEndOfTurn: { kind: "GainLight", amount: 2 },
    });
    const concealed = makeWorldCard({
      id: "mist-stalker",
      templateId: "Something in the Mist",
      name: "Something in the Mist",
      keywords: [{ name: "Concealed", value: 5 }],
      onEndOfTurn: { kind: "Damage", amount: 4 },
    });
    const [drawCards, s1] = mintPlayers(makeState({ hp: 10, light: 0 }), "Explore", 4);
    const state = { ...s1, hand: [visible, concealed], playerDraw: drawCards };

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    expect(text).toContain("End the turn");
    expect(text).toContain("Light 0 -> 2 (+2)");
    expect(text).toContain("concealed hazard effects may trigger");
    expect(text).toContain("Energy 0 -> 1 (+1)");
    expect(text).toContain("Draw 4 player cards");
    expect(text).not.toContain("Something in the Mist");
    expect(text).not.toContain("Take 4 damage");
    expect(text).not.toContain("HP 10 -> 6 (-4)");
  });

  it("masks concealed EndTurn hooks that begin with resource events", () => {
    const concealed = makeWorldCard({
      id: "hidden-generator",
      templateId: "Hidden Generator",
      name: "Hidden Generator",
      keywords: [{ name: "Concealed", value: 5 }],
      onEndOfTurn: { kind: "GainEnergy", amount: 5 },
    });
    const [drawCards, s1] = mintPlayers(makeState({ energy: 0, light: 0 }), "Explore", 5);
    const state = { ...s1, hand: [concealed], playerDraw: drawCards };

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    expect(text).toContain("concealed hazard effects may trigger");
    expect(text).toContain("Energy changes");
    expect(text).toContain("Draw 5 player cards");
    expect(text).not.toContain("Hidden Generator");
    expect(text).not.toContain("Energy 0 -> 5 (+5)");
    expect(text).not.toContain("Energy 0 -> 6 (+6)");
    expect(text).not.toContain("Energy 5 -> 6 (+1)");
  });

  it("masks downstream EndTurn discard and refill summaries tainted by concealed draws", () => {
    const concealed = makeWorldCard({
      id: "mist-cache",
      templateId: "Mist Cache",
      name: "Mist Cache",
      keywords: [{ name: "Concealed", value: 5 }],
      onEndOfTurn: { kind: "Draw", player: 2 },
    });
    const held = makePlayerCard({ id: "held-tool", templateId: "Held Tool", name: "Held Tool" });
    const hiddenA = makePlayerCard({
      id: "hidden-draw-a",
      templateId: "Hidden Draw A",
      name: "Hidden Draw A",
    });
    const hiddenB = makePlayerCard({
      id: "hidden-draw-b",
      templateId: "Hidden Draw B",
      name: "Hidden Draw B",
    });
    const refillCards = Array.from({ length: 5 }, (_, index) =>
      makePlayerCard({
        id: `refill-${index}`,
        templateId: `Refill ${index}`,
        name: `Refill ${index}`,
      }),
    );
    const state = makeState({
      hand: [concealed, held],
      playerDraw: [hiddenA, hiddenB, ...refillCards],
      light: 0,
    });

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    expect(text).toContain("concealed hazard effects may trigger");
    expect(text).toContain("Discard player cards");
    // The turn-end refill draw is stamped revealedFromHidden, so the stamp path
    // masks it to the generic "Draw N player cards": a count but no card names.
    // The concealed hook's own draw ("Draw 2") stays masked by concealment.
    expect(text).toMatch(/Draw \d+ player cards/);
    expect(text).toContain("Energy 0 -> 1 (+1)");
    expect(text).not.toContain("Mist Cache");
    expect(text).not.toContain("Hidden Draw A");
    expect(text).not.toContain("Hidden Draw B");
    expect(text).not.toContain("Discard 3 cards");
    expect(text).not.toContain("Draw 2 cards");
  });

  it("masks downstream EndTurn shuffles caused by concealed draw hooks", () => {
    const concealed = makeWorldCard({
      id: "mist-cache",
      templateId: "Mist Cache",
      name: "Mist Cache",
      keywords: [{ name: "Concealed", value: 5 }],
      onEndOfTurn: { kind: "Draw", player: 2 },
    });
    const held = makePlayerCard({ id: "held-tool", templateId: "Held Tool", name: "Held Tool" });
    const hiddenA = makePlayerCard({
      id: "hidden-draw-a",
      templateId: "Hidden Draw A",
      name: "Hidden Draw A",
    });
    const hiddenB = makePlayerCard({
      id: "hidden-draw-b",
      templateId: "Hidden Draw B",
      name: "Hidden Draw B",
    });
    const state = makeState({
      hand: [concealed, held],
      playerDraw: [],
      playerDiscard: [hiddenA, hiddenB],
      light: 0,
    });

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    expect(text).toContain("concealed hazard effects may trigger");
    // DeckShuffled carries no card names, so it keeps its generic "Shuffle the
    // deck" copy; the turn-end refill draw masks to a name-free "Draw N ...".
    expect(text).toContain("Shuffle the deck");
    expect(text).toMatch(/Draw \d+ player cards/);
    expect(text).not.toContain("Mist Cache");
    expect(text).not.toContain("Hidden Draw A");
    expect(text).not.toContain("Hidden Draw B");
    expect(text).not.toContain("Discard 3 cards");
    expect(text).not.toContain("Draw 2 cards");
  });

  it("preserves visible EndTurn hook consequences after concealed draw hooks", () => {
    const concealed = makeWorldCard({
      id: "mist-cache",
      templateId: "Mist Cache",
      name: "Mist Cache",
      keywords: [{ name: "Concealed", value: 5 }],
      onEndOfTurn: { kind: "Draw", player: 2 },
    });
    const visible = makeWorldCard({
      id: "signal-fire",
      templateId: "Signal Fire",
      name: "Signal Fire",
      onEndOfTurn: { kind: "GainLight", amount: 2 },
    });
    const held = makePlayerCard({ id: "held-tool", templateId: "Held Tool", name: "Held Tool" });
    const hiddenA = makePlayerCard({
      id: "hidden-draw-a",
      templateId: "Hidden Draw A",
      name: "Hidden Draw A",
    });
    const hiddenB = makePlayerCard({
      id: "hidden-draw-b",
      templateId: "Hidden Draw B",
      name: "Hidden Draw B",
    });
    const state = makeState({
      hand: [concealed, visible, held],
      playerDraw: [],
      playerDiscard: [hiddenA, hiddenB],
      light: 0,
    });

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    expect(text).toContain("Light 0 -> 2 (+2)");
    expect(text).toContain("concealed hazard effects may trigger");
    // DeckShuffled keeps its generic "Shuffle the deck" copy (no card names);
    // the visible GainLight stays specific and no hidden card name leaks.
    expect(text).toContain("Shuffle the deck");
    expect(text).not.toContain("Mist Cache");
    expect(text).not.toContain("Hidden Draw A");
    expect(text).not.toContain("Hidden Draw B");
    expect(text).not.toContain("Draw 3 cards");
  });

  it("masks destroyed cards from a concealed EndTurn ForceDestroy hook", () => {
    const concealed = makeWorldCard({
      id: "mist-snatcher",
      templateId: "Mist Snatcher",
      name: "Mist Snatcher",
      keywords: [{ name: "Concealed", value: 5 }],
      onEndOfTurn: { kind: "ForceDestroy", amount: 1 },
    });
    const refillCards = Array.from({ length: 5 }, (_, index) =>
      makePlayerCard({
        id: `loot-${index}`,
        templateId: `Loot ${index}`,
        name: `Loot ${index}`,
      }),
    );
    const state = makeState({ hand: [concealed], playerDraw: refillCards, light: 0 });

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    // The ForceDestroy fires from a concealed source. Its deferred CardDestroyed
    // now carries that source's provenance (pendingForceDestroySource), so it is
    // masked directly as a concealed-source event: only the generic warning
    // shows, and the destroyed loot is never named.
    expect(text).toContain("concealed hazard effects may trigger");
    expect(text).not.toContain("Mist Snatcher");
    for (let index = 0; index < refillCards.length; index++) {
      expect(text).not.toContain(`Loot ${index}`);
    }
  });

  it("masks a hazard a concealed EndTurn hook adds to the world deck", () => {
    // The concealed card is a literal (not minted from catalog); its onEndOfTurn
    // adds a "Zombie" world card, a template the base catalog already defines.
    const concealed = makeWorldCard({
      id: "mist-spawner",
      templateId: "Mist Spawner Hazard",
      name: "Mist Spawner",
      keywords: [{ name: "Concealed", value: 5 }],
      onEndOfTurn: { kind: "AddWorldCardToDeck", template: "Zombie" },
    });
    const [drawCards, s1] = mintPlayers(makeState({ light: 0 }), "Explore", 4);
    const state = { ...s1, hand: [concealed], playerDraw: drawCards, worldDraw: [] };

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    // The Zombie the hidden hook spawns must not be named — neither directly nor
    // via a downstream world-refill summary.
    expect(text).toContain("concealed hazard effects may trigger");
    expect(text).not.toContain("Mist Spawner");
    expect(text).not.toContain("Zombie");
    expect(text).not.toContain("Gain Zombie to worldDraw");
  });

  it("does not mutate original state references or zones", () => {
    const [explore, s1] = mintPlayer(makeState(), "Explore");
    const [rubble, s2] = mintWorld(s1, "Rubble");
    const hand: readonly (PlayerCard | WorldCard)[] = [explore, rubble];
    const playerDiscard = s2.playerDiscard;
    const worldDraw = s2.worldDraw;
    const progress = s2.progress;
    const state = { ...s2, hand };

    previewAction(catalog, state, {
      type: "PlayCard",
      cardId: explore.id,
      targetId: rubble.id,
    });

    expect(state.hand).toBe(hand);
    expect(state.playerDiscard).toBe(playerDiscard);
    expect(state.worldDraw).toBe(worldDraw);
    expect(state.progress).toBe(progress);
    expect(state.hand).toEqual([explore, rubble]);
  });

  it("returns a typed non-previewable result for illegal actions", () => {
    const state = makeState();

    expect(() =>
      previewAction(catalog, state, { type: "PlayCard", cardId: "missing", targetId: "none" }),
    ).not.toThrow();

    const preview = previewAction(catalog, state, {
      type: "PlayCard",
      cardId: "missing",
      targetId: "none",
    });

    expect(preview.previewable).toBe(false);
    expect(preview.events).toEqual([]);
    expect(preview.summaryLines).toEqual([]);
    expect(preview.risk).toBe("none");
    expect(preview.severity).toBe("info");
    expect(preview.error).toContain("Card missing is not playable");
  });

  it("shows a visible EndTurn draw while masking a co-firing concealed ForceDestroy", () => {
    // Concern (b): a concealed card queues a deferred destroy AND a visible card
    // disturbs the deck this turn (drawing 2). The visible draw must read
    // specifically; only the concealed destroy is masked. The old static taint
    // started at TurnEnded and over-masked the visible draw to generic copy.
    const concealed = makeWorldCard({
      id: "mist-snatcher",
      templateId: "Mist Snatcher",
      name: "Mist Snatcher",
      keywords: [{ name: "Concealed", value: 5 }],
      onEndOfTurn: { kind: "ForceDestroy", amount: 1 },
    });
    const visible = makeWorldCard({
      id: "open-cache",
      templateId: "Open Cache",
      name: "Open Cache",
      onEndOfTurn: { kind: "Draw", player: 2 },
    });
    const held = makePlayerCard({ id: "held-tool", templateId: "Held Tool", name: "Held Tool" });
    const refillCards = Array.from({ length: 7 }, (_, index) =>
      makePlayerCard({
        id: `loot-${index}`,
        templateId: `Loot ${index}`,
        name: `Loot ${index}`,
      }),
    );
    const state = makeState({
      hand: [concealed, visible, held],
      playerDraw: refillCards,
      light: 0,
    });

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    // The visible card's draw is named specifically, not generic-masked.
    expect(text).toContain("Draw 2 player cards");
    // The concealed destroy is masked.
    expect(text).toContain("concealed hazard effects may trigger");
    expect(text).not.toContain("Mist Snatcher");
    // No CardDestroyed line names the snatched player card.
    expect(text).not.toContain("Destroy 1 card");
  });

  it("masks a Brace absorption caused by a concealed ForceDestroy", () => {
    // Concern (a): with brace charges present, the deferred BraceConsumed now
    // carries the concealed source's provenance, so the "Brace absorbs..." line
    // that would hint at the hidden snatch is masked.
    const concealed = makeWorldCard({
      id: "mist-snatcher",
      templateId: "Mist Snatcher",
      name: "Mist Snatcher",
      keywords: [{ name: "Concealed", value: 5 }],
      onEndOfTurn: { kind: "ForceDestroy", amount: 1 },
    });
    const held = makePlayerCard({ id: "held-tool", templateId: "Held Tool", name: "Held Tool" });
    const refillCards = Array.from({ length: 5 }, (_, index) =>
      makePlayerCard({
        id: `loot-${index}`,
        templateId: `Loot ${index}`,
        name: `Loot ${index}`,
      }),
    );
    const state = makeState({
      hand: [concealed, held],
      playerDraw: refillCards,
      braceCharges: 2,
      light: 0,
    });

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    // The brace absorption fired (a BraceConsumed event exists in the stream)...
    expect(preview.events.some((event) => event.type === "BraceConsumed")).toBe(true);
    // ...but it must not surface a line hinting at the concealed snatch.
    expect(text).not.toContain("Brace absorbs");
    expect(text).toContain("concealed hazard effects may trigger");
    expect(text).not.toContain("Mist Snatcher");
  });

  it("masks a GainRandomCard roll: names the pool, never the rolled template or its rarity (D3)", () => {
    const [explore, s1] = mintPlayer(makeState(), "Explore");
    const cache = makeWorldCard({
      id: "cache-hazard",
      templateId: "Cache Hazard",
      name: "Cache Hazard",
      cost: 1,
      onCleared: { kind: "GainRandomCard", setId: "pool-fortune", setName: "the cache" },
    });
    const state = { ...s1, hand: [explore, cache], progress: {} };

    const preview = previewAction(catalog, state, {
      type: "PlayCard",
      cardId: explore.id,
      targetId: cache.id,
    });
    const text = preview.summaryLines.join("\n");

    expect(preview.events.some((event) => event.type === "CardGained")).toBe(true);
    expect(text).toContain("Gain a random card from the cache");
    // None of the pool's templates, nor any rarity word, leak into the preview.
    for (const templateId of [
      "Lucky Break",
      "Second Wind",
      "Found Tool",
      "Clear Path",
      "Steady Nerve",
    ]) {
      expect(text).not.toContain(templateId);
    }
    expect(text.toLowerCase()).not.toMatch(/common|uncommon|\brare\b|legendary/);
  });

  it("still names the template for a fixed GainCard grant (regression)", () => {
    const [explore, s1] = mintPlayer(makeState(), "Explore");
    const stash = makeWorldCard({
      id: "stash-hazard",
      templateId: "Stash Hazard",
      name: "Stash Hazard",
      cost: 1,
      onCleared: { kind: "GainCard", template: "Sprint" },
    });
    const state = { ...s1, hand: [explore, stash], progress: {} };

    const text = linesText(state, {
      type: "PlayCard",
      cardId: explore.id,
      targetId: stash.id,
    });

    expect(text).toContain("Gain Sprint to discard");
  });

  it("masks the rng ForceDestroy snatch from a visible source (leak fix), risk unchanged", () => {
    // A VISIBLE world card queues the destroy, so the deferred CardDestroyed is
    // not concealed-source — before the stamp fix it fell through to the named
    // summary and leaked the rng-chosen victim. The randomized stamp must mask it.
    const snatcher = makeWorldCard({
      id: "open-snatcher",
      templateId: "Open Snatcher",
      name: "Open Snatcher",
      onEndOfTurn: { kind: "ForceDestroy", amount: 1 },
    });
    const held = makePlayerCard({ id: "held-tool", templateId: "Held Tool", name: "Held Tool" });
    const refillCards = Array.from({ length: 5 }, (_, index) =>
      makePlayerCard({
        id: `loot-${index}`,
        templateId: `Loot ${index}`,
        name: `Loot ${index}`,
      }),
    );
    const state = makeState({ hand: [snatcher, held], playerDraw: refillCards, light: 0 });

    const preview = previewAction(catalog, state, { type: "EndTurn" });
    const text = preview.summaryLines.join("\n");

    expect(preview.previewable).toBe(true);
    // resolveForceDestroy resolves the pending snatch this turn, so a
    // CardDestroyed event exists in the stream...
    expect(preview.events.some((event) => event.type === "CardDestroyed")).toBe(true);
    // ...yet the rng-chosen victim is never named; the summary reads generically.
    expect(text).toContain("Destroy 1 player card");
    for (let index = 0; index < refillCards.length; index++) {
      expect(text).not.toContain(`Loot ${index}`);
    }
    // Risk/severity unchanged: the turn-end player discard keeps it harmful.
    expect(preview.risk).toBe("harmful");
    expect(preview.severity).toBe("danger");
  });

  it("masks ExileTopWorldCards: never names the exiled top of the world deck (leak fix)", () => {
    const exiler = makePlayerCard({
      id: "exile-tool",
      templateId: "Exile Tool",
      name: "Exile Tool",
      effect: { kind: "ExileTopWorldCards", amount: 2 },
    });
    const topZombie = makeWorldCard({ id: "top-zombie", templateId: "Zombie", name: "Zombie" });
    const topRubble = makeWorldCard({ id: "top-rubble", templateId: "Rubble", name: "Rubble" });
    const state = makeState({ hand: [exiler], worldDraw: [topZombie, topRubble] });

    const preview = previewAction(catalog, state, { type: "PlayCard", cardId: exiler.id });
    const text = preview.summaryLines.join("\n");

    expect(preview.events.some((event) => event.type === "WorldCardsExiled")).toBe(true);
    // The exiled cards come off the hidden world deck; only the count shows.
    expect(text).toContain("Exile top 2 world cards");
    expect(text).not.toContain("Zombie");
    expect(text).not.toContain("Rubble");
    // WorldCardsExiled classifies as attention; masking does not change that.
    expect(preview.risk).toBe("attention");
    expect(preview.severity).toBe("warning");
  });

  it("keeps a masked rng freeze classified as harmful (risk preserved)", () => {
    const freezer = makePlayerCard({
      id: "freeze-tool",
      templateId: "Freeze Tool",
      name: "Freeze Tool",
      effect: { kind: "FreezeCards", amount: 2, duration: 1 },
    });
    const targetA = makePlayerCard({ id: "target-a", templateId: "Target A", name: "Target A" });
    const targetB = makePlayerCard({ id: "target-b", templateId: "Target B", name: "Target B" });
    const state = makeState({ hand: [freezer, targetA, targetB], light: 0 });

    const preview = previewAction(catalog, state, { type: "PlayCard", cardId: freezer.id });
    const text = preview.summaryLines.join("\n");

    expect(preview.events.some((event) => event.type === "CardsFrozen")).toBe(true);
    // The rng pick is summarized generically (no frozen card is named)...
    expect(text).toContain("Freeze 2 cards at random");
    expect(text).not.toContain("Target A");
    expect(text).not.toContain("Target B");
    // ...and the freeze still reads as harmful: the stamp masks copy, not risk.
    expect(preview.risk).toBe("harmful");
    expect(preview.severity).toBe("danger");
  });
});
