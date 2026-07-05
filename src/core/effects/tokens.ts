import type { CounterSpec, KeywordBonus } from "../model/types";
import type { EffectLine, EffectToken, IconId, ValueEmphasis } from "../view/effectGlyphs";

export function icon(id: IconId): EffectToken {
  return { kind: "icon", icon: id };
}

export function value(text: string, emphasis?: ValueEmphasis): EffectToken {
  return emphasis === undefined ? { kind: "value", text } : { kind: "value", text, emphasis };
}

export function text(s: string): EffectToken {
  return { kind: "text", text: s };
}

export function main(tokens: EffectToken[]): EffectLine {
  return { tokens };
}

export function rider(tokens: EffectToken[]): EffectLine {
  return { tokens, role: "rider" };
}

export function bonusRider(bonus: KeywordBonus, emphasis?: ValueEmphasis): EffectLine {
  return rider([value(`+${bonus.amount}`, emphasis), text("vs"), text(bonus.tag)]);
}

export function counterLabel(per: CounterSpec): string {
  switch (per.kind) {
    case "KeywordInHand":
      return `${per.keyword} in hand`;
    case "FrozenPlayerCards":
      return "frozen card";
  }
}

export function perRider(sign: string, amount: number, per: CounterSpec): EffectLine {
  if (per.kind === "KeywordInHand") {
    return rider([value(`${sign}${amount}`), text("per"), text(per.keyword), text("in hand")]);
  }
  return rider([value(`${sign}${amount}`), text("per"), text(counterLabel(per))]);
}

export function rangeText(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}
