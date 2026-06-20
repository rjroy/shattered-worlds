/**
 * TableScene — the main Phaser scene that owns a GameCore instance and drives
 * the full interaction loop.
 *
 * Responsibilities:
 *  - Create / destroy card objects on every drawAll() cycle
 *  - Route pointer clicks through the selection state machine
 *  - Dispatch completed Actions to GameCore and repaint
 *  - Show win / loss screens when the game ends
 */
import Phaser from "phaser";
import { stopMainTheme } from "../audio/menuMusic";
import { worldMusicManifest } from "../data/audioManifest";
import { createGameplayRuntime, type GameplayRuntime } from "../runtime/gameplayRuntime";
import type { GameplaySession } from "../runtime/gameplaySession";
import { selectTheme } from "../view/themes/themeManifest";
import type { VisualTheme } from "../view/themes/theme";
import { availableActions, effectiveHand, effectivePlayerCard } from "../../core/index";
import type { Card, Action, PlayerCard, TargetSpec, WorldCard } from "../../core/index";
import { structuralSpecOf } from "../../core/engine/available";
import { EFFECTS } from "../../core/effects/registry";
import {
  IDLE,
  advance,
  activeModalStep,
  autoAdvances,
  beginTargeting,
  cancel,
  chooseModal,
  buildAction,
  isComplete,
  needsConfirm,
  activeStep,
  hintForSelection,
  stepSatisfied,
  togglePick,
} from "../interaction/selection";
import type { SelectionState } from "../interaction/selection";
import { classifyHighlight } from "../interaction/highlight";
import { CardView } from "../view/CardView";
import { ensureEffectIconTextures } from "../view/effectLineView";
import { HUDView } from "../view/HUDView";
import { RunSummaryView, type RunSummaryData } from "../view/RunSummaryView";
import { HelpOverlayView } from "../view/HelpOverlayView";
import { ActionConfirmationView } from "../view/ActionConfirmationView";
import { SettingsOverlayView } from "../view/SettingsOverlayView";
import { textStyle, TEXT, getRealityPalette } from "../view/presentation";
import { ringFraction, connectorLine } from "../interaction/feedback";
import type { ConnectorStyle } from "../interaction/feedback";
import { effectAtStep } from "../../core/effects/composite";
import { connectorStyleOf } from "../../core/effects/registry";
import { drawConnector } from "../view/connector";
import { resolveBranchLabels } from "../../core/view/branchLabels";
import { ModalChooserView } from "../view/ModalChooserView";
import { BoonChoiceView, type BoonChoiceOption } from "../view/BoonChoiceView";
import { CommonLabel, CommonButton } from "../view/components";
import {
  isConcealmentWarning,
  concealOf,
  isConcealed,
  describeWorldCardHooks,
  CONCEALED_HAZARD,
} from "../../core/index";
import { PileLayer } from "../view/PileLayer";
import { BackdropLayer } from "../view/backdrop";
import { worldDisplayManifest } from "../../data/worldDisplayManifest";
import { CARD_FACE, TABLE_LAYOUT } from "../view/layout";
import { rowCardPositions } from "../view/tableLayout";
import { addTooltip } from "../view/TooltipView";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Vertical centre of the world cards (hazard) row. */
const WORLD_ROW_Y = TABLE_LAYOUT.worldRowY;
/** Vertical centre of the player hand row. */
const HAND_ROW_Y = TABLE_LAYOUT.handRowY;
/**
 * Depth for the targeting connector. Cards live at the default depth 0 and the
 * win/loss overlays at 1000; 500 draws the connector over the (possibly dimmed)
 * cards while staying below the end-game screens. The connector is decorative
 * and never interactive, so this depth only affects draw order, not input.
 */
const CONNECTOR_DEPTH = TABLE_LAYOUT.connectorDepth;
// ROW_LEFT reserved for future fixed-layout mode
// const ROW_LEFT = 80

/**
 * Separator that folds the unified preview's multi-line `summaryLines` into the
 * single-line previewSlot label. previewSlot is sized to its text and sits in a
 * tight band above selectionHint, so a compact inline join reads better than
 * stacking newlines there.
 */
const PREVIEW_LINE_SEP = "\n";

/** Hover warning for a concealed hazard in the partial-intent fallback. */
const CONCEALED_HOVER_WARNING = "Target is concealed. Beware.";

/**
 * Trim a unified preview down to the minimal form shown when
 * `detailedHoverPreviews` is off: the first substantive consequence line, plus
 * every concealment warning (which must survive the trim so a hidden hook is
 * never silently dropped). Concealment lines are matched by exact constant via
 * isConcealmentWarning, not by guessing at wording.
 */
function minimalPreviewLines(summaryLines: readonly string[]): readonly string[] {
  const warnings = summaryLines.filter(isConcealmentWarning);
  const firstSubstantive = summaryLines.find((line) => !isConcealmentWarning(line));
  const lines: string[] = [];
  if (firstSubstantive !== undefined) lines.push(firstSubstantive);
  for (const warning of warnings) {
    if (!lines.includes(warning)) lines.push(warning);
  }
  return lines;
}

const TABLE_TOOLTIPS = {
  endTurn: {
    title: "End Turn",
    body: "End your turn, discard your hand, and start a new turn.",
  },
  question: {
    title: "Help",
    body: "For detailed help.",
  },
  exit: {
    title: "Exit",
    body: "Abandon this run and exit to the main menu.",
  },
  settings: {
    title: "Settings",
    body: "Adjust confirmation and preview options.",
  },
};

function playerCardDisplaySignature(card: Extract<Card, { kind: "player" }>): string {
  return JSON.stringify({
    templateId: card.templateId,
    sourceWorldId: card.sourceWorldId,
    name: card.name,
    insetKey: card.insetKey,
    energyCost: card.energyCost,
    effect: card.effect,
    keywords: card.keywords,
    exhaust: card.exhaust,
    frozen: card.frozen,
  });
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class TableScene extends Phaser.Scene {
  private game_!: GameplaySession;
  private theme_!: VisualTheme;
  private sel: SelectionState = IDLE;

  /** All live card containers, keyed by card id. */
  private cardObjects: Map<string, CardView> = new Map();
  private playerCardDisplaySignatures: Map<string, string> = new Map();

  /**
   * Id of the card currently under the pointer, or null. Maintained by the
   * pointerover/out handlers so the repaint pass can re-assert the base
   * transform on every non-hovered card without re-reading the pointer.
   */
  private hoveredCardId: string | null = null;
  private selectedCardSnapshot: PlayerCard | null = null;

  // Persistent HUD objects (created once, updated on drawAll)
  private hudView!: HUDView;
  private endTurnBtn!: CommonButton;
  private cancelBtn!: CommonButton;
  private confirmBtn!: CommonButton;
  private runSummary!: RunSummaryView;
  private helpOverlay!: HelpOverlayView;
  private settingsOverlay!: SettingsOverlayView;
  // Phase 8: the confirmation modal is instantiated and ready, but not yet
  // routed to real dispatch. Phase 9 adds maybeConfirmOrDispatch to drive it.
  private actionConfirmation!: ActionConfirmationView;
  private questionBtn!: CommonButton;
  private settingsBtn!: CommonButton;
  private exitBtn!: CommonButton;

  // Modal chooser UI (created/destroyed per card play)
  private modalChooser: ModalChooserView | null = null;
  private boonChoiceView: BoonChoiceView | null = null;
  private boonChoiceKey: string | null = null;
  private loggedBoonMissingKey: string | null = null;
  private worldMusic: Phaser.Sound.BaseSound | null = null;

  // Pile layer — persistent containers for player draw and world draw stacks
  private pileLayer!: PileLayer;

  // Backdrop: reality image + intensity-driven intrusion overlay
  private backdropLayer!: BackdropLayer;

  // Phase-instruction text ("Select a Hazard target", etc.)
  private selectionHint!: CommonLabel;

  // Live target preview ("Deals 3 → clears …"), a separate surface from the
  // instruction so the two never overwrite each other.
  private previewSlot!: CommonLabel;

  // Targeting connector: a single persistent Graphics that draws a line from the
  // acting card to the hovered legal target. Created once, redrawn on hover,
  // cleared on hover-out / commit / cancel. It is NEVER made interactive — it
  // draws only and must not hit-test (the open clicking bug forbids any new
  // pointer-eating object over the cards).
  private connectorGfx!: Phaser.GameObjects.Graphics;

  private worldId_: string = "zombie-big-box";
  private seed_: number = 0;
  private terminalSummaryShown_: boolean = false;
  private runtime_: GameplayRuntime;

  constructor(runtime?: GameplayRuntime) {
    super({ key: "Table" });
    // The app composition root (main.ts) injects the shared runtime so
    // cross-run consumers observe every session; a private fallback keeps the
    // scene constructible without one (tests, Phaser default instantiation).
    this.runtime_ = runtime ?? createGameplayRuntime();
  }

  init(data: { worldId?: string; seed?: number }): void {
    this.worldId_ = data.worldId ?? "zombie-big-box";
    this.seed_ = data.seed ?? Math.floor(Math.random() * 2 ** 32);
    this.terminalSummaryShown_ = false;
    this.cardObjects = new Map();
    this.playerCardDisplaySignatures = new Map();
    this.selectedCardSnapshot = null;
  }

  create(): void {
    stopMainTheme(this);

    // Effect-icon placeholder textures are generated (not loaded), so they
    // register here rather than in preload — before any CardView renders.
    ensureEffectIconTextures(this);

    this.game_ = this.runtime_.startSession(this.worldId_, this.seed_);
    // Registered before any other create() work can throw, so a session that
    // emitted RunStarted always gets its closing RunEnded on shutdown. Closes
    // the run as 'abandoned' when the player exits mid-run; no-op if the run
    // already ended in a win or loss.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopWorldMusic();
      // Dismiss the confirmation modal so a mid-confirmation shutdown leaves no
      // dangling callback. Also the one read of actionConfirmation in Phase 8;
      // Phase 9 wires it into the dispatch path.
      this.actionConfirmation?.hide();
      this.game_.abandon();
    });
    this.theme_ = selectTheme(this.game_.state.worldId);
    this.startWorldMusic(this.game_.state.worldId);

    this.hudView = new HUDView(this);

    const endTurnStyle = textStyle({
      fontSize: "16px",
      color: getRealityPalette(this.theme_, "text"),
      fontStyle: "bold",
    });
    this.endTurnBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.endTurn.x,
      TABLE_LAYOUT.buttons.endTurn.y,
      "[ End Turn ]",
      endTurnStyle,
    )
      .on("pointerdown", () => this.onEndTurnClick())
      // Hovering End Turn previews the EndTurn action's consequences. Attached
      // only to the existing button (no new interactive overlay), so it can
      // never steal card clicks. showEndTurnPreview self-gates on availability.
      .on("pointerover", () => this.showEndTurnPreview())
      .on("pointerout", () => this.clearPreviewSlot());
    addTooltip(this, this.endTurnBtn, TABLE_TOOLTIPS.endTurn);

    const cancelStyle = textStyle({
      fontSize: "13px",
      color: getRealityPalette(this.theme_, "cancel"),
    });
    this.cancelBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.cancel.x,
      TABLE_LAYOUT.buttons.cancel.y,
      "[ Cancel ]",
      cancelStyle,
    )
      .on("pointerdown", () => {
        this.sel = cancel();
        this.clearSelectedCardSnapshot();
        this.dismissModal();
        this.clearConnector();
        this.clearPreviewSlot();
        this.drawAll();
      })
      .setVisible(false);

    const confirmStyle = textStyle({
      fontSize: "13px",
      fontStyle: "bold",
      color: getRealityPalette(this.theme_, "confirm"),
    });
    this.confirmBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.confirm.x,
      TABLE_LAYOUT.buttons.confirm.y,
      "[ Confirm ]",
      confirmStyle,
    )
      .on("pointerdown", () => this.onConfirmClick())
      .setVisible(false);

    this.runSummary = new RunSummaryView(this);

    this.helpOverlay = new HelpOverlayView(this, this.worldId_, this.game_.state.totalActs);
    this.settingsOverlay = new SettingsOverlayView(this, this.runtime_.userSettings);
    this.actionConfirmation = new ActionConfirmationView(this);

    const questionStyle = textStyle({
      fontSize: "16px",
      fontStyle: "bold",
      color: TEXT.textLight,
    });
    this.questionBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.help.x,
      TABLE_LAYOUT.buttons.help.y,
      "?",
      questionStyle,
    ).on("pointerup", () => {
      // While a confirmation modal is open it is the top-most surface; help and
      // settings cannot be opened behind it (its depth-2500 backdrop already
      // blocks pointer clicks, but guarding here keeps the rule explicit and
      // consistent across every open path).
      if (this.actionConfirmation.isOpen) return;
      // Help and settings must not sit open at once fighting for input.
      this.settingsOverlay.close();
      this.helpOverlay.setVisible(true);
    });
    addTooltip(this, this.questionBtn, TABLE_TOOLTIPS.question);

    this.settingsBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.settings.x,
      TABLE_LAYOUT.buttons.settings.y,
      "S",
      questionStyle,
    ).on("pointerup", () => {
      // Same rule as the help button: a confirmation modal is top-most, so
      // settings cannot be opened behind it.
      if (this.actionConfirmation.isOpen) return;
      // Opening settings hides help; open() re-syncs highlights from the store.
      // This only toggles the overlay — it never dispatches or clears the run.
      this.helpOverlay.setVisible(false);
      this.settingsOverlay.open();
    });
    addTooltip(this, this.settingsBtn, TABLE_TOOLTIPS.settings);

    this.exitBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.exit.x,
      TABLE_LAYOUT.buttons.exit.y,
      "X",
      questionStyle,
    ).on("pointerup", () => {
      if (this.game_.state.status !== "playing") return;
      this.game_.abandon();
      this.showRunSummaryFromStats();
    });
    addTooltip(this, this.exitBtn, TABLE_TOOLTIPS.exit);

    this.input.keyboard?.on("keydown-ESC", () => {
      // The confirmation modal is the top-most surface. When it is open ESC
      // CANCELS it (the same path the modal's Cancel button uses: dispatch
      // nothing, reset selection to idle) and does nothing else — help/settings
      // can never be open behind it (gap C), so there is nothing else to close.
      if (this.actionConfirmation.isOpen) {
        this.actionConfirmation.hide();
        this.cancelConfirmation();
        return;
      }
      // Otherwise ESC closes whichever overlay is visible; neither dispatches or
      // clears the run.
      if (this.helpOverlay.visible) this.helpOverlay.setVisible(false);
      if (this.settingsOverlay.visible) this.settingsOverlay.close();
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key !== "1" && event.key !== "2" && event.key !== "3") return;
      this.chooseVisibleBoonOption(Number(event.key) - 1);
    });

    this.selectionHint = new CommonLabel(
      this,
      TABLE_LAYOUT.selectionHint.x,
      TABLE_LAYOUT.selectionHint.y,
      "",
      textStyle({
        fontSize: "12px",
        color: getRealityPalette(this.theme_, "text"),
      }),
    ).setVisible(false);

    // Sits in a dedicated slot directly above selectionHint. selectionHint has
    // origin (0.5, 1) at y=568, so with 12px text + 2px vertical padding it
    // tops out around y=552; anchoring previewSlot's bottom edge at y=550 keeps
    // the two surfaces from ever overlapping. Degrades fine on touch (no hover
    // means this slot simply stays empty).
    this.previewSlot = new CommonLabel(
      this,
      TABLE_LAYOUT.previewSlot.x,
      TABLE_LAYOUT.previewSlot.y,
      "",
      textStyle({
        fontSize: "12px",
        color: getRealityPalette(this.theme_, "title"),
        wordWrap: { width: 400 },
      }),
    );
    this.previewSlot.setDepth(TABLE_LAYOUT.previewDepth);
    this.previewSlot.setVisible(false);

    // Persistent connector graphic. setDepth controls draw order only; we never
    // call setInteractive on it, so Phaser keeps it out of the input hit-test
    // list and it cannot intercept clicks meant for the cards beneath it.
    this.connectorGfx = this.add.graphics();
    this.connectorGfx.setDepth(CONNECTOR_DEPTH);

    this.pileLayer = new PileLayer(this);
    this.backdropLayer = new BackdropLayer(this, selectTheme(this.game_.state.worldId));

    this.drawAll();
  }

  // ---------------------------------------------------------------------------
  // Full repaint
  // ---------------------------------------------------------------------------

  /**
   * Reconcile card objects against the current hand, apply highlights derived
   * from availableActions, and update the HUD.
   *
   * Containers persist across cycles: a card still in hand keeps its container
   * (re-positioned and re-styled), only newly-drawn cards are created, and only
   * cards that left the hand are destroyed. This is the precondition for the
   * later per-card animations — destroying/recreating every cycle would race
   * any in-flight tween. See task S3.
   *
   * Called after every dispatch and after every selection-state change that
   * affects highlights.
   */
  private drawAll(): void {
    const state = this.game_.state;

    // Update backdrop intensity before reconciling cards
    this.backdropLayer.update(state, this.game_.intensity());

    const available = availableActions(state);

    // Determine sets for highlight computation
    const playableIds = new Set(available.playable.map((p) => p.cardId));
    const discardableIds = new Set(available.discardable);

    const legalTargetIds = this.currentLegalTargetIds();

    // If a hovered card is no longer a legal target after this repaint
    // (e.g. drawAll fired mid-hover and the phase/legal set changed),
    // drop the stored hovered id and restore that
    // container's base transform. (Case (a) hover-out and case (c) card-left-hand
    // are handled in the pointerout handler and the destruction pass below.)
    if (this.hoveredCardId !== null && !legalTargetIds.has(this.hoveredCardId)) {
      const stale = this.cardObjects.get(this.hoveredCardId);
      if (stale !== undefined) stale.clearEmphasis();
      this.hoveredCardId = null;
    }

    // Split hand into world row and effective player row for layout. Effective
    // cards preserve base ids, so reconciliation and dispatch still address the
    // durable cards in GameState while the visible player faces show current
    // read-model modifiers.
    const visibleHand = effectiveHand(state);
    const worldCards = visibleHand.filter(
      (c): c is import("../../core/index").WorldCard => c.kind === "world",
    );
    const playerCards = visibleHand.filter((c) => c.kind === "player");

    // Reconcile each row in place; collect the ids that should still exist after
    // this cycle so anything no longer desired can be destroyed afterward.
    const desiredIds = new Set<string>();
    this.layoutRow(
      worldCards,
      WORLD_ROW_Y,
      playableIds,
      discardableIds,
      legalTargetIds,
      desiredIds,
    );
    this.layoutRow(
      playerCards,
      HAND_ROW_Y,
      playableIds,
      discardableIds,
      legalTargetIds,
      desiredIds,
    );

    // Destroy containers whose card left the hand. Never touches a card still in
    // state.hand — only ids absent from desiredIds. Kill any tweens on the
    // container first so a recycled Tween can never retarget a live object.
    for (const [id, container] of this.cardObjects) {
      if (desiredIds.has(id)) continue;
      this.tweens.killTweensOf(container);
      this.tweens.killTweensOf(container.list);
      if (this.hoveredCardId === id) this.hoveredCardId = null;
      container.destroy();
      this.cardObjects.delete(id);
      this.playerCardDisplaySignatures.delete(id);
    }

    // HUD
    this.hudView.update(state);

    // Pile stacks (player draw + world draw)
    this.pileLayer.update(
      this,
      state.playerDraw.length,
      state.worldDraw.length,
      state.playerDiscard.length,
    );

    // End Turn button
    const selectionActive = this.sel.phase !== "idle";
    this.endTurnBtn.setAlpha(selectionActive ? 0.35 : 1.0);
    this.endTurnBtn.disableInteractive();
    if (!selectionActive && available.canEndTurn) {
      this.endTurnBtn.setInteractive({ useHandCursor: true });
    }

    // Cancel / Confirm buttons
    this.cancelBtn.setVisible(selectionActive);
    const showConfirm =
      this.sel.phase === "targeting" && needsConfirm(this.sel) && stepSatisfied(this.sel);
    this.confirmBtn.setVisible(showConfirm);

    // Selection hint text
    this.updateHint();

    // Terminal summary
    if (state.status === "won" || state.status === "lost") {
      this.showRunSummaryFromStats();
    }

    // Cleanup the interactivity of objects at game end.
    if (state.status !== "playing" || this.runSummary.visible) {
      this.questionBtn.disableInteractive();
      this.questionBtn.setVisible(false);
      this.settingsBtn.disableInteractive();
      this.settingsBtn.setVisible(false);
      this.exitBtn.disableInteractive();
      this.helpOverlay.setVisible(false);
      this.settingsOverlay.close();
      // A confirmation modal must never survive into the terminal/cleanup state;
      // hide() drops it without firing its commit/cancel callbacks.
      this.actionConfirmation.hide();
    }

    this.updateBoonChoiceView();
  }

  private buildRunSummaryData(): RunSummaryData | null {
    const lifetime = this.runtime_.runStats.lifetime();
    const lastRun = lifetime.lastRun;
    if (lastRun === undefined) return null;

    const display = worldDisplayManifest[lastRun.worldId];
    const worldStats = lifetime.byWorld[lastRun.worldId];

    return {
      outcome: lastRun.outcome,
      worldName: display?.name ?? lastRun.worldId,
      runNumber: lifetime.runs,
      worldWins: worldStats?.wins ?? 0,
      activeDurationMs: lastRun.activeDurationMs,
      turns: lastRun.turns,
      cardsPlayed: lastRun.cardsPlayed,
      progressDealt: lastRun.progressDealt,
      damageTaken: lastRun.damageTaken,
      hazardsResolved: lastRun.hazardsResolved,
      hazardsDiscarded: lastRun.hazardsDiscarded,
      cardsDiscarded: lastRun.cardsDiscarded,
      records: this.runtime_.runStats.lastRunRecords(),
      featsEarned: this.runtime_.featEvaluator.lastRunEarned(),
    };
  }

  private showRunSummaryFromStats(): void {
    if (this.terminalSummaryShown_) return;

    const data = this.buildRunSummaryData();
    if (data === null) return;

    this.terminalSummaryShown_ = true;
    // Drop any lingering targeting feedback before the summary covers the table.
    this.clearConnector();
    this.clearPreviewSlot();
    // The terminal run summary must never appear with a confirmation modal still
    // on top of it; hide() drops it without firing its callbacks.
    this.actionConfirmation.hide();
    this.helpOverlay.setVisible(false);
    this.settingsOverlay.close();
    this.questionBtn.disableInteractive();
    this.questionBtn.setVisible(false);
    this.settingsBtn.disableInteractive();
    this.settingsBtn.setVisible(false);
    this.exitBtn.disableInteractive();
    this.runSummary.show(data, () => {
      this.scene.start("WorldSelect");
    });
  }

  /**
   * Reconcile one row of cards in place. Each desired card keeps its container
   * if it already exists (re-positioned and re-styled), or is created once with
   * its handlers attached exactly once. Records every laid-out id in
   * `desiredIds` so drawAll can destroy whatever is left over.
   */
  private layoutRow(
    cards: readonly Card[],
    rowY: number,
    playableIds: Set<string>,
    discardableIds: Set<string>,
    legalTargetIds: Set<string>,
    desiredIds: Set<string>,
  ): void {
    const positions = rowCardPositions(cards.length, rowY);

    cards.forEach((card, i) => {
      const { x, y } = positions[i]!;
      const container = this.obtainCardContainer(card);
      desiredIds.add(card.id);

      // Position is mutable per cycle (a card may shift slots as the hand
      // changes). The static face was set once, at creation.
      container.setCardPosition(x, y);

      // Re-apply mutable visual state every cycle, reused or freshly created.
      this.applyHighlight(container, card, playableIds, discardableIds, legalTargetIds);

      // Emphasis re-assert: a reused container must never keep stale
      // emphasis. Re-assert the BASE transform (scale 1, glow off) on every card
      // that is NOT the still-legal hovered one; the hovered-and-still-legal card
      // KEEPS its emphasis (re-applied idempotently so the magnitude tracks the
      // current intensity without jitter). drawAll already cleared hoveredCardId
      // for any hovered card that is no longer legal (seam case b), so reaching
      // here with hoveredCardId === card.id means the card is still a legal
      // target.
      if (this.hoveredCardId === card.id) {
        container.emphasize(this.theme_.frameStyle.targetGlow, this.game_.intensity());
      } else {
        container.clearEmphasis();
      }

      // World cards carry a progress ring around the cost digit. Animate it
      // toward the current accumulated progress every cycle (idempotent on an
      // unchanged target). Banking raises the target (ring fills); the
      // end-of-turn progress wipe drops it to 0 (the same ring drains) — one
      // clock. Player cards have no ring; updateCostRing no-ops on them, but
      // only world cards reach here with a costRing so guard by kind to keep
      // intent explicit.
      if (card.kind === "world") {
        const progress = this.game_.state.progress[card.id] ?? 0;
        const fraction = ringFraction(progress, card.cost);
        container.updateCostRing(fraction, this.theme_.frameStyle.ringAccent);

        // Fog-back reconcile: re-read Light every cycle so a card concealed at
        // the current depth shows its fog-back and identity stays hidden. This
        // is the LightChanged transition — EndTurn decay and a played GainLight
        // both repaint via drawAll, so the fog-back tracks Light with no event
        // subscription. Purely cosmetic; never feeds back into core state.
        container.applyConcealment(this.game_.state.light);
      }
    });
  }

  /**
   * Return the persistent container for a card, reusing the existing one if the
   * card is already on the table. A newly-created container gets its interactive
   * size and pointer handlers wired exactly once — the handlers capture only the
   * stable card id and read live scene state (`this.sel`) at call time, so they
   * stay correct across cycles and must never be re-bound on reuse (re-binding
   * accumulates duplicate listeners — the suspected input bug from the rollout).
   */
  private obtainCardContainer(card: Card): CardView {
    const existing = this.cardObjects.get(card.id);
    if (existing !== undefined) {
      if (card.kind !== "player") return existing;

      const signature = playerCardDisplaySignature(card);
      if (this.playerCardDisplaySignatures.get(card.id) === signature) return existing;

      this.tweens.killTweensOf(existing);
      this.tweens.killTweensOf(existing.list);
      existing.destroy();
      this.cardObjects.delete(card.id);
      this.playerCardDisplaySignatures.delete(card.id);
    }

    const container = new CardView(this, card, 0, 0, this.theme_, selectTheme);
    this.cardObjects.set(card.id, container);
    if (card.kind === "player") {
      this.playerCardDisplaySignatures.set(card.id, playerCardDisplaySignature(card));
    }

    // Make card interactive
    container.setSize(CARD_FACE.width, CARD_FACE.height);
    container.setInteractive({ useHandCursor: true });

    const id = card.id;

    // Main card click — player and world cards both route through onCardClick,
    // which decides play / target / discard from availableActions live.
    container.on("pointerdown", () => this.onCardClick(id));

    // Hovering a legal Hazard target during targeting shows the live preview
    // (Progress dealt, and whether it clears the Hazard). Track the hovered id
    // so a later phase can re-assert base transform on non-hovered cards.
    container.on("pointerover", () => {
      // No hover preview behind an open confirmation modal.
      if (this.actionConfirmation.isOpen) return;
      this.hoveredCardId = id;
      this.showTargetPreview(id);
      // Idle world-card preview: when no selection is active, hovering a world
      // card summarizes its own hooks (end-of-turn, and on-discard if
      // discardable). Gated on the idle phase, so targeting preview keeps
      // priority and the two never both render.
      if (this.sel.phase === "idle" && card.kind === "world") {
        this.showIdleWorldPreview(card);
      }
      // Connector generalizes across all three targeting phases (the preview
      // text is hazard-only). showConnector gates on phase + legal target.
      this.showConnector(id);
      // Hover emphasis: only a card that is a legal target RIGHT NOW
      // gets lifted + ringed. Player cards are never legal targets, so this
      // gate keeps emphasis off them. Magnitude scales with intensity().
      this.emphasizeIfLegalTarget(id, container);
      this.emphasizeIfPlayable(id, container);
    });
    container.on("pointerout", (pointer: Phaser.Input.Pointer) => {
      // Interactive children (effect icons/tooltips) can become the top hit
      // target while the cursor is still visually over the card. In that case
      // keep the card lifted; clearing here would shrink the icon out from
      // under the cursor and produce hover bounce.
      if (this.pointerInsideCardVisual(pointer, container)) return;

      // Seam case (a): pointer-out clears the stored hovered id AND restores
      // this container's base transform (scale 1, glow off).
      if (this.hoveredCardId === id) this.hoveredCardId = null;
      container.clearEmphasis();
      // Instruction stays stable in its own slot; clear only the preview slot.
      this.updateHint();
      this.clearPreviewSlot();
      // No stale line may survive hover-out.
      this.clearConnector();
    });

    return container;
  }

  private pointerInsideCardVisual(pointer: Phaser.Input.Pointer, container: CardView): boolean {
    const x = pointer.worldX ?? pointer.x;
    const y = pointer.worldY ?? pointer.y;
    const halfW = (CARD_FACE.width * container.scaleX) / 2;
    const halfH = (CARD_FACE.height * container.scaleY) / 2;
    return Math.abs(x - container.x) <= halfW && Math.abs(y - container.y) <= halfH;
  }

  /** Apply the correct highlight and alpha to a card container. */
  private applyHighlight(
    container: CardView,
    card: Card,
    playableIds: Set<string>,
    discardableIds: Set<string>,
    legalTargetIds: Set<string>,
  ): void {
    const { kind, dim } = classifyHighlight(
      this.sel,
      card,
      playableIds,
      discardableIds,
      legalTargetIds,
    );
    container.applyHighlight(kind, this.theme_.frameStyle);
    container.setDimmed(dim);
  }

  // ---------------------------------------------------------------------------
  // Interaction handlers
  // ---------------------------------------------------------------------------

  private onCardClick(cardId: string): void {
    // While the confirmation modal is open all table input is inert.
    if (this.actionConfirmation.isOpen) return;
    const state = this.game_.state;
    if (state.status !== "playing") return;
    if (state.pendingBoonChoices.length > 0) return;

    const available = availableActions(state);

    // ---- Idle: check what this card can do ----
    if (this.sel.phase === "idle") {
      // Check if it's a discardable world card
      if (available.discardable.includes(cardId)) {
        this.onDiscardClick(cardId);
        return;
      }

      const entry = available.playable.find((p) => p.cardId === cardId);
      if (entry === undefined) return; // not playable

      const baseCard = state.hand.find((c) => c.id === cardId);
      if (baseCard?.kind !== "player") return;

      const snapshot = effectivePlayerCard(baseCard, state);
      const spec = structuralSpecOf(snapshot.effect);
      this.nextSelection(snapshot, spec);
      return;
    }

    // ---- Active targeting: check if this is legal for the current step ----
    if (this.sel.phase === "targeting" && !isComplete(this.sel)) {
      if (!this.currentLegalTargetIds().has(cardId)) return;

      this.sel = togglePick(this.sel, cardId);
      if (autoAdvances(this.sel)) {
        this.advanceSelection();
        return;
      }
      this.clearConnector();
      this.drawAll();
      return;
    }
  }

  /** Begin a new selection for a playable card. */
  private nextSelection(snapshot: PlayerCard, spec: TargetSpec): void {
    const cardId = snapshot.id;
    this.dismissModal();
    this.selectedCardSnapshot = snapshot;

    switch (spec.kind) {
      case "modal": {
        this.sel = { phase: "awaiting-modal", cardId };
        this.showModalChooser(snapshot, spec);
        return;
      }
    }

    this.sel = beginTargeting(cardId, spec);
    this.continueSelection();
  }

  private onDiscardClick(cardId: string): void {
    if (this.actionConfirmation.isOpen) return;
    if (this.game_.state.pendingBoonChoices.length > 0) return;
    const available = availableActions(this.game_.state);
    if (available.discardable.includes(cardId)) {
      this.maybeConfirmOrDispatch({ type: "DiscardHazard", cardId });
    }
  }

  private onEndTurnClick(): void {
    if (this.actionConfirmation.isOpen) return;
    if (this.game_.state.pendingBoonChoices.length > 0) return;
    if (this.sel.phase !== "idle") return;
    this.maybeConfirmOrDispatch({ type: "EndTurn" });
  }

  private onConfirmClick(): void {
    if (this.actionConfirmation.isOpen) return;
    if (this.game_.state.pendingBoonChoices.length > 0) return;
    if (!stepSatisfied(this.sel)) return;
    this.advanceSelection();
  }

  private advanceSelection(): void {
    this.sel = advance(this.sel);
    this.clearConnector();
    this.clearPreviewSlot();
    this.continueSelection();
  }

  private continueSelection(): void {
    if (isComplete(this.sel)) {
      const action = buildAction(this.sel);
      if (action !== null) {
        this.maybeConfirmOrDispatch(action);
        return;
      }
    }

    const modalStep = activeModalStep(this.sel);
    if (modalStep !== null && this.selectedCardSnapshot !== null) {
      this.drawAll();
      this.showModalChooser(this.selectedCardSnapshot, modalStep);
      return;
    }

    this.drawAll();
  }

  // ---------------------------------------------------------------------------
  // Modal chooser
  // ---------------------------------------------------------------------------

  private showModalChooser(
    snapshot: PlayerCard,
    spec: Extract<TargetSpec, { kind: "modal" }>,
  ): void {
    if (this.game_.state.pendingBoonChoices.length > 0) return;

    const available = availableActions(this.game_.state);
    // Label each branch from the card's actual Modal effect, so the chooser can
    // never drift from what the card does.
    const effectBranches = this.effectBranchesForModalStep(snapshot);
    const branches = resolveBranchLabels(spec.branches, effectBranches, available, snapshot.id);

    this.modalChooser = new ModalChooserView(
      this,
      this.theme_,
      branches,
      (idx) => this.onModalChoose(spec, idx),
      () => {
        this.sel = cancel();
        this.clearSelectedCardSnapshot();
        this.dismissModal();
        this.clearConnector();
        this.clearPreviewSlot();
        this.drawAll();
      },
    );
  }

  /** Apply a chosen modal branch: advance selection, or commit if it's a 'none' branch. */
  private onModalChoose(spec: Extract<TargetSpec, { kind: "modal" }>, idx: number): void {
    // A confirmation can only open after the chooser is dismissed, so they never
    // coexist; this guard keeps that invariant explicit if the order ever shifts.
    if (this.actionConfirmation.isOpen) return;
    if (this.game_.state.pendingBoonChoices.length > 0) return;
    this.dismissModal(false);
    const newSel = chooseModal(this.sel, idx, spec);
    this.sel = newSel;

    // If the branch is 'none' after modal, commit immediately with choice. The
    // chooser has already been dismissed above, so the confirmation modal (if
    // one opens) never overlaps the chooser.
    if (isComplete(newSel)) {
      const action = buildAction(newSel);
      if (action !== null) {
        this.maybeConfirmOrDispatch(action);
        return;
      }
    }

    this.continueSelection();
  }

  private effectBranchesForModalStep(snapshot: PlayerCard): PlayerCard["effect"][] {
    if (snapshot.effect.kind === "Modal") {
      return [...snapshot.effect.branches];
    }

    if (this.sel.phase !== "targeting" || this.sel.stepIdx >= this.sel.steps.length) {
      return [];
    }

    const stepEffect = effectAtStep(snapshot.effect, this.sel.stepIdx);
    return stepEffect?.kind === "Modal" ? [...stepEffect.branches] : [];
  }

  private dismissModal(clearSnapshot = true): void {
    if (this.modalChooser !== null) {
      this.modalChooser.destroy();
      this.modalChooser = null;
    }
    if (clearSnapshot) {
      this.clearSelectedCardSnapshot();
    }
  }

  // ---------------------------------------------------------------------------
  // Confirmation gate
  // ---------------------------------------------------------------------------

  /**
   * The single entry point for every user-initiated COMMITTED action (play a
   * card, discard a hazard, end the turn). It consults the confirmation mode and
   * the action preview, then either commits the action immediately or opens the
   * ActionConfirmationView. Boon choices are NOT routed here — choosing a boon is
   * already a modal commitment, so those call this.dispatch directly.
   *
   * Revalidation: while the confirmation modal is open the underlying table input
   * is fully blocked (every input handler early-returns on
   * actionConfirmation.isOpen), and the core never mutates state on its own — it
   * is deterministic and only changes on dispatch. So no timer, async callback,
   * or background path can alter the game state between building `action` here
   * and committing it on confirm. The stored action therefore stays valid and we
   * do not re-run availability checks at commit time.
   */
  private maybeConfirmOrDispatch(action: Action): void {
    // Never stack a second confirmation on top of an open one.
    if (this.actionConfirmation.isOpen) return;

    const preview = this.game_.preview(action);

    // A non-previewable action has no consequence lines, so a confirmation modal
    // would render blank. Callers here only ever build legal actions, and the
    // preview engine (not the modal) is the surface that would have shown
    // nothing; dispatch directly and let the core reducer stay the authority
    // (it throws if the action is truly illegal). Previewable actions are
    // unaffected.
    if (!preview.previewable) {
      this.dispatch(action);
      return;
    }

    const mode = this.runtime_.userSettings.get().confirmationMode;

    const shouldConfirm =
      mode === "always" ||
      (mode === "risk-only" && (preview.risk === "attention" || preview.risk === "harmful"));

    if (!shouldConfirm) {
      this.dispatch(action);
      return;
    }

    // Capture the exact action and preview in the commit closure so the modal
    // commits precisely what was previewed. The view guards onCommit to fire at
    // most once per show.
    this.actionConfirmation.show({
      title: this.confirmationTitle(action),
      lines: preview.summaryLines,
      onCommit: () => this.dispatch(action),
      onCancel: () => this.cancelConfirmation(),
    });
  }

  /**
   * Human-readable title for the confirmation modal. Concealment-safe: when the
   * action names a world card that is concealed at the current Light level, the
   * title uses a generic name (CONCEALED_HAZARD) instead of the real one so a
   * hidden hazard's identity never leaks through the modal title. Uses the same
   * isConcealed check the preview/describe layer uses.
   */
  private confirmationTitle(action: Action): string {
    const state = this.game_.state;
    switch (action.type) {
      case "EndTurn":
        return "End Turn";
      case "PlayCard": {
        const card = state.hand.find((c) => c.id === action.cardId);
        return `Play ${this.safeCardName(card)}`;
      }
      case "DiscardHazard": {
        const card = state.hand.find((c) => c.id === action.cardId);
        return `Discard ${this.safeCardName(card)}`;
      }
      default:
        return "Confirm";
    }
  }

  /**
   * Resolve a card's display name, masking it to CONCEALED_HAZARD when the card
   * is a world card concealed at the current Light. Falls back to the generic
   * concealed name when the card is missing.
   */
  private safeCardName(card: Card | undefined): string {
    if (card === undefined) return CONCEALED_HAZARD;
    if (card.kind === "world" && isConcealed(card, this.game_.state.light)) {
      return CONCEALED_HAZARD;
    }
    return card.name;
  }

  /**
   * Cancel an open confirmation: dispatch NOTHING, and fully reset any stale
   * selection UI back to idle so no half-cleared selection survives. Mirrors the
   * cleanup the Cancel button performs (Assumption 6: a cancelled confirmation
   * returns to idle rather than back to mid-selection). The Phase-8 view auto-
   * hides itself before invoking this callback.
   */
  private cancelConfirmation(): void {
    this.sel = IDLE;
    this.clearSelectedCardSnapshot();
    this.dismissModal();
    this.clearConnector();
    this.clearPreviewSlot();
    this.drawAll();
  }

  // ---------------------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------------------

  private dispatch(action: Action): void {
    this.game_.dispatch(action);
    this.sel = IDLE;
    this.clearSelectedCardSnapshot();
    this.dismissModal();
    this.updateBoonChoiceView();
    // Commit ends targeting; drop the connector and preview so nothing survives
    // the action.
    this.clearConnector();
    this.clearPreviewSlot();
    this.drawAll();
  }

  private startWorldMusic(worldId: string): Promise<void> {
    this.stopWorldMusic();

    const music = worldMusicManifest[worldId];
    if (music === undefined) {
      console.warn(`[TableScene] No music asset configured for world: ${worldId}`);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const resolveMusic = () => {
        this.worldMusic = this.sound.add(music.key, {
          loop: true,
          volume: 0.45,
        });
        this.worldMusic.play();
        resolve();
      };

      if (!this.cache.audio.exists(music.key)) {
        this.load.audio(music.key, music.url);
        this.load.once("filecomplete", (key: string) => {
          if (key === music.key) {
            resolveMusic();
          }
        });
        this.load.once("loaderror", (file: Phaser.Loader.File) => {
          if (file.key === music.key) {
            reject(new Error(`Failed to load music asset: ${music.key}`));
          }
        });
        this.load.start();
      } else {
        resolveMusic();
      }
    });
  }

  private stopWorldMusic(): void {
    if (this.worldMusic === null) return;
    this.worldMusic.stop();
    this.worldMusic.destroy();
    this.worldMusic = null;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * The set of legal target card ids for the active targeting phase and its
   * captured current step, or an empty set when no targeting phase is active.
   * Target ids come from the core effect registry for the captured effective
   * card snapshot, so scene highlighting/click acceptance matches reducer
   * legality semantics without letting mid-selection card modifier drift reshape
   * the selected effect path.
   */
  private currentLegalTargetIds(): Set<string> {
    if (this.sel.phase !== "targeting" || isComplete(this.sel)) {
      return new Set<string>();
    }
    const card = this.actingPlayerCardFor(this.sel.cardId);
    if (card === null) return new Set<string>();

    const effect = this.effectForSelectionStep(card, this.sel);
    if (effect === null) return new Set<string>();

    const handler = EFFECTS[effect.kind];
    return new Set(handler.legalTargets(effect as never, card.id, this.game_.state));
  }

  private effectForSelectionStep(
    card: PlayerCard,
    sel: Extract<SelectionState, { phase: "targeting" }>,
  ): PlayerCard["effect"] | null {
    if (card.effect.kind === "Modal") {
      if (sel.choice === undefined) return null;
      const branch = card.effect.branches[sel.choice];
      return branch === undefined ? null : effectAtStep(branch, sel.stepIdx);
    }

    const stepEffect = effectAtStep(card.effect, sel.stepIdx);
    if (stepEffect?.kind === "Modal") {
      if (sel.choice === undefined) return null;
      return stepEffect.branches[sel.choice] ?? null;
    }

    return stepEffect;
  }

  /**
   * While targeting a Hazard, write the live preview for the Hazard under the
   * pointer into its own slot (previewSlot): the consequence summary of applying
   * the hovered target to the current step. The phase instruction in
   * selectionHint is untouched. No-ops unless this card is a legal target right
   * now.
   *
   * The preview is the SAME unified engine the confirmation flow uses
   * (game_.preview). We synthesise a CANDIDATE selection — "the player picked the
   * hovered target for the current step" — via the real selection helpers
   * (togglePick + advance), so the action built is byte-identical to the one a
   * click would dispatch, and modifiers carried by the acting snapshot are
   * reflected. For a single-target hazard step that completes the selection, so
   * buildAction returns a full PlayCard we can preview. For a compound card whose
   * hazard step is not last, the candidate is still incomplete; we fall back to a
   * concise targeted line rather than failing silently.
   */
  private showTargetPreview(targetId: string): void {
    const sel = this.sel;
    if (sel.phase !== "targeting" || isComplete(sel)) return;
    if (sel.steps[sel.stepIdx]?.kind !== "hazard") return;

    const state = this.game_.state;
    if (!this.currentLegalTargetIds().has(targetId)) return;

    const card = this.actingPlayerCardFor(sel.cardId);
    const target = state.hand.find((c) => c.id === targetId);
    if (card === null || target?.kind !== "world") return;

    // Fold the hovered target into the current step exactly as a click would,
    // then advance. For the common single-target hazard step this completes the
    // selection; buildAction then yields the real PlayCard action.
    const candidate = advance(togglePick(sel, targetId));
    const action = buildAction(candidate);

    if (action === null) {
      // Partial-intent fallback: the hazard step is one of several (compound
      // card), so no full action exists yet. Surface a concise targeted line
      // rather than nothing. A concealed target hides its math, so warn instead.
      this.renderPartialTargetPreview(target, state.light);
      return;
    }

    const preview = this.game_.preview(action);
    // Drop the leading "Play <card>" line: the hover slot already sits beside the
    // acting card, so restating which card is played is noise. The consequence
    // lines (Progress, clears, warnings) are what previewPlay surfaced.
    const consequences = preview.summaryLines.filter((line) => line !== `Play ${card.name}`);
    if (!preview.previewable || consequences.length === 0) {
      this.previewSlot.setVisible(false);
      return;
    }

    const detailed = this.runtime_.userSettings.get().detailedHoverPreviews;
    const lines = detailed ? consequences : minimalPreviewLines(consequences);
    this.showPreviewSlot(lines.join(PREVIEW_LINE_SEP));
  }

  /**
   * Partial-intent fallback for a hazard step that is not the final step of a
   * compound selection (so no complete action can be previewed yet). Names the
   * hovered hazard, or warns when it is concealed. Kept minimal on purpose; it
   * does NOT reconstruct the full per-event summary.
   */
  private renderPartialTargetPreview(target: WorldCard, light: number): void {
    const text = isConcealed(target, light)
      ? `${CONCEALED_HOVER_WARNING} (needs Light ${concealOf(target)})`
      : `Target ${target.name}`;
    this.showPreviewSlot(text);
  }

  /**
   * Idle (no-selection) hover preview for a world card: summarize what the card
   * will do on its own — its end-of-turn hook, and its on-discard hook when it
   * is discardable — into previewSlot. Reads from `describeWorldCardHooks`, the
   * same core source the card face and target preview read, so the wording can
   * never disagree; that source is concealment-safe (a fogged card yields only
   * the generic warning). Renders nothing when the card has no meaningful hooks.
   *
   * Only meaningful in the idle phase; the caller already gates on that, so this
   * stays out of the targeting preview's way (targeted preview keeps priority).
   */
  private showIdleWorldPreview(card: WorldCard): void {
    if (this.sel.phase !== "idle") return;

    const hooks = describeWorldCardHooks(card, this.game_.state);
    if (hooks.length === 0) {
      this.previewSlot.setVisible(false);
      return;
    }

    const detailed = this.runtime_.userSettings.get().detailedHoverPreviews;
    const lines = detailed ? hooks : minimalPreviewLines(hooks);
    this.showPreviewSlot(lines.join(PREVIEW_LINE_SEP));
  }

  /**
   * Hover preview for the End Turn button: surface the consequences of ending
   * the turn now (world hooks firing, decay, refill) via the same unified
   * `game_.preview` engine the confirmation flow uses. Only shown when ending
   * the turn is actually available — the button is non-interactive while a
   * selection is mid-flight or when canEndTurn is false, and previewing then
   * would advertise an action the player cannot take. Concealment survival and
   * off-mode trimming match the targeted preview.
   */
  private showEndTurnPreview(): void {
    // No preview behind an open confirmation modal.
    if (this.actionConfirmation.isOpen) return;
    // Mirror the interactive gate from drawAll: no preview while a selection is
    // active (the button is dimmed and disabled then).
    if (this.sel.phase !== "idle") return;

    const preview = this.game_.preview({ type: "EndTurn" });
    if (!preview.previewable || preview.summaryLines.length === 0) {
      this.previewSlot.setVisible(false);
      return;
    }

    const detailed = this.runtime_.userSettings.get().detailedHoverPreviews;
    const lines = detailed ? preview.summaryLines : minimalPreviewLines(preview.summaryLines);
    this.showPreviewSlot(lines.join(PREVIEW_LINE_SEP));
  }

  /**
   * Apply hover emphasis to a card iff it is a legal target for the active
   * targeting step. Reads the same currentLegalTargetIds set the per-cycle pass
   * uses, so a player card (never a legal target) is never emphasized, and the
   * hover read matches exactly which cards show the `target` border. Magnitude
   * scales with this.game_.intensity() (FEEDBACK-12 emphasis half).
   */
  private emphasizeIfLegalTarget(cardId: string, container: CardView): void {
    if (!this.currentLegalTargetIds().has(cardId)) return;
    container.emphasize(this.theme_.frameStyle.targetGlow, this.game_.intensity());
  }

  private emphasizeIfPlayable(cardId: string, container: CardView): void {
    if (this.sel.phase !== "idle") return;
    const available = availableActions(this.game_.state);
    if (!available.playable.some((p) => p.cardId === cardId)) return;
    container.emphasize(this.theme_.frameStyle.playableGlow, this.game_.intensity());
  }

  /**
   * Draw a connector from the acting card to the legal target currently under
   * the pointer. Active for targeting steps that use visible card-to-card
   * targeting; any other phase no-ops. The target must be legal for the current step, and both
   * the acting and target containers must still exist (they persist across
   * cycles since S3). Redraws from a clean slate every call so the previous
   * frame's line never lingers.
   *
   * S8 decorates the line by ConnectorStyle (progress / destroy / return). The
   * style is resolved from the acting card's effect *for the current step* — a
   * compound card (Barricade) deals progress in step 0 and returns world cards
   * in step 1, so the connector must follow the active targeting phase, not the
   * card as a whole. See stepConnectorStyle() for the per-step style lookup.
   */
  private showConnector(targetId: string): void {
    const sel = this.sel;
    if (sel.phase !== "targeting" || isComplete(sel)) {
      return;
    }
    const currentStep = sel.steps[sel.stepIdx];
    if (
      currentStep?.kind !== "hazard" &&
      currentStep?.kind !== "destroyHand" &&
      currentStep?.kind !== "returnWorld"
    )
      return;

    const step = activeStep(sel);
    if (!this.currentLegalTargetIds().has(targetId)) return;

    const source = this.cardObjects.get(sel.cardId);
    const target = this.cardObjects.get(targetId);
    if (source === undefined || target === undefined) return;

    const { from, to } = connectorLine(source, target);
    // Resolve the style from the acting card's effect for THIS step, then render.
    const style = this.stepConnectorStyle(sel.cardId, step);
    this.connectorGfx.clear();
    drawConnector(
      this.connectorGfx,
      style,
      from,
      to,
      this.pileLayer.worldPileCenter(),
      this.theme_.frameStyle,
    );
  }

  /**
   * Resolve the ConnectorStyle for the acting card's effect at `step` (looked up
   * through any Sequence/Modal via effectAtStep, so the style tracks the active
   * branch/step rather than the card as a whole). Null when no effect is found;
   * drawConnector then falls back to the plain accent line.
   */
  private stepConnectorStyle(cardId: string, step: number): ConnectorStyle | null {
    const card = this.actingPlayerCardFor(cardId);
    if (card === null) return null;
    const effect = effectAtStep(card.effect, step);
    return effect !== null ? connectorStyleOf(effect) : null;
  }

  private actingPlayerCardFor(cardId: string): PlayerCard | null {
    if (
      this.sel.phase !== "idle" &&
      this.sel.cardId === cardId &&
      this.selectedCardSnapshot?.id === cardId
    ) {
      return this.selectedCardSnapshot;
    }

    const card = this.game_.state.hand.find((c) => c.id === cardId);
    return card?.kind === "player" ? card : null;
  }

  private clearSelectedCardSnapshot(): void {
    this.selectedCardSnapshot = null;
  }

  /** Remove any drawn connector. Safe to call when nothing is drawn. */
  private clearConnector(): void {
    this.connectorGfx.clear();
  }

  private showPreviewSlot(message: string): void {
    this.previewSlot.setText(message);
    this.previewSlot.setVisible(true);
    this.previewSlot.setY(TABLE_LAYOUT.previewSlot.y - this.previewSlot.getBgHeight() / 2);
  }

  /** Hide and blank the targeted-hover preview. Safe to call when already empty. */
  private clearPreviewSlot(): void {
    this.previewSlot.setText("");
    this.previewSlot.setVisible(false);
  }

  private updateHint(): void {
    const { text, visible } = hintForSelection(this.sel);
    this.selectionHint.setText(text);
    this.selectionHint.setVisible(visible);
  }

  private updateBoonChoiceView(): void {
    const pending = this.game_.state.pendingBoonChoices[0];
    if (pending === undefined) {
      this.dismissBoonChoiceView();
      return;
    }

    const key = `${pending.source}\u0000${pending.setId}\u0000${pending.bToDiscard}\u0000${pending.offeredTemplateIds.join("\u0000")}`;
    if (this.boonChoiceView !== null && this.boonChoiceKey === key) return;

    this.dismissModal();
    this.sel = IDLE;
    this.clearSelectedCardSnapshot();
    this.clearConnector();
    this.dismissBoonChoiceView();

    const options: BoonChoiceOption[] = pending.offeredTemplateIds.map((templateId) => ({
      templateId,
      template: this.game_.template(templateId),
    }));
    const missing = options
      .filter((option) => option.template === undefined)
      .map((option) => option.templateId);
    if (missing.length > 0 && this.loggedBoonMissingKey !== key) {
      this.loggedBoonMissingKey = key;
      console.error(
        `[TableScene] Pending boon choice references missing template(s): ${missing.join(", ")}`,
      );
    }

    this.boonChoiceView = new BoonChoiceView(this, {
      theme: this.theme_,
      source: pending.source,
      bToDiscard: pending.bToDiscard,
      options,
      resolveTheme: selectTheme,
      onChoose: (templateId: string) => this.dispatch({ type: "ChooseBoon", templateId }),
    });
    this.boonChoiceKey = key;
  }

  private dismissBoonChoiceView(): void {
    if (this.boonChoiceView === null) return;
    this.boonChoiceView.destroy();
    this.boonChoiceView = null;
    this.boonChoiceKey = null;
  }

  private chooseVisibleBoonOption(index: number): void {
    const pending = this.game_.state.pendingBoonChoices[0];
    if (pending === undefined) return;
    const templateId = pending.offeredTemplateIds[index];
    if (templateId === undefined) return;
    if (this.game_.template(templateId) === undefined) return;
    this.dispatch({ type: "ChooseBoon", templateId });
  }
}
