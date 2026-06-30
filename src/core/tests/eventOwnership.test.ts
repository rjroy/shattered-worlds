import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";
import type { GameEvent } from "../model/types";
import { EXTERNALLY_PREVIEWED_EVENT_TYPES } from "../view/actionPreview";

type EventOwnershipCategory =
  | "preview-policy"
  | "engine-framing"
  | "terminal-status"
  | "effect-family";

const EVENT_OWNERSHIP = {
  ProgressDealt: "preview-policy",
  HazardResolved: "preview-policy",
  HazardPartial: "preview-policy",
  HpChanged: "preview-policy",
  EnergyChanged: "preview-policy",
  LightChanged: "preview-policy",
  HeatChanged: "preview-policy",
  BraceChanged: "preview-policy",

  CardPlayed: "engine-framing",
  CardsDrawn: "engine-framing",
  CardsDiscarded: "engine-framing",
  DeckShuffled: "engine-framing",
  TurnEnded: "engine-framing",
  ActAdvanced: "engine-framing",
  HazardAdded: "engine-framing",
  BoonCardGranted: "engine-framing",
  PlayerDiscardRecalled: "engine-framing",
  BraceConsumed: "engine-framing",
  HazardDiscarded: "engine-framing",

  WorldWon: "terminal-status",
  WorldLost: "terminal-status",

  KeywordApplied: "effect-family",
  KeywordRemoved: "effect-family",
  AlarmGuardChanged: "effect-family",
  AlarmGuardConsumed: "effect-family",
  DamageDealt: "effect-family",
  HealReceived: "effect-family",
  CardsFrozen: "effect-family",
  CardsThawed: "effect-family",
  CardsBurnedForHeat: "effect-family",
  CardDestroyed: "effect-family",
  WorldCardsReturned: "effect-family",
  WorldCardsExiled: "effect-family",
  CardGained: "effect-family",
  BoonOffered: "effect-family",
} as const satisfies Record<GameEvent["type"], EventOwnershipCategory>;

type EffectFamilyEventType = {
  [Type in keyof typeof EVENT_OWNERSHIP]: (typeof EVENT_OWNERSHIP)[Type] extends "effect-family"
    ? Type
    : never;
}[keyof typeof EVENT_OWNERSHIP];

const EFFECT_FAMILY_OWNERS = {
  KeywordApplied: "appliedKeywords",
  KeywordRemoved: "appliedKeywords",
  AlarmGuardChanged: "resources",
  AlarmGuardConsumed: "appliedKeywords",
  DamageDealt: "damage",
  HealReceived: "resources",
  CardsFrozen: "heat",
  CardsThawed: "heat",
  CardsBurnedForHeat: "heat",
  CardDestroyed: "worldCards",
  WorldCardsReturned: "worldCards",
  WorldCardsExiled: "worldCards",
  CardGained: "gainCard",
  BoonOffered: "actBoonPreview",
} as const satisfies Record<EffectFamilyEventType, string>;

describe("GameEvent preview ownership coverage", () => {
  it("categorizes every GameEvent type", () => {
    const declaredEventTypes = [...extractGameEventTypes()];
    const categorizedEventTypes = Object.keys(EVENT_OWNERSHIP).sort();

    expect(categorizedEventTypes).toEqual(declaredEventTypes);
  });

  it("declares an owner for every effect-family event", () => {
    const effectFamilyEventTypes = Object.entries(EVENT_OWNERSHIP)
      .filter(([, ownership]) => ownership === "effect-family")
      .map(([type]) => type)
      .sort();
    const ownedEventTypes = Object.keys(EFFECT_FAMILY_OWNERS).sort();

    expect(ownedEventTypes).toEqual(effectFamilyEventTypes);
  });

  it("routes every effect-family event through exact external preview dispatch", () => {
    const effectFamilyEventTypes = Object.entries(EVENT_OWNERSHIP)
      .filter(([, ownership]) => ownership === "effect-family")
      .map(([type]) => type)
      .sort();

    const dispatchedEventTypes: string[] = [...EXTERNALLY_PREVIEWED_EVENT_TYPES].sort();

    expect(dispatchedEventTypes).toEqual(effectFamilyEventTypes);
  });
});

function extractGameEventTypes(): readonly string[] {
  const sourcePath = join(import.meta.dir, "../model/types.ts");
  const sourceText = readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true);
  const aliases = new Map<string, ts.TypeNode>();

  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      aliases.set(statement.name.text, statement.type);
    }
  }

  const eventTypes = new Set<string>();
  collectEventTypesFromAlias("GameEvent", aliases, eventTypes, new Set());

  return [...eventTypes].sort();
}

function collectEventTypesFromAlias(
  aliasName: string,
  aliases: ReadonlyMap<string, ts.TypeNode>,
  eventTypes: Set<string>,
  seenAliases: Set<string>,
): void {
  if (seenAliases.has(aliasName)) return;
  const alias = aliases.get(aliasName);
  if (!alias) return;

  seenAliases.add(aliasName);
  collectEventTypes(alias, aliases, eventTypes, seenAliases);
}

function collectEventTypes(
  node: ts.Node,
  aliases: ReadonlyMap<string, ts.TypeNode>,
  eventTypes: Set<string>,
  seenAliases: Set<string>,
): void {
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    collectEventTypesFromAlias(node.typeName.text, aliases, eventTypes, seenAliases);
    return;
  }

  if (ts.isPropertySignature(node) && isTypeProperty(node.name)) {
    const type = node.type;
    if (type && ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) {
      eventTypes.add(type.literal.text);
    }
  }

  ts.forEachChild(node, (child) => collectEventTypes(child, aliases, eventTypes, seenAliases));
}

function isTypeProperty(name: ts.PropertyName): boolean {
  return ts.isIdentifier(name) && name.text === "type";
}
