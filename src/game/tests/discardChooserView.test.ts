import { describe, expect, it } from "bun:test";
import { DiscardChooserView } from "../view/DiscardChooserView";
import { selectTheme } from "../view/themes/themeManifest";
import type { Card } from "../../core/index";

// ---------------------------------------------------------------------------
// Minimal fake Phaser scene — the DiscardChooserView only constructs
// rectangles, a nineslice, and text, and registers pointerdown handlers. This
// harness records created objects and their handlers so the test can assert
// rendered fields and drive selection via emitted pointer events. It mirrors
// the fake-scene pattern in boonChoiceView.test.ts, trimmed to what this view
// touches.
// ---------------------------------------------------------------------------

interface FakeObject {
  kind: string;
  text?: string;
  list?: unknown[];
  handlers: Record<string, () => void>;
  strokeWidth: number;
  strokeColor: number;
  setOrigin(): FakeObject;
  setInteractive(): FakeObject;
  setDepth(): FakeObject;
  setAlpha(): FakeObject;
  setTint(): FakeObject;
  setRounded(): FakeObject;
  setFillStyle(): FakeObject;
  setStrokeStyle(width?: number, color?: number): FakeObject;
  setText(t: string): FakeObject;
  on(event: string, handler: () => void): FakeObject;
  once(event: string, handler: () => void): FakeObject;
  off(event: string): FakeObject;
  add(child: unknown): FakeObject;
  emit(event: string): void;
  destroy(): void;
  removeFromDisplayList(): FakeObject;
  addedToScene(): void;
}

function makeObject(kind: string, text = ""): FakeObject {
  const obj: FakeObject = {
    kind,
    text,
    handlers: {},
    strokeWidth: 0,
    strokeColor: 0,
    setOrigin() {
      return this;
    },
    setInteractive() {
      return this;
    },
    setDepth() {
      return this;
    },
    setAlpha() {
      return this;
    },
    setTint() {
      return this;
    },
    setRounded() {
      return this;
    },
    setFillStyle() {
      return this;
    },
    setStrokeStyle(width?: number, color?: number) {
      this.strokeWidth = width ?? 0;
      this.strokeColor = color ?? 0;
      return this;
    },
    setText(t: string) {
      this.text = t;
      return this;
    },
    on(event: string, handler: () => void) {
      this.handlers[event] = handler;
      return this;
    },
    once(event: string, handler: () => void) {
      this.handlers[event] = handler;
      return this;
    },
    off(event: string) {
      delete this.handlers[event];
      return this;
    },
    add(child: unknown) {
      this.list?.push(child);
      return this;
    },
    emit(event: string) {
      this.handlers[event]?.();
    },
    destroy() {},
    removeFromDisplayList() {
      return this;
    },
    addedToScene() {},
  };
  if (kind === "container") obj.list = [];
  return obj;
}

function makeScene(): { scene: Phaser.Scene; objects: FakeObject[] } {
  const objects: FakeObject[] = [];
  const track = (obj: FakeObject) => {
    objects.push(obj);
    return obj;
  };
  const scene = {
    sys: {
      displayList: { add() {}, remove() {}, exists: () => false },
      updateList: { add() {}, remove() {} },
      queueDepthSort() {},
      events: { once() {}, off() {} },
    },
    children: { bringToTop() {} },
    add: {
      existing(obj: unknown) {
        track(obj as FakeObject);
        return obj;
      },
      rectangle: () => track(makeObject("rectangle")),
      nineslice: () => track(makeObject("nineslice")),
      text: (_x: number, _y: number, t: string) => track(makeObject("text", t)),
      container: () => track(makeObject("container")),
    },
  };
  return { scene: scene as unknown as Phaser.Scene, objects };
}

function discardCard(over: Partial<Extract<Card, { kind: "player" }>>): Card {
  return {
    kind: "player",
    id: "c1",
    templateId: "Panic",
    name: "Panic",
    insetKey: undefined,
    sourceWorldId: "the-tidal-archive",
    effect: { kind: "None" },
    canDestroy: true,
    energyCost: 1,
    keywords: [],
    rarity: "common",
    ...over,
  };
}

const THEME = selectTheme("the-tidal-archive");

function textsOf(objects: FakeObject[]): string[] {
  return objects.filter((o) => o.kind === "text").map((o) => o.text ?? "");
}

describe("DiscardChooserView", () => {
  it("renders a row per discard card with name, cost, and instance state", () => {
    const { scene, objects } = makeScene();
    new DiscardChooserView(scene, {
      theme: THEME,
      cards: [
        discardCard({ id: "a", name: "Mark the Shelf", energyCost: 2, modified: true }),
        discardCard({ id: "b", name: "Cross-Reference", energyCost: 1, exhaust: true }),
      ],
      min: 1,
      max: 1,
      onConfirm() {},
      onCancel() {},
    });

    const texts = textsOf(objects);
    expect(texts).toContain("Mark the Shelf");
    expect(texts).toContain("Cross-Reference");
    // Costs rendered.
    expect(texts).toContain("2");
    expect(texts).toContain("1");
    // Instance state surfaced.
    expect(texts).toContain("modified");
    expect(texts).toContain("exhaust");
  });

  it("confirms a single pick and reports its id (max 1 replaces)", () => {
    const { scene } = makeScene();
    let confirmed: readonly string[] | undefined;
    const view = new DiscardChooserView(scene, {
      theme: THEME,
      cards: [discardCard({ id: "a", name: "Alpha" }), discardCard({ id: "b", name: "Beta" })],
      min: 1,
      max: 1,
      onConfirm(ids) {
        confirmed = ids;
      },
      onCancel() {},
    });

    // Click row "a", then row "b": max 1 means the second replaces the first.
    view.clickRow("a");
    view.clickRow("b");
    expect(view.selectedIds).toEqual(["b"]);

    view.clickConfirm();
    expect(confirmed).toEqual(["b"]);
  });

  it("enforces min: a confirm with too few picks does not fire onConfirm", () => {
    const { scene } = makeScene();
    let fired = false;
    const view = new DiscardChooserView(scene, {
      theme: THEME,
      cards: [discardCard({ id: "a", name: "Alpha" })],
      min: 1,
      max: 1,
      onConfirm() {
        fired = true;
      },
      onCancel() {},
    });

    view.clickConfirm(); // zero picks, min 1
    expect(fired).toBe(false);
  });

  it("allows confirming zero picks when min is 0 (optional recall / done)", () => {
    const { scene } = makeScene();
    let confirmed: readonly string[] | undefined;
    const view = new DiscardChooserView(scene, {
      theme: THEME,
      cards: [discardCard({ id: "a", name: "Alpha" })],
      min: 0,
      max: 1,
      onConfirm(ids) {
        confirmed = ids;
      },
      onCancel() {},
    });

    // With no picks and min 0, the button reads "Done" and confirms an empty set.
    expect(view.confirmLabelText).toBe("Done");
    view.clickConfirm();
    expect(confirmed).toEqual([]);
  });

  it("enforces max for multi-pick: extra picks beyond max are ignored", () => {
    const { scene } = makeScene();
    const view = new DiscardChooserView(scene, {
      theme: THEME,
      cards: [
        discardCard({ id: "a", name: "Alpha" }),
        discardCard({ id: "b", name: "Beta" }),
        discardCard({ id: "c", name: "Gamma" }),
      ],
      min: 0,
      max: 2,
      onConfirm() {},
      onCancel() {},
    });

    view.clickRow("a");
    view.clickRow("b");
    view.clickRow("c"); // at capacity (max 2) — ignored
    expect(view.selectedIds).toEqual(["a", "b"]);
  });

  it("pages a fixed window when the pile is taller than the panel", () => {
    const { scene } = makeScene();
    const cards = Array.from({ length: 12 }, (_, i) =>
      discardCard({ id: `c${i}`, name: `Card ${i}` }),
    );
    const view = new DiscardChooserView(scene, {
      theme: THEME,
      cards,
      min: 1,
      max: 1,
      onConfirm() {},
      onCancel() {},
    });

    // The window caps at 7 rows even though 12 cards exist.
    expect(view.visibleCardIds.length).toBe(7);
    expect(view.visibleCardIds[0]).toBe("c0");
    expect(view.visibleCardIds[6]).toBe("c6");

    // Paging down shifts the window; it never runs past the last card.
    view.scrollByRows(3);
    expect(view.visibleCardIds[0]).toBe("c3");
    expect(view.visibleCardIds[6]).toBe("c9");

    view.scrollByRows(99);
    expect(view.visibleCardIds[0]).toBe("c5");
    expect(view.visibleCardIds[6]).toBe("c11");

    view.scrollByRows(-99);
    expect(view.visibleCardIds[0]).toBe("c0");
  });

  it("keeps a pick made off-screen and re-applies it when scrolled back in", () => {
    const { scene } = makeScene();
    const cards = Array.from({ length: 10 }, (_, i) =>
      discardCard({ id: `c${i}`, name: `Card ${i}` }),
    );
    let confirmed: readonly string[] | undefined;
    const view = new DiscardChooserView(scene, {
      theme: THEME,
      cards,
      min: 1,
      max: 1,
      onConfirm(ids) {
        confirmed = ids;
      },
      onCancel() {},
    });

    view.clickRow("c1"); // visible, selected
    view.scrollByRows(3); // c1 scrolls out of the window
    expect(view.visibleCardIds).not.toContain("c1");
    expect(view.selectedIds).toEqual(["c1"]); // pick survives paging

    view.clickConfirm();
    expect(confirmed).toEqual(["c1"]);
  });

  it("cancel fires onCancel", () => {
    const { scene } = makeScene();
    let cancelled = false;
    const view = new DiscardChooserView(scene, {
      theme: THEME,
      cards: [discardCard({ id: "a", name: "Alpha" })],
      min: 1,
      max: 1,
      onConfirm() {},
      onCancel() {
        cancelled = true;
      },
    });

    view.clickCancel();
    expect(cancelled).toBe(true);
  });
});
