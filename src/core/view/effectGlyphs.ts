/**
 * Compact token compilation of card behaviour.
 *
 * This is the single source of the icon-and-token form of every effect — the
 * card face reads from here, while `describe.ts` remains the single source of
 * full English prose (chooser labels, target previews, future tooltips). Both
 * are pure functions of the same `CardEffect`, so they cannot drift apart. It
 * imports core *types* only (no Phaser, no DOM), so it stays on the pure side
 * of the renderer boundary and is unit-tested headless.
 *
 * Tokens are semantic: an `IconId` names what an icon *means*; texture keys,
 * sizes, and colors are renderer concerns. Keywords are deliberately not
 * icons — they pass through as plain text tokens, so no keyword-to-icon
 * mapping exists to drift as worlds add keywords.
 */
import type { CardEffect } from "../../core/index";
import type { CompileContext as HandlerCompileContext } from "../effects/EffectContext";
import { EFFECTS } from "../effects/registry";

/** Closed set of semantic icon identifiers. No Phaser types, no texture keys. */
export type IconId =
  // resources & actions
  | "progress"
  | "progressAll"
  | "draw"
  | "worldDraw"
  | "hp"
  | "energy"
  | "discard"
  | "destroy"
  | "exile"
  | "return"
  | "addCard"
  | "brace"
  | "survive"
  | "vanish"
  // world-card triggers
  | "eachTurn"
  | "onDiscard"
  | "onClear"
  | "onPartialClear";

/** How a value token should be visually weighted by the renderer. */
export type ValueEmphasis = "progress" | "brace" | "reward" | "penalty";

export type EffectToken =
  | { kind: "icon"; icon: IconId }
  | { kind: "value"; text: string; emphasis?: ValueEmphasis }
  | { kind: "text"; text: string }; // connectives ('→', 'vs', 'per', '·') and keyword names

export interface EffectLine {
  tokens: EffectToken[];
  /**
   * 'branch' indents under a Modal header; 'rider' renders smaller (bonus
   * clauses). undefined means 'main' — the renderer treats them identically.
   */
  role?: "main" | "branch" | "rider";
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

/**
 * Compile a card effect into compact token lines. Recurses into `Modal`
 * (a "Choose:" header plus a `branch` line per branch) and `Sequence`
 * (1–2 steps join onto one line with `→` connectives; 3+ steps emit one
 * line per step, continuation lines led by `→`), so nothing collapses
 * to an opaque "Choose…" / "Multi-step". Riders produced inside composites
 * keep their `rider` role; deeper nesting compiles at a single indent level
 * (`branch` does not stack).
 *
 * `None` compiles to no lines at all — the card face skips `None` blocks, and
 * the empty compile encodes that rule once instead of leaving it to callers.
 */
export function compileEffect(effect: CardEffect, worldId: string): EffectLine[] {
  // Top-level compile starts with compactSequences = false (a top-level Sequence
  // may split across lines); composites force it true for their children.
  return dispatchCompile(effect, makeHandlerCtx(worldId, false));
}

/**
 * Build the core `CompileContext` a composite handler's `compile` receives. Its
 * `compile` callback is bound to `dispatchCompile`, so Modal/Sequence handlers
 * recurse into child effects without importing `registry.ts` themselves.
 */
function makeHandlerCtx(worldId: string, compactSequences: boolean): HandlerCompileContext {
  return { worldId, compactSequences, compile: dispatchCompile };
}

/**
 * Compile-time dispatcher mirroring `applyEffect`'s `dispatch`.
 */
function dispatchCompile(effect: CardEffect, ctx: HandlerCompileContext): EffectLine[] {
  const h = EFFECTS[effect.kind];
  return h.compile(effect as never, ctx);
}
