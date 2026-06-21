import { describe, expect, it } from "bun:test";
import { BoonChoiceView } from "../view/BoonChoiceView";
import { TableScene } from "../scenes/TableScene";
import { selectTheme } from "../view/themes/themeManifest";
import { rarityStyle } from "../view/rarity";
import { RARITY_STROKE_WIDTH } from "../view/CardView";
import { DEFAULT_RUN_MODIFIERS } from "../../data/unlocks/types";
import type { Action, CardTemplate, GameState } from "../../core/index";

interface FakeGameObject {
  readonly kind: string;
  text?: string;
  list?: unknown[];
  x: number;
  y: number;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  strokeWidth: number;
  strokeColor: number;
  handlers: Record<string, () => void>;
  parentContainer?: unknown;
  setOrigin(...args: unknown[]): FakeGameObject;
  setInteractive(...args: unknown[]): FakeGameObject;
  disableInteractive(): FakeGameObject;
  on(event: string, handler: () => void): FakeGameObject;
  once(event: string, handler: () => void): FakeGameObject;
  off(event: string, handler?: () => void): FakeGameObject;
  emit(event: string): void;
  setDepth(...args: unknown[]): FakeGameObject;
  setAlpha(...args: unknown[]): FakeGameObject;
  setTint(...args: unknown[]): FakeGameObject;
  setFillStyle(...args: unknown[]): FakeGameObject;
  setDisplaySize(width: number, height: number): FakeGameObject;
  setSize(width: number, height: number): FakeGameObject;
  setScale(scale: number): FakeGameObject;
  setStrokeStyle(width?: number, color?: number): FakeGameObject;
  setRounded(...args: unknown[]): FakeGameObject;
  setPosition(x: number, y: number): FakeGameObject;
  setY(y: number): FakeGameObject;
  setVisible(...args: unknown[]): FakeGameObject;
  setText(text: string): FakeGameObject;
  setAbove(...args: unknown[]): FakeGameObject;
  getWrappedText(text: string): string[];
  clear(): FakeGameObject;
  lineStyle(...args: unknown[]): FakeGameObject;
  strokeRoundedRect(...args: unknown[]): FakeGameObject;
  strokeCircle(...args: unknown[]): FakeGameObject;
  fillStyle(...args: unknown[]): FakeGameObject;
  fillCircle(...args: unknown[]): FakeGameObject;
  beginPath(): FakeGameObject;
  arc(...args: unknown[]): FakeGameObject;
  strokePath(): FakeGameObject;
  add(child: unknown): FakeGameObject;
  destroy(): void;
  removeFromDisplayList(): FakeGameObject;
  addedToScene(): void;
}

function makeObject(kind: string, text = ""): FakeGameObject {
  const obj = {
    kind,
    text,
    x: 0,
    y: 0,
    width: text.length > 0 ? Math.max(8, text.length * 8) : 32,
    height: 18,
    displayWidth: text.length > 0 ? Math.max(8, text.length * 8) : 32,
    displayHeight: 18,
    strokeWidth: 0,
    strokeColor: 0,
    handlers: {},
    setOrigin() {
      return this;
    },
    setInteractive() {
      return this;
    },
    disableInteractive() {
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
    emit(event: string) {
      this.handlers[event]?.();
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
    setFillStyle() {
      return this;
    },
    setDisplaySize(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.displayWidth = width;
      this.displayHeight = height;
      return this;
    },
    setSize(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.displayWidth = width;
      this.displayHeight = height;
      return this;
    },
    setScale(scale: number) {
      this.displayWidth = this.width * scale;
      this.displayHeight = this.height * scale;
      return this;
    },
    setStrokeStyle(width?: number, color?: number) {
      this.strokeWidth = width ?? 0;
      this.strokeColor = color ?? 0;
      return this;
    },
    setRounded() {
      return this;
    },
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    setY(y: number) {
      this.y = y;
      return this;
    },
    setVisible() {
      return this;
    },
    setText(textValue: string) {
      this.text = textValue;
      this.width = Math.max(8, textValue.length * 8);
      this.displayWidth = this.width;
      return this;
    },
    setAbove() {
      return this;
    },
    getWrappedText(textValue: string) {
      return [textValue];
    },
    clear() {
      return this;
    },
    lineStyle() {
      return this;
    },
    strokeRoundedRect() {
      return this;
    },
    strokeCircle() {
      return this;
    },
    fillStyle() {
      return this;
    },
    fillCircle() {
      return this;
    },
    beginPath() {
      return this;
    },
    arc() {
      return this;
    },
    strokePath() {
      return this;
    },
    add(child: unknown) {
      this.list?.push(child);
      return this;
    },
    destroy() {},
    removeFromDisplayList() {
      return this;
    },
    addedToScene() {},
  } as FakeGameObject;
  if (kind === "container") obj.list = [];
  return obj;
}

function makeScene(): Phaser.Scene & { objects: unknown[] } {
  const objects: unknown[] = [];
  const scene = {
    sys: {
      displayList: {
        add() {},
        remove() {},
        exists() {
          return false;
        },
      },
      updateList: { add() {}, remove() {} },
      input: {
        enable(obj: unknown) {
          (obj as { __interactive?: boolean }).__interactive = true;
        },
      },
      queueDepthSort() {},
      events: { once() {}, off() {} },
    },
    children: {
      bringToTop() {},
    },
    textures: {
      exists() {
        return true;
      },
      createCanvas() {
        return null;
      },
    },
    add: {
      existing(obj: unknown) {
        objects.push(obj as FakeGameObject);
        return obj;
      },
      rectangle() {
        const obj = makeObject("rectangle");
        objects.push(obj);
        return obj;
      },
      nineslice() {
        const obj = makeObject("nineslice");
        objects.push(obj);
        return obj;
      },
      text(_x: number, _y: number, text: string) {
        const obj = makeObject("text", text);
        objects.push(obj);
        return obj;
      },
      image() {
        const obj = makeObject("image");
        objects.push(obj);
        return obj;
      },
      graphics() {
        const obj = makeObject("graphics");
        objects.push(obj);
        return obj;
      },
      circle() {
        const obj = makeObject("circle");
        objects.push(obj);
        return obj;
      },
      container() {
        const obj = makeObject("container");
        objects.push(obj);
        return obj;
      },
    },
  };

  return Object.assign(scene, { objects }) as unknown as Phaser.Scene & { objects: unknown[] };
}

const templates: Record<string, CardTemplate> = {
  "Lucky Break": {
    kind: "player",
    name: "Lucky Break",
    energyCost: 0,
    exhaust: true,
    effect: { kind: "Heal", amount: 2 },
  },
  "Second Wind": {
    kind: "player",
    name: "Second Wind",
    energyCost: 0,
    exhaust: true,
    effect: { kind: "GainEnergy", amount: 2 },
  },
  "Found Tool": {
    kind: "player",
    name: "Found Tool",
    energyCost: 0,
    exhaust: true,
    effect: { kind: "DealProgress", base: 2 },
  },
};

function pendingState(): GameState {
  return {
    playerDraw: [],
    hand: [
      {
        kind: "player",
        id: "p1",
        templateId: "Sprint",
        name: "Sprint",
        insetKey: undefined,
        sourceWorldId: "zombie-big-box",
        effect: { kind: "Draw", player: 1 },
        energyCost: 0,
        keywords: [],
        rarity: "common",
      },
    ],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    actIndex: 1,
    totalActs: 3,
    progress: {},
    hp: 20,
    energy: 3,
    light: 0,
    heat: 0,
    pendingForceDestroy: 0,
    braceCharges: 0,
    pendingBoonChoices: [
      {
        source: "act",
        act: 2,
        setId: "fortune-v1",
        setName: "fortune-v1",
        offeredTemplateIds: ["Lucky Break", "Second Wind", "Found Tool"],
        chooseCount: 1,
        bToDiscard: false,
      },
    ],
    endOfTurnPassive: { kind: "None" },
    runModifiers: DEFAULT_RUN_MODIFIERS,
    turnPlayHistory: { cardsPlayedThisTurn: 0, byTemplateId: {} },
    status: "playing",
    worldId: "zombie-big-box",
    rng: { a: 1, b: 2, c: 3, d: 4 },
    nextId: 10,
  };
}

describe("BoonChoiceView", () => {
  it("renders all offered choices without minting cards", () => {
    const scene = makeScene();
    new BoonChoiceView(scene, {
      theme: selectTheme("zombie-big-box"),
      source: "act",
      bToDiscard: false,
      options: Object.entries(templates).map(([templateId, template]) => ({
        templateId,
        template,
      })),
      resolveTheme: selectTheme,
      onChoose() {},
    });

    const renderedText = scene.objects
      .filter((obj): obj is FakeGameObject => (obj as FakeGameObject).kind === "text")
      .map((obj) => obj.text);
    expect(renderedText).toContain("Lucky Break");
    expect(renderedText).toContain("Second Wind");
    expect(renderedText).toContain("Found Tool");
    expect(renderedText).toContain("Pick one temporary card. It goes directly to your hand.");
  });

  it("renders discard destination copy", () => {
    const scene = makeScene();
    new BoonChoiceView(scene, {
      theme: selectTheme("zombie-big-box"),
      source: "worldClear",
      bToDiscard: true,
      options: Object.entries(templates).map(([templateId, template]) => ({
        templateId,
        template,
      })),
      resolveTheme: selectTheme,
      onChoose() {},
    });

    const renderedText = scene.objects
      .filter((obj): obj is FakeGameObject => (obj as FakeGameObject).kind === "text")
      .map((obj) => obj.text);
    expect(renderedText).toContain("Pick one temporary card. It goes to your discard pile.");
  });

  it("formats world template keywords through CardView", () => {
    const scene = makeScene();
    const worldTemplate: CardTemplate = {
      kind: "world",
      name: "Fog Bank",
      cost: 3,
      keywords: ["Concealed:3", "Obstructed"],
      discardable: false,
      onDiscarded: { kind: "None" },
      onCleared: { kind: "None" },
      onEndOfTurn: { kind: "None" },
      onPartialClear: { kind: "None" },
    };

    new BoonChoiceView(scene, {
      theme: selectTheme("zombie-big-box"),
      source: "act",
      bToDiscard: false,
      options: [{ templateId: "Fog Bank", template: worldTemplate }],
      resolveTheme: selectTheme,
      onChoose() {},
    });

    const renderedText = scene.objects
      .filter((obj): obj is FakeGameObject => (obj as FakeGameObject).kind === "text")
      .map((obj) => obj.text);
    expect(renderedText.some((text) => text?.includes("Concealed 3"))).toBe(true);
    expect(renderedText).not.toContain("Concealed:3 · Hidden");
  });

  it("dispatches the selected template from pointer selection", () => {
    const scene = makeScene();
    let chosen: string | undefined;
    new BoonChoiceView(scene, {
      theme: selectTheme("zombie-big-box"),
      source: "act",
      bToDiscard: false,
      options: Object.entries(templates).map(([templateId, template]) => ({
        templateId,
        template,
      })),
      resolveTheme: selectTheme,
      onChoose(templateId) {
        chosen = templateId;
      },
    });

    const clickable = scene.objects.find(
      (obj): obj is { __interactive: true; emit(event: string): void } =>
        (obj as { __interactive?: boolean }).__interactive === true &&
        (obj as { kind?: string }).kind === undefined &&
        typeof (obj as { emit?: unknown }).emit === "function",
    );
    expect(clickable).toBeDefined();
    clickable?.emit("pointerdown");
    expect(chosen).toBe("Lucky Break");
  });

  // -------------------------------------------------------------------------
  // Rarity coloring (REQ-RARITY-37, 38, 39) — colored from the catalog
  // template's `rarity` field (`option.template.rarity`), never from a
  // `BoonOffered.rarities` event field: this view's input (`BoonChoiceOption`)
  // doesn't carry an event at all, only `{ templateId, template }`, so there
  // is no event-shaped data for an event→render bridge to read in the first
  // place. previewCardFromTemplate stamps `template.rarity ?? "common"` onto
  // the preview Card exactly like a real mint does, and CardView reads that
  // stamped field to draw its rarity stroke — the same mechanism a card
  // landing on the table via a real GainCard/GainRandomCard grant uses.
  // -------------------------------------------------------------------------
  describe("rarity coloring", () => {
    const rarityTemplates: Record<string, CardTemplate> = {
      "Common Boon": {
        kind: "player",
        name: "Common Boon",
        energyCost: 0,
        exhaust: true,
        effect: { kind: "Heal", amount: 1 },
        rarity: "common",
      },
      "Uncommon Boon": {
        kind: "player",
        name: "Uncommon Boon",
        energyCost: 0,
        exhaust: true,
        effect: { kind: "Heal", amount: 1 },
        rarity: "uncommon",
      },
      "Rare Boon": {
        kind: "player",
        name: "Rare Boon",
        energyCost: 0,
        exhaust: true,
        effect: { kind: "Heal", amount: 1 },
        rarity: "rare",
      },
      "Unstamped Boon": {
        kind: "player",
        name: "Unstamped Boon",
        energyCost: 0,
        exhaust: true,
        effect: { kind: "Heal", amount: 1 },
        // No rarity authored — previewCardFromTemplate defaults to "common",
        // mirroring mintCard's own `template.rarity ?? "common"` stamping.
      },
    };

    // Each option's CardView constructs exactly two rectangles, in order:
    // highlightRect (selection/target overlay, stroke width 0 until a
    // selection state is applied) then rarityRect (the always-visible rarity
    // stroke, width RARITY_STROKE_WIDTH from construction). Filtering on that
    // exact width isolates the rarity strokes from every other rectangle on
    // the scene — the shield/panel backdrop, the unstroked highlight
    // rectangles, and TooltipView's own lazily-constructed 1px-stroke
    // background (built as a side effect of the first effect-icon tooltip).
    function rarityStrokeColors(scene: Phaser.Scene & { objects: unknown[] }): number[] {
      return (scene.objects as FakeGameObject[])
        .filter((obj) => obj.kind === "rectangle" && obj.strokeWidth === RARITY_STROKE_WIDTH)
        .map((obj) => obj.strokeColor);
    }

    it("colors each offered option's card face from option.template.rarity", () => {
      const scene = makeScene();
      new BoonChoiceView(scene, {
        theme: selectTheme("zombie-big-box"),
        source: "act",
        bToDiscard: false,
        options: [
          { templateId: "Common Boon", template: rarityTemplates["Common Boon"]! },
          { templateId: "Uncommon Boon", template: rarityTemplates["Uncommon Boon"]! },
          { templateId: "Rare Boon", template: rarityTemplates["Rare Boon"]! },
        ],
        resolveTheme: selectTheme,
        onChoose() {},
      });

      expect(rarityStrokeColors(scene)).toEqual([
        rarityStyle("common").color,
        rarityStyle("uncommon").color,
        rarityStyle("rare").color,
      ]);
    });

    it("defaults an unstamped template's option to the Common rarity treatment", () => {
      const scene = makeScene();
      new BoonChoiceView(scene, {
        theme: selectTheme("zombie-big-box"),
        source: "act",
        bToDiscard: false,
        options: [{ templateId: "Unstamped Boon", template: rarityTemplates["Unstamped Boon"]! }],
        resolveTheme: selectTheme,
        onChoose() {},
      });

      expect(rarityStrokeColors(scene)).toEqual([rarityStyle("common").color]);
    });
  });
});

describe("TableScene pending boon input", () => {
  interface TableHarness {
    game_: { state: GameState; template(id: string): CardTemplate | undefined };
    sel: { phase: "idle" };
    actionConfirmation: { isOpen: boolean };
    dispatch(action: Action): void;
    actions: Action[];
    chooseVisibleBoonOption(index: number): void;
    onCardClick(cardId: string): void;
    onEndTurnClick(): void;
  }

  function makeTableHarness(): TableHarness {
    const scene = Object.create(TableScene.prototype) as TableHarness;
    scene.actions = [];
    scene.game_ = {
      state: pendingState(),
      template(id: string) {
        return templates[id];
      },
    };
    scene.sel = { phase: "idle" };
    scene.actionConfirmation = { isOpen: false };
    scene.dispatch = (action: Action) => {
      scene.actions.push(action);
    };
    return scene;
  }

  it("dispatches the matching visible template ID for number-key selection", () => {
    const scene = makeTableHarness();

    (scene as unknown as { chooseVisibleBoonOption(index: number): void }).chooseVisibleBoonOption(
      1,
    );

    expect(scene.actions).toEqual([{ type: "ChooseBoon", templateId: "Second Wind" }]);
  });

  it("blocks table card clicks and End Turn while the overlay is present", () => {
    const scene = makeTableHarness();

    (scene as unknown as { onCardClick(cardId: string): void }).onCardClick("p1");
    (scene as unknown as { onEndTurnClick(): void }).onEndTurnClick();

    expect(scene.actions).toEqual([]);
  });
});
