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
// Not part of the public core surface, so imported from the model directly.
import type { CounterSpec, Keyword } from "../model/types";

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
  | "threat"
  | "brace"
  | "skipDraw"
  | "survive"
  | "vanish"
  // world-card triggers
  | "eachTurn"
  | "onDiscard"
  | "onClear"
  | "onPartialClear";

/** How a value token should be visually weighted by the renderer. */
export type ValueEmphasis = "progress" | "reward" | "penalty";

export type EffectToken =
  | { kind: "icon"; icon: IconId }
  | { kind: "value"; text: string; emphasis?: ValueEmphasis }
  | { kind: "text"; text: string }; // connectives ('then', 'vs', 'per', '·') and keyword names

export interface EffectLine {
  tokens: EffectToken[];
  /**
   * 'branch' indents under a Modal header; 'rider' renders smaller (bonus
   * clauses). undefined means 'main' — the renderer treats them identically.
   */
  role?: "main" | "branch" | "rider";
}

// ---------------------------------------------------------------------------
// Token constructors
// ---------------------------------------------------------------------------

function icon(id: IconId): EffectToken {
  return { kind: "icon", icon: id };
}

function value(text: string, emphasis?: ValueEmphasis): EffectToken {
  return emphasis === undefined
    ? { kind: "value", text }
    : { kind: "value", text, emphasis };
}

function text(s: string): EffectToken {
  return { kind: "text", text: s };
}

function main(tokens: EffectToken[]): EffectLine {
  return { tokens };
}

function rider(tokens: EffectToken[]): EffectLine {
  return { tokens, role: "rider" };
}

/** Rider for a keyword bonus: `+2 vs Spore`. The keyword stays plain text. */
function bonusRider(bonus: { tag: Keyword; amount: number }): EffectLine {
  return rider([value(`+${bonus.amount}`), text("vs"), text(bonus.tag)]);
}

/** Rider for a scaled effect: `+1 per Spore in hand` / `−1 per Spore in hand`. */
function perRider(
  sign: "+" | "−",
  amount: number,
  per: CounterSpec,
): EffectLine {
  return rider([
    value(`${sign}${amount}`),
    text("per"),
    text(per.keyword),
    text("in hand"),
  ]);
}

function rangeText(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

/**
 * Compile a card effect into compact token lines. Recurses into `Modal`
 * (a "Choose:" header plus a `branch` line per branch) and `Sequence`
 * (1–2 steps join onto one line with `then` connectives; 3+ steps emit one
 * line per step, continuation lines led by `then`), so nothing collapses
 * to an opaque "Choose…" / "Multi-step". Riders produced inside composites
 * keep their `rider` role; deeper nesting compiles at a single indent level
 * (`branch` does not stack).
 *
 * `None` compiles to no lines at all — the card face skips `None` blocks, and
 * the empty compile encodes that rule once instead of leaving it to callers.
 */
export function compileEffect(effect: CardEffect): EffectLine[] {
  return compile(effect, { compactSequences: false });
}

interface CompileContext {
  /**
   * Inside a Modal branch, a Sequence always joins onto one line regardless
   * of step count — branches are compact by nature (single indent level).
   */
  compactSequences: boolean;
}

function compile(effect: CardEffect, ctx: CompileContext): EffectLine[] {
  switch (effect.kind) {
    case "DealProgress": {
      const lines = [
        main([
          text("+"),
          icon("progress"),
          value(`${effect.base}`, "progress"),
        ]),
      ];
      if (effect.bonus) lines.push(bonusRider(effect.bonus));
      return lines;
    }
    case "DealProgressScaled":
      return [
        main([
          text("+"),
          icon("progress"),
          value(`${effect.base}`, "progress"),
        ]),
        perRider("+", effect.amount, effect.per),
      ];
    case "DealProgressAll": {
      const lines = [
        main([
          text("+"),
          icon("progressAll"),
          value(`${effect.base}`, "progress"),
          text("all"),
        ]),
      ];
      if (effect.bonus) lines.push(bonusRider(effect.bonus));
      return lines;
    }
    case "Draw": {
      const tokens: EffectToken[] = [];
      if (effect.player !== undefined && effect.player > 0) {
        tokens.push(icon("draw"), value(`${effect.player}`));
      }
      if (effect.world !== undefined && effect.world > 0) {
        if (tokens.length > 0) tokens.push(text("·"));
        tokens.push(icon("worldDraw"), value(`+${effect.world}`));
      }
      return [main(tokens.length > 0 ? tokens : [text("draw nothing")])];
    }
    case "Heal":
      return [main([icon("hp"), value(`+${effect.amount}`, "reward")])];
    case "Damage":
      return [main([icon("hp"), value(`−${effect.amount}`, "penalty")])];
    case "DamageScaled":
      return [
        main([icon("hp"), value(`−${effect.base}`, "penalty")]),
        perRider("−", effect.amount, effect.per),
      ];
    case "GainEnergy":
      return [main([icon("energy"), value(`+${effect.amount}`, "reward")])];
    case "ReturnWorldCards":
      return [main([icon("return"), value(rangeText(effect.min, effect.max))])];
    case "DestroyCardInHand": {
      const count = effect.max === 1 ? "1" : rangeText(effect.min, effect.max);
      const lines = [main([icon("destroy"), value(count), text("in hand")])];
      if (effect.min === 0 && effect.max === 1)
        lines.push(rider([text("(optional)")]));
      return lines;
    }
    case "DiscardThenDraw":
      return [
        main([
          icon("discard"),
          value("1"),
          text("then"),
          icon("draw"),
          value(`${effect.player}`),
        ]),
      ];
    case "ExileTopWorldCards":
      return [main([icon("exile"), text("top"), value(`${effect.amount}`)])];
    case "Brace":
      return [main([icon("brace"), value(`${effect.amount}`)])];
    case "AddCard":
    case "GainCard":
      return [main([icon("addCard"), text(effect.template)])];
    case "AddPlayerCardToTop":
      return [
        main([icon("addCard"), text(effect.template)]),
        rider([text("top of deck")]),
      ];
    case "AddWorldCardToDeck":
      return [main([icon("threat"), text(effect.template)])];
    case "AddThreatToWorldDeck":
      return [main([icon("threat"), value("+1")])];
    case "SkipDrawNextTurn":
      return [main([icon("skipDraw"), text("next turn")])];
    case "SurviveWorld":
      return [main([icon("survive"), text("survive")])];
    case "ForceDestroy":
      // The amount is dropped, matching describeEffect's prose for this kind.
      return [main([icon("destroy"), text("random, next hand")])];
    case "DestroySelf":
      return [main([icon("vanish")])];
    case "None":
      return [];
    case "Modal":
      return [
        main([text("Choose:")]),
        // A branch's first (main) line becomes a 'branch' line; rider lines it
        // produced stay riders, and nested 'branch' lines stay 'branch' — the
        // indent level deliberately does not stack.
        ...effect.branches.flatMap((branch) =>
          compile(branch, { compactSequences: true }).map(
            (l): EffectLine => ({ ...l, role: l.role ?? "branch" }),
          ),
        ),
      ];
    case "Sequence": {
      // None steps contribute nothing, so the join-vs-split count is over the
      // steps that actually produced lines.
      const compiledSteps = effect.steps
        .map((step) => compile(step, ctx))
        .filter((compiled) => compiled.length > 0);
      if (ctx.compactSequences || compiledSteps.length <= 2) {
        // Step main lines join onto one line with 'then' connectives; any
        // rider/branch lines the steps produced follow after, roles preserved.
        const joined: EffectToken[] = [];
        const trailing: EffectLine[] = [];
        for (const [first, ...rest] of compiledSteps) {
          if (first === undefined) continue;
          if (joined.length > 0) joined.push(text("then"));
          joined.push(...first.tokens);
          trailing.push(...rest);
        }
        return joined.length > 0 ? [main(joined), ...trailing] : trailing;
      }
      // 3+ steps would overflow a single line, so each step gets its own line,
      // continuation lines led by 'then'. Each step's rider/branch lines
      // immediately follow that step's line, keeping riders bound to their
      // owner (see design §2 rider binding).
      return compiledSteps.flatMap(([first, ...rest], index) => {
        if (first === undefined) return [];
        const tokens =
          index === 0 ? first.tokens : [text("then"), ...first.tokens];
        return [{ ...first, tokens }, ...rest];
      });
    }
  }
}
