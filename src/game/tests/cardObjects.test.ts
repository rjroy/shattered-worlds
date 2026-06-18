import { describe, it, expect } from "bun:test";
import { CardView, applyCardHighlight } from "../view/CardView";
import { TableScene } from "../scenes/TableScene";
import { selectTheme } from "../view/themes/themeManifest";
import { CARD_FACE } from "../view/layout";
import { mintCard } from "../../core/model/cards";
import { createRng } from "../../core/engine/rng";
import { DEFAULT_RUN_MODIFIERS, type PlayerCardModifier } from "../../data/unlocks/types";
import type {
  Action,
  Card,
  CardCatalog,
  GameState,
  PlayerCard,
  TargetSpec,
  WorldCard,
} from "../../core/index";
import {
  makePlayerCard,
  makeState as makeCoreState,
  makeWorldCard,
  mintPlayers as mintCorePlayers,
} from "../../core/tests/testFixture";

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

function makeDrawAllHarness(state: GameState): {
  scene: { drawAll(): void };
  playerRows: Card[][];
} {
  const scene = Object.create(TableScene.prototype) as Record<string, unknown> & {
    drawAll(): void;
  };
  const playerRows: Card[][] = [];
  scene.game_ = { state, intensity: () => 0 };
  scene.theme_ = selectTheme("zombie-big-box");
  scene.sel = { phase: "idle" };
  scene.hoveredCardId = null;
  scene.cardObjects = new Map();
  scene.backdropLayer = { update(): void {} };
  scene.hudView = { update(): void {} };
  scene.pileLayer = { update(): void {} };
  scene.endTurnBtn = {
    setAlpha(): unknown { return scene.endTurnBtn; },
    disableInteractive(): unknown { return scene.endTurnBtn; },
    setInteractive(): unknown { return scene.endTurnBtn; },
  };
  scene.cancelBtn = { setVisible(): unknown { return scene.cancelBtn; } };
  scene.confirmBtn = { setVisible(): unknown { return scene.confirmBtn; } };
  scene.runSummary = { visible: false };
  scene.questionBtn = {
    disableInteractive(): unknown { return scene.questionBtn; },
    setVisible(): unknown { return scene.questionBtn; },
  };
  scene.exitBtn = {
    disableInteractive(): unknown { return scene.exitBtn; },
  };
  scene.helpOverlay = { setVisible(): unknown { return scene.helpOverlay; } };
  scene.tweens = { killTweensOf(): void {} };
  scene.currentLegalTargetIds = () => new Set<string>();
  scene.layoutRow = (cards: readonly Card[], rowY: number) => {
    if (rowY > 400) playerRows.push([...cards]);
  };
  scene.updateHint = () => {};
  scene.updateActBoonChoiceView = () => {};
  return { scene, playerRows };
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
    expect(
      afterPlayerRow?.map((card) => (card.kind === "player" ? card.energyCost : NaN)),
    ).toEqual([1, 1]);
  });
});

function makeSelectionHarness(state: GameState): {
  scene: {
    onCardClick(cardId: string): void;
    currentLegalTargetIds(): Set<string>;
    showTargetPreview(targetId: string): void;
    stepConnectorStyle(cardId: string, step: number): "progress" | "destroy" | "return" | null;
    sel: unknown;
    selectedCardSnapshot: PlayerCard | null;
    game_: { state: GameState };
    previewSlot: { text: string; visible: boolean };
  };
  drawCount: () => number;
  dispatched: () => Action[];
} {
  const scene = Object.create(TableScene.prototype) as {
    onCardClick(cardId: string): void;
    currentLegalTargetIds(): Set<string>;
    showTargetPreview(targetId: string): void;
    stepConnectorStyle(cardId: string, step: number): "progress" | "destroy" | "return" | null;
    sel: unknown;
    selectedCardSnapshot: PlayerCard | null;
    game_: { state: GameState; dispatch(action: Action): void };
    previewSlot: {
      text: string;
      visible: boolean;
      setText(text: string): void;
      setVisible(visible: boolean): void;
    };
    drawAll(): void;
    clearConnector(): void;
    dismissModal(): void;
    dispatch(action: Action): void;
  };
  let draws = 0;
  const dispatched: Action[] = [];
  scene.game_ = {
    state,
    dispatch(action: Action): void {
      dispatched.push(action);
    },
  };
  scene.sel = { phase: "idle" };
  scene.selectedCardSnapshot = null;
  scene.previewSlot = {
    text: "",
    visible: false,
    setText(text: string): void {
      this.text = text;
    },
    setVisible(visible: boolean): void {
      this.visible = visible;
    },
  };
  scene.drawAll = () => {
    draws += 1;
  };
  scene.clearConnector = () => {};
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

  it("previews hazard progress from the selected effective snapshot", () => {
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
    scene.game_.state = makeCoreState({
      hand: [survey, hazard],
      energy: 0,
      runModifiers: DEFAULT_RUN_MODIFIERS,
    });
    scene.showTargetPreview(hazard.id);

    expect(scene.previewSlot.visible).toBe(true);
    expect(scene.previewSlot.text).toBe("Make 2 Progress → 1 more to clear Deep Hazard");
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
      onModalChoose(spec: Extract<TargetSpec, { kind: "modal" }>, idx: number): void;
      drawAll(): void;
      clearSelectedCardSnapshot(): void;
      dismissModal(clearSnapshot?: boolean): void;
      clearConnector(): void;
    };
    let destroyed = 0;
    let draws = 0;
    scene.game_ = { state: makeCoreState({ hand: [tactic], pendingActBoon: null }) };
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
        branches: [{ kind: "GainEnergy", amount: 1 }, { kind: "Draw", player: 1 }],
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
      showModalChooser(
        snapshot: PlayerCard,
        spec: Extract<TargetSpec, { kind: "modal" }>,
      ): void;
      onModalChoose(spec: Extract<TargetSpec, { kind: "modal" }>, idx: number): void;
    };
    modalScene.showModalChooser = (snapshot, spec) => {
      snapshots.push(snapshot);
      modalSpecs.push(spec);
    };

    scene.onCardClick(choiceCard.id);

    expect(modalSpecs).toEqual([
      { kind: "modal", branches: [{ kind: "none" }, { kind: "none" }] },
    ]);
    expect(snapshots[0]?.effect).toEqual({
      kind: "Sequence",
      steps: [
        choiceCard.effect,
        { kind: "DealProgress", base: 1 },
      ],
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
  const noopBadge = { setVisible(): unknown { return noopBadge; } };
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
  once(): void {},
  off(): void {},
  removeFromDisplayList(): void {},
  addedToScene(): void {},
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
    setOrigin: (): unknown => rect,
    setRounded: (): unknown => rect,
    setAlpha: (): unknown => rect,
    setStrokeStyle: (): unknown => rect,
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

/** Scene stub satisfying the full CardView constructor (player and world cards). */
function makeRenderScene(): { scene: unknown; texts: TrackedText[]; containers: FakeContainer[] } {
  const texts: TrackedText[] = [];
  const containers: FakeContainer[] = [];
  const scene = {
    sys: {
      queueDepthSort(): void {},
      events: { once(): void {}, off(): void {} },
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
    pendingActBoon: null,
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
    expect(kw!.fontSize).toBe("9px");
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
      keywords: ["Concealed:3", "Hidden"],
      discardable: false,
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

  const badgeState: PickBadgeState = { visible: false, containerCallCount: 0, setVisibleCallCount: 0 };
  const badgeObj = {
    add(_child: unknown): unknown { return badgeObj; },
    setVisible(v: boolean): unknown {
      badgeState.visible = v;
      badgeState.setVisibleCallCount++;
      return badgeObj;
    },
  };

  const fakeGraphics = { fillStyle(): void {}, fillCircle(): void {}, setAlpha(): void {} };
  const fakeText = { setOrigin(): unknown { return fakeText; } };

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
      graphics(): unknown { return fakeGraphics; },
      text(): unknown { return fakeText; },
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
      setStrokeStyle(w: number, c?: number): unknown { rect.strokeWidth = w; rect.strokeColor = c ?? 0; return rectObj; },
      setFillStyle(c: number, a?: number): unknown { rect.fillColor = c; rect.fillAlpha = a ?? 1; return rectObj; },
    };
    const plainContainer = { list: [{}, rectObj] } as unknown as import("phaser").GameObjects.Container;
    // Must not throw even though plainContainer is not a CardView (no badge created).
    expect(() => applyCardHighlight(plainContainer, "picked", fs)).not.toThrow();
    expect(rect.strokeColor).toBe(fs.pickedBorder);
    expect(rect.fillColor).toBe(fs.pickedBorder);
    expect(rect.fillAlpha).toBeGreaterThan(0);
  });
});
