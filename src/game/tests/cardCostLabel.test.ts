import { describe, expect, it } from "bun:test";
import { CardView } from "../view/CardView";
import { TEXT } from "../view/presentation";

type FakeText = {
  text: string;
  color: string;
  setText(value: string): void;
  setColor(value: string): void;
};

function harness(): { view: CardView; text: FakeText } {
  const text: FakeText = {
    text: "3",
    color: TEXT.textCost,
    setText(value) {
      this.text = value;
    },
    setColor(value) {
      this.color = value;
    },
  };
  const view = Object.create(CardView.prototype) as CardView;
  (view as unknown as { costText: FakeText }).costText = text;
  return { view, text };
}

describe("CardView.updateCostLabel", () => {
  it("uses default, penalty, and reward colors relative to base cost", () => {
    const { view, text } = harness();

    view.updateCostLabel(3, 3);
    expect(text.text).toBe("3");
    expect(text.color).toBe(TEXT.textCost);

    view.updateCostLabel(5, 3);
    expect(text.text).toBe("5");
    expect(text.color).toBe(TEXT.textPenalty);

    view.updateCostLabel(2, 3);
    expect(text.text).toBe("2");
    expect(text.color).toBe(TEXT.textReward);
  });
});
