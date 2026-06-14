import { describe, expect, it } from "bun:test";
import type { Card, PlayerCard, WorldCard } from "../model/types";
import { concealOf, hasKeyword, isConcealed, keywordNames, parseKeyword } from "../model/keywords";

// ---------------------------------------------------------------------------
// Helpers — minimal cards built directly, independent of catalog/mint.
// ---------------------------------------------------------------------------

function playerWith(keywords: PlayerCard["keywords"]): PlayerCard {
  return {
    kind: "player",
    id: "p",
    name: "p",
    insetKey: undefined,
    sourceWorldId: "test",
    effect: { kind: "None" },
    energyCost: 0,
    keywords,
  };
}

function worldWith(keywords: WorldCard["keywords"]): WorldCard {
  return {
    kind: "world",
    id: "w",
    name: "w",
    insetKey: undefined,
    cost: 1,
    keywords,
    discardable: true,
    canExile: true,
    onDiscarded: { kind: "None" },
    onCleared: { kind: "None" },
    onEndOfTurn: { kind: "None" },
    onPartialClear: { kind: "None" },
  };
}

// ---------------------------------------------------------------------------
// 1. parseKeyword
// ---------------------------------------------------------------------------

describe("parseKeyword", () => {
  it("parses a bare keyword to { name }", () => {
    expect(parseKeyword("Spore")).toEqual({ name: "Spore" });
    expect(parseKeyword("Hidden")).toEqual({ name: "Hidden" });
  });

  it("parses Name:N to { name, value }", () => {
    expect(parseKeyword("Concealed:3")).toEqual({ name: "Concealed", value: 3 });
    expect(parseKeyword("Concealed:0")).toEqual({ name: "Concealed", value: 0 });
  });

  it("throws on a non-numeric value", () => {
    expect(() => parseKeyword("Concealed:deep")).toThrow();
    expect(() => parseKeyword("Concealed:")).toThrow();
  });

  it("throws on an unknown name (with or without a value)", () => {
    expect(() => parseKeyword("Bogus")).toThrow();
    expect(() => parseKeyword("Bogus:2")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. hasKeyword / keywordNames — match by name, value-agnostic
// ---------------------------------------------------------------------------

describe("hasKeyword", () => {
  it("matches by name regardless of value", () => {
    const valued: Card = worldWith([{ name: "Concealed", value: 3 }]);
    const bare: Card = worldWith([{ name: "Concealed" }]);
    expect(hasKeyword(valued, "Concealed")).toBe(true);
    expect(hasKeyword(bare, "Concealed")).toBe(true);
  });

  it("is false when the keyword is absent", () => {
    const card: Card = playerWith([{ name: "Spore" }]);
    expect(hasKeyword(card, "Hidden")).toBe(false);
  });
});

describe("keywordNames", () => {
  it("returns the names in order, dropping values", () => {
    const card: Card = worldWith([{ name: "Slow" }, { name: "Concealed", value: 2 }]);
    expect(keywordNames(card)).toEqual(["Slow", "Concealed"]);
  });
});

// ---------------------------------------------------------------------------
// 3. concealOf / isConcealed — the live concealment comparison
// ---------------------------------------------------------------------------

describe("concealOf", () => {
  it("returns the Concealed keyword's value", () => {
    expect(concealOf(worldWith([{ name: "Concealed", value: 3 }]))).toBe(3);
  });

  it("is 0 when the card has no Concealed keyword", () => {
    expect(concealOf(worldWith([{ name: "Hidden" }]))).toBe(0);
    expect(concealOf(worldWith([]))).toBe(0);
  });

  it("is 0 for a player card (never concealed)", () => {
    expect(concealOf(playerWith([{ name: "Spore" }]))).toBe(0);
  });
});

describe("isConcealed", () => {
  it("is true when depth strictly exceeds light", () => {
    const card: Card = worldWith([{ name: "Concealed", value: 3 }]);
    expect(isConcealed(card, 0)).toBe(true);
    expect(isConcealed(card, 2)).toBe(true);
  });

  it("REVEALS at the threshold (concealOf === light is NOT concealed)", () => {
    const card: Card = worldWith([{ name: "Concealed", value: 3 }]);
    expect(isConcealed(card, 3)).toBe(false);
    expect(isConcealed(card, 4)).toBe(false);
  });

  it("is never concealed for a card with no Concealed keyword, even at light 0", () => {
    expect(isConcealed(worldWith([{ name: "Hidden" }]), 0)).toBe(false);
    expect(isConcealed(worldWith([]), 0)).toBe(false);
  });
});
