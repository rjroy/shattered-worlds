import { describe, expect, it } from "bun:test";
import { applyEffect } from "../engine/effects";
import { catalog, makeState } from "./testFixture";

// `sourceKind` provenance: every event returned through the dispatch() boundary
// is stamped with the originating CardEffect kind, "innermost wins". Composite
// handlers (Modal/Sequence) recurse through dispatch(), so an event born inside
// a child effect carries the child's kind, not the composite's. This rides
// alongside `sourceCardId` and must not disturb it.

describe("sourceKind stamping", () => {
  it("stamps the innermost effect kind on a Sequence-nested DamageDealt", () => {
    const state = makeState({ hp: 10 });
    const { events } = applyEffect(catalog, state, {
      kind: "Sequence",
      steps: [{ kind: "Damage", amount: 3 }],
    });

    const damageDealt = events.find((event) => event.type === "DamageDealt");
    expect(damageDealt).toBeDefined();
    // Innermost wins: the inner Damage dispatch stamps first, the outer Sequence
    // dispatch leaves it alone.
    expect(damageDealt?.sourceKind).toBe("Damage");

    // Player-played effect (no selfId): sourceCardId provenance is unchanged.
    expect(damageDealt?.sourceCardId).toBeUndefined();
  });

  it("stamps sourceKind without disturbing sourceCardId from a firing hook", () => {
    const state = makeState({ hp: 10 });
    const { events } = applyEffect(
      catalog,
      state,
      { kind: "Sequence", steps: [{ kind: "Damage", amount: 3 }] },
      undefined,
      "hook-card",
    );

    const damageDealt = events.find((event) => event.type === "DamageDealt");
    expect(damageDealt).toBeDefined();
    expect(damageDealt?.sourceKind).toBe("Damage");
    // sourceCardId is still stamped at the applyEffect boundary, independent of
    // the new sourceKind stamp.
    expect(damageDealt?.sourceCardId).toBe("hook-card");
  });
});
