import { describe, it, expect } from "bun:test";
import { EFFECT_ICON_TOOLTIPS } from "../../core/view/effectTooltips";
import { worldHelpManifest } from "../../data/worldHelpManifest";

const { HelpOverlayView } = await import("../view/HelpOverlayView");
type HelpOverlayViewInstance = InstanceType<typeof HelpOverlayView>;

// ---------------------------------------------------------------------------
// HelpOverlayView's entire construction (tabs, pages, panels) lived inline in
// the constructor, unlike SettingsOverlayView. A direct-construction probe
// (`new HelpOverlayView(fakeScene, worldId, totalActs)` against a stubbed
// scene) confirmed the real `Phaser.GameObjects.Container` base constructor
// throws under the happy-dom + stubbed-canvas harness (it reaches for
// `scene.sys.queueDepthSort`, which a hand-rolled fake scene has no reason to
// provide). So the same extraction SettingsOverlayView already carries was
// applied here: a `private build(scene, worldId, totalActs)` method, moved
// verbatim out of the constructor body, callable independently via
// Object.create — see the mirrored rationale comment on HelpOverlayView.build.
// ---------------------------------------------------------------------------

// Every fake Phaser object exposes the small set of chainable setters
// HelpOverlayView's build path calls, each returning itself so call chains
// keep working. `kind` lets assertions tell containers/rects/images apart
// without re-deriving Phaser's own class hierarchy.
function makeFakeContainer(): Record<string, unknown> & { list: unknown[] } {
  const node: Record<string, unknown> & { list: unknown[] } = {
    kind: "container",
    list: [],
    x: 0,
    y: 0,
    add: (child: unknown) => {
      node.list.push(child);
      return node;
    },
    setPosition: () => node,
    setSize: () => node,
    setInteractive: () => node,
    setVisible: () => node,
    setScale: () => node,
    on: () => node,
    destroy: () => {},
  };
  return node;
}

function makeFakeRect(): Record<string, unknown> {
  const node: Record<string, unknown> = {
    kind: "rect",
    width: 10,
    height: 10,
    setStrokeStyle: () => node,
    setRounded: () => node,
    setPosition: () => node,
    setInteractive: () => node,
    setFillStyle: () => node,
    setOrigin: () => node,
    setAlpha: () => node,
    setScale: () => node,
    on: () => node,
  };
  return node;
}

function makeFakeCircle(): Record<string, unknown> {
  const node: Record<string, unknown> = {
    kind: "circle",
    setStrokeStyle: () => node,
    setFillStyle: () => node,
    setOrigin: () => node,
    setAlpha: () => node,
    setPosition: () => node,
  };
  return node;
}

function makeFakeImage(): Record<string, unknown> {
  const node: Record<string, unknown> = {
    kind: "image",
    width: 22,
    height: 22,
    displayWidth: 22,
    displayHeight: 22,
    setOrigin: () => node,
    setScale: (s: number) => {
      node.displayWidth = (node.width as number) * s;
      node.displayHeight = (node.height as number) * s;
      return node;
    },
    setDisplaySize: (w: number, h: number) => {
      node.displayWidth = w;
      node.displayHeight = h;
      return node;
    },
    setAlpha: () => node,
    setTint: () => node,
    setPosition: () => node,
  };
  return node;
}

function makeFakeGraphics(): Record<string, unknown> {
  const node: Record<string, unknown> = {
    kind: "graphics",
    lineStyle: () => node,
    lineBetween: () => node,
    fillStyle: () => node,
    fillCircle: () => node,
    clear: () => node,
    beginPath: () => node,
    arc: () => node,
    strokePath: () => node,
    setPosition: () => node,
  };
  return node;
}

// Text is the one node whose content the tests actually read: every string
// passed to scene.add.text() is pushed to `capturedTexts` at creation time,
// which is what the completeness guard (assertion 1) and the "Hidden"/
// "Vanish" regression guards (assertions 2-3) inspect.
function makeFakeText(text: string, capturedTexts: string[]): Record<string, unknown> {
  capturedTexts.push(text);
  const node: Record<string, unknown> = {
    kind: "text",
    content: text,
    color: undefined as string | undefined,
    width: 40,
    height: 12,
    displayWidth: 40,
    displayHeight: 12,
    setOrigin: () => node,
    setColor: (c: string) => {
      node.color = c;
      return node;
    },
    setText: (t: string) => {
      node.content = t;
      return node;
    },
    setName: () => node,
    setScale: () => node,
    setPosition: () => node,
    setInteractive: () => node,
    setWordWrapWidth: () => node,
    setVisible: () => node,
    on: () => node,
  };
  return node;
}

function makeFakeScene(capturedTexts: string[]): unknown {
  return {
    add: {
      existing: () => {},
      container: () => makeFakeContainer(),
      rectangle: () => makeFakeRect(),
      circle: () => makeFakeCircle(),
      image: () => makeFakeImage(),
      graphics: () => makeFakeGraphics(),
      text: (_x: number, _y: number, text: string) => makeFakeText(text, capturedTexts),
    },
    // addScreenBackdrop and ensureEffectIconTextures both branch on
    // scene.textures.exists — claiming everything already exists skips
    // canvas-texture generation (a browser concern the fake scene can't do)
    // the same way cardObjects.test.ts's render-scene stub does.
    textures: { exists: (): boolean => true },
  };
}

/**
 * Build a real HelpOverlayView by invoking the extracted `build()` against an
 * Object.create'd instance, exactly as settingsOverlayView.test.ts drives
 * SettingsOverlayView.build() — the constructor itself is never called, so
 * the real (unstubbed) Phaser Container base class never runs.
 */
function buildHelpOverlay(
  worldId: string,
  totalActs: number,
): { view: HelpOverlayViewInstance; capturedTexts: string[] } {
  const capturedTexts: string[] = [];
  const scene = makeFakeScene(capturedTexts);

  const raw = Object.create(HelpOverlayView.prototype) as unknown as {
    pages: unknown[];
    tabButtons: unknown[];
    activePage: number;
    add: (child: unknown) => unknown;
    build(s: unknown, worldId: string, totalActs: number): void;
    updatePage(next: number): void;
  };
  raw.pages = [];
  raw.tabButtons = [];
  raw.activePage = 0;
  raw.add = () => raw;

  raw.build(scene, worldId, totalActs);

  return { view: raw as unknown as HelpOverlayViewInstance, capturedTexts };
}

const SAMPLE_WORLD_ID = "zombie-big-box";
const SAMPLE_TOTAL_ACTS = 3;

describe("HelpOverlayView", () => {
  it("renders the exact title of every EFFECT_ICON_TOOLTIPS entry somewhere on the pages", () => {
    // This is the systemic fix: capturing at the text level (not by inverting
    // shared icon textures) means a tooltip title with no matching help-page
    // row fails here, the same way the original "5 missing icon rows" gap
    // would have. Exact match (not substring) avoids false positives from
    // unrelated text that merely contains a tooltip's title as a fragment.
    const { capturedTexts } = buildHelpOverlay(SAMPLE_WORLD_ID, SAMPLE_TOTAL_ACTS);

    for (const iconId of Object.keys(EFFECT_ICON_TOOLTIPS) as (keyof typeof EFFECT_ICON_TOOLTIPS)[]) {
      const { title } = EFFECT_ICON_TOOLTIPS[iconId];
      expect(capturedTexts).toContain(title);
    }
  });

  it("never renders the stale 'Hidden' keyword name", () => {
    const { capturedTexts } = buildHelpOverlay(SAMPLE_WORLD_ID, SAMPLE_TOTAL_ACTS);
    const hits = capturedTexts.filter((t) => t.includes("Hidden"));
    expect(hits).toEqual([]);
  });

  it("never renders the stale 'Vanish' icon label", () => {
    const { capturedTexts } = buildHelpOverlay(SAMPLE_WORLD_ID, SAMPLE_TOTAL_ACTS);
    const hits = capturedTexts.filter((t) => t.includes("Vanish"));
    expect(hits).toEqual([]);
  });

  it("has 5 tabs labeled Turn, Hazards, Tools, Icons, World", () => {
    const { view } = buildHelpOverlay(SAMPLE_WORLD_ID, SAMPLE_TOTAL_ACTS);
    const tabButtons = (view as unknown as { tabButtons: { list: { content: string }[] }[] })
      .tabButtons;

    expect(tabButtons.length).toBe(5);
    // Each tab container's list is [bgButton, label] in add() order (mirrors
    // how updatePage itself reads button.list[0]/[1]).
    const labels = tabButtons.map((tab) => tab.list[1]?.content);
    expect(labels).toEqual(["Turn", "Hazards", "Tools", "Icons", "World"]);
  });

  it("wraps updatePage at both ends of the tab range", () => {
    const { view } = buildHelpOverlay(SAMPLE_WORLD_ID, SAMPLE_TOTAL_ACTS);
    // updatePage is private; reach it the same way settingsOverlayView.test.ts
    // reaches SettingsOverlayView's private members — through an `unknown`
    // intermediate cast so it doesn't collapse to `never`.
    const withPrivateAccess = view as unknown as {
      updatePage: (next: number) => void;
      activePage: number;
    };

    withPrivateAccess.updatePage(-1);
    expect(withPrivateAccess.activePage).toBe(4); // wraps to the last tab (World)

    withPrivateAccess.updatePage(5);
    expect(withPrivateAccess.activePage).toBe(0); // wraps to the first tab (Turn)
  });

  it("renders one panel per helpData.mechanics entry on the World tab", () => {
    const { view } = buildHelpOverlay(SAMPLE_WORLD_ID, SAMPLE_TOTAL_ACTS);
    const expectedCount = worldHelpManifest[SAMPLE_WORLD_ID]?.mechanics.length ?? 0;
    expect(expectedCount).toBeGreaterThan(0);

    // The World tab is the 5th (last) page. Its build loop adds exactly one
    // panel rectangle per mechanics entry and no other rectangles, so
    // counting "rect"-kind children on that page's container is a direct,
    // layout-agnostic proxy for "one panel per mechanic".
    const worldPage = (view as unknown as { pages: { list: { kind: string }[] }[] }).pages[4];
    const panelCount = (worldPage?.list ?? []).filter((child) => child.kind === "rect").length;
    expect(panelCount).toBe(expectedCount);
  });
});
