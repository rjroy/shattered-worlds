import { describe, it, expect } from "bun:test";
import { CardView, applyCardHighlight } from "../view/CardView";
import { TableScene } from "../scenes/TableScene";
import { selectTheme } from "../view/themes/themeManifest";
import type { VisualTheme } from "../view/themes/theme";
import type { CommonButton } from "../view/components";
import { CARD_FACE, TABLE_LAYOUT } from "../view/layout";
import { mintCard } from "../../core/model/cards";
import { createRng } from "../../core/engine/rng";
import { DEFAULT_RUN_MODIFIERS, type PlayerCardModifier } from "../../data/unlocks/types";
import { rarityStyle } from "../view/rarity";
import type {
  Action,
  Card,
  CardCatalog,
  GameState,
  PlayerCard,
  RarityTier,
  TargetSpec,
  WorldCard,
} from "../../core/index";
import {
  catalog as coreCatalog,
  makePlayerCard,
  makeState as makeCoreState,
  makeWorldCard,
  mintPlayers as mintCorePlayers,
} from "../../core/tests/testFixture";
import { previewAction } from "../../core/index";
import type { ActionPreview } from "../../core/index";
import { reduce } from "../../core/engine/reduce";
import type { UserSettings } from "../runtime/userSettings";

// ---------------------------------------------------------------------------
// updateCostRing — fill/drain animation (S5)
//
// updateCostRing only touches a small, well-defined surface of Phaser: the ring
// Graphics' draw methods, plus scene.tweens.{killTweensOf, add}. We fake both so
// the animation logic (snap-on-first-render, idempotence, tween direction, the
// onUpdate/onComplete redraw) is tested deterministically without a real Phaser
// runtime or a real clock.
// ---------------------------------------------------------------------------

const RING_ACCENT = 0x88aaff;

function playerCardModifier(
  id: string,
  templateId: string,
  patches: PlayerCardModifier["patches"],
  condition: PlayerCardModifier["condition"] = { kind: "always" },
): PlayerCardModifier {
  return {
    id,
    displayName: id,
    target: { kind: "template", templateId },
    condition,
    patches,
  };
}

interface CapturedTween {
  targets: unknown;
  displayedFraction: number;
  duration: number;
  ease: string;
  onUpdate: () => void;
  onComplete: () => void;
}

/** A fake ring Graphics that records draw calls and arc end fractions. */
interface FakeRingState {
  displayedFraction: number | undefined;
  arcs: number[];
  clears: number;
}

function makeFakeRing(): {
  ring: FakeRingState;
  graphics: unknown;
} {
  const state = {
    displayedFraction: undefined as number | undefined,
    arcs: [] as number[],
    clears: 0,
  };
  const graphics = {
    get displayedFraction(): number | undefined {
      return state.displayedFraction;
    },
    set displayedFraction(v: number | undefined) {
      state.displayedFraction = v;
    },
    clear(): void {
      state.clears += 1;
    },
    lineStyle(): void {},
    strokeCircle(): void {},
    fillStyle(): void {},
    fillCircle(): void {},
    beginPath(): void {},
    // The arc's end angle encodes the drawn fraction: end = -π/2 + frac*2π.
    arc(_x: number, _y: number, _r: number, _start: number, end: number): void {
      const frac = (end + Math.PI / 2) / (Math.PI * 2);
      state.arcs.push(frac);
    },
    strokePath(): void {},
  };
  return { ring: state, graphics };
}

/**
 * A fake scene.tweens that captures the tween config, counts kills, and records
 * an ordered call-log. The log lets tests assert the kill-before-add contract:
 * an in-flight tween must be cancelled (killTweensOf) before a new one is added,
 * on the same target. A bare kill counter would still pass if someone reordered
 * `add` before `killTweensOf`, so the ordered log is the real guard.
 */
function makeFakeScene(): {
  scene: unknown;
  captured: CapturedTween[];
  callLog: ("kill" | "add")[];
  kills: number;
} {
  const captured: CapturedTween[] = [];
  const callLog: ("kill" | "add")[] = [];
  let kills = 0;
  const scene = {
    tweens: {
      killTweensOf(): void {
        kills += 1;
        callLog.push("kill");
      },
      add(config: CapturedTween): CapturedTween {
        captured.push(config);
        callLog.push("add");
        return config;
      },
    },
  };
  return {
    scene,
    captured,
    callLog,
    get kills(): number {
      return kills;
    },
  };
}

interface CostRingCardViewFake {
  scene: unknown;
  costRing?: unknown;
  updateCostRing: CardView["updateCostRing"];
}

function makeCardView(scene: unknown, graphics?: unknown): CostRingCardViewFake {
  const view = Object.create(CardView.prototype) as CostRingCardViewFake;
  Object.defineProperty(view, "scene", { value: scene });
  if (graphics !== undefined) view.costRing = graphics;
  return view;
}

/** Fetch the nth captured tween, asserting it exists (keeps strict types happy). */
function nthTween(captured: CapturedTween[], i: number): CapturedTween {
  const t = captured[i];
  if (t === undefined) throw new Error(`expected a captured tween at index ${i}`);
  return t;
}

type RowNavButton = CommonButton & {
  interactive: boolean;
  press(): void;
};

function makeDrawAllHarness(state: GameState): {
  scene: {
    drawAll(): void;
    navigateRow(row: "world" | "player", direction: -1 | 1): void;
    cardObjects: Map<string, CardView>;
  };
  worldRows: Card[][];
  playerRows: Card[][];
  rowNav: {
    worldPrev: RowNavButton;
    worldNext: RowNavButton;
    worldLabel: FakeRowNavLabel;
    playerPrev: RowNavButton;
    playerNext: RowNavButton;
    playerLabel: FakeRowNavLabel;
  };
} {
  const render = makeRenderScene();
  const scene = Object.create(TableScene.prototype) as Record<string, unknown> & {
    drawAll(): void;
    navigateRow(row: "world" | "player", direction: -1 | 1): void;
    cardObjects: Map<string, CardView>;
  };
  scene.sys = render.scene.sys;
  scene.textures = render.scene.textures;
  const commonButtonAdd = makeFakeCommonButtonAdd();
  scene.add = { ...render.scene.add, nineslice: commonButtonAdd.nineslice };
  const worldRows: Card[][] = [];
  const playerRows: Card[][] = [];
  const createRowNavButton = (
    scene as unknown as {
      createRowNavButton(
        row: "world" | "player",
        direction: -1 | 1,
        text: string,
        style: Record<string, never>,
      ): CommonButton;
    }
  ).createRowNavButton.bind(scene);
  const rowNav = {
    worldPrev: makeTestRowNavButton(createRowNavButton("world", -1, "<", {})),
    worldNext: makeTestRowNavButton(createRowNavButton("world", 1, ">", {})),
    worldLabel: makeFakeRowNavLabel(),
    playerPrev: makeTestRowNavButton(createRowNavButton("player", -1, "<", {})),
    playerNext: makeTestRowNavButton(createRowNavButton("player", 1, ">", {})),
    playerLabel: makeFakeRowNavLabel(),
  };
  const game = {
    state,
    intensity: () => 0,
    dispatch(action: Action): { state: GameState; events: unknown[] } {
      const result = reduce(coreCatalog, game.state, action);
      game.state = result.state;
      return result;
    },
    preview(action: Action): ActionPreview {
      return previewAction(coreCatalog, game.state, action);
    },
  };
  scene.game_ = game;
  scene.theme_ = selectTheme("zombie-big-box");
  scene.sel = { phase: "idle" };
  scene.selectedCardSnapshot = null;
  scene.hoveredCardId = null;
  scene.worldRowOffset = 0;
  scene.playerRowOffset = 0;
  scene.cardObjects = new Map();
  scene.cardDisplaySignatures = new Map();
  scene.modalChooser = null;
  scene.discardChooser = null;
  scene.boonChoiceView = null;
  scene.runtime_ = { userSettings: { get: () => DEFAULT_HARNESS_SETTINGS } };
  scene.worldRowPrevBtn = rowNav.worldPrev;
  scene.worldRowNextBtn = rowNav.worldNext;
  scene.worldRowRangeLabel = rowNav.worldLabel;
  scene.playerRowPrevBtn = rowNav.playerPrev;
  scene.playerRowNextBtn = rowNav.playerNext;
  scene.playerRowRangeLabel = rowNav.playerLabel;
  scene.backdropLayer = { update(): void {} };
  scene.hudView = { update(): void {} };
  scene.pileLayer = { update(): void {} };
  scene.endTurnBtn = {
    setAlpha(): unknown {
      return scene.endTurnBtn;
    },
    disableInteractive(): unknown {
      return scene.endTurnBtn;
    },
    setInteractive(): unknown {
      return scene.endTurnBtn;
    },
  };
  scene.cancelBtn = {
    setVisible(): unknown {
      return scene.cancelBtn;
    },
  };
  scene.confirmBtn = {
    setVisible(): unknown {
      return scene.confirmBtn;
    },
  };
  scene.runSummary = { visible: false };
  scene.questionBtn = {
    disableInteractive(): unknown {
      return scene.questionBtn;
    },
    setVisible(): unknown {
      return scene.questionBtn;
    },
  };
  scene.exitBtn = {
    disableInteractive(): unknown {
      return scene.exitBtn;
    },
  };
  scene.helpOverlay = {
    visible: false,
    setVisible(): unknown {
      return scene.helpOverlay;
    },
  };
  scene.settingsOverlay = {
    visible: false,
    close(): unknown {
      return scene.settingsOverlay;
    },
  };
  scene.settingsBtn = {
    disableInteractive(): unknown {
      return scene.settingsBtn;
    },
    setVisible(): unknown {
      return scene.settingsBtn;
    },
  };
  scene.actionConfirmation = { isOpen: false };
  scene.tweens = { killTweensOf(): void {} };
  scene.currentLegalTargetIds = () => new Set<string>();
  const realLayoutRow = (
    scene as unknown as {
      layoutRow(
        isPlayer: boolean,
        offset: number,
        cards: readonly Card[],
        positions: readonly { y: number }[],
        playableIds: Set<string>,
        discardableIds: Set<string>,
        legalTargetIds: Set<string>,
        desiredIds: Set<string>,
      ): void;
    }
  ).layoutRow.bind(scene);
  scene.layoutRow = (
    isPlayer: boolean,
    offset: number,
    cards: readonly Card[],
    positions: readonly { y: number }[],
    playableIds: Set<string>,
    discardableIds: Set<string>,
    legalTargetIds: Set<string>,
    desiredIds: Set<string>,
  ) => {
    realLayoutRow(
      isPlayer,
      offset,
      cards,
      positions,
      playableIds,
      discardableIds,
      legalTargetIds,
      desiredIds,
    );
    const rowY = positions[0]?.y;
    if (rowY === undefined) return;
    if (rowY > 400) {
      playerRows.push([...cards]);
    } else {
      worldRows.push([...cards]);
    }
  };
  scene.updateHint = () => {};
  scene.updateBoonChoiceView = () => {};
  scene.clearConnector = () => {};
  scene.clearPreviewSlot = () => {};

  return { scene, worldRows, playerRows, rowNav };
}

interface FakeCommonButtonBacking {
  interactive: boolean;
  pointerdown: (() => void) | null;
  width: number;
  height: number;
  setOrigin(): FakeCommonButtonBacking;
  setTint(): FakeCommonButtonBacking;
  setSize(width: number, height: number): FakeCommonButtonBacking;
  setScale(scaleX: number, scaleY: number): FakeCommonButtonBacking;
  setInteractive(): FakeCommonButtonBacking;
  disableInteractive(): FakeCommonButtonBacking;
  on(event: string, callback: () => void): FakeCommonButtonBacking;
  once(): FakeCommonButtonBacking;
  off(): FakeCommonButtonBacking;
  removeFromDisplayList(): FakeCommonButtonBacking;
  addToDisplayList(): FakeCommonButtonBacking;
  addToUpdateList(): FakeCommonButtonBacking;
  removeFromUpdateList(): FakeCommonButtonBacking;
  addedToScene(): void;
  removedFromScene(): void;
}

interface FakeRowNavLabel {
  visible: boolean;
  text: string;
  setVisible(visible: boolean): FakeRowNavLabel;
  setText(text: string): void;
}

function makeFakeCommonButtonBacking(): FakeCommonButtonBacking {
  const backing: FakeCommonButtonBacking = {
    interactive: false,
    pointerdown: null,
    width: 30,
    height: 20,
    setOrigin(): FakeCommonButtonBacking {
      return this;
    },
    setTint(): FakeCommonButtonBacking {
      return this;
    },
    setSize(width: number, height: number): FakeCommonButtonBacking {
      this.width = width;
      this.height = height;
      return this;
    },
    setScale(): FakeCommonButtonBacking {
      return this;
    },
    setInteractive(): FakeCommonButtonBacking {
      this.interactive = true;
      return this;
    },
    disableInteractive(): FakeCommonButtonBacking {
      this.interactive = false;
      return this;
    },
    on(event: string, callback: () => void): FakeCommonButtonBacking {
      if (event === "pointerdown") this.pointerdown = callback;
      return this;
    },
    once(): FakeCommonButtonBacking {
      return this;
    },
    off(): FakeCommonButtonBacking {
      return this;
    },
    removeFromDisplayList(): FakeCommonButtonBacking {
      return this;
    },
    addToDisplayList(): FakeCommonButtonBacking {
      return this;
    },
    addToUpdateList(): FakeCommonButtonBacking {
      return this;
    },
    removeFromUpdateList(): FakeCommonButtonBacking {
      return this;
    },
    addedToScene(): void {},
    removedFromScene(): void {},
  };
  return backing;
}

function makeFakeCommonButtonAdd(): {
  nineslice(): FakeCommonButtonBacking;
  text(): FakeCommonButtonBacking & { text: string; setText(text: string): void };
  existing(): void;
} {
  return {
    nineslice(): FakeCommonButtonBacking {
      return makeFakeCommonButtonBacking();
    },
    text(): FakeCommonButtonBacking & { text: string; setText(text: string): void } {
      return {
        ...makeFakeCommonButtonBacking(),
        text: "",
        width: 8,
        height: 12,
        setText(text: string): void {
          this.text = text;
          this.width = Math.max(8, text.length * 8);
        },
      };
    },
    existing(): void {},
  };
}

function rowNavButtonBacking(button: CommonButton): FakeCommonButtonBacking {
  return (button as unknown as { txtBg: FakeCommonButtonBacking }).txtBg;
}

function makeTestRowNavButton(button: CommonButton): RowNavButton {
  Object.defineProperty(button, "interactive", {
    get(): boolean {
      return rowNavButtonBacking(button).interactive;
    },
  });
  Object.defineProperty(button, "press", {
    value(): void {
      const backing = rowNavButtonBacking(button);
      if (!button.visible || !backing.interactive) return;
      backing.pointerdown?.();
    },
  });
  return button as RowNavButton;
}

function pressRowNavKey(
  scene: unknown,
  code: "BracketLeft" | "BracketRight",
  shiftKey = false,
): boolean {
  let prevented = false;
  const event = {
    code,
    shiftKey,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault(): void {
      prevented = true;
    },
  } as unknown as KeyboardEvent;
  (
    scene as {
      handleRowNavigationKey(event: KeyboardEvent): void;
    }
  ).handleRowNavigationKey(event);
  return prevented;
}

function scrollRowWheel(scene: unknown, x: number, y: number, deltaY: number): void {
  (
    scene as {
      handleRowNavigationWheel(pointer: Phaser.Input.Pointer, deltaY: number): void;
    }
  ).handleRowNavigationWheel({ x, y, worldX: x, worldY: y } as Phaser.Input.Pointer, deltaY);
}

function makeFakeRowNavLabel(): FakeRowNavLabel {
  return {
    visible: false,
    text: "",
    setVisible(visible: boolean): FakeRowNavLabel {
      this.visible = visible;
      return this;
    },
    setText(text: string): void {
      this.text = text;
    },
  };
}

describe("TableScene effective player-card layout", () => {
  it("renders visible Sprints from effective cards and updates remaining Sprints after one resolves", () => {
    const base = makeCoreState({ energy: 9 });
    const [sprints, minted] = mintCorePlayers(base, "Sprint", 3);
    const runModifiers = {
      ...DEFAULT_RUN_MODIFIERS,
      playerCardModifiers: [
        playerCardModifier(
          "first-sprint-free",
          "Sprint",
          [{ kind: "setEnergyCost", energyCost: 0 }],
          {
            kind: "templatePlayOrdinalThisTurn",
            ordinal: 1,
          },
        ),
      ],
    };
    const before = {
      ...minted,
      hand: sprints,
      energy: 9,
      runModifiers,
      turnPlayHistory: { cardsPlayedThisTurn: 0, byTemplateId: {} },
    };
    const beforeHarness = makeDrawAllHarness(before);
    beforeHarness.scene.drawAll();

    const [beforePlayerRow] = beforeHarness.playerRows;
    expect(beforePlayerRow?.map((card) => card.id)).toEqual(sprints.map((card) => card.id));
    expect(
      beforePlayerRow?.map((card) => (card.kind === "player" ? card.energyCost : NaN)),
    ).toEqual([0, 0, 0]);
    expect(sprints.map((card) => card.energyCost)).toEqual([1, 1, 1]);

    const after = {
      ...before,
      hand: sprints.slice(1),
      turnPlayHistory: { cardsPlayedThisTurn: 1, byTemplateId: { Sprint: 1 } },
    };
    const afterHarness = makeDrawAllHarness(after);
    afterHarness.scene.drawAll();

    const [afterPlayerRow] = afterHarness.playerRows;
    expect(afterPlayerRow?.map((card) => card.id)).toEqual(sprints.slice(1).map((card) => card.id));
    expect(afterPlayerRow?.map((card) => (card.kind === "player" ? card.energyCost : NaN))).toEqual(
      [1, 1],
    );
  });

  it("shows row navigation only for overflowing rows and pages the player window", () => {
    const base = makeCoreState({ energy: 9 });
    const [sprints, state] = mintCorePlayers(base, "Sprint", 7);
    const harness = makeDrawAllHarness({ ...state, hand: sprints });

    harness.scene.drawAll();

    expect(harness.playerRows[0]?.map((card) => card.id)).toEqual(
      sprints.slice(0, 5).map((card) => card.id),
    );
    expect(harness.rowNav.worldLabel.visible).toBe(false);
    expect(harness.rowNav.worldPrev.visible).toBe(false);
    expect(harness.rowNav.playerLabel.visible).toBe(true);
    expect(harness.rowNav.playerLabel.text).toBe("1-5 of 7");
    expect(harness.rowNav.playerPrev.interactive).toBe(false);
    expect(harness.rowNav.playerPrev.alpha).toBe(0.35);
    expect(harness.rowNav.playerNext.interactive).toBe(true);

    harness.rowNav.playerNext.press();

    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      sprints.slice(2, 7).map((card) => card.id),
    );
    expect(harness.rowNav.playerLabel.text).toBe("3-7 of 7");
    expect(harness.rowNav.playerPrev.interactive).toBe(true);
    expect(harness.rowNav.playerNext.interactive).toBe(false);
    expect(harness.rowNav.playerNext.alpha).toBe(0.35);
  });

  it("pages overflowing world and player rows independently through nav controls", () => {
    const base = makeCoreState({ energy: 9 });
    const worldCards = Array.from({ length: 7 }, (_, i) => makeWorldCard({ id: `world-${i + 1}` }));
    const [playerCards, state] = mintCorePlayers(base, "Sprint", 7);
    const harness = makeDrawAllHarness({ ...state, hand: [...worldCards, ...playerCards] });

    harness.scene.drawAll();

    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.rowNav.worldLabel.text).toBe("1-5 of 7");
    expect(harness.rowNav.playerLabel.text).toBe("1-5 of 7");

    harness.rowNav.worldNext.press();

    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.rowNav.worldLabel.text).toBe("3-7 of 7");
    expect(harness.rowNav.playerLabel.text).toBe("1-5 of 7");

    harness.rowNav.playerNext.press();

    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.rowNav.worldLabel.text).toBe("3-7 of 7");
    expect(harness.rowNav.playerLabel.text).toBe("3-7 of 7");
  });

  it("pages overflowing world and player rows independently through keyboard shortcuts", () => {
    const base = makeCoreState({ energy: 9 });
    const worldCards = Array.from({ length: 7 }, (_, i) =>
      makeWorldCard({ id: `key-world-${i + 1}` }),
    );
    const [playerCards, state] = mintCorePlayers(base, "Sprint", 7);
    const harness = makeDrawAllHarness({ ...state, hand: [...worldCards, ...playerCards] });

    harness.scene.drawAll();

    expect(pressRowNavKey(harness.scene, "BracketRight")).toBe(true);
    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.rowNav.worldLabel.text).toBe("3-7 of 7");
    expect(harness.rowNav.playerLabel.text).toBe("1-5 of 7");

    expect(pressRowNavKey(harness.scene, "BracketRight", true)).toBe(true);
    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.rowNav.worldLabel.text).toBe("3-7 of 7");
    expect(harness.rowNav.playerLabel.text).toBe("3-7 of 7");

    expect(pressRowNavKey(harness.scene, "BracketLeft")).toBe(true);
    expect(pressRowNavKey(harness.scene, "BracketLeft", true)).toBe(true);
    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(0, 5).map((card) => card.id),
    );
  });

  it("pages overflowing world and player rows independently with the mouse wheel over each row", () => {
    const base = makeCoreState({ energy: 9 });
    const worldCards = Array.from({ length: 7 }, (_, i) =>
      makeWorldCard({ id: `wheel-world-${i + 1}` }),
    );
    const [playerCards, state] = mintCorePlayers(base, "Sprint", 7);
    const harness = makeDrawAllHarness({ ...state, hand: [...worldCards, ...playerCards] });

    harness.scene.drawAll();

    scrollRowWheel(harness.scene, TABLE_LAYOUT.rowCenterX, TABLE_LAYOUT.worldRowY, 120);

    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.rowNav.worldLabel.text).toBe("3-7 of 7");
    expect(harness.rowNav.playerLabel.text).toBe("1-5 of 7");

    scrollRowWheel(harness.scene, TABLE_LAYOUT.rowCenterX, TABLE_LAYOUT.handRowY, 120);

    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.rowNav.worldLabel.text).toBe("3-7 of 7");
    expect(harness.rowNav.playerLabel.text).toBe("3-7 of 7");

    scrollRowWheel(harness.scene, TABLE_LAYOUT.rowCenterX, TABLE_LAYOUT.handRowY, -120);

    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.rowNav.playerLabel.text).toBe("1-5 of 7");
  });

  it("ignores mouse wheel outside the hand row footprints", () => {
    const base = makeCoreState({ energy: 9 });
    const worldCards = Array.from({ length: 7 }, (_, i) =>
      makeWorldCard({ id: `wheel-outside-world-${i + 1}` }),
    );
    const [playerCards, state] = mintCorePlayers(base, "Sprint", 7);
    const harness = makeDrawAllHarness({ ...state, hand: [...worldCards, ...playerCards] });

    harness.scene.drawAll();
    scrollRowWheel(harness.scene, TABLE_LAYOUT.rowCenterX, 285, 120);
    scrollRowWheel(harness.scene, TABLE_LAYOUT.rowCenterX, TABLE_LAYOUT.handRowY, 0);

    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.rowNav.worldLabel.text).toBe("1-5 of 7");
    expect(harness.rowNav.playerLabel.text).toBe("1-5 of 7");
  });

  it("draws only the five-card visible windows for twenty-plus-card rows", () => {
    const base = makeCoreState({ energy: 30 });
    const worldCards = Array.from({ length: 23 }, (_, i) =>
      makeWorldCard({ id: `oversized-world-${i + 1}` }),
    );
    const [playerCards, state] = mintCorePlayers(base, "Sprint", 23);
    const harness = makeDrawAllHarness({ ...state, hand: [...worldCards, ...playerCards] });

    harness.scene.drawAll();

    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.worldRows.at(-1)).toHaveLength(5);
    expect(harness.playerRows.at(-1)).toHaveLength(5);
    expect([...harness.scene.cardObjects.keys()].sort()).toEqual(
      [...worldCards.slice(0, 5), ...playerCards.slice(0, 5)].map((card) => card.id).sort(),
    );
    const firstPlayerView = harness.scene.cardObjects.get(playerCards[0]!.id);
    const sixthPlayerId = playerCards[5]!.id;
    let firstPlayerDestroyed = 0;
    if (firstPlayerView === undefined) throw new Error("expected first player CardView");
    const destroyFirstPlayer = firstPlayerView.destroy.bind(firstPlayerView);
    firstPlayerView.destroy = ((...args: Parameters<CardView["destroy"]>) => {
      firstPlayerDestroyed += 1;
      return destroyFirstPlayer(...args);
    }) as CardView["destroy"];
    expect(harness.scene.cardObjects.has(sixthPlayerId)).toBe(false);
    expect(harness.rowNav.worldLabel.text).toBe("1-5 of 23");
    expect(harness.rowNav.playerLabel.text).toBe("1-5 of 23");

    harness.rowNav.playerNext.press();

    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(5, 10).map((card) => card.id),
    );
    expect(firstPlayerDestroyed).toBe(1);
    expect(harness.scene.cardObjects.has(playerCards[0]!.id)).toBe(false);
    expect(harness.scene.cardObjects.has(sixthPlayerId)).toBe(true);
    expect([...harness.scene.cardObjects.keys()].sort()).toEqual(
      [...worldCards.slice(0, 5), ...playerCards.slice(5, 10)].map((card) => card.id).sort(),
    );
    expect(harness.rowNav.worldLabel.text).toBe("1-5 of 23");
    expect(harness.rowNav.playerLabel.text).toBe("6-10 of 23");

    harness.rowNav.worldNext.press();
    harness.rowNav.worldNext.press();
    harness.rowNav.worldNext.press();
    harness.rowNav.worldNext.press();

    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(18, 23).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(5, 10).map((card) => card.id),
    );
    expect(harness.rowNav.worldLabel.text).toBe("19-23 of 23");
    expect(harness.rowNav.playerLabel.text).toBe("6-10 of 23");
    expect([...harness.scene.cardObjects.keys()].sort()).toEqual(
      [...worldCards.slice(18, 23), ...playerCards.slice(5, 10)].map((card) => card.id).sort(),
    );
    expect(harness.rowNav.worldNext.interactive).toBe(false);
    expect(harness.rowNav.playerNext.interactive).toBe(true);
  });

  it("surfaces off-window legal targets through the overflowing row range label", () => {
    const base = makeCoreState({ energy: 9 });
    const worldCards = Array.from({ length: 7 }, (_, i) =>
      makeWorldCard({ id: `world-target-${i + 1}` }),
    );
    const [playerCards, state] = mintCorePlayers(base, "Sprint", 1);
    const harness = makeDrawAllHarness({ ...state, hand: [...worldCards, ...playerCards] });
    (harness.scene as unknown as { currentLegalTargetIds(): Set<string> }).currentLegalTargetIds =
      () => new Set([worldCards[6]!.id]);

    harness.scene.drawAll();

    expect(harness.rowNav.worldLabel.text).toBe("1-5 of 7 target >");

    harness.rowNav.worldNext.press();

    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toContain(worldCards[6]!.id);
    expect(harness.rowNav.worldLabel.text).toBe("3-7 of 7");
  });

  it("lets pointer paging reach and select an off-window player target during targeting", () => {
    const base = makeCoreState({ energy: 9 });
    const worldCards = Array.from({ length: 7 }, (_, i) =>
      makeWorldCard({ id: `world-pick-${i + 1}` }),
    );
    const [playerCards, state] = mintCorePlayers(base, "Sprint", 7);
    const harness = makeDrawAllHarness({ ...state, hand: [...worldCards, ...playerCards] });
    const snapshot = playerCards[0]!;
    const offWindowPlayerTarget = playerCards[6]!;
    const sel = {
      phase: "targeting" as const,
      cardId: snapshot.id,
      steps: [{ kind: "destroyHand" as const, min: 0, max: 2 }],
      stepIdx: 0,
      done: [{ kind: "returnWorld" as const, returnIds: [worldCards[0]!.id] }],
      current: [playerCards[1]!.id],
    };
    const scene = harness.scene as unknown as {
      sel: typeof sel;
      selectedCardSnapshot: PlayerCard | null;
    };
    scene.sel = sel;
    scene.selectedCardSnapshot = snapshot;
    (harness.scene as unknown as { currentLegalTargetIds(): Set<string> }).currentLegalTargetIds =
      () => new Set([offWindowPlayerTarget.id]);

    harness.scene.drawAll();
    harness.rowNav.worldNext.press();
    harness.rowNav.playerNext.press();

    expect(scene.sel).toBe(sel);
    expect(scene.selectedCardSnapshot).toBe(snapshot);
    expect(scene.sel.done).toEqual([{ kind: "returnWorld", returnIds: [worldCards[0]!.id] }]);
    expect(scene.sel.current).toEqual([playerCards[1]!.id]);
    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toContain(offWindowPlayerTarget.id);
    expect(harness.rowNav.playerLabel.text).toBe("3-7 of 7");

    const targetView = harness.scene.cardObjects.get(offWindowPlayerTarget.id);
    expect(targetView).toBeInstanceOf(CardView);

    targetView!.emit("pointerdown");

    expect(scene.selectedCardSnapshot).toBe(snapshot);
    expect(scene.sel).toMatchObject({
      phase: "targeting",
      cardId: snapshot.id,
      stepIdx: 0,
      done: [{ kind: "returnWorld", returnIds: [worldCards[0]!.id] }],
      current: [playerCards[1]!.id, offWindowPlayerTarget.id],
    });
  });

  it("keeps the acting card visible when keyboard paging would not reveal a new player target", () => {
    const base = makeCoreState({ energy: 9 });
    const worldCards = Array.from({ length: 7 }, (_, i) =>
      makeWorldCard({ id: `key-world-pick-${i + 1}` }),
    );
    const [playerCards, state] = mintCorePlayers(base, "Sprint", 7);
    const harness = makeDrawAllHarness({ ...state, hand: [...worldCards, ...playerCards] });
    const snapshot = playerCards[0]!;
    const sel = {
      phase: "targeting" as const,
      cardId: snapshot.id,
      steps: [{ kind: "hazard" as const }],
      stepIdx: 0,
      done: [{ kind: "returnWorld" as const, returnIds: [worldCards[0]!.id] }],
      current: [worldCards[1]!.id],
    };
    const scene = harness.scene as unknown as {
      sel: typeof sel;
      selectedCardSnapshot: PlayerCard | null;
    };
    scene.sel = sel;
    scene.selectedCardSnapshot = snapshot;
    (harness.scene as unknown as { currentLegalTargetIds(): Set<string> }).currentLegalTargetIds =
      () => new Set([playerCards[4]!.id]);

    harness.scene.drawAll();
    expect(pressRowNavKey(harness.scene, "BracketRight")).toBe(true);
    expect(pressRowNavKey(harness.scene, "BracketRight", true)).toBe(true);

    expect(scene.sel).toBe(sel);
    expect(scene.selectedCardSnapshot).toBe(snapshot);
    expect(scene.sel.done).toEqual([{ kind: "returnWorld", returnIds: [worldCards[0]!.id] }]);
    expect(scene.sel.current).toEqual([worldCards[1]!.id]);
    expect(harness.worldRows.at(-1)?.map((card) => card.id)).toEqual(
      worldCards.slice(2, 7).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      playerCards.slice(0, 5).map((card) => card.id),
    );
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toContain(snapshot.id);
  });
});

describe("TableScene applied-keyword display refresh", () => {
  // World card containers persist across drawAll cycles (see obtainCardContainer),
  // so a state change invisible to the container's construction args (e.g. Alarm
  // applied/removed by ApplyKeyword/RemoveKeyword after the card is already on the
  // table) must trigger a rebuild, or the on-face keyword label goes stale even
  // though core state is correct. Regression coverage for that gap.
  it("rebuilds a world card's container when RemoveKeyword clears an applied keyword", () => {
    const alarmed = makeWorldCard({
      id: "alarmed-1",
      appliedKeywords: [{ name: "Alarm", value: 2 }],
    });
    const state = makeCoreState({ hand: [alarmed] });
    const harness = makeDrawAllHarness(state);
    const scene = harness.scene as typeof harness.scene & { game_: { state: GameState } };

    harness.scene.drawAll();
    const beforeView = scene.cardObjects.get(alarmed.id);
    expect(beforeView).toBeInstanceOf(CardView);

    const cleared: WorldCard = { ...alarmed, appliedKeywords: [] };
    scene.game_.state = { ...scene.game_.state, hand: [cleared] };
    harness.scene.drawAll();
    const afterView = scene.cardObjects.get(alarmed.id);

    expect(afterView).toBeInstanceOf(CardView);
    expect(afterView).not.toBe(beforeView);
  });

  it("keeps the same container when no display-relevant field changes", () => {
    const worldCard = makeWorldCard({ id: "steady-1" });
    const state = makeCoreState({ hand: [worldCard] });
    const harness = makeDrawAllHarness(state);
    const scene = harness.scene as typeof harness.scene & { game_: { state: GameState } };

    harness.scene.drawAll();
    const beforeView = scene.cardObjects.get(worldCard.id);

    scene.game_.state = { ...scene.game_.state, hand: [{ ...worldCard }] };
    harness.scene.drawAll();
    const afterView = scene.cardObjects.get(worldCard.id);

    expect(afterView).toBe(beforeView);
  });
});

/**
 * Fake ActionConfirmationView for the selection harness. Captures the most
 * recent show() options so tests can assert the title/lines and drive the
 * stored onCommit / onCancel exactly as the real view's Commit / Cancel buttons
 * would (the real view nulls its callbacks on fire; this fake mirrors that
 * exactly-once contract).
 */
interface FakeActionConfirmation {
  isOpen: boolean;
  lastShow: ActionConfirmationOptions | null;
  show(opts: ActionConfirmationOptions): void;
  hide(): void;
  commit(): void;
  cancel(): void;
}

interface ActionConfirmationOptions {
  readonly title: string;
  readonly lines: readonly string[];
  readonly onCommit: () => void;
  readonly onCancel: () => void;
}

function makeFakeActionConfirmation(): FakeActionConfirmation {
  return {
    isOpen: false,
    lastShow: null,
    show(opts: ActionConfirmationOptions): void {
      this.lastShow = opts;
      this.isOpen = true;
    },
    hide(): void {
      this.isOpen = false;
    },
    commit(): void {
      const opts = this.lastShow;
      if (opts === null) return;
      this.lastShow = null;
      this.isOpen = false;
      opts.onCommit();
    },
    cancel(): void {
      const opts = this.lastShow;
      if (opts === null) return;
      this.lastShow = null;
      this.isOpen = false;
      opts.onCancel();
    },
  };
}

interface SelectionHarnessScene {
  onCardClick(cardId: string): void;
  onEndTurnClick(): void;
  onDiscardClick(cardId: string): void;
  navigateRow(row: "world" | "player", direction: -1 | 1): void;
  currentLegalTargetIds(): Set<string>;
  showTargetPreview(targetId: string): void;
  showIdleWorldPreview(card: WorldCard): void;
  showEndTurnPreview(): void;
  stepConnectorStyle(cardId: string, step: number): "progress" | "destroy" | "return" | null;
  sel: unknown;
  selectedCardSnapshot: PlayerCard | null;
  theme_: VisualTheme;
  game_: {
    state: GameState;
    dispatch(action: Action): void;
    preview(action: Action): ActionPreview;
  };
  runtime_: { userSettings: { get(): UserSettings } };
  actionConfirmation: FakeActionConfirmation;
  previewSlot: {
    text: string;
    visible: boolean;
    tint: string;
    setText(text: string): void;
    setVisible(visible: boolean): void;
    setY(y: number): void;
    setTint(tint: string): void;
    getBgHeight(): number;
  };
  drawAll(): void;
  clearConnector(): void;
  clearPreviewSlot(): void;
  dismissModal(): void;
  dispatch(action: Action): void;
}

// Default to "off" so existing tests exercise the direct-dispatch path on
// selection completion. Phase 9 confirmation tests set the mode they need.
const DEFAULT_HARNESS_SETTINGS: UserSettings = {
  version: 2,
  confirmationMode: "off",
  detailedHoverPreviews: true,
  musicVolume: 1.0,
  fxVolume: 0.5,
  masterMute: false,
};

function makeSelectionHarness(
  state: GameState,
  settings: UserSettings = DEFAULT_HARNESS_SETTINGS,
): {
  scene: SelectionHarnessScene;
  drawCount: () => number;
  dispatched: () => Action[];
} {
  const scene = Object.create(TableScene.prototype) as SelectionHarnessScene;
  let draws = 0;
  const dispatched: Action[] = [];
  scene.game_ = {
    state,
    dispatch(action: Action): void {
      dispatched.push(action);
    },
    // Real unified preview against the shared catalog, so hover previews exercise
    // the same engine the confirmation flow uses. Reads scene.game_.state each
    // call so tests can swap the live state after selection begins.
    preview(action: Action): ActionPreview {
      return previewAction(coreCatalog, scene.game_.state, action);
    },
  };
  scene.runtime_ = { userSettings: { get: () => settings } };
  scene.actionConfirmation = makeFakeActionConfirmation();
  scene.sel = { phase: "idle" };
  scene.selectedCardSnapshot = null;
  (scene as typeof scene & { hoveredCardId: string | null }).hoveredCardId = null;
  (scene as typeof scene & { cardObjects: Map<string, unknown> }).cardObjects = new Map();
  // Mirror production: the scene picks its theme from the run's world so
  // severity tinting (which reads theme_.intrusionHue / realityPalette.cancel)
  // has a real palette to resolve against.
  scene.theme_ = selectTheme(state.worldId);
  // Faithful stand-in for the CommonLabel previewSlot: records the surface
  // showPreviewSlot drives (text/visibility/tint) and answers the geometry
  // query it makes (getBgHeight) so positioning does not throw.
  scene.previewSlot = {
    text: "",
    visible: false,
    tint: "#FFFFFF",
    setText(text: string): void {
      this.text = text;
    },
    setVisible(visible: boolean): void {
      this.visible = visible;
    },
    setY(): void {},
    setTint(tint: string): void {
      this.tint = tint;
    },
    getBgHeight(): number {
      return 0;
    },
  };
  scene.drawAll = () => {
    draws += 1;
  };
  scene.clearConnector = () => {};
  scene.clearPreviewSlot = () => {
    scene.previewSlot.setText("");
    scene.previewSlot.setVisible(false);
  };
  scene.dismissModal = () => {};
  scene.dispatch = (action: Action) => {
    scene.game_.dispatch(action);
    scene.sel = { phase: "idle" };
  };
  return { scene, drawCount: () => draws, dispatched: () => [...dispatched] };
}

describe("TableScene selected effective card snapshots", () => {
  it("starts selection from an effective appended target step while the base card stays no-target", () => {
    const survey = makePlayerCard({
      id: "survey-1",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "None" },
      energyCost: 0,
    });
    const hazard = makeWorldCard({ id: "hazard-1", discardable: false });
    const state = makeCoreState({
      hand: [survey, hazard],
      energy: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("survey-progress", "Survey", [
            { kind: "appendEffect", effect: { kind: "DealProgress", base: 1 } },
          ]),
        ],
      },
    });
    const { scene, drawCount } = makeSelectionHarness(state);

    scene.onCardClick(survey.id);

    expect(drawCount()).toBe(1);
    expect(scene.selectedCardSnapshot?.id).toBe(survey.id);
    expect(survey.effect).toEqual({ kind: "None" });
    expect(scene.selectedCardSnapshot?.effect).toEqual({
      kind: "Sequence",
      steps: [{ kind: "None" }, { kind: "DealProgress", base: 1 }],
    });
    expect(scene.sel).toMatchObject({
      phase: "targeting",
      cardId: survey.id,
      stepIdx: 1,
      steps: [{ kind: "none" }, { kind: "hazard" }],
    });
  });

  it("brings the acting player card into the player row window before targeting repaints", () => {
    const survey = makePlayerCard({
      id: "survey-window",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "DealProgress", base: 1 },
      energyCost: 0,
    });
    const extraPlayers = Array.from({ length: 6 }, (_, i) =>
      makePlayerCard({
        id: `extra-player-${i + 1}`,
        templateId: "Extra",
        name: "Extra",
        effect: { kind: "None" },
        energyCost: 0,
      }),
    );
    const hazard = makeWorldCard({ id: "hazard-window", discardable: false });
    const state = makeCoreState({
      hand: [survey, ...extraPlayers, hazard],
      energy: 0,
    });
    const { scene, drawCount } = makeSelectionHarness(state);
    const windowedScene = scene as typeof scene & { playerRowOffset: number };
    windowedScene.playerRowOffset = 2;

    scene.onCardClick(survey.id);

    expect(drawCount()).toBe(1);
    expect(windowedScene.playerRowOffset).toBe(0);
    expect(scene.sel).toMatchObject({
      phase: "targeting",
      cardId: survey.id,
    });
  });

  it("keeps off-window player cards in hand and playable after row navigation", () => {
    const players = Array.from({ length: 23 }, (_, i) =>
      makePlayerCard({
        id: `off-window-player-${i + 1}`,
        templateId: "OffWindow",
        name: "Off Window",
        effect: { kind: "None" },
        energyCost: 0,
      }),
    );
    const state = makeCoreState({
      hand: players,
      energy: 0,
    });
    const harness = makeDrawAllHarness(state);
    const scene = harness.scene as typeof harness.scene & {
      game_: { state: GameState };
      playerRowOffset: number;
    };
    const target = players[5]!;

    harness.scene.drawAll();

    expect(scene.playerRowOffset).toBe(0);
    expect(scene.game_.state.hand.map((card) => card.id)).toContain(target.id);
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      players.slice(0, 5).map((card) => card.id),
    );
    expect(scene.cardObjects.has(target.id)).toBe(false);

    const beforeNavHandIds = scene.game_.state.hand.map((card) => card.id);
    scene.navigateRow("player", 1);

    expect(scene.playerRowOffset).toBe(5);
    expect(scene.game_.state.hand.map((card) => card.id)).toEqual(beforeNavHandIds);
    expect(scene.game_.state.hand.map((card) => card.id)).toContain(target.id);
    expect(harness.playerRows.at(-1)?.map((card) => card.id)).toEqual(
      players.slice(5, 10).map((card) => card.id),
    );
    const targetView = scene.cardObjects.get(target.id);
    expect(targetView).toBeInstanceOf(CardView);

    targetView!.emit("pointerdown");

    expect(scene.game_.state.hand.map((card) => card.id)).not.toContain(target.id);
    expect(scene.game_.state.playerDiscard.map((card) => card.id)).toContain(target.id);
    expect(scene.cardObjects.has(target.id)).toBe(false);
  });

  it("keeps an effective appended target step highlightable and clickable after live state loses the modifier", () => {
    const survey = makePlayerCard({
      id: "survey-stable",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "None" },
      energyCost: 0,
    });
    const hazard = makeWorldCard({ id: "hazard-stable", discardable: false });
    const modifiedState = makeCoreState({
      hand: [survey, hazard],
      energy: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("survey-progress-stable", "Survey", [
            { kind: "appendEffect", effect: { kind: "DealProgress", base: 1 } },
          ]),
        ],
      },
    });
    const { scene, dispatched } = makeSelectionHarness(modifiedState);

    scene.onCardClick(survey.id);
    scene.game_.state = makeCoreState({
      hand: [survey, hazard],
      energy: 0,
      runModifiers: DEFAULT_RUN_MODIFIERS,
    });

    expect(scene.currentLegalTargetIds()).toEqual(new Set([hazard.id]));

    scene.onCardClick(hazard.id);

    expect(dispatched()).toEqual([
      {
        type: "PlayCard",
        cardId: survey.id,
        targetId: hazard.id,
      },
    ]);
  });

  it("previews hazard progress from the selected effective snapshot via the unified engine", () => {
    const survey = makePlayerCard({
      id: "survey-preview",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "None" },
      energyCost: 0,
    });
    const hazard = makeWorldCard({
      id: "hazard-preview",
      name: "Deep Hazard",
      cost: 3,
      discardable: false,
    });
    const state = makeCoreState({
      hand: [survey, hazard],
      energy: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("survey-preview-progress", "Survey", [
            { kind: "appendEffect", effect: { kind: "DealProgress", base: 2 } },
          ]),
        ],
      },
    });
    const { scene } = makeSelectionHarness(state);

    scene.onCardClick(survey.id);
    scene.showTargetPreview(hazard.id);

    // The unified summary surfaces the same information the legacy previewPlay
    // gave: the Progress amount and the running total against cost (2/3, so it
    // does not yet clear). The previewed action resolves through the live
    // effective card (base 2 from the modifier), so the math reflects the
    // modifier exactly as a real dispatch would.
    expect(scene.previewSlot.visible).toBe(true);
    expect(scene.previewSlot.text).toContain("Make 2 Progress on Deep Hazard");
    expect(scene.previewSlot.text).toContain("(2/3)");
  });

  it("previews a clear when the play meets the hazard cost", () => {
    const survey = makePlayerCard({
      id: "survey-clear",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "None" },
      energyCost: 0,
    });
    const hazard = makeWorldCard({
      id: "hazard-clear",
      name: "Shallow Hazard",
      cost: 2,
      discardable: false,
    });
    const state = makeCoreState({
      hand: [survey, hazard],
      energy: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("survey-clear-progress", "Survey", [
            { kind: "appendEffect", effect: { kind: "DealProgress", base: 2 } },
          ]),
        ],
      },
    });
    const { scene } = makeSelectionHarness(state);

    scene.onCardClick(survey.id);
    scene.showTargetPreview(hazard.id);

    expect(scene.previewSlot.visible).toBe(true);
    expect(scene.previewSlot.text).toContain("Clear Shallow Hazard");
  });

  it("clears the preview on hover-out and on cancel", () => {
    const survey = makePlayerCard({
      id: "survey-clearing",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "None" },
      energyCost: 0,
    });
    const hazard = makeWorldCard({
      id: "hazard-clearing",
      name: "Clearing Hazard",
      cost: 3,
      discardable: false,
    });
    const state = makeCoreState({
      hand: [survey, hazard],
      energy: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("survey-clearing-progress", "Survey", [
            { kind: "appendEffect", effect: { kind: "DealProgress", base: 1 } },
          ]),
        ],
      },
    });
    const { scene } = makeSelectionHarness(state);

    scene.onCardClick(survey.id);
    scene.showTargetPreview(hazard.id);
    expect(scene.previewSlot.visible).toBe(true);

    // Hover-out and cancel both reset the slot through clearPreviewSlot.
    scene.clearPreviewSlot();
    expect(scene.previewSlot.visible).toBe(false);
    expect(scene.previewSlot.text).toBe("");
  });

  it("trims to a minimal preview when detailedHoverPreviews is off but keeps the concealment warning", () => {
    // Clearing the visible hazard fires its onCleared (DealProgressAll), which
    // touches the concealed hazard sitting in hand. The unified preview then
    // surfaces a concealment warning alongside the visible clear line. With the
    // detailed setting off we keep only the first substantive line plus the
    // concealment warning — the warning must never be trimmed away.
    const survey = makePlayerCard({
      id: "survey-conceal",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "DealProgress", base: 1 },
      energyCost: 0,
    });
    const visible = makeWorldCard({
      id: "hazard-visible",
      name: "Visible Hazard",
      cost: 1,
      discardable: false,
      onCleared: { kind: "DealProgressAll", base: 1 },
    });
    const concealed = makeWorldCard({
      id: "hazard-concealed",
      name: "Concealed Hazard",
      cost: 5,
      discardable: false,
      keywords: [{ name: "Concealed", value: 3 }],
    });
    const state = makeCoreState({
      hand: [survey, visible, concealed],
      energy: 0,
      light: 0, // 0 < 3 → the concealed hazard stays hidden
    });
    const { scene } = makeSelectionHarness(state, {
      version: 2,
      confirmationMode: "always",
      detailedHoverPreviews: false,
      musicVolume: 1.0,
      fxVolume: 0.5,
      masterMute: false,
    });

    scene.onCardClick(survey.id);
    // Hover the VISIBLE hazard (concealed cards are never legal hazard targets).
    scene.showTargetPreview(visible.id);

    expect(scene.previewSlot.visible).toBe(true);
    // The concealment warning survives the off-mode trim.
    expect(scene.previewSlot.text).toContain("concealed");
    // Minimal mode keeps only the first substantive line plus concealment
    // warnings: the visible clear detail line is trimmed away.
    expect(scene.previewSlot.text).not.toContain("Clear Visible Hazard");
    // The leading substantive consequence line is still present.
    expect(scene.previewSlot.text).toContain("Make 1 total Progress");

    // For contrast, the SAME hover with detailed previews on keeps the clear line.
    const detailed = makeSelectionHarness(
      makeCoreState({
        hand: [survey, visible, concealed],
        energy: 0,
        light: 0,
      }),
    );
    detailed.scene.onCardClick(survey.id);
    detailed.scene.showTargetPreview(visible.id);
    expect(detailed.scene.previewSlot.text).toContain("Clear Visible Hazard");
    expect(detailed.scene.previewSlot.text).toContain("concealed");
  });

  it("styles connectors from appended progress, return, and destroy steps on the selected effective snapshot", () => {
    const progressCard = makePlayerCard({
      id: "survey-progress-connector",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "None" },
      energyCost: 0,
    });
    const progressHazard = makeWorldCard({ id: "hazard-progress-connector", discardable: false });
    const progressState = makeCoreState({
      hand: [progressCard, progressHazard],
      energy: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("survey-progress-step", "Survey", [
            { kind: "appendEffect", effect: { kind: "DealProgress", base: 1 } },
          ]),
        ],
      },
    });
    const progressHarness = makeSelectionHarness(progressState);

    progressHarness.scene.onCardClick(progressCard.id);
    progressHarness.scene.game_.state = makeCoreState({
      hand: [progressCard, progressHazard],
      energy: 0,
      runModifiers: DEFAULT_RUN_MODIFIERS,
    });

    expect(progressHarness.scene.stepConnectorStyle(progressCard.id, 1)).toBe("progress");

    const returnCard = makePlayerCard({
      id: "survey-return",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "None" },
      energyCost: 0,
    });
    const hazard = makeWorldCard({ id: "hazard-return", discardable: false });
    const returnState = makeCoreState({
      hand: [returnCard, hazard],
      energy: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("survey-return-step", "Survey", [
            { kind: "appendEffect", effect: { kind: "ReturnWorldCards", min: 1, max: 1 } },
          ]),
        ],
      },
    });
    const returnHarness = makeSelectionHarness(returnState);

    returnHarness.scene.onCardClick(returnCard.id);
    returnHarness.scene.game_.state = makeCoreState({
      hand: [returnCard, hazard],
      energy: 0,
      runModifiers: DEFAULT_RUN_MODIFIERS,
    });

    expect(returnHarness.scene.stepConnectorStyle(returnCard.id, 1)).toBe("return");

    const destroyCard = makePlayerCard({
      id: "survey-destroy",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "None" },
      energyCost: 0,
    });
    const targetCard = makePlayerCard({
      id: "target-destroy",
      templateId: "Target",
      name: "Target",
      energyCost: 0,
    });
    const destroyState = makeCoreState({
      hand: [destroyCard, targetCard],
      energy: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("survey-destroy-step", "Survey", [
            { kind: "appendEffect", effect: { kind: "DestroyCardInHand", min: 1, max: 1 } },
          ]),
        ],
      },
    });
    const destroyHarness = makeSelectionHarness(destroyState);

    destroyHarness.scene.onCardClick(destroyCard.id);
    destroyHarness.scene.game_.state = makeCoreState({
      hand: [destroyCard, targetCard],
      energy: 0,
      runModifiers: DEFAULT_RUN_MODIFIERS,
    });

    expect(destroyHarness.scene.stepConnectorStyle(destroyCard.id, 1)).toBe("destroy");
  });

  it("clears the selected card snapshot when a modal is dismissed", () => {
    const survey = makePlayerCard({ id: "survey-modal", templateId: "Survey" });
    const scene = Object.create(TableScene.prototype) as {
      selectedCardSnapshot: PlayerCard | null;
      modalChooser: { destroy(): void } | null;
      dismissModal(): void;
    };
    let destroyed = 0;
    scene.selectedCardSnapshot = survey;
    scene.modalChooser = {
      destroy(): void {
        destroyed += 1;
      },
    };

    scene.dismissModal();

    expect(destroyed).toBe(1);
    expect(scene.modalChooser).toBeNull();
    expect(scene.selectedCardSnapshot).toBeNull();
  });

  it("preserves the selected effective snapshot after choosing a modal branch", () => {
    const tactic = makePlayerCard({
      id: "tactic-modal",
      templateId: "Tactical Choice",
      name: "Tactical Choice",
      effect: {
        kind: "Modal",
        branches: [{ kind: "DealProgress", base: 1 }],
      },
    });
    const effectiveTactic: PlayerCard = {
      ...tactic,
      effect: {
        kind: "Modal",
        branches: [{ kind: "DealProgress", base: 2 }],
      },
    };
    const scene = Object.create(TableScene.prototype) as {
      selectedCardSnapshot: PlayerCard | null;
      modalChooser: { destroy(): void } | null;
      game_: { state: GameState };
      sel: unknown;
      actionConfirmation: { isOpen: boolean };
      onModalChoose(spec: Extract<TargetSpec, { kind: "modal" }>, idx: number): void;
      drawAll(): void;
      clearSelectedCardSnapshot(): void;
      dismissModal(clearSnapshot?: boolean): void;
      clearConnector(): void;
    };
    let destroyed = 0;
    let draws = 0;
    scene.game_ = { state: makeCoreState({ hand: [tactic], pendingBoonChoices: [] }) };
    scene.actionConfirmation = { isOpen: false };
    scene.sel = { phase: "awaiting-modal", cardId: tactic.id };
    scene.selectedCardSnapshot = effectiveTactic;
    scene.modalChooser = {
      destroy(): void {
        destroyed += 1;
      },
    };
    scene.drawAll = () => {
      draws += 1;
    };
    scene.clearConnector = () => {};

    scene.onModalChoose({ kind: "modal", branches: [{ kind: "hazard" }] }, 0);

    expect(destroyed).toBe(1);
    expect(draws).toBe(1);
    expect(scene.modalChooser).toBeNull();
    expect(scene.selectedCardSnapshot).toBe(effectiveTactic);
    expect(scene.sel).toMatchObject({
      phase: "targeting",
      cardId: tactic.id,
      choice: 0,
      steps: [{ kind: "hazard" }],
    });
  });

  it("presents a nested modal step from an effective appended target effect and completes after the branch choice", () => {
    const choiceCard = makePlayerCard({
      id: "choice-with-rider",
      templateId: "Choice With Rider",
      name: "Choice With Rider",
      effect: {
        kind: "Modal",
        branches: [
          { kind: "GainEnergy", amount: 1 },
          { kind: "Draw", player: 1 },
        ],
      },
      energyCost: 0,
    });
    const hazard = makeWorldCard({ id: "nested-modal-hazard", discardable: false });
    const state = makeCoreState({
      hand: [choiceCard, hazard],
      energy: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("choice-rider-progress", "Choice With Rider", [
            { kind: "appendEffect", effect: { kind: "DealProgress", base: 1 } },
          ]),
        ],
      },
    });
    const { scene, dispatched } = makeSelectionHarness(state);
    const modalSpecs: Extract<TargetSpec, { kind: "modal" }>[] = [];
    const snapshots: PlayerCard[] = [];
    const modalScene = scene as typeof scene & {
      showModalChooser(snapshot: PlayerCard, spec: Extract<TargetSpec, { kind: "modal" }>): void;
      onModalChoose(spec: Extract<TargetSpec, { kind: "modal" }>, idx: number): void;
    };
    modalScene.showModalChooser = (snapshot, spec) => {
      snapshots.push(snapshot);
      modalSpecs.push(spec);
    };

    scene.onCardClick(choiceCard.id);

    expect(modalSpecs).toEqual([{ kind: "modal", branches: [{ kind: "none" }, { kind: "none" }] }]);
    expect(snapshots[0]?.effect).toEqual({
      kind: "Sequence",
      steps: [choiceCard.effect, { kind: "DealProgress", base: 1 }],
    });
    expect(scene.sel).toMatchObject({
      phase: "targeting",
      cardId: choiceCard.id,
      stepIdx: 0,
      steps: [
        { kind: "modal", branches: [{ kind: "none" }, { kind: "none" }] },
        { kind: "hazard" },
      ],
    });

    modalScene.onModalChoose(modalSpecs[0]!, 0);

    expect(scene.sel).toMatchObject({
      phase: "targeting",
      cardId: choiceCard.id,
      choice: 0,
      stepIdx: 1,
      steps: [{ kind: "none" }, { kind: "hazard" }],
    });
    expect(scene.currentLegalTargetIds()).toEqual(new Set([hazard.id]));

    scene.onCardClick(hazard.id);

    expect(dispatched()).toEqual([
      {
        type: "PlayCard",
        cardId: choiceCard.id,
        choice: 0,
        targetId: hazard.id,
      },
    ]);
  });

  it("clears connectors when an endpoint is off-window and draws again once both endpoints are visible", () => {
    const acting = makePlayerCard({
      id: "connector-acting",
      templateId: "Connector",
      name: "Connector",
      effect: { kind: "DealProgress", base: 1 },
      energyCost: 0,
    });
    const target = makeWorldCard({ id: "connector-target", discardable: false });
    const gfx = {
      clears: 0,
      lines: 0,
      clear(): void {
        this.clears += 1;
      },
      lineStyle(): void {},
      lineBetween(): void {
        this.lines += 1;
      },
    };
    const scene = Object.create(TableScene.prototype) as {
      sel: unknown;
      cardObjects: Map<string, { x: number; y: number }>;
      connectorGfx: typeof gfx;
      theme_: VisualTheme;
      pileLayer: { worldPileCenter(): { x: number; y: number } };
      currentLegalTargetIds(): Set<string>;
      stepConnectorStyle(): "progress";
      showConnector(targetId: string): void;
    };
    scene.sel = {
      phase: "targeting",
      cardId: acting.id,
      steps: [{ kind: "hazard" }],
      stepIdx: 0,
      done: [],
      current: [],
    };
    scene.cardObjects = new Map([[target.id, { x: 300, y: 180 }]]);
    scene.connectorGfx = gfx;
    scene.theme_ = selectTheme("zombie-big-box");
    scene.pileLayer = { worldPileCenter: () => ({ x: 0, y: 0 }) };
    scene.currentLegalTargetIds = () => new Set([target.id]);
    scene.stepConnectorStyle = () => "progress";

    scene.showConnector(target.id);

    expect(gfx.clears).toBe(1);
    expect(gfx.lines).toBe(0);

    scene.cardObjects.set(acting.id, { x: 100, y: 460 });
    scene.showConnector(target.id);

    expect(gfx.clears).toBe(2);
    expect(gfx.lines).toBe(1);
  });
});

describe("updateCostRing", () => {
  it("no-ops on a container without a costRing (player card)", () => {
    const { scene, captured } = makeFakeScene();
    // No throw, no tween.
    makeCardView(scene).updateCostRing(0.5, RING_ACCENT);
    expect(captured.length).toBe(0);
  });

  it("snaps (no tween) on first render and records the displayed fraction", () => {
    const { ring, graphics } = makeFakeRing();
    const { scene, captured, callLog } = makeFakeScene();
    makeCardView(scene, graphics).updateCostRing(0.5, RING_ACCENT);

    expect(captured.length).toBe(0); // snapped, did not animate
    expect(callLog).not.toContain("add"); // snap never adds a tween
    expect(ring.displayedFraction).toBe(0.5);
    expect(ring.arcs.at(-1)).toBeCloseTo(0.5, 5);
  });

  it("is idempotent: a repeated identical target does not start a tween", () => {
    const { ring, graphics } = makeFakeRing();
    const { scene, captured, callLog } = makeFakeScene();
    const view = makeCardView(scene, graphics);
    view.updateCostRing(0.5, RING_ACCENT); // first: snap
    view.updateCostRing(0.5, RING_ACCENT); // same target

    expect(captured.length).toBe(0);
    expect(callLog).not.toContain("add"); // idempotent repeat never adds a tween
    expect(ring.displayedFraction).toBe(0.5);
  });

  it("animates (kills then adds) when the target differs, targeting the ring object", () => {
    const { ring, graphics } = makeFakeRing();
    const fake = makeFakeScene();
    const view = makeCardView(fake.scene, graphics);
    view.updateCostRing(0.25, RING_ACCENT); // snap to 0.25
    view.updateCostRing(0.75, RING_ACCENT); // animate up

    expect(fake.kills).toBe(1);
    expect(fake.captured.length).toBe(1);
    // The kill-before-add contract: the in-flight tween must be cancelled
    // before the new one is added. This fails if production reorders `add`
    // ahead of `killTweensOf`.
    expect(fake.callLog).toEqual(["kill", "add"]);
    expect(fake.callLog.indexOf("kill")).toBeLessThan(fake.callLog.indexOf("add"));
    const t = nthTween(fake.captured, 0);
    // Must target the ring Graphics itself so the S3 destruction pass
    // (killTweensOf(container.list)) can cancel it before destroy.
    expect(t.targets).toBe(graphics);
    expect(t.displayedFraction).toBe(0.75);
    // displayed fraction is still the pre-tween value until the tween runs.
    expect(ring.displayedFraction).toBe(0.25);
  });

  it("fill and drain use the same duration and easing (one clock)", () => {
    const { graphics } = makeFakeRing();
    const fake = makeFakeScene();
    const view = makeCardView(fake.scene, graphics);
    view.updateCostRing(0, RING_ACCENT); // snap to 0
    view.updateCostRing(1, RING_ACCENT); // fill 0 -> 1
    // Simulate the fill tween finishing (real Phaser advances displayedFraction
    // to the target); only then does the next cycle see a different displayed
    // value to drain from.
    nthTween(fake.captured, 0).onComplete();
    view.updateCostRing(0, RING_ACCENT); // drain 1 -> 0

    expect(fake.captured.length).toBe(2);
    const fill = nthTween(fake.captured, 0);
    const drain = nthTween(fake.captured, 1);
    expect(fill.duration).toBe(drain.duration);
    expect(fill.ease).toBe(drain.ease);
    expect(fill.displayedFraction).toBe(1);
    expect(drain.displayedFraction).toBe(0);
  });

  it("onUpdate redraws the arc at the current displayed fraction", () => {
    const { ring, graphics } = makeFakeRing();
    const fake = makeFakeScene();
    const view = makeCardView(fake.scene, graphics);
    view.updateCostRing(0, RING_ACCENT);
    view.updateCostRing(1, RING_ACCENT);
    const t = nthTween(fake.captured, 0);

    // Simulate the tween engine advancing the property and ticking onUpdate.
    ring.displayedFraction = 0.4;
    t.onUpdate();
    expect(ring.arcs.at(-1)).toBeCloseTo(0.4, 5);
  });

  it("onComplete settles exactly on target", () => {
    const { ring, graphics } = makeFakeRing();
    const fake = makeFakeScene();
    const view = makeCardView(fake.scene, graphics);
    view.updateCostRing(0, RING_ACCENT);
    view.updateCostRing(1, RING_ACCENT);
    const t = nthTween(fake.captured, 0);

    // Float drift mid-tween, then complete: must land exactly on target.
    ring.displayedFraction = 0.999_7;
    t.onComplete();
    expect(ring.displayedFraction).toBe(1);
    expect(ring.arcs.at(-1)).toBeCloseTo(1, 5);
  });
});

// ---------------------------------------------------------------------------
// CardView emphasize / clearEmphasis — hover-target emphasis (S9)
//
// The methods touch a tiny Phaser surface: view.setScale / .add, plus a
// glow Graphics' draw methods. We fake both so the lift-and-glow logic (scale
// > 1, glow alpha scaled by intensity, idempotence, restore-to-base) is tested
// without a real Phaser runtime.
// ---------------------------------------------------------------------------

const GLOW_COLOR = 0x88ffaa;

interface FakeGlow {
  alphas: number[];
  clears: number;
  visible: boolean;
}

/** A fake glow Graphics recording stroke alpha, clears, and visibility. */
function makeFakeGlow(): { state: FakeGlow; graphics: unknown } {
  const state: FakeGlow = { alphas: [], clears: 0, visible: false };
  const graphics = {
    clear(): void {
      state.clears += 1;
    },
    lineStyle(_width: number, _color: number, alpha: number): void {
      state.alphas.push(alpha);
    },
    strokeRoundedRect(): void {},
    setVisible(v: boolean): unknown {
      state.visible = v;
      return graphics;
    },
  };
  return { state, graphics };
}

/**
 * A fake CardView: records scale, captures added children, and exposes the
 * mutable `targetGlow`/`emphasized` props the method stamps on it. `scene.add.graphics`
 * returns the supplied fake glow so the test can inspect what was drawn.
 */
interface EmphasisCardViewFake {
  scene: unknown;
  scale: number;
  targetGlow: unknown;
  emphasized: boolean | undefined;
  added: unknown[];
  setScale(v: number): unknown;
  add(child: unknown): unknown;
  emphasize: CardView["emphasize"];
  clearEmphasis: CardView["clearEmphasis"];
}

function makeFakeEmphasisCardView(glow: unknown): { view: EmphasisCardViewFake } {
  const view = Object.create(CardView.prototype) as EmphasisCardViewFake;
  Object.assign(view, {
    scale: 1,
    added: [] as unknown[],
    targetGlow: undefined as unknown,
    emphasized: undefined as boolean | undefined,
    setScale(v: number): unknown {
      view.scale = v;
      return view;
    },
    add(child: unknown): unknown {
      view.added.push(child);
      return view;
    },
  });
  const scene = { add: { graphics: (): unknown => glow } };
  Object.defineProperty(view, "scene", { value: scene });
  return { view };
}

describe("CardView emphasize / clearEmphasis", () => {
  it("lifts the card (scale > 1) and draws a glow when emphasized", () => {
    const { state: glow, graphics } = makeFakeGlow();
    const { view } = makeFakeEmphasisCardView(graphics);
    view.emphasize(GLOW_COLOR, 0.5);

    expect(view.scale).toBeGreaterThan(1);
    expect(view.emphasized).toBe(true);
    expect(view.targetGlow).toBe(graphics); // glow stored on the view
    expect(view.added).toContain(graphics); // appended as a child
    expect(glow.visible).toBe(true);
    expect(glow.alphas.at(-1)).toBeGreaterThan(0);
  });

  it("scales glow alpha AND lift by intensity (loud at 1, calm-but-visible at 0)", () => {
    const low = makeFakeGlow();
    const lowC = makeFakeEmphasisCardView(low.graphics);
    lowC.view.emphasize(GLOW_COLOR, 0);

    const high = makeFakeGlow();
    const highC = makeFakeEmphasisCardView(high.graphics);
    highC.view.emphasize(GLOW_COLOR, 1);

    // Higher intensity → larger lift and brighter glow.
    expect(highC.view.scale).toBeGreaterThan(lowC.view.scale);
    expect(high.state.alphas.at(-1)!).toBeGreaterThan(low.state.alphas.at(-1)!);
    // Even at intensity 0 the emphasis is clearly on (scale > 1, alpha > 0).
    expect(lowC.view.scale).toBeGreaterThan(1);
    expect(low.state.alphas.at(-1)!).toBeGreaterThan(0);
  });

  it("is idempotent: re-emphasizing an already-emphasized card does not redraw", () => {
    const { state: glow, graphics } = makeFakeGlow();
    const { view } = makeFakeEmphasisCardView(graphics);
    view.emphasize(GLOW_COLOR, 1);
    const drawsAfterFirst = glow.alphas.length;
    view.emphasize(GLOW_COLOR, 1); // same call again
    expect(glow.alphas.length).toBe(drawsAfterFirst); // no second draw → no jitter
  });

  it("clearEmphasis restores base transform (scale 1, glow hidden/cleared)", () => {
    const { state: glow, graphics } = makeFakeGlow();
    const { view } = makeFakeEmphasisCardView(graphics);
    view.emphasize(GLOW_COLOR, 1);
    const clearsBefore = glow.clears;

    view.clearEmphasis();
    expect(view.scale).toBe(1);
    expect(view.emphasized).toBe(false);
    expect(glow.visible).toBe(false);
    expect(glow.clears).toBeGreaterThan(clearsBefore); // glow was cleared
  });

  it("clearEmphasis is safe on a never-emphasized view (no glow)", () => {
    const { view } = makeFakeEmphasisCardView(makeFakeGlow().graphics);
    view.clearEmphasis(); // never emphasized → targetGlow undefined
    expect(view.scale).toBe(1);
    expect(view.emphasized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CardView applyHighlight — named highlight rectangle styling (S10 'committed' kind)
//
// applyHighlight touches only the named overlay rectangle's setStrokeStyle /
// setFillStyle. We also provide a fake `list[1]` guard so the per-kind styling
// (and the committed-fill reset) is tested
// without a real Phaser runtime.
// ---------------------------------------------------------------------------

interface FakeRect {
  strokeWidth: number;
  strokeColor: number;
  fillColor: number;
  fillAlpha: number;
}

interface HighlightCardViewFake {
  highlightRect: unknown;
  list: unknown[];
  // Pre-initialized so applyHighlight's badge guard short-circuits for non-picked
  // kinds without needing a scene stub. Tests that need badge behaviour use
  // makeFakePickBadgeView instead.
  pickedNow: boolean | undefined;
  pickBadge: unknown;
  applyHighlight: CardView["applyHighlight"];
}

function makeFakeHighlightCardView(): {
  view: HighlightCardViewFake;
  rect: FakeRect;
  listRect: FakeRect;
} {
  const rect: FakeRect = { strokeWidth: 0, strokeColor: 0, fillColor: 0x000000, fillAlpha: 0 };
  const rectObj = {
    setStrokeStyle(width: number, color?: number): unknown {
      rect.strokeWidth = width;
      rect.strokeColor = color ?? 0;
      return rectObj;
    },
    setFillStyle(color: number, alpha?: number): unknown {
      rect.fillColor = color;
      rect.fillAlpha = alpha ?? 1;
      return rectObj;
    },
  };
  const listRect: FakeRect = { strokeWidth: 0, strokeColor: 0, fillColor: 0x000000, fillAlpha: 0 };
  const listRectObj = {
    setStrokeStyle(width: number, color?: number): unknown {
      listRect.strokeWidth = width;
      listRect.strokeColor = color ?? 0;
      return listRectObj;
    },
    setFillStyle(color: number, alpha?: number): unknown {
      listRect.fillColor = color;
      listRect.fillAlpha = alpha ?? 1;
      return listRectObj;
    },
  };
  const noopBadge = {
    setVisible(): unknown {
      return noopBadge;
    },
  };
  const view = Object.create(CardView.prototype) as HighlightCardViewFake;
  view.highlightRect = rectObj;
  // If CardView regresses to list[1], these assertions will see listRect mutate.
  view.list = [{}, listRectObj];
  // Pre-set so the badge guard skips for non-picked kinds (existing tests
  // don't care about the badge; the full badge behaviour is in makeFakePickBadgeView).
  view.pickedNow = false;
  view.pickBadge = noopBadge;
  return { view, rect, listRect };
}

describe("CardView applyHighlight 'committed' kind", () => {
  const fs = selectTheme("zombie-big-box").frameStyle;

  it("strokes the highlightRect with the muted committedTarget colour, not the bright target border", () => {
    const { view, rect } = makeFakeHighlightCardView();
    view.applyHighlight("committed", fs);
    expect(rect.strokeColor).toBe(fs.committedTarget);
    expect(rect.strokeColor).not.toBe(fs.targetBorder); // visually distinct from a live legal target
    expect(rect.strokeWidth).toBeGreaterThan(0);
  });

  it("adds a faint committedTarget fill so the mark reads as steady/settled", () => {
    const { view, rect } = makeFakeHighlightCardView();
    view.applyHighlight("committed", fs);
    expect(rect.fillColor).toBe(fs.committedTarget);
    expect(rect.fillAlpha).toBeGreaterThan(0);
    expect(rect.fillAlpha).toBeLessThan(1); // muted, not a solid block
  });

  it("clears any prior committed fill when re-applied as another kind (no stale tint)", () => {
    const { view, rect } = makeFakeHighlightCardView();
    view.applyHighlight("committed", fs); // tints the fill
    view.applyHighlight("target", fs); // reused view, new state
    expect(rect.fillAlpha).toBe(0); // committed tint cleared
    expect(rect.strokeColor).toBe(fs.targetBorder);
  });

  it("'target' uses the bright targetBorder, distinct from committed", () => {
    const { view, rect } = makeFakeHighlightCardView();
    view.applyHighlight("target", fs);
    expect(rect.strokeColor).toBe(fs.targetBorder);
    expect(rect.fillAlpha).toBe(0); // legal-target border has no fill
  });

  it("uses the named highlightRect field instead of depending on list[1]", () => {
    const { view, rect, listRect } = makeFakeHighlightCardView();
    view.applyHighlight("target", fs);
    expect(rect.strokeColor).toBe(fs.targetBorder);
    expect(listRect.strokeWidth).toBe(0);
    expect(listRect.fillAlpha).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CardView surface methods
// ---------------------------------------------------------------------------

describe("CardView surface methods", () => {
  it("setDimmed pushes the dim alpha onto the view", () => {
    const view = Object.create(CardView.prototype) as CardView & {
      alpha: number;
      setAlpha(v: number): unknown;
    };
    view.alpha = 1;
    view.setAlpha = (v: number) => {
      view.alpha = v;
      return view;
    };

    view.setDimmed(true);
    expect(view.alpha).toBe(0.35);
    view.setDimmed(false);
    expect(view.alpha).toBe(1);
  });

  it("setCardPosition re-asserts the view position", () => {
    const view = Object.create(CardView.prototype) as CardView & {
      x: number;
      y: number;
      setPosition(x: number, y: number): unknown;
    };
    view.x = 0;
    view.y = 0;
    view.setPosition = (x: number, y: number) => {
      view.x = x;
      view.y = y;
      return view;
    };

    view.setCardPosition(123, 456);
    expect(view.x).toBe(123);
    expect(view.y).toBe(456);
  });
});

// ---------------------------------------------------------------------------
// CardView player-card keyword line (REQ-MALL-21)
//
// Unlike the surface-method tests above (which fake the CardView itself),
// these run the REAL constructor end-to-end with real minted player cards.
// The scene stub records every text object created (position, content, font
// size) so the tests can pin the keyword line to the exact offset and format
// the world face uses, and prove a keywordless card's layout is untouched.
// ---------------------------------------------------------------------------

/** A created text object as the scene stub tracked it. */
interface TrackedText {
  x: number;
  y: number;
  content: string;
  fontSize: string;
  color: string;
  visible: boolean;
}

/**
 * Minimal protocol a fake child must speak so the REAL Container.add
 * (addHandler) accepts it: a DESTROY listener hook plus display-list moves.
 * addHandler also stamps `parentContainer` on the child — the tests use that
 * stamp to find the effect-block containers CardView adopted.
 */
const childProtocol = {
  parentContainer: null as unknown,
  visible: true,
  interactive: false,
  once(): void {},
  off(): void {},
  on(): unknown {
    return this;
  },
  removeFromDisplayList(): void {},
  addedToScene(): void {},
  setInteractive(this: { interactive: boolean }): unknown {
    this.interactive = true;
    return this;
  },
  // CardView's fog-back toggles identity vs. fog via setVisible; every fake
  // child records the last value so the concealment tests can read it.
  setVisible(this: { visible: boolean }, v: boolean): unknown {
    this.visible = v;
    return this;
  },
};

function makeFakeText(
  x: number,
  y: number,
  content: string,
  style: { fontSize?: string; color?: string },
  sink: TrackedText[],
): unknown {
  const tracked: TrackedText = {
    x,
    y,
    content,
    fontSize: style.fontSize ?? "",
    color: style.color ?? "",
    visible: true,
  };
  sink.push(tracked);
  const text = {
    ...childProtocol,
    x,
    y,
    width: 40,
    height: 12,
    displayWidth: 40,
    // The fog-back toggles identity via setVisible; mirror it onto the tracked
    // record so the concealment tests can read each line's visibility.
    setVisible(v: boolean): unknown {
      tracked.visible = v;
      return text;
    },
    // Mirror the tracked content and colour so token assertions can read them
    // off the object a row container holds (addEffectLines never calls setText).
    get content(): string {
      return tracked.content;
    },
    get color(): string {
      return tracked.color;
    },
    setOrigin: (): unknown => text,
    setScale: (): unknown => text,
    setWordWrapWidth: (): unknown => text,
    setPosition(px: number, py: number): unknown {
      text.x = px;
      text.y = py;
      tracked.x = px;
      tracked.y = py;
      return text;
    },
    setText(s: string): unknown {
      tracked.content = s;
      return text;
    },
    // The real implementation wraps via canvas measurement; splitting on
    // explicit newlines is enough here because every string under test is
    // shorter than the wrap width.
    getWrappedText: (s: string): string[] => s.split("\n"),
    setAbove: (): unknown => text,
  };
  return text;
}

function makeFakeRect(x: number, y: number): unknown {
  const rect = {
    ...childProtocol,
    x,
    y,
    strokeWidth: 0,
    strokeColor: 0,
    setOrigin: (): unknown => rect,
    setRounded: (): unknown => rect,
    setAlpha: (): unknown => rect,
    setStrokeStyle(width: number, color?: number): unknown {
      rect.strokeWidth = width;
      rect.strokeColor = color ?? 0;
      return rect;
    },
    setFillStyle: (): unknown => rect,
  };
  return rect;
}

function makeFakeCircle(x: number, y: number): unknown {
  const circle = {
    ...childProtocol,
    x,
    y,
    setOrigin: (): unknown => circle,
    setStrokeStyle: (): unknown => circle,
    setFillStyle: (): unknown => circle,
  };
  return circle;
}

function makeFakeImage(x: number, y: number, textureKey: string): unknown {
  const img = {
    ...childProtocol,
    x,
    y,
    width: 10,
    height: 10,
    displayWidth: 10,
    displayHeight: 10,
    textureKey,
    setOrigin: (): unknown => img,
    setPosition(px: number, py: number): unknown {
      img.x = px;
      img.y = py;
      return img;
    },
    setDisplaySize(w: number, h: number): unknown {
      img.displayWidth = w;
      img.displayHeight = h;
      return img;
    },
    setScale(s: number): unknown {
      img.displayWidth = img.width * s;
      img.displayHeight = img.height * s;
      return img;
    },
  };
  return img;
}

/** A cost-ring Graphics stub: CardView only positions it during construction. */
function makeFakeGraphics(): unknown {
  const g = {
    ...childProtocol,
    setPosition: (): unknown => g,
    clear: (): unknown => g,
    lineStyle: (): unknown => g,
    strokeCircle: (): unknown => g,
    beginPath: (): unknown => g,
    arc: (): unknown => g,
    strokePath: (): unknown => g,
    // obtainPickBadge's circle draw calls (fillStyle/fillCircle/setAlpha) —
    // no-ops here since these tests assert on stroke colors, not pixels.
    fillStyle: (): unknown => g,
    fillCircle: (): unknown => g,
    setAlpha: (): unknown => g,
  };
  return g;
}

/**
 * A container the scene stub created — addEffectLines makes one per effect
 * block plus one per token row. The object IS its own tracking record: the
 * tests read position, children, and the destroyed flag straight off it.
 */
interface FakeContainer {
  parentContainer: unknown;
  x: number;
  y: number;
  scale: number;
  children: unknown[];
  destroyed: boolean;
  once(): void;
  off(): void;
  removeFromDisplayList(): void;
  addedToScene(): void;
  setPosition(x: number, y: number): unknown;
  setScale(s: number): unknown;
  add(child: unknown): unknown;
  destroy(): void;
}

function makeFakeContainer(sink: FakeContainer[]): FakeContainer {
  const container: FakeContainer = {
    ...childProtocol,
    x: 0,
    y: 0,
    scale: 1,
    children: [],
    destroyed: false,
    setPosition(x: number, y: number): unknown {
      container.x = x;
      container.y = y;
      return container;
    },
    setScale(s: number): unknown {
      container.scale = s;
      return container;
    },
    add(child: unknown): unknown {
      container.children.push(child);
      return container;
    },
    destroy(): void {
      container.destroyed = true;
    },
  };
  sink.push(container);
  return container;
}

type RenderScene = {
  sys: {
    queueDepthSort(): void;
    events: { once(): void; on(): void; off(): void };
    displayList: { add(): void; remove(): void; exists(): boolean };
    updateList: { add(): void; remove(): void };
    input: { enable(obj: unknown): void; disable(obj: unknown): void };
  };
  textures: { exists(): boolean };
  add: {
    existing(obj?: unknown): unknown;
    image(x: number, y: number, key: string): unknown;
    rectangle(x: number, y: number): unknown;
    circle(x: number, y: number): unknown;
    graphics(): unknown;
    container(): unknown;
    text(
      x: number,
      y: number,
      content: string,
      style: { fontSize?: string; color?: string },
    ): unknown;
  };
};

/** Scene stub satisfying the full CardView constructor (player and world cards). */
function makeRenderScene(): {
  scene: RenderScene;
  texts: TrackedText[];
  containers: FakeContainer[];
} {
  const texts: TrackedText[] = [];
  const containers: FakeContainer[] = [];
  const scene: RenderScene = {
    sys: {
      queueDepthSort(): void {},
      events: { once(): void {}, on(): void {}, off(): void {} },
      displayList: {
        add(): void {},
        remove(): void {},
        exists(): boolean {
          return false;
        },
      },
      updateList: { add(): void {}, remove(): void {} },
      input: {
        enable(obj: unknown): void {
          (obj as { interactive?: boolean }).interactive = true;
        },
        disable(obj: unknown): void {
          (obj as { interactive?: boolean }).interactive = false;
        },
      },
    },
    // addEffectLines lazily ensures the icon placeholder textures; claiming
    // every key exists skips canvas texture generation (a browser concern).
    textures: { exists: (): boolean => true },
    add: {
      existing(): void {},
      image: (x: number, y: number, key: string): unknown => makeFakeImage(x, y, key),
      rectangle: (x: number, y: number): unknown => makeFakeRect(x, y),
      circle: (x: number, y: number): unknown => makeFakeCircle(x, y),
      graphics: (): unknown => makeFakeGraphics(),
      container: (): unknown => makeFakeContainer(containers),
      text: (
        x: number,
        y: number,
        content: string,
        style: { fontSize?: string; color?: string },
      ): unknown => makeFakeText(x, y, content, style, texts),
    },
  };
  return { scene, texts, containers };
}

function makeMintState(): GameState {
  return {
    playerDraw: [],
    hand: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    actIndex: 0,
    totalActs: 3,
    progress: {},
    hp: 10,
    energy: 0,
    light: 0,
    heat: 0,
    pendingForceDestroy: 0,
    braceCharges: 0,
    keywordGuard: 0,
    progressDealtThisTurn: 0,
    pendingBoonChoices: [],
    pendingKeywordNextWorldCard: [],
    endOfTurnPassive: { kind: "None" },
    runModifiers: DEFAULT_RUN_MODIFIERS,
    turnPlayHistory: { cardsPlayedThisTurn: 0, byTemplateId: {} },
    status: "playing",
    worldId: "zombie-big-box",
    rng: createRng(0),
    nextId: 0,
  };
}

const keywordCatalog: CardCatalog = {
  "Spore Cloud": {
    kind: "player",
    name: "Spore Cloud",
    effect: { kind: "DealProgress", base: 1 },
    keywords: ["Spore"],
  },
  "Creeping Bloom": {
    kind: "player",
    name: "Creeping Bloom",
    effect: { kind: "DealProgress", base: 1 },
    keywords: ["Spore", "Slow"],
  },
  "Plain Strike": {
    kind: "player",
    name: "Plain Strike",
    effect: { kind: "DealProgress", base: 1 },
  },
};

function mintPlayer(templateId: string): PlayerCard {
  const [card] = mintCard(keywordCatalog, makeMintState(), templateId);
  if (card.kind !== "player") throw new Error(`expected ${templateId} to mint a player card`);
  return card;
}

interface RenderedCard {
  view: CardView;
  texts: TrackedText[];
  containers: FakeContainer[];
}

function renderCard(card: Card): RenderedCard {
  const { scene, texts, containers } = makeRenderScene();
  const theme = selectTheme("zombie-big-box");
  const view = new CardView(scene as never, card, 0, 0, theme, () => theme);
  return { view, texts, containers };
}

/**
 * The effect-block containers CardView adopted, in creation (stacking) order.
 * The REAL Container.add stamped `parentContainer` on them; token-row
 * containers live one level deeper (added by the fake block container) and a
 * dropped `None` block is never adopted at all, so neither matches.
 */
function effectBlocks(rendered: RenderedCard): FakeContainer[] {
  return rendered.containers.filter((c) => c.parentContainer === rendered.view);
}

/** Token rows of one effect block, in stacking order. */
function rowsOf(block: FakeContainer): FakeContainer[] {
  // An effect block's only children are its row containers.
  return block.children as FakeContainer[];
}

/** Icon texture keys and text contents of one row, each in token order. */
function rowTokens(row: FakeContainer): { iconKeys: string[]; textContents: string[] } {
  const iconKeys: string[] = [];
  const textContents: string[] = [];
  for (const child of row.children) {
    const c = child as { textureKey?: string; content?: string };
    if (typeof c.textureKey === "string") iconKeys.push(c.textureKey);
    if (typeof c.content === "string") textContents.push(c.content);
  }
  return { iconKeys, textContents };
}

/** Colours of one row's text tokens, in token order. */
function rowTextColors(row: FakeContainer): string[] {
  return row.children
    .map((child) => child as { content?: string; color?: string })
    .filter((c) => typeof c.content === "string")
    .map((c) => c.color ?? "");
}

describe("CardView player-card keyword line (REQ-MALL-21)", () => {
  // The world face renders keywords at this offset/size; the player face must
  // match it exactly (CardView.ts world branch).
  const KEYWORD_Y = -CARD_FACE.height / 2 + 23;
  const EFFECT_Y_DEFAULT = -CARD_FACE.height / 2 + 28;
  const EFFECT_Y_WITH_KEYWORDS = -CARD_FACE.height / 2 + 36;

  it("renders a minted Spore card with a keyword line at the world-face offset and size", () => {
    const { texts } = renderCard(mintPlayer("Spore Cloud"));
    const kw = texts.find((t) => t.content === "Spore");
    expect(kw).toBeDefined();
    expect(kw!.y).toBe(KEYWORD_Y);
  });

  it("joins multiple keywords with ' · ' exactly like the world face", () => {
    const { texts } = renderCard(mintPlayer("Creeping Bloom"));
    expect(texts.some((t) => t.content === "Spore · Slow")).toBe(true);
  });

  it("shifts the token effect block down to the world-face effect offset when keywords are present", () => {
    const rendered = renderCard(mintPlayer("Spore Cloud"));
    const [block, ...extra] = effectBlocks(rendered);
    expect(block).toBeDefined();
    expect(extra).toEqual([]); // a player card carries exactly one effect block
    expect(block!.x).toBe(0);
    expect(block!.y).toBe(EFFECT_Y_WITH_KEYWORDS);
    // DealProgress base 1 compiles to a single `[progress] 1` row.
    const rows = rowsOf(block!);
    expect(rows.length).toBe(1);
    expect(rowTokens(rows[0]!)).toEqual({
      iconKeys: ["effect-icon-progress"],
      textContents: ["+", "1"],
    });
  });

  it("renders a keywordless card unchanged: no keyword line, effect block at the original offset", () => {
    const rendered = renderCard(mintPlayer("Plain Strike"));
    // No keyword line at all — nothing renders at the keyword slot and no
    // 9px text exists on the face (name is 13px, effect tokens 11px; no Exhaust).
    expect(rendered.texts.some((t) => t.y === KEYWORD_Y)).toBe(false);
    expect(rendered.texts.some((t) => t.fontSize === "9px")).toBe(false);
    const [block] = effectBlocks(rendered);
    expect(block).toBeDefined();
    expect(block!.y).toBe(EFFECT_Y_DEFAULT);
    expect(rowTokens(rowsOf(block!)[0]!).textContents).toEqual(["+", "1"]);
  });
});

// ---------------------------------------------------------------------------
// CardView world-card trigger blocks (token IR, design §4)
//
// Same real-constructor approach as the keyword tests: a minted world card
// renders through the actual CardView + addEffectLines pipeline against the
// scene stub. Pins the trigger-icon lead, the height+spacing stacking, and the
// rule that a `None` effect contributes neither a block nor spacing.
// ---------------------------------------------------------------------------

describe("CardView world-card trigger blocks", () => {
  const worldCatalog: CardCatalog = {
    Shambler: {
      kind: "world",
      name: "Shambler",
      cost: 3,
      keywords: [],
      discardable: false,
      onDraw: { kind: "None" },
      onEndOfTurn: { kind: "Damage", amount: 1 },
      onDiscarded: { kind: "None" },
      onCleared: { kind: "GainEnergy", amount: 1 },
      onPartialClear: { kind: "None" },
    },
    // All four triggers non-None so the order assertions can pin the visual
    // stack CardView uses.
    "Patient Zero": {
      kind: "world",
      name: "Patient Zero",
      cost: 5,
      keywords: [],
      discardable: false,
      onDraw: { kind: "None" },
      onEndOfTurn: { kind: "Brace", amount: 2 },
      onDiscarded: { kind: "AddThreatToWorldDeck" },
      onCleared: { kind: "ExileTopWorldCards", amount: 1 },
      onPartialClear: { kind: "ForceDestroy", amount: 1 },
    },
  };

  function mintWorld(templateId: string): WorldCard {
    const [card] = mintCard(worldCatalog, makeMintState(), templateId);
    if (card.kind !== "world") throw new Error(`expected ${templateId} to mint a world card`);
    return card;
  }

  const FIRST_BLOCK_Y = -CARD_FACE.height / 2 + 36;
  // Every fake text measures 12px high, so a one-line block is 12px tall.
  const FAKE_LINE_HEIGHT = 12;
  const BLOCK_SPACING = 4;

  it("stacks one trigger block per non-None effect by height + spacing, skipping None entirely", () => {
    const rendered = renderCard(mintWorld("Shambler"));
    const blocks = effectBlocks(rendered);
    // onDiscarded and onPartialClear are None: no block, no spacing gap.
    expect(blocks.length).toBe(2);
    const [eachTurn, onClear] = blocks;
    expect(eachTurn!.y).toBe(FIRST_BLOCK_Y);
    expect(onClear!.y).toBe(FIRST_BLOCK_Y + FAKE_LINE_HEIGHT + BLOCK_SPACING);
    // The None blocks' empty containers were destroyed, not left on the scene.
    const adopted = new Set(blocks);
    const strays = rendered.containers.filter(
      (c) => !adopted.has(c) && c.parentContainer === null && c.children.length === 0,
    );
    expect(strays.every((c) => c.destroyed)).toBe(true);
  });

  it("leads each block with its trigger icon, then the compiled effect tokens", () => {
    const rendered = renderCard(mintWorld("Shambler"));
    const [onClear, eachTurn] = effectBlocks(rendered);
    expect(rowTokens(rowsOf(onClear!)[0]!)).toEqual({
      iconKeys: ["effect-icon-on-clear", "effect-icon-energy"],
      textContents: [":", "+1"],
    });
    expect(rowTokens(rowsOf(eachTurn!)[0]!)).toEqual({
      iconKeys: ["effect-icon-each-turn", "effect-icon-hp"],
      textContents: [":", "-1"], // core's true minus, normalized for the card font
    });
    // No trigger icon for the None blocks appears anywhere.
    const allKeys = rendered.containers.flatMap((c) => rowTokens(c).iconKeys);
    expect(allKeys).not.toContain("effect-icon-discard");
    expect(allKeys).not.toContain("effect-icon-on-partial-clear");
  });

  it("renders trigger-block token text at the world-face 12px size", () => {
    const { texts } = renderCard(mintWorld("Shambler"));
    const damage = texts.find((t) => t.content === "-1");
    expect(damage).toBeDefined();
    expect(damage!.fontSize).toBe("12px");
  });

  it("renders all four triggers in CardView's visual order with value emphasis tints", () => {
    const rendered = renderCard(mintWorld("Patient Zero"));
    const blocks = effectBlocks(rendered);
    expect(blocks.length).toBe(4);

    // Visual stack order: rewards/partial outcomes first, then discard,
    // then each-turn pressure.
    const leadIcons = blocks.map((block) => rowTokens(rowsOf(block)[0]!).iconKeys[0]);
    expect(leadIcons).toEqual([
      "effect-icon-on-clear",
      "effect-icon-on-partial-clear",
      "effect-icon-discard",
      "effect-icon-each-turn",
    ]);

    // CardView supplies light base text for trigger blocks; emphasized values
    // keep their semantic reward/penalty/brace tints.
    const tints = blocks.map((block) => rowTextColors(rowsOf(block)[0]!));
    expect(tints).toEqual([
      ["#e8eaf0", "#e8eaf0", "#e8eaf0"], // onClear: colon + exile 'top', '1'
      ["#e8eaf0", "#e8eaf0"], // onPartialClear: colon + force-destroy text
      ["#e8eaf0", "#ff8888"], // onDiscard: colon + threat 'Zombie'
      ["#e8eaf0", "#e8eaf0"], // eachTurn: colon + Brace '+2'
    ]);
  });
});

// ---------------------------------------------------------------------------
// CardView fog-back (concealment, REQ-FOG-28)
//
// A world card carrying `Concealed:N` renders a fog-back that shows ONLY its
// depth chip ("Concealed 3") and hides every identity object (name, cost,
// effect tokens). applyConcealment(light) is the cosmetic reconcile the table
// runs every drawAll cycle: it reads `state.light` and toggles the two groups,
// never touching core. Raising light past the depth reveals the card.
// ---------------------------------------------------------------------------

describe("CardView fog-back concealment", () => {
  const fogCatalog: CardCatalog = {
    "Something in the Mist": {
      kind: "world",
      name: "Something in the Mist",
      cost: 3,
      keywords: ["Concealed:3", "Obstructed"],
      discardable: false,
      onDraw: { kind: "None" },
      onEndOfTurn: { kind: "Damage", amount: 2 },
      onDiscarded: { kind: "None" },
      onCleared: { kind: "None" },
      onPartialClear: { kind: "None" },
    },
    "Plain Hazard": {
      kind: "world",
      name: "Plain Hazard",
      cost: 2,
      keywords: [],
      discardable: false,
      onDraw: { kind: "None" },
      onEndOfTurn: { kind: "Damage", amount: 1 },
      onDiscarded: { kind: "None" },
      onCleared: { kind: "None" },
      onPartialClear: { kind: "None" },
    },
  };

  function mintFogWorld(templateId: string): WorldCard {
    const [card] = mintCard(fogCatalog, makeMintState(), templateId);
    if (card.kind !== "world") throw new Error(`expected ${templateId} to mint a world card`);
    return card;
  }

  /** All text contents the card rendered, regardless of nesting. */
  function allTexts(rendered: RenderedCard): string[] {
    return rendered.texts.map((t) => t.content);
  }

  it("renders the structured-keyword depth chip ('Concealed 3')", () => {
    const rendered = renderCard(mintFogWorld("Something in the Mist"));
    expect(allTexts(rendered)).toContain("Concealed 3");
  });

  it("shows the depth chip and hides identity when concealed (Light below depth)", () => {
    const rendered = renderCard(mintFogWorld("Something in the Mist"));
    // Light 1 < depth 3 → concealed.
    rendered.view.applyConcealment(1);

    // The depth chip is visible; the name (identity) is hidden.
    const chip = rendered.texts.find((t) => t.content === "Concealed 3");
    const name = rendered.texts.find((t) => t.content === "Something in the Mist");
    expect(chip!.visible).toBe(true);
    expect(name!.visible).toBe(false);
  });

  it("reveals identity and hides the fog chip once Light reaches the depth", () => {
    const rendered = renderCard(mintFogWorld("Something in the Mist"));
    rendered.view.applyConcealment(1); // concealed
    rendered.view.applyConcealment(3); // Light 3 >= depth 3 → revealed

    const chip = rendered.texts.find((t) => t.content === "Concealed 3");
    const name = rendered.texts.find((t) => t.content === "Something in the Mist");
    expect(name!.visible).toBe(true);
    expect(chip!.visible).toBe(false);
  });

  it("never conceals a card without a Concealed keyword (depth 0 is a no-op)", () => {
    const rendered = renderCard(mintFogWorld("Plain Hazard"));
    // Even at Light 0 a non-concealable card stays fully revealed.
    rendered.view.applyConcealment(0);
    const name = rendered.texts.find((t) => t.content === "Plain Hazard");
    expect(name!.visible).toBe(true);
    // No fog depth chip exists for a card with no Concealed keyword.
    expect(allTexts(rendered)).not.toContain("Concealed 0");
  });
});

// ---------------------------------------------------------------------------
// CardView applyHighlight 'picked' badge — visibility toggle and idempotency
//
// The badge is a lazy Container built on first use. The idempotency guard
// (pickedNow tracker) ensures setVisible is only called when the kind
// actually changes, not on every drawAll cycle.
// ---------------------------------------------------------------------------

interface PickBadgeState {
  visible: boolean;
  containerCallCount: number;
  setVisibleCallCount: number;
}

interface PickBadgeViewFake {
  highlightRect: unknown;
  list: unknown[];
  pickedNow: boolean | undefined;
  pickBadge: unknown | undefined;
  added: unknown[];
  add(child: unknown): unknown;
  applyHighlight: CardView["applyHighlight"];
}

function makeFakePickBadgeView(): {
  view: PickBadgeViewFake;
  rect: FakeRect;
  badgeState: PickBadgeState;
} {
  const rect: FakeRect = { strokeWidth: 0, strokeColor: 0, fillColor: 0x000000, fillAlpha: 0 };
  const rectObj = {
    setStrokeStyle(width: number, color?: number): unknown {
      rect.strokeWidth = width;
      rect.strokeColor = color ?? 0;
      return rectObj;
    },
    setFillStyle(color: number, alpha?: number): unknown {
      rect.fillColor = color;
      rect.fillAlpha = alpha ?? 1;
      return rectObj;
    },
  };

  const badgeState: PickBadgeState = {
    visible: false,
    containerCallCount: 0,
    setVisibleCallCount: 0,
  };
  const badgeObj = {
    add(_child: unknown): unknown {
      return badgeObj;
    },
    setVisible(v: boolean): unknown {
      badgeState.visible = v;
      badgeState.setVisibleCallCount++;
      return badgeObj;
    },
  };

  const fakeGraphics = { fillStyle(): void {}, fillCircle(): void {}, setAlpha(): void {} };
  const fakeText = {
    setOrigin(): unknown {
      return fakeText;
    },
  };

  const added: unknown[] = [];
  const view = Object.create(CardView.prototype) as PickBadgeViewFake;
  Object.assign(view, {
    highlightRect: rectObj,
    list: [{}, rectObj],
    pickedNow: undefined as boolean | undefined,
    pickBadge: undefined as unknown,
    added,
    add(child: unknown): unknown {
      added.push(child);
      return view;
    },
  });

  const scene = {
    add: {
      container(_x: number, _y: number): unknown {
        badgeState.containerCallCount++;
        return badgeObj;
      },
      graphics(): unknown {
        return fakeGraphics;
      },
      text(): unknown {
        return fakeText;
      },
    },
  };
  Object.defineProperty(view, "scene", { value: scene });

  return { view, rect, badgeState };
}

describe("CardView applyHighlight pick badge", () => {
  const fs = selectTheme("zombie-big-box").frameStyle;

  it("makes the badge visible when kind is 'picked'", () => {
    const { view, badgeState } = makeFakePickBadgeView();
    view.applyHighlight("picked", fs);
    expect(badgeState.visible).toBe(true);
    expect(badgeState.containerCallCount).toBe(1); // badge created exactly once
  });

  it("hides the badge when kind changes from 'picked' to another kind", () => {
    const { view, badgeState } = makeFakePickBadgeView();
    view.applyHighlight("picked", fs);
    view.applyHighlight("committed", fs);
    expect(badgeState.visible).toBe(false);
  });

  it("is idempotent: repeated 'picked' calls do not rebuild or re-toggle the badge", () => {
    const { view, badgeState } = makeFakePickBadgeView();
    view.applyHighlight("picked", fs); // first: builds + shows (2 setVisible calls: false at build, true here)
    const callsAfterFirst = badgeState.setVisibleCallCount;
    view.applyHighlight("picked", fs); // second: guard fires, no setVisible
    view.applyHighlight("picked", fs); // third: same
    expect(badgeState.containerCallCount).toBe(1); // built once only
    expect(badgeState.setVisibleCallCount).toBe(callsAfterFirst); // no extra calls
  });

  it("badge is constructed lazily on first call and starts hidden for non-picked kinds", () => {
    const { view, badgeState } = makeFakePickBadgeView();
    // First applyHighlight triggers construction (pickedNow: undefined → false).
    // The badge is built, shown as hidden by the constructor, then setVisible(false) again.
    view.applyHighlight("none", fs);
    expect(badgeState.containerCallCount).toBe(1); // built exactly once
    expect(badgeState.visible).toBe(false); // and stays hidden for a non-picked kind
  });

  it("applyCardHighlight on a plain container applies pickedBorder stroke/fill without a badge", () => {
    const rect: FakeRect = { strokeWidth: 0, strokeColor: 0, fillColor: 0x000000, fillAlpha: 0 };
    const rectObj = {
      setStrokeStyle(w: number, c?: number): unknown {
        rect.strokeWidth = w;
        rect.strokeColor = c ?? 0;
        return rectObj;
      },
      setFillStyle(c: number, a?: number): unknown {
        rect.fillColor = c;
        rect.fillAlpha = a ?? 1;
        return rectObj;
      },
    };
    const plainContainer = {
      list: [{}, rectObj],
    } as unknown as import("phaser").GameObjects.Container;
    // Must not throw even though plainContainer is not a CardView (no badge created).
    expect(() => applyCardHighlight(plainContainer, "picked", fs)).not.toThrow();
    expect(rect.strokeColor).toBe(fs.pickedBorder);
    expect(rect.fillColor).toBe(fs.pickedBorder);
    expect(rect.fillAlpha).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CardView rarity stroke (REQ-RARITY-37, 38, 39, 40)
//
// The rarity stroke is drawn once at construction from the minted card's
// `rarity` field and is always visible (no toggle, unlike the selection
// highlight). These tests render real CardView instances via the same
// real-constructor harness the keyword/trigger-block tests above use, then
// read the rarity Rectangle's stroke color straight off `view.list` — a real
// Phaser Container's list, populated by the real `Container.add` calls the
// constructor makes against the fake `scene.add.rectangle`.
// ---------------------------------------------------------------------------

const rarityCatalog: CardCatalog = {
  "Common Card": {
    kind: "player",
    name: "Common Card",
    effect: { kind: "DealProgress", base: 1 },
    rarity: "common",
  },
  "Uncommon Card": {
    kind: "player",
    name: "Uncommon Card",
    effect: { kind: "DealProgress", base: 1 },
    rarity: "uncommon",
  },
  "Rare Card": {
    kind: "player",
    name: "Rare Card",
    effect: { kind: "DealProgress", base: 1 },
    rarity: "rare",
  },
  "Legendary Card": {
    kind: "player",
    name: "Legendary Card",
    effect: { kind: "DealProgress", base: 1 },
    rarity: "legendary",
  },
  "Signature Card": {
    kind: "player",
    name: "Signature Card",
    effect: { kind: "DealProgress", base: 1 },
    rarity: "signature",
  },
  "Unstamped Card": {
    kind: "player",
    name: "Unstamped Card",
    effect: { kind: "DealProgress", base: 1 },
    // No rarity field — mintCard stamps "common" (template.rarity ?? "common").
  },
};

function mintRarityPlayer(templateId: string): PlayerCard {
  const [card] = mintCard(rarityCatalog, makeMintState(), templateId);
  if (card.kind !== "player") throw new Error(`expected ${templateId} to mint a player card`);
  return card;
}

/**
 * The card-face Rectangles in construction order: [0] is `highlightRect`
 * (selection/target overlay, list[1] on the real container — index 0 here
 * because the cardfront `image` and the inset frame are filtered out), [1] is
 * the rarity stroke. Both must exist simultaneously and independently.
 */
function faceRectangles(view: CardView): { strokeWidth: number; strokeColor: number }[] {
  return (view as unknown as { list: unknown[] }).list.filter(
    (child): child is { strokeWidth: number; strokeColor: number } =>
      typeof (child as { strokeWidth?: unknown }).strokeWidth === "number",
  );
}

describe("CardView rarity stroke", () => {
  const tiers: RarityTier[] = ["common", "uncommon", "rare", "legendary", "signature"];
  const templateIdByTier: Record<RarityTier, string> = {
    common: "Common Card",
    uncommon: "Uncommon Card",
    rare: "Rare Card",
    legendary: "Legendary Card",
    signature: "Signature Card",
  };

  it("each tier renders a distinct stroke color matching rarityStyle", () => {
    const colors = tiers.map((tier) => {
      const rendered = renderCard(mintRarityPlayer(templateIdByTier[tier]));
      const [, rarityRect] = faceRectangles(rendered.view);
      return rarityRect?.strokeColor;
    });

    // Every tier resolves to its own rarityStyle color.
    tiers.forEach((tier, i) => {
      expect(colors[i]).toBe(rarityStyle(tier).color);
    });

    // And the four colors are pairwise distinct — no two tiers collide.
    expect(new Set(colors).size).toBe(tiers.length);
  });

  it("a card minted without an authored rarity falls back to Common (mint-time default)", () => {
    const rendered = renderCard(mintRarityPlayer("Unstamped Card"));
    const [, rarityRect] = faceRectangles(rendered.view);
    expect(rendered.view.cardId).toBeDefined();
    expect(rarityRect?.strokeColor).toBe(rarityStyle("common").color);
  });

  it("an unknown tier value falls back to the Common treatment without throwing", () => {
    // Simulates data drift (e.g. a persisted card from before a tier existed):
    // rarityStyle must never throw and must render exactly as Common.
    const unknownTier = "mythic" as unknown as RarityTier;
    expect(() => rarityStyle(unknownTier)).not.toThrow();
    expect(rarityStyle(unknownTier)).toEqual(rarityStyle("common"));
  });

  it("missing/undefined tier falls back to the Common treatment without throwing", () => {
    expect(() => rarityStyle(undefined)).not.toThrow();
    expect(rarityStyle(undefined)).toEqual(rarityStyle("common"));
  });

  it("the rarity stroke coexists with the highlight stroke: both render simultaneously", () => {
    const rendered = renderCard(mintRarityPlayer("Rare Card"));
    const [highlightRect, rarityRect] = faceRectangles(rendered.view);
    expect(highlightRect).toBeDefined();
    expect(rarityRect).toBeDefined();
    expect(highlightRect).not.toBe(rarityRect); // distinct Graphics/Rectangle objects

    // Applying a selection highlight (e.g. 'target') changes only the
    // highlight rectangle's stroke; the rarity rectangle's stroke is
    // untouched, proving neither object clobbers the other's state.
    const fs = selectTheme("zombie-big-box").frameStyle;
    rendered.view.applyHighlight("target", fs);

    const [highlightAfter, rarityAfter] = faceRectangles(rendered.view);
    expect(highlightAfter?.strokeColor).toBe(fs.targetBorder);
    expect(rarityAfter?.strokeColor).toBe(rarityStyle("rare").color);
  });
});

describe("TableScene idle world-card and End Turn previews", () => {
  it("shows no idle preview for a non-discardable world card", () => {
    // Idle hover previews the DiscardHazard action. A non-discardable card has
    // no discard to preview, so the slot stays hidden — its end-of-turn threat
    // is read off the card face, not this slot.
    const hazard = makeWorldCard({
      id: "idle-eot",
      name: "Decaying Wreck",
      discardable: false,
      onEndOfTurn: { kind: "Damage", amount: 3 },
      onDraw: { kind: "None" },
    });
    const state = makeCoreState({ hand: [hazard], light: 0 });
    const { scene } = makeSelectionHarness(state);

    scene.showIdleWorldPreview(hazard);

    expect(scene.previewSlot.visible).toBe(false);
  });

  it("previews the discard consequence of a discardable world card on idle hover", () => {
    const hazard = makeWorldCard({
      id: "idle-discard",
      name: "Brittle Debris",
      discardable: true,
      onDraw: { kind: "None" },
      onEndOfTurn: { kind: "None" },
      onDiscarded: { kind: "Damage", amount: 4 },
    });
    const state = makeCoreState({ hand: [hazard], light: 0 });
    const { scene } = makeSelectionHarness(state);

    scene.showIdleWorldPreview(hazard);

    expect(scene.previewSlot.visible).toBe(true);
    expect(scene.previewSlot.text).toContain("Discard Brittle Debris");
    expect(scene.previewSlot.text).toContain("Take 4 damage");
  });

  it("previews only the discard consequence, not the end-of-turn hook, on idle hover", () => {
    // The unified discard preview surfaces what discarding does (6 damage). The
    // end-of-turn hook (2 damage) is the card's own behaviour, not part of the
    // discard action, so it is not folded into this slot.
    const hazard = makeWorldCard({
      id: "idle-both",
      name: "Volatile Pile",
      discardable: true,
      onDraw: { kind: "None" },
      onEndOfTurn: { kind: "Damage", amount: 2 },
      onDiscarded: { kind: "Damage", amount: 6 },
    });
    const state = makeCoreState({ hand: [hazard], light: 0 });
    const { scene } = makeSelectionHarness(state);

    scene.showIdleWorldPreview(hazard);

    expect(scene.previewSlot.visible).toBe(true);
    expect(scene.previewSlot.text).toContain("Take 6 damage");
    expect(scene.previewSlot.text).not.toContain("Take 2 damage");
  });

  it("shows only the concealment warning for a fogged world card on idle hover", () => {
    const hazard = makeWorldCard({
      id: "idle-fog",
      name: "Hidden Terror",
      keywords: [{ name: "Concealed", value: 2 }],
      onDraw: { kind: "None" },
      onEndOfTurn: { kind: "Damage", amount: 9 },
      onDiscarded: { kind: "Damage", amount: 9 },
    });
    // Light 0 < depth 2 → concealed.
    const state = makeCoreState({ hand: [hazard], light: 0 });
    const { scene } = makeSelectionHarness(state);

    scene.showIdleWorldPreview(hazard);

    expect(scene.previewSlot.visible).toBe(true);
    expect(scene.previewSlot.text).toContain("concealed");
    expect(scene.previewSlot.text).not.toContain("Hidden Terror");
    expect(scene.previewSlot.text).not.toContain("End of turn");
    expect(scene.previewSlot.text).not.toContain("9");
  });

  it("hides the idle preview for a world card with no meaningful hooks", () => {
    const hazard = makeWorldCard({
      id: "idle-inert",
      name: "Inert Rubble",
      discardable: false,
      onDraw: { kind: "None" },
      onEndOfTurn: { kind: "None" },
      onDiscarded: { kind: "None" },
    });
    const state = makeCoreState({ hand: [hazard], light: 0 });
    const { scene } = makeSelectionHarness(state);

    scene.showIdleWorldPreview(hazard);

    expect(scene.previewSlot.visible).toBe(false);
  });

  it("does not render an idle preview while targeting (targeted preview keeps priority)", () => {
    // Drive a real targeting selection, then call showIdleWorldPreview directly:
    // it must no-op because the phase is no longer idle, leaving the targeted
    // preview untouched. This proves the idle/targeted priority split.
    const survey = makePlayerCard({
      id: "priority-survey",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "None" },
      energyCost: 0,
    });
    const hazard = makeWorldCard({
      id: "priority-hazard",
      name: "Targeted Hazard",
      cost: 3,
      discardable: true,
      onEndOfTurn: { kind: "Damage", amount: 7 },
    });
    const state = makeCoreState({
      hand: [survey, hazard],
      energy: 0,
      light: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("priority-survey-progress", "Survey", [
            { kind: "appendEffect", effect: { kind: "DealProgress", base: 2 } },
          ]),
        ],
      },
    });
    const { scene } = makeSelectionHarness(state);

    scene.onCardClick(survey.id);
    scene.showTargetPreview(hazard.id);
    const targetedText = scene.previewSlot.text;
    expect(targetedText).toContain("Make 2 Progress on Targeted Hazard");

    // Now the idle hook preview is gated out by the active targeting phase.
    scene.showIdleWorldPreview(hazard);
    expect(scene.previewSlot.text).toBe(targetedText);
    expect(scene.previewSlot.text).not.toContain("End of turn:");
  });

  it("previews the EndTurn action's consequences on End Turn hover", () => {
    const hazard = makeWorldCard({
      id: "endturn-eot",
      name: "Ticking Hazard",
      discardable: false,
      onEndOfTurn: { kind: "Damage", amount: 3 },
    });
    const state = makeCoreState({ hand: [hazard], light: 0 });
    const { scene } = makeSelectionHarness(state);

    // Idle phase: ending the turn is available, so the preview surfaces the
    // end-of-turn hook firing (3 damage).
    scene.showEndTurnPreview();

    expect(scene.previewSlot.visible).toBe(true);
    expect(scene.previewSlot.text).toContain("Take 3 damage");
  });

  it("does not preview End Turn while a selection is active", () => {
    const survey = makePlayerCard({
      id: "endturn-gate-survey",
      templateId: "Survey",
      name: "Survey",
      effect: { kind: "None" },
      energyCost: 0,
    });
    const hazard = makeWorldCard({
      id: "endturn-gate-hazard",
      name: "Gate Hazard",
      cost: 3,
      discardable: false,
      onEndOfTurn: { kind: "Damage", amount: 3 },
    });
    const state = makeCoreState({
      hand: [survey, hazard],
      energy: 0,
      light: 0,
      runModifiers: {
        ...DEFAULT_RUN_MODIFIERS,
        playerCardModifiers: [
          playerCardModifier("endturn-gate-progress", "Survey", [
            { kind: "appendEffect", effect: { kind: "DealProgress", base: 1 } },
          ]),
        ],
      },
    });
    const { scene } = makeSelectionHarness(state);

    // Begin a selection so the End Turn button would be non-interactive.
    scene.onCardClick(survey.id);
    scene.clearPreviewSlot();

    scene.showEndTurnPreview();
    expect(scene.previewSlot.visible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 9: maybeConfirmOrDispatch — confirmation gate routing
// ---------------------------------------------------------------------------

function settings(mode: UserSettings["confirmationMode"]): UserSettings {
  return {
    version: 2,
    confirmationMode: mode,
    detailedHoverPreviews: true,
    musicVolume: 1.0,
    fxVolume: 0.5,
    masterMute: false,
  };
}

/** A no-target player card that gains energy: a deterministic risk-NONE play. */
function gainEnergyCard(id: string): PlayerCard {
  return makePlayerCard({
    id,
    templateId: id,
    name: id,
    effect: { kind: "GainEnergy", amount: 1 },
    energyCost: 0,
  });
}

describe("TableScene confirmation gate (Phase 9)", () => {
  it("mode 'always': EndTurn opens the modal and does not dispatch yet", () => {
    const hazard = makeWorldCard({ id: "always-eot", discardable: false });
    const state = makeCoreState({ hand: [hazard], light: 5 });
    const { scene, dispatched } = makeSelectionHarness(state, settings("always"));

    scene.onEndTurnClick();

    expect(scene.actionConfirmation.isOpen).toBe(true);
    expect(scene.actionConfirmation.lastShow?.title).toBe("End Turn");
    expect(dispatched()).toEqual([]);
  });

  it("mode 'always': DiscardHazard opens the modal and does not dispatch yet", () => {
    const hazard = makeWorldCard({ id: "always-discard", name: "Trash", discardable: true });
    const state = makeCoreState({ hand: [hazard], light: 5 });
    const { scene, dispatched } = makeSelectionHarness(state, settings("always"));

    scene.onDiscardClick(hazard.id);

    expect(scene.actionConfirmation.isOpen).toBe(true);
    expect(scene.actionConfirmation.lastShow?.title).toBe("Discard Trash");
    expect(dispatched()).toEqual([]);
  });

  it("mode 'always': completing a PlayCard opens the modal and does not dispatch yet", () => {
    const card = gainEnergyCard("always-play");
    const state = makeCoreState({ hand: [card], energy: 0, light: 5 });
    const { scene, dispatched } = makeSelectionHarness(state, settings("always"));

    // No-target card: the click completes the selection and routes to the gate.
    scene.onCardClick(card.id);

    expect(scene.actionConfirmation.isOpen).toBe(true);
    expect(scene.actionConfirmation.lastShow?.title).toBe("Play always-play");
    expect(dispatched()).toEqual([]);
  });

  it("mode 'off': EndTurn dispatches immediately and the modal never opens", () => {
    const hazard = makeWorldCard({ id: "off-eot", discardable: false });
    const state = makeCoreState({ hand: [hazard], light: 5 });
    const { scene, dispatched } = makeSelectionHarness(state, settings("off"));

    scene.onEndTurnClick();

    expect(scene.actionConfirmation.isOpen).toBe(false);
    expect(dispatched()).toEqual([{ type: "EndTurn" }]);
  });

  it("mode 'risk-only': a risk-NONE play dispatches directly with no modal", () => {
    const card = gainEnergyCard("risk-none-play");
    const state = makeCoreState({ hand: [card], energy: 0, light: 5 });
    // Confirm the action really is risk none through the real engine.
    expect(previewAction(coreCatalog, state, { type: "PlayCard", cardId: card.id }).risk).toBe(
      "none",
    );

    const { scene, dispatched } = makeSelectionHarness(state, settings("risk-only"));
    scene.onCardClick(card.id);

    expect(scene.actionConfirmation.isOpen).toBe(false);
    expect(dispatched()).toEqual([{ type: "PlayCard", cardId: card.id }]);
  });

  it("mode 'risk-only': a RISK EndTurn (concealed card in hand) opens the modal", () => {
    const concealed = makeWorldCard({
      id: "risk-eot-concealed",
      name: "Hidden Menace",
      cost: 5,
      discardable: false,
      keywords: [{ name: "Concealed", value: 3 }],
    });
    const state = makeCoreState({ hand: [concealed], light: 0 });
    // The engine classifies EndTurn with a concealed world card in hand as harmful.
    expect(previewAction(coreCatalog, state, { type: "EndTurn" }).risk).toBe("harmful");

    const { scene, dispatched } = makeSelectionHarness(state, settings("risk-only"));
    scene.onEndTurnClick();

    expect(scene.actionConfirmation.isOpen).toBe(true);
    expect(dispatched()).toEqual([]);
  });

  it("commit fires the stored action exactly once", () => {
    const hazard = makeWorldCard({ id: "commit-once", discardable: false });
    const state = makeCoreState({ hand: [hazard], light: 5 });
    const { scene, dispatched } = makeSelectionHarness(state, settings("always"));

    scene.onEndTurnClick();
    scene.actionConfirmation.commit();
    // A second commit (e.g. a double click) must not fire again.
    scene.actionConfirmation.commit();

    expect(dispatched()).toEqual([{ type: "EndTurn" }]);
    expect(scene.actionConfirmation.isOpen).toBe(false);
  });

  it("cancel dispatches nothing and resets the selection to idle", () => {
    const card = gainEnergyCard("cancel-play");
    const state = makeCoreState({ hand: [card], energy: 0, light: 5 });
    const { scene, dispatched } = makeSelectionHarness(state, settings("always"));

    scene.onCardClick(card.id);
    expect(scene.actionConfirmation.isOpen).toBe(true);

    scene.actionConfirmation.cancel();

    expect(dispatched()).toEqual([]);
    expect(scene.sel).toEqual({ phase: "idle" });
    expect(scene.previewSlot.visible).toBe(false);
  });

  it("while the modal is open, table input is inert (no dispatch)", () => {
    const card = gainEnergyCard("inert-play");
    const hazard = makeWorldCard({ id: "inert-haz", discardable: true });
    const state = makeCoreState({ hand: [card, hazard], energy: 0, light: 5 });
    const { scene, dispatched } = makeSelectionHarness(state, settings("always"));

    // Open the modal via a play.
    scene.onCardClick(card.id);
    expect(scene.actionConfirmation.isOpen).toBe(true);

    // Every committed entry point no-ops while the modal is up.
    scene.onCardClick(hazard.id);
    scene.onEndTurnClick();
    scene.onDiscardClick(hazard.id);

    expect(dispatched()).toEqual([]);
  });

  it("title is concealment-safe for a concealed DiscardHazard", () => {
    const concealed = makeWorldCard({
      id: "conceal-discard",
      name: "Real Secret Name",
      discardable: true,
      keywords: [{ name: "Concealed", value: 3 }],
    });
    const state = makeCoreState({ hand: [concealed], light: 0 });
    const { scene } = makeSelectionHarness(state, settings("always"));

    scene.onDiscardClick(concealed.id);

    expect(scene.actionConfirmation.isOpen).toBe(true);
    const title = scene.actionConfirmation.lastShow?.title ?? "";
    expect(title).not.toContain("Real Secret Name");
    expect(title).toBe("Discard a concealed hazard");
  });
});

// ---------------------------------------------------------------------------
// Phase 10: overlay/modal lifecycle cleanup at terminal, ESC, and the
// non-previewable defensive guard.
// ---------------------------------------------------------------------------

describe("TableScene confirmation lifecycle (Phase 10)", () => {
  it("dismisses an open confirmation modal when the terminal run summary shows", () => {
    // showRunSummaryFromStats reaches into many collaborators; stub exactly the
    // ones the cleanup path touches so the assertion is about the modal hide.
    const scene = Object.create(TableScene.prototype) as Record<string, unknown> & {
      showRunSummaryFromStats(): void;
    };
    let summaryShown = false;
    const data = { outcome: "won" } as unknown;
    scene.terminalSummaryShown_ = false;
    scene.buildRunSummaryData = () => data;
    scene.clearConnector = () => {};
    scene.clearPreviewSlot = () => {};
    scene.actionConfirmation = makeFakeActionConfirmation();
    (scene.actionConfirmation as FakeActionConfirmation).isOpen = true;
    scene.helpOverlay = { setVisible(): void {} };
    scene.settingsOverlay = { close(): void {} };
    scene.questionBtn = {
      disableInteractive(): unknown {
        return scene.questionBtn;
      },
      setVisible(): unknown {
        return scene.questionBtn;
      },
    };
    scene.settingsBtn = {
      disableInteractive(): unknown {
        return scene.settingsBtn;
      },
      setVisible(): unknown {
        return scene.settingsBtn;
      },
    };
    scene.exitBtn = {
      disableInteractive(): unknown {
        return scene.exitBtn;
      },
    };
    scene.runSummary = {
      show(_d: unknown, _cb: () => void): void {
        summaryShown = true;
      },
    };

    scene.showRunSummaryFromStats();

    // The confirmation modal is gone, and the run summary is up.
    expect((scene.actionConfirmation as FakeActionConfirmation).isOpen).toBe(false);
    expect(summaryShown).toBe(true);
  });

  it("ESC while the confirmation modal is open cancels it: no dispatch, idle, hidden", () => {
    const card = gainEnergyCard("esc-cancel-play");
    const state = makeCoreState({ hand: [card], energy: 0, light: 5 });
    const { scene, dispatched } = makeSelectionHarness(state, settings("always"));

    // Open the modal via a completed play.
    scene.onCardClick(card.id);
    expect(scene.actionConfirmation.isOpen).toBe(true);

    // Drive the same ESC path the keydown handler runs while the modal is open:
    // hide the view, then cancel (dispatch nothing, reset selection to idle).
    scene.actionConfirmation.hide();
    (scene as unknown as { cancelConfirmation(): void }).cancelConfirmation();

    expect(dispatched()).toEqual([]);
    expect(scene.sel).toEqual({ phase: "idle" });
    expect(scene.actionConfirmation.isOpen).toBe(false);
    expect(scene.previewSlot.visible).toBe(false);
  });

  it("a non-previewable action dispatches directly without opening the modal", () => {
    const card = gainEnergyCard("nonpreviewable-play");
    const state = makeCoreState({ hand: [card], energy: 0, light: 5 });
    // mode 'always' would normally open the modal — the previewable:false guard
    // must short-circuit that and dispatch directly instead.
    const { scene, dispatched } = makeSelectionHarness(state, settings("always"));

    // Point preview at a non-previewable result (illegal action surface).
    scene.game_.preview = (): ActionPreview => ({
      action: { type: "EndTurn" },
      events: [],
      summaryLines: [],
      severity: "info",
      risk: "none",
      previewable: false,
    });

    (scene as unknown as { maybeConfirmOrDispatch(action: Action): void }).maybeConfirmOrDispatch({
      type: "EndTurn",
    });

    expect(scene.actionConfirmation.isOpen).toBe(false);
    expect(dispatched()).toEqual([{ type: "EndTurn" }]);
  });
});
