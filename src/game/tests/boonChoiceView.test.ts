import { describe, expect, it } from "bun:test";
import { BoonChoiceView } from "../view/BoonChoiceView";
import { TableScene } from "../scenes/TableScene";
import { selectTheme } from "../view/themes/themeManifest";
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
  setStrokeStyle(...args: unknown[]): FakeGameObject;
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
    setStrokeStyle() {
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
      displayList: { add() {}, remove() {}, exists() { return false; } },
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
    hand: [{ kind: "player", id: "p1", templateId: "Sprint", name: "Sprint", insetKey: undefined, sourceWorldId: "zombie-big-box", effect: { kind: "Draw", player: 1 }, energyCost: 0, keywords: [] }],
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
    pendingBoonChoices: [{
      source: "act",
      act: 2,
      setId: "fortune-v1",
      offeredTemplateIds: ["Lucky Break", "Second Wind", "Found Tool"],
      chooseCount: 1,
      bToDiscard: false,
    }],
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
      options: Object.entries(templates).map(([templateId, template]) => ({ templateId, template })),
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
      options: Object.entries(templates).map(([templateId, template]) => ({ templateId, template })),
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
      keywords: ["Concealed:3", "Hidden"],
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
      options: Object.entries(templates).map(([templateId, template]) => ({ templateId, template })),
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
});

describe("TableScene pending boon input", () => {
  interface TableHarness {
    game_: { state: GameState; template(id: string): CardTemplate | undefined };
    sel: { phase: "idle" };
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
    scene.dispatch = (action: Action) => {
      scene.actions.push(action);
    };
    return scene;
  }

  it("dispatches the matching visible template ID for number-key selection", () => {
    const scene = makeTableHarness();

    (scene as unknown as { chooseVisibleBoonOption(index: number): void }).chooseVisibleBoonOption(1);

    expect(scene.actions).toEqual([{ type: "ChooseBoon", templateId: "Second Wind" }]);
  });

  it("blocks table card clicks and End Turn while the overlay is present", () => {
    const scene = makeTableHarness();

    (scene as unknown as { onCardClick(cardId: string): void }).onCardClick("p1");
    (scene as unknown as { onEndTurnClick(): void }).onEndTurnClick();

    expect(scene.actions).toEqual([]);
  });
});
