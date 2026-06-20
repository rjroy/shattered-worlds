import { describe, expect, it } from "bun:test";
import { BOON_SETS, FORTUNE_BOON_POOLS } from "../../data/worlds/boons/fortune";
import { buildWorld, worldManifest } from "../../data/worldManifest";
import { worldDataRegistry } from "../../data/worlds/registry";
import { LOOT_POOLS } from "../effects/pools";
import { applyEffect } from "../engine/effects";
import { createWorld } from "../engine/world";
import type { CardCatalog } from "../model/catalog";
import type { CardEffect } from "../model/types";

// ---------------------------------------------------------------------------
// World assembly contract. Every world registered in the manifest must follow
// the theme-authoring rules: it assembles without duplicate-template errors,
// runs three escalating acts, ends on The Walker, and every card-effect that
// names another template must resolve in the assembled catalog (an unresolved
// reference is an authoring typo that would only surface mid-run otherwise).
// ---------------------------------------------------------------------------

const worldIds = Object.keys(worldManifest);
const fortuneBoonIds = FORTUNE_BOON_POOLS["fortune-v1"];
const fortuneBoonIdSet = new Set<string>(fortuneBoonIds);
const boonSetEntries = Object.entries(BOON_SETS);
const boonSetIds = new Set(boonSetEntries.map(([setId]) => setId));
const allBoonSetTemplateIds = boonSetEntries.flatMap(([, set]) => [...set.templateIds]);

/** Template ids an effect can name, walking Modal branches and Sequence steps. */
function templateRefs(effect: CardEffect): string[] {
  switch (effect.kind) {
    case "AddCard":
    case "AddWorldCardToDeck":
    case "AddPlayerCardToTop":
    case "GainCard":
      return [effect.template];
    case "Modal":
      return effect.branches.flatMap(templateRefs);
    case "Sequence":
      return effect.steps.flatMap(templateRefs);
    default:
      return [];
  }
}

function offerBoonSetRefs(effect: CardEffect): string[] {
  switch (effect.kind) {
    case "OfferBoon":
      return [effect.setId];
    case "Modal":
      return effect.branches.flatMap(offerBoonSetRefs);
    case "Sequence":
      return effect.steps.flatMap(offerBoonSetRefs);
    default:
      return [];
  }
}

function lootPoolSetRefs(effect: CardEffect): string[] {
  switch (effect.kind) {
    case "GainRandomCard":
      return [effect.setId];
    case "Modal":
      return effect.branches.flatMap(lootPoolSetRefs);
    case "Sequence":
      return effect.steps.flatMap(lootPoolSetRefs);
    default:
      return [];
  }
}

/** Every template id referenced by any effect across the whole catalog. */
function allReferencedTemplates(catalog: CardCatalog): string[] {
  const refs: string[] = [];
  for (const template of Object.values(catalog)) {
    if (template.kind === "player") {
      refs.push(...templateRefs(template.effect));
    } else {
      refs.push(...templateRefs(template.onDiscarded));
      refs.push(...templateRefs(template.onCleared));
      refs.push(...templateRefs(template.onEndOfTurn));
      refs.push(...templateRefs(template.onPartialClear));
    }
  }
  return refs;
}

function allReferencedOfferBoonSets(catalog: CardCatalog): string[] {
  const refs: string[] = [];
  for (const template of Object.values(catalog)) {
    if (template.kind === "player") {
      refs.push(...offerBoonSetRefs(template.effect));
    } else {
      refs.push(...offerBoonSetRefs(template.onDiscarded));
      refs.push(...offerBoonSetRefs(template.onCleared));
      refs.push(...offerBoonSetRefs(template.onEndOfTurn));
      refs.push(...offerBoonSetRefs(template.onPartialClear));
    }
  }
  return refs;
}

function allReferencedLootPoolSets(catalog: CardCatalog): string[] {
  const refs: string[] = [];
  for (const template of Object.values(catalog)) {
    if (template.kind === "player") {
      refs.push(...lootPoolSetRefs(template.effect));
    } else {
      refs.push(...lootPoolSetRefs(template.onDiscarded));
      refs.push(...lootPoolSetRefs(template.onCleared));
      refs.push(...lootPoolSetRefs(template.onEndOfTurn));
      refs.push(...lootPoolSetRefs(template.onPartialClear));
    }
  }
  return refs;
}

function catalogWorldTemplateIds(catalog: CardCatalog): Set<string> {
  return new Set(
    Object.entries(catalog)
      .filter(([, template]) => template.kind === "world")
      .map(([id]) => id),
  );
}

function expectNoForbiddenBoonEffect(
  effect: CardEffect,
  worldTemplateIds: ReadonlySet<string>,
): void {
  switch (effect.kind) {
    case "SurviveWorld":
    case "AddWorldCardToDeck":
    case "AddThreatToWorldDeck":
    case "ExileTopWorldCards":
      throw new Error(`Forbidden Fortune boon effect: ${effect.kind}`);
    case "AddCard":
      if (
        effect.dest === "worldDraw" ||
        effect.dest === "worldDrawTop" ||
        effect.template === "Door" ||
        effect.template === "The Walker" ||
        worldTemplateIds.has(effect.template)
      ) {
        throw new Error(`Forbidden Fortune boon AddCard effect: ${effect.template}`);
      }
      return;
    case "GainCard":
    case "AddPlayerCardToTop":
      if (
        effect.template === "Door" ||
        effect.template === "The Walker" ||
        worldTemplateIds.has(effect.template)
      ) {
        throw new Error(`Forbidden Fortune boon ${effect.kind} effect: ${effect.template}`);
      }
      return;
    case "Modal":
      for (const branch of effect.branches) expectNoForbiddenBoonEffect(branch, worldTemplateIds);
      return;
    case "Sequence":
      for (const step of effect.steps) expectNoForbiddenBoonEffect(step, worldTemplateIds);
      return;
    default:
      return;
  }
}

it("registers more than one world", () => {
  expect(worldIds.length).toBeGreaterThan(1);
});

describe.each(worldIds)('world "%s"', (worldId) => {
  it("assembles without throwing (no duplicate template ids)", () => {
    expect(() => buildWorld(worldId)).not.toThrow();
  });

  it("descriptor carries the matching worldId and a non-empty starter deck", () => {
    const { worldData } = buildWorld(worldId);
    expect(worldData.worldId).toBe(worldId);
    expect(worldData.starterDeck.length).toBeGreaterThan(0);
  });

  it("runs three acts and ends the last act on The Walker", () => {
    const { worldData } = buildWorld(worldId);
    const acts = worldData.deckComposition.acts;
    expect(acts).toHaveLength(3);
    const finalAct = acts[acts.length - 1]!;
    const lastCard = finalAct.cards[finalAct.cards.length - 1]!;
    expect(lastCard.templateId).toBe("The Walker");
  });

  it("every card-effect template reference resolves in the catalog", () => {
    const { catalog } = buildWorld(worldId);
    const missing = allReferencedTemplates(catalog).filter((id) => catalog[id] === undefined);
    expect(missing).toEqual([]);
  });

  it("every templateId in the deck composition exists in the catalog", () => {
    const { catalog, worldData } = buildWorld(worldId);
    const deckIds = worldData.deckComposition.acts.flatMap((act) =>
      act.cards.map((c) => c.templateId),
    );
    const missing = deckIds.filter((id) => catalog[id] === undefined);
    expect(missing).toEqual([]);
  });

  it("contains every registered boon set template in the assembled catalog", () => {
    const { catalog } = buildWorld(worldId);
    const missing = allBoonSetTemplateIds.filter((id) => catalog[id] === undefined);
    expect(missing).toEqual([]);
  });

  it("resolves every authored OfferBoon setId to a registered boon set", () => {
    const { catalog } = buildWorld(worldId);
    const missing = allReferencedOfferBoonSets(catalog).filter((setId) => !boonSetIds.has(setId));
    expect(missing).toEqual([]);
  });

  it("resolves every authored GainRandomCard setId to a registered loot pool", () => {
    const { catalog } = buildWorld(worldId);
    const missing = allReferencedLootPoolSets(catalog).filter(
      (setId) => !Object.prototype.hasOwnProperty.call(LOOT_POOLS, setId),
    );
    expect(missing).toEqual([]);
  });
});

describe("fortune-v1 boon source", () => {
  it("keeps each boon set templateIds in sync with its authored source templates", () => {
    for (const [, set] of boonSetEntries) {
      const authoredTemplateIds: string[] = Object.keys(set.source.cardTemplates).sort();
      const registeredTemplateIds: string[] = [...set.templateIds].sort();

      expect(registeredTemplateIds).toEqual(authoredTemplateIds);
    }
  });

  it("keeps every boon template player-only, temporary, and legal for Phase 2", () => {
    for (const worldId of worldIds) {
      const { catalog } = buildWorld(worldId);
      const worldTemplateIds = catalogWorldTemplateIds(catalog);

      for (const id of fortuneBoonIds) {
        const template = catalog[id];
        expect(template).toBeDefined();
        expect(template?.kind).toBe("player");
        if (template === undefined || template.kind !== "player") continue;

        expect(template.energyCost ?? 0).toBe(0);
        expect(template.exhaust).toBe(true);
        expect(() => expectNoForbiddenBoonEffect(template.effect, worldTemplateIds)).not.toThrow();
      }
    }
  });

  it("does not leak boon ids into starter decks, act compositions, or world-authored card effects", () => {
    for (const worldId of worldIds) {
      const { worldData } = buildWorld(worldId);
      const starterIds = worldData.starterDeck.map((card) => card.templateId);
      const actIds = worldData.deckComposition.acts.flatMap((act) =>
        act.cards.map((card) => card.templateId),
      );

      expect(starterIds.filter((id) => fortuneBoonIdSet.has(id))).toEqual([]);
      expect(actIds.filter((id) => fortuneBoonIdSet.has(id))).toEqual([]);
    }

    for (const bundle of worldDataRegistry) {
      const refs = allReferencedTemplates(bundle.source.cardTemplates);
      expect(refs.filter((id) => fortuneBoonIdSet.has(id))).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Corpse self-transform card: confirm the zombie-big-box catalog builds with
// the Corpse template and its onEndOfTurn Sequence references a valid Zombie.
// ---------------------------------------------------------------------------

describe("zombie-big-box Corpse card", () => {
  it("resolves Corpse and its onEndOfTurn Sequence references a valid Zombie template", () => {
    const { catalog } = buildWorld("zombie-big-box");

    const corpse = catalog["Corpse"];
    expect(corpse).toBeDefined();
    if (corpse === undefined || corpse.kind !== "world") return;

    const eot = corpse.onEndOfTurn;
    expect(eot.kind).toBe("Sequence");
    if (eot.kind !== "Sequence") return;

    // The Sequence spawns a Zombie then destroys itself.
    const kinds = eot.steps.map((s) => s.kind);
    expect(kinds).toContain("AddWorldCardToDeck");
    expect(kinds).toContain("DestroySelf");

    // Every template the Sequence names resolves in the catalog (Zombie).
    const refs = eot.steps.flatMap(templateRefs);
    expect(refs).toContain("Zombie");
    expect(refs.filter((id) => catalog[id] === undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fog-cooler-loot-v1: the Step 7 GainRandomCard example (REQ-RARITY-30, D2).
// "Abandoned Cooler" is a generic cache-style world card — its grant is not
// load-bearing world identity (unlike Fire Axe/Nitro elsewhere), so it is the
// one onCleared converted from fixed GainCard to a rolled GainRandomCard.
// ---------------------------------------------------------------------------

describe("fog-cooler-loot-v1 loot pool", () => {
  const lootPoolTemplateIds = LOOT_POOLS["fog-cooler-loot-v1"];

  it("is registered with 4 templates across at least two rarity tiers", () => {
    expect(lootPoolTemplateIds).toHaveLength(4);
  });

  it("every pool template mints as a legal player card with its authored rarity", () => {
    const { catalog } = buildWorld("fog-beach-party");
    const rarities = lootPoolTemplateIds.map((id) => {
      const template = catalog[id];
      expect(template).toBeDefined();
      expect(template?.kind).toBe("player");
      return template?.rarity;
    });

    expect(rarities).toContain("common");
    expect(rarities).toContain("uncommon");
  });

  it('"Abandoned Cooler" onCleared rolls a card from fog-cooler-loot-v1 instead of a fixed grant', () => {
    const { catalog, worldData } = buildWorld("fog-beach-party");

    const abandonedCooler = catalog["Abandoned Cooler"];
    expect(abandonedCooler).toBeDefined();
    if (abandonedCooler === undefined || abandonedCooler.kind !== "world") return;
    expect(abandonedCooler.onCleared).toEqual({
      kind: "GainRandomCard",
      setId: "fog-cooler-loot-v1",
      setName: "the cooler",
    });

    const { state } = createWorld(catalog, worldData, 7);
    const result = applyEffect(catalog, state, abandonedCooler.onCleared);

    expect(result.state.playerDiscard).toHaveLength(1);
    const granted = result.state.playerDiscard[0]!;
    expect([...lootPoolTemplateIds] as string[]).toContain(granted.templateId);

    const grantedEvent = result.events.find((event) => event.type === "CardGained");
    expect(grantedEvent).toBeDefined();
    if (grantedEvent?.type === "CardGained") {
      expect(grantedEvent.setName).toBe("the cooler");
      expect(grantedEvent.templateId).toBe(granted.templateId);
    }
  });
});
