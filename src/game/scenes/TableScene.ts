/**
 * TableScene — the main Phaser scene that owns a GameplaySession and drives
 * the full interaction loop: card layout, the selection state machine,
 * dispatch to the core, and the surrounding HUD/overlay chrome.
 */
import Phaser from "phaser";
import { stopMainTheme } from "../audio/menuMusic";
import {
  WORLD_MUSIC_BASE,
  CARD_FX_BASE,
  effectiveVolume,
  musicGain,
  fxGain,
} from "../audio/audioVolume";
import { worldMusicManifest } from "../data/audioManifest";
import { createGameplayRuntime, type GameplayRuntime } from "../runtime/gameplayRuntime";
import type { GameplaySession } from "../runtime/gameplaySession";
import { selectTheme } from "../view/themes/themeManifest";
import type { VisualTheme } from "../view/themes/theme";
import {
  availableActions,
  effectiveHand,
  effectivePlayerCard,
  effectiveWorldCardCost,
} from "../../core/index";
import type {
  Card,
  CardId,
  CardFxType,
  Action,
  PlayerCard,
  TargetSpec,
  WorldCard,
  ActionPreviewSeverity,
  ActionPreview,
  GameEvent,
} from "../../core/index";
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
import { FONTS } from "../view/fonts";
import { ringFraction, connectorLine } from "../interaction/feedback";
import type { ConnectorStyle } from "../interaction/feedback";
import { effectAtStep } from "../../core/effects/composite";
import { connectorStyleOf } from "../../core/effects/registry";
import { drawConnector } from "../view/connector";
import { resolveBranchLabels } from "../../core/view/branchLabels";
import { ModalChooserView } from "../view/ModalChooserView";
import { BoonChoiceView, type BoonChoiceOption } from "../view/BoonChoiceView";
import { DiscardChooserView } from "../view/DiscardChooserView";
import { CommonLabel, CommonButton } from "../view/components";
import { isConcealmentWarning, concealOf, isConcealed, CONCEALED_HAZARD } from "../../core/index";
import { PileLayer } from "../view/PileLayer";
import { BackdropLayer } from "../view/backdrop";
import { worldDisplayManifest } from "../../data/worldDisplayManifest";
import { CARD_FACE, TABLE_LAYOUT } from "../view/layout";
import {
  bringRowCardIdIntoView,
  ROW_WINDOW_VISIBLE_LIMIT,
  rowWindowLayout,
  rowWindowPageOffset,
  type RowCardPosition,
  type RowWindowLayout,
} from "../view/tableLayout";
import { addTooltip } from "../view/TooltipView";
import { CONCEALED_HOOK_WARNING } from "../../core/view/actionPreview";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const WORLD_ROW_Y = TABLE_LAYOUT.worldRowY;
const HAND_ROW_Y = TABLE_LAYOUT.handRowY;
// Between the default card depth (0) and the win/loss overlay (1000), so the
// connector draws over cards but never covers the end-game screens.
const CONNECTOR_DEPTH = TABLE_LAYOUT.connectorDepth;

// previewSlot is a single-line label, so multi-line summaries fold into one
// line with this separator rather than stacking newlines.
const PREVIEW_LINE_SEP = "\n";

/** Hover warning for a concealed hazard in the partial-intent fallback. */
const CONCEALED_HOVER_WARNING = "Target is concealed. Beware.";

// Minimal preview mode (detailedHoverPreviews off) keeps only the first
// consequence line plus any concealment warning — a hidden hook must never be
// silently dropped, even when the rest of the preview is trimmed.
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

// A modifier (e.g. a buff changing energyCost or effect) — or a runtime
// applied keyword like Alarm — can change how a card displays without
// changing its id, so reconciliation needs this signature to detect "same
// card, different face" and rebuild the container. Covers both card kinds:
// world cards carry no energyCost/effect/exhaust/frozen, but they do carry
// appliedKeywords (Alarm's ApplyKeyword/RemoveKeyword targets are almost
// always world cards), so that field must be checked regardless of kind.
function cardDisplaySignature(card: Card): string {
  return card.kind === "player"
    ? JSON.stringify({
        templateId: card.templateId,
        sourceWorldId: card.sourceWorldId,
        name: card.name,
        insetKey: card.insetKey,
        energyCost: card.energyCost,
        effect: card.effect,
        keywords: card.keywords,
        exhaust: card.exhaust,
        frozen: card.frozen,
        appliedKeywords: card.appliedKeywords,
      })
    : JSON.stringify({
        templateId: card.templateId,
        name: card.name,
        insetKey: card.insetKey,
        keywords: card.keywords,
        appliedKeywords: card.appliedKeywords,
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
  private cardDisplaySignatures: Map<string, string> = new Map();

  // Tracked outside Phaser's pointer events so drawAll can re-assert the base
  // transform on every non-hovered card during a repaint, not just on pointerout.
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
  // Gates every committed action (play/discard/end-turn); see maybeConfirmOrDispatch.
  private actionConfirmation!: ActionConfirmationView;
  private questionBtn!: CommonButton;
  private settingsBtn!: CommonButton;
  private exitBtn!: CommonButton;
  private worldRowPrevBtn!: CommonButton;
  private worldRowNextBtn!: CommonButton;
  private worldRowRangeLabel!: CommonLabel;
  private playerRowPrevBtn!: CommonButton;
  private playerRowNextBtn!: CommonButton;
  private playerRowRangeLabel!: CommonLabel;

  // Modal chooser UI (created/destroyed per card play)
  private modalChooser: ModalChooserView | null = null;
  private boonChoiceView: BoonChoiceView | null = null;
  private discardChooser: DiscardChooserView | null = null;
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

  // Never call setInteractive on this — it must not hit-test, or it would
  // steal pointer events from the cards beneath it.
  private connectorGfx!: Phaser.GameObjects.Graphics;

  private worldId_: string = "zombie-big-box";
  private seed_: number = 0;
  private terminalSummaryShown_: boolean = false;
  private runtime_: GameplayRuntime;
  private worldRowOffset: number = 0;
  private playerRowOffset: number = 0;

  constructor(runtime?: GameplayRuntime) {
    super({ key: "Table" });
    // The app composition root (main.ts) injects the shared runtime so
    // cross-run consumers observe every session; a private fallback keeps the
    // scene constructible without one (tests, Phaser default instantiation).
    this.runtime_ = runtime ?? createGameplayRuntime();
  }

  // Phaser reuses the scene instance across runs (WorldSelect restarts Table
  // with a new seed), so per-run state must be reset here rather than relying
  // on field initializers, which only run once.
  init(data: { worldId?: string; seed?: number }): void {
    this.worldId_ = data.worldId ?? "zombie-big-box";
    this.seed_ = data.seed ?? Math.floor(Math.random() * 2 ** 32);
    this.terminalSummaryShown_ = false;
    this.cardObjects = new Map();
    this.cardDisplaySignatures = new Map();
    this.selectedCardSnapshot = null;
    this.worldRowOffset = 0;
    this.playerRowOffset = 0;
  }

  create(): void {
    stopMainTheme(this);

    // Effect-icon textures are generated, not loaded, so they must register
    // here rather than in preload — before any CardView renders.
    ensureEffectIconTextures(this);

    this.game_ = this.runtime_.startSession(this.worldId_, this.seed_);
    // Registered immediately so RunStarted always gets a matching RunEnded,
    // even if later create() work throws. abandon() no-ops if the run already
    // ended in a win or loss.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopWorldMusic();
      this.actionConfirmation?.hide();
      this.game_.abandon();
    });
    this.theme_ = selectTheme(this.game_.state.worldId);
    this.startWorldMusic(this.game_.state.worldId);

    this.hudView = new HUDView(this);

    const endTurnStyle = textStyle({
      fontFamily: FONTS.body,
      fontSize: "16px",
      color: getRealityPalette(this.theme_, "text"),
      fontStyle: "bold",
    });
    this.endTurnBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.endTurn.x,
      TABLE_LAYOUT.buttons.endTurn.y,
      "END TURN",
      endTurnStyle,
    )
      .on("pointerdown", () => this.onEndTurnClick())
      .on("pointerover", () => this.showEndTurnPreview())
      .on("pointerout", () => this.clearPreviewSlot());
    addTooltip(this, this.endTurnBtn, TABLE_TOOLTIPS.endTurn);

    const cancelStyle = textStyle({
      fontFamily: FONTS.body,
      fontSize: "16px",
      color: getRealityPalette(this.theme_, "cancel"),
      fontStyle: "bold",
    });
    this.cancelBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.cancel.x,
      TABLE_LAYOUT.buttons.cancel.y,
      "CANCEL",
      cancelStyle,
    )
      .on("pointerdown", () => {
        this.sel = cancel();
        this.clearSelectedCardSnapshot();
        this.dismissModal();
        this.dismissDiscardChooser();
        this.clearConnector();
        this.clearPreviewSlot();
        this.drawAll();
      })
      .setVisible(false);

    const confirmStyle = textStyle({
      fontFamily: FONTS.body,
      fontSize: "16px",
      fontStyle: "bold",
      color: getRealityPalette(this.theme_, "confirm"),
    });
    this.confirmBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.confirm.x,
      TABLE_LAYOUT.buttons.confirm.y,
      "CONFIRM",
      confirmStyle,
    )
      .on("pointerdown", () => this.onConfirmClick())
      .setVisible(false);

    this.runSummary = new RunSummaryView(this);

    this.helpOverlay = new HelpOverlayView(this, this.worldId_, this.game_.state.totalActs);
    this.settingsOverlay = new SettingsOverlayView(this, this.runtime_.userSettings, () =>
      this.reapplyMusicVolume(),
    );
    this.actionConfirmation = new ActionConfirmationView(this);

    const questionStyle = textStyle({
      fontFamily: FONTS.monospace,
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
      // The confirmation modal is the top-most surface; help/settings must
      // never open behind it.
      if (this.actionConfirmation.isOpen) return;
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
      if (this.actionConfirmation.isOpen) return;
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

    const worldRowNavStyle = textStyle({
      fontFamily: FONTS.monospace,
      fontSize: "16px",
      fontStyle: "bold",
      color: getRealityPalette(this.theme_, "cancel"),
    });
    const worldRowRangeStyle = textStyle({
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: getRealityPalette(this.theme_, "cancel"),
    });
    this.worldRowPrevBtn = this.createRowNavButton("world", -1, "<", worldRowNavStyle);
    this.worldRowNextBtn = this.createRowNavButton("world", 1, ">", worldRowNavStyle);
    this.worldRowRangeLabel = new CommonLabel(
      this,
      TABLE_LAYOUT.rowNav.world.labelX,
      TABLE_LAYOUT.rowNav.world.labelY,
      "",
      worldRowRangeStyle,
    )
      .setDepth(TABLE_LAYOUT.cardHoverDepth + 25)
      .setVisible(false);

    const playerRowNavStyle = textStyle({
      fontFamily: FONTS.monospace,
      fontSize: "16px",
      fontStyle: "bold",
      color: getRealityPalette(this.theme_, "confirm"),
    });
    const playerRowRangeStyle = textStyle({
      fontFamily: FONTS.body,
      fontSize: "13px",
      color: getRealityPalette(this.theme_, "confirm"),
    });
    this.playerRowPrevBtn = this.createRowNavButton("player", -1, "<", playerRowNavStyle);
    this.playerRowNextBtn = this.createRowNavButton("player", 1, ">", playerRowNavStyle);
    this.playerRowRangeLabel = new CommonLabel(
      this,
      TABLE_LAYOUT.rowNav.player.labelX,
      TABLE_LAYOUT.rowNav.player.labelY,
      "",
      playerRowRangeStyle,
    )
      .setDepth(TABLE_LAYOUT.cardHoverDepth + 25)
      .setVisible(false);

    this.input.keyboard?.on("keydown-ESC", () => {
      // The confirmation modal is top-most, so ESC only cancels it when open;
      // help/settings can never be open behind it.
      if (this.actionConfirmation.isOpen) {
        this.actionConfirmation.hide();
        this.cancelConfirmation();
        return;
      }
      if (this.helpOverlay.visible) this.helpOverlay.setVisible(false);
      if (this.settingsOverlay.visible) this.settingsOverlay.close();
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key !== "1" && event.key !== "2" && event.key !== "3") return;
      this.chooseVisibleBoonOption(Number(event.key) - 1);
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      this.handleRowNavigationKey(event);
    });
    this.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, deltaY: number) => {
        this.handleRowNavigationWheel(pointer, deltaY);
      },
    );

    this.selectionHint = new CommonLabel(
      this,
      TABLE_LAYOUT.selectionHint.x,
      TABLE_LAYOUT.selectionHint.y,
      "",
      textStyle({
        fontFamily: FONTS.ui,
        fontSize: "13px",
        color: getRealityPalette(this.theme_, "text"),
      }),
    ).setVisible(false);

    // A separate label from selectionHint, positioned just above it, so the
    // live preview and the phase instruction never overwrite each other.
    this.previewSlot = new CommonLabel(
      this,
      TABLE_LAYOUT.previewSlot.x,
      TABLE_LAYOUT.previewSlot.y,
      "",
      textStyle({
        fontFamily: FONTS.ui,
        fontSize: "13px",
        color: getRealityPalette(this.theme_, "title"),
        wordWrap: { width: 400 },
      }),
    );
    this.previewSlot.setDepth(TABLE_LAYOUT.previewDepth);
    this.previewSlot.setVisible(false);

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
   * Full repaint: reconciles card containers against the current hand,
   * re-applies highlights, and updates the HUD. Called after every dispatch
   * and every selection-state change that affects highlights.
   *
   * Containers persist across cycles — a card still in hand keeps its
   * container instead of being destroyed and recreated, so an in-flight tween
   * is never raced by a recycled object.
   */
  private drawAll(): void {
    const state = this.game_.state;

    this.backdropLayer.update(state, this.game_.intensity());

    const available = availableActions(state);
    const playableIds = new Set(available.playable.map((p) => p.cardId));
    const discardableIds = new Set(available.discardable);
    const legalTargetIds = this.currentLegalTargetIds();

    // drawAll can fire mid-hover with the legal-target set changed underneath
    // the pointer (e.g. a step advanced); drop a hover that's no longer legal
    // so its emphasis doesn't linger.
    if (this.hoveredCardId !== null && !legalTargetIds.has(this.hoveredCardId)) {
      const stale = this.cardObjects.get(this.hoveredCardId);
      if (stale !== undefined) stale.clearEmphasis();
      this.hoveredCardId = null;
    }

    // effectiveHand applies live modifiers to player cards but preserves base
    // ids, so reconciliation/dispatch still address the durable GameState card
    // while the face shown reflects current buffs/debuffs.
    const visibleHand = effectiveHand(state);
    const worldCards = visibleHand.filter((c): c is WorldCard => c.kind === "world");
    const playerCards = visibleHand.filter((c) => c.kind === "player");
    const worldWindow = rowWindowLayout(
      false,
      worldCards.map((c) => c.id),
      this.worldRowOffset,
      WORLD_ROW_Y,
    );
    const playerWindow = rowWindowLayout(
      true,
      playerCards.map((c) => c.id),
      this.playerRowOffset,
      HAND_ROW_Y,
    );
    this.worldRowOffset = worldWindow.offset;
    this.playerRowOffset = playerWindow.offset;
    const visibleWorldCards = worldCards.slice(worldWindow.startIndex, worldWindow.endIndex);
    const visiblePlayerCards = playerCards.slice(playerWindow.startIndex, playerWindow.endIndex);
    this.updateRowNavigation("world", worldWindow, legalTargetIds);
    this.updateRowNavigation("player", playerWindow, legalTargetIds);

    const desiredIds = new Set<string>();
    this.layoutRow(
      false,
      worldWindow.offset,
      visibleWorldCards,
      worldWindow.positions,
      playableIds,
      discardableIds,
      legalTargetIds,
      desiredIds,
    );
    this.layoutRow(
      true,
      playerWindow.offset,
      visiblePlayerCards,
      playerWindow.positions,
      playableIds,
      discardableIds,
      legalTargetIds,
      desiredIds,
    );

    // Kill tweens before destroy so a recycled Tween never retargets a freed object.
    for (const [id, container] of this.cardObjects) {
      if (desiredIds.has(id)) continue;
      this.tweens.killTweensOf(container);
      this.tweens.killTweensOf(container.list);
      if (this.hoveredCardId === id) this.hoveredCardId = null;
      container.destroy();
      this.cardObjects.delete(id);
      this.cardDisplaySignatures.delete(id);
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

  // null when no run has completed yet (lifetime stats are empty) — the
  // caller treats that as "nothing to show" rather than an error.
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
    isPlayer: boolean,
    offset: number,
    cards: readonly Card[],
    positions: readonly RowCardPosition[],
    playableIds: Set<string>,
    discardableIds: Set<string>,
    legalTargetIds: Set<string>,
    desiredIds: Set<string>,
  ): void {
    const radians = (2 * 3.14159) / 180;
    const rotationOffset = Math.floor((positions.length - offset) / 2);
    cards.forEach((card, i) => {
      const { x, y } = positions[i]!;
      const container = this.obtainCardContainer(card);
      desiredIds.add(card.id);

      // Position is mutable per cycle (a card may shift slots as the hand
      // changes). The static face was set once, at creation.
      container.setCardPosition(x, y);
      if (isPlayer) container.setRotation((i - rotationOffset) * radians);

      // Re-apply mutable visual state every cycle, reused or freshly created.
      this.applyHighlight(container, card, playableIds, discardableIds, legalTargetIds);

      // A reused container must not keep stale emphasis from a previous cycle;
      // only the still-hovered, still-legal card (drawAll already cleared
      // hoveredCardId otherwise) keeps it, re-applied so its magnitude tracks
      // the current intensity.
      if (this.hoveredCardId === card.id) {
        container.emphasize(this.theme_.frameStyle.targetGlow, this.game_.intensity());
      } else {
        container.clearEmphasis();
      }

      // Only world cards have a progress ring/shadow overlay; re-read state.progress
      // and state.light every cycle since neither has its own change event.
      if (card.kind === "world") {
        const progress = this.game_.state.progress[card.id] ?? 0;
        const effectiveCost = effectiveWorldCardCost(card, this.game_.state);
        const fraction = ringFraction(progress, effectiveCost);
        container.updateCostRing(fraction, this.theme_.frameStyle.ringAccent);
        container.updateCostLabel(effectiveCost, card.cost);
        container.applyConcealment(this.game_.state.light);
      }
    });
  }

  private createRowNavButton(
    row: "world" | "player",
    direction: -1 | 1,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): CommonButton {
    const nav = row === "world" ? TABLE_LAYOUT.rowNav.world : TABLE_LAYOUT.rowNav.player;
    const x = direction < 0 ? nav.previousX : nav.nextX;
    return new CommonButton(this, x, nav.buttonY, text, style)
      .setDepth(TABLE_LAYOUT.cardHoverDepth + 25)
      .on("pointerdown", () => this.navigateRow(row, direction))
      .setVisible(false);
  }

  private updateRowNavigation(
    row: "world" | "player",
    layout: RowWindowLayout,
    legalTargetIds: Set<string>,
  ): void {
    const previous = row === "world" ? this.worldRowPrevBtn : this.playerRowPrevBtn;
    const next = row === "world" ? this.worldRowNextBtn : this.playerRowNextBtn;
    const label = row === "world" ? this.worldRowRangeLabel : this.playerRowRangeLabel;

    previous.setVisible(layout.hasOverflow);
    next.setVisible(layout.hasOverflow);
    label.setVisible(layout.hasOverflow);
    if (!layout.hasOverflow) {
      previous.disableInteractive();
      next.disableInteractive();
      return;
    }

    label.setText(this.rowRangeLabel(row, layout, legalTargetIds));
    this.setRowNavButtonEnabled(previous, layout.canPageBackward);
    this.setRowNavButtonEnabled(next, layout.canPageForward);
  }

  private rowRangeLabel(
    row: "world" | "player",
    layout: RowWindowLayout,
    legalTargetIds: Set<string>,
  ): string {
    if (legalTargetIds.size === 0) return layout.rangeLabel;

    let hasLegalBefore = false;
    let hasLegalAfter = false;
    const allIds = this.rowIdsFor(row);
    for (let i = 0; i < allIds.length; i += 1) {
      const id = allIds[i];
      if (id === undefined || !legalTargetIds.has(id)) continue;
      if (i < layout.startIndex) hasLegalBefore = true;
      if (i >= layout.endIndex) hasLegalAfter = true;
    }

    if (!hasLegalBefore && !hasLegalAfter) return layout.rangeLabel;
    const direction =
      hasLegalBefore && hasLegalAfter ? "< target >" : hasLegalBefore ? "< target" : "target >";
    return `${layout.rangeLabel} ${direction}`;
  }

  private rowIdsFor(row: "world" | "player"): readonly string[] {
    const visibleHand = effectiveHand(this.game_.state);
    return visibleHand.filter((card) => card.kind === row).map((card) => card.id);
  }

  private handleRowNavigationKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!this.canHandleTableRowNavigationKeys()) return;

    let direction: -1 | 1 | null = null;
    if (event.code === "BracketLeft") direction = -1;
    if (event.code === "BracketRight") direction = 1;
    if (direction === null) return;

    event.preventDefault();
    this.navigateRow(event.shiftKey ? "player" : "world", direction);
  }

  private handleRowNavigationWheel(pointer: Phaser.Input.Pointer, deltaY: number): void {
    if (!this.canHandleTableRowNavigationKeys()) return;
    if (deltaY === 0) return;

    const row = this.rowForWheelPointer(pointer);
    if (row === null) return;

    this.navigateRow(row, deltaY > 0 ? 1 : -1);
  }

  private rowForWheelPointer(pointer: Phaser.Input.Pointer): "world" | "player" | null {
    const y = pointer.worldY ?? pointer.y;
    const x = pointer.worldX ?? pointer.x;
    const rowMinX = TABLE_LAYOUT.rowCenterX - TABLE_LAYOUT.cardSpacing * 2.5;
    const rowMaxX = TABLE_LAYOUT.rowCenterX + TABLE_LAYOUT.cardSpacing * 2.5;
    if (x < rowMinX || x > rowMaxX) return null;

    const rowPadding = 16;
    const rowHalfHeight = CARD_FACE.height / 2 + rowPadding;
    if (Math.abs(y - TABLE_LAYOUT.worldRowY) <= rowHalfHeight) return "world";
    if (Math.abs(y - TABLE_LAYOUT.handRowY) <= rowHalfHeight) return "player";
    return null;
  }

  private canHandleTableRowNavigationKeys(): boolean {
    if (this.game_.state.status !== "playing") return false;
    if (this.actionConfirmation.isOpen) return false;
    if (this.runSummary.visible) return false;
    if (this.helpOverlay.visible) return false;
    if (this.settingsOverlay.visible) return false;
    if (this.modalChooser !== null) return false;
    if (this.discardChooser !== null) return false;
    if (this.boonChoiceView !== null) return false;
    return true;
  }

  private setRowNavButtonEnabled(button: CommonButton, enabled: boolean): void {
    button.setAlpha(enabled ? 1 : 0.35);
    button.disableInteractive();
    if (enabled) button.setInteractive({ useHandCursor: true });
  }

  private navigateRow(row: "world" | "player", direction: -1 | 1): void {
    if (this.actionConfirmation.isOpen) return;
    if (this.game_.state.status !== "playing") return;
    const visibleHand = effectiveHand(this.game_.state);
    const cardCount = visibleHand.filter((card) => card.kind === row).length;
    const currentOffset = row === "world" ? this.worldRowOffset : this.playerRowOffset;
    const nextOffset = rowWindowPageOffset(cardCount, currentOffset, direction);
    if (nextOffset === currentOffset) return;

    if (this.hoveredCardId !== null) {
      this.cardObjects.get(this.hoveredCardId)?.clearEmphasis();
      this.hoveredCardId = null;
    }
    this.clearConnector();
    this.clearPreviewSlot();
    if (row === "world") {
      this.worldRowOffset = nextOffset;
    } else {
      this.playerRowOffset = nextOffset;
    }
    if (this.shouldPinActingCardAfterRowNavigation(row, nextOffset)) {
      this.ensureActingCardVisibleForTargeting();
    }
    this.drawAll();
  }

  private shouldPinActingCardAfterRowNavigation(
    row: "world" | "player",
    nextOffset: number,
  ): boolean {
    if (row !== "player") return true;
    if (this.sel.phase !== "targeting") return true;

    const playerCardIds = effectiveHand(this.game_.state)
      .filter((card): card is PlayerCard => card.kind === "player")
      .map((card) => card.id);
    const actorPinnedOffset = bringRowCardIdIntoView(playerCardIds, this.sel.cardId, nextOffset);
    if (actorPinnedOffset === nextOffset) return true;

    const legalTargetIds = this.currentLegalTargetIds();
    if (legalTargetIds.size === 0) return true;

    return !playerCardIds.some((id, index) => {
      if (!legalTargetIds.has(id)) return false;
      return (
        this.rowIndexVisibleAtOffset(index, nextOffset) &&
        !this.rowIndexVisibleAtOffset(index, actorPinnedOffset)
      );
    });
  }

  private rowIndexVisibleAtOffset(index: number, offset: number): boolean {
    return index >= offset && index < offset + ROW_WINDOW_VISIBLE_LIMIT;
  }

  /**
   * Return the persistent container for a card, reusing the existing one if
   * already on the table. Pointer handlers are wired exactly once per
   * container, on creation — they capture only the stable card id and read
   * live scene state (`this.sel`) at call time, so re-binding on reuse would
   * only accumulate duplicate listeners, never fix anything.
   */
  private obtainCardContainer(card: Card): CardView {
    const existing = this.cardObjects.get(card.id);
    if (existing !== undefined) {
      const signature = cardDisplaySignature(card);
      if (this.cardDisplaySignatures.get(card.id) === signature) return existing;

      this.tweens.killTweensOf(existing);
      this.tweens.killTweensOf(existing.list);
      existing.destroy();
      this.cardObjects.delete(card.id);
      this.cardDisplaySignatures.delete(card.id);
    }

    const container = new CardView(this, card, 0, 0, this.theme_, selectTheme, () =>
      fxGain(this.runtime_.userSettings.get()),
    );
    this.cardObjects.set(card.id, container);
    this.cardDisplaySignatures.set(card.id, cardDisplaySignature(card));

    container.setSize(CARD_FACE.width, CARD_FACE.height);
    container.setInteractive({ useHandCursor: true });

    const id = card.id;

    container.on("pointerdown", () => this.onCardClick(id));

    container.on("pointerover", () => {
      // No hover preview behind an open confirmation modal.
      if (this.actionConfirmation.isOpen) return;
      this.hoveredCardId = id;
      this.showTargetPreview(id);
      if (this.sel.phase === "idle") {
        if (card.kind === "world") {
          this.showIdleWorldPreview(card);
        } else if (card.kind === "player") {
          this.showIdlePlayerPreview(card);
        }
      }
      this.showConnector(id);
      this.emphasizeIfLegalTarget(id, container);
      this.emphasizeIfPlayable(id, container);
      this.cardObjects.forEach((obj) => {
        if (id != obj.getCardId()) {
          obj.clearEmphasis();
        }
      });
    });
    container.on("pointerout", (pointer: Phaser.Input.Pointer) => {
      // Interactive children (effect icons/tooltips) can become the top hit
      // target while the cursor is still visually over the card; keep the
      // card lifted then, or the icon shrinks out from under the cursor.
      if (this.pointerInsideCardVisual(pointer, container)) return;

      if (this.hoveredCardId === id) this.hoveredCardId = null;
      container.clearEmphasis();
      this.updateHint();
      this.clearPreviewSlot();
      this.clearConnector();
    });

    return container;
  }

  // Falls back to screen coords if worldX/Y are unset; half-extents scale
  // with the container so this still matches the card during hover-grow tweens.
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

  // Single entry point for every card click; routes to play/target/discard
  // based on the current selection phase rather than the card's own kind,
  // since the same card behaves differently while idle vs. mid-targeting.
  private onCardClick(cardId: string): void {
    if (this.actionConfirmation.isOpen) return;
    const state = this.game_.state;
    if (state.status !== "playing") return;
    // A pending boon choice has its own modal and must own all input until resolved.
    if (state.pendingBoonChoices.length > 0) return;

    const available = availableActions(state);

    if (this.sel.phase === "idle") {
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

  // Dispatches if the selection is now complete, opens the next modal chooser
  // if a Modal step is next, or just repaints to show the next targeting step.
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

    const recallStep = this.activeRecallStep();
    if (recallStep !== null) {
      this.beginRecallStep(recallStep);
      return;
    }

    this.ensureActingCardVisibleForTargeting();
    this.drawAll();
  }

  private ensureActingCardVisibleForTargeting(): void {
    if (this.sel.phase !== "targeting") return;
    const playerCardIds = effectiveHand(this.game_.state)
      .filter((card): card is PlayerCard => card.kind === "player")
      .map((card) => card.id);
    this.playerRowOffset = bringRowCardIdIntoView(
      playerCardIds,
      this.sel.cardId,
      this.playerRowOffset,
    );
  }

  // The current targeting step when it is a discard-recall step, else null.
  private activeRecallStep(): Extract<TargetSpec, { kind: "recallTarget" }> | null {
    if (this.sel.phase !== "targeting" || isComplete(this.sel)) return null;
    const step = this.sel.steps[this.sel.stepIdx];
    return step?.kind === "recallTarget" ? step : null;
  }

  // Open the discard chooser for a recallTarget step — or auto-skip it when the
  // discard pile is empty and the step is optional (min:0, e.g. Shelf Map). A
  // min>0 step with an empty pile never reaches here: the card is unplayable
  // (core ReturnPlayerDiscardToTopHandler.isPlayable). See selection.ts §
  // empty-pile flow for why this skip lives in the scene, not the state machine.
  private beginRecallStep(step: Extract<TargetSpec, { kind: "recallTarget" }>): void {
    const discard = this.game_.state.playerDiscard;
    if (discard.length === 0) {
      // Optional step over an empty pile: confirm zero picks and move on.
      this.advanceSelection();
      return;
    }
    this.drawAll();
    this.showDiscardChooser(step, discard);
  }

  private showDiscardChooser(
    step: Extract<TargetSpec, { kind: "recallTarget" }>,
    cards: readonly Card[],
  ): void {
    this.dismissDiscardChooser();
    this.discardChooser = new DiscardChooserView(this, {
      theme: this.theme_,
      cards,
      min: step.min,
      max: step.max,
      onConfirm: (ids) => this.onRecallConfirm(ids),
      onCancel: () => this.onRecallCancel(),
    });
  }

  private onRecallConfirm(ids: readonly string[]): void {
    this.dismissDiscardChooser();
    // Fold the chosen ids into the current step exactly as togglePick would,
    // then advance — buildAction then sets PlayCard.recallIds.
    for (const id of ids) {
      this.sel = togglePick(this.sel, id);
    }
    this.advanceSelection();
  }

  private onRecallCancel(): void {
    this.dismissDiscardChooser();
    this.sel = cancel();
    this.clearSelectedCardSnapshot();
    this.clearConnector();
    this.clearPreviewSlot();
    this.drawAll();
  }

  private dismissDiscardChooser(): void {
    if (this.discardChooser !== null) {
      this.discardChooser.destroy();
      this.discardChooser = null;
    }
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

  // Modal branches can appear either as the card's whole effect or nested at
  // the current targeting step (e.g. a compound card whose second step
  // branches); look in whichever place applies to this snapshot.
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
   * Single entry point for every user-initiated committed action (play,
   * discard, end turn) — consults confirmation mode + the action preview, then
   * either dispatches immediately or opens the confirmation modal. Boon
   * choices skip this and call dispatch directly; choosing a boon is already
   * a modal commitment.
   *
   * No re-validation happens at commit time: while the modal is open every
   * input handler early-returns on actionConfirmation.isOpen, and the core
   * only mutates on dispatch, so the action built here is still valid
   * whenever onCommit fires.
   */
  private maybeConfirmOrDispatch(action: Action): void {
    if (this.actionConfirmation.isOpen) return;

    const preview = this.game_.preview(action);

    // A non-previewable action has no lines to show, so go straight to
    // dispatch — the core reducer remains the authority on legality.
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

    this.actionConfirmation.show({
      title: this.confirmationTitle(action),
      lines: preview.summaryLines,
      onCommit: () => this.dispatch(action),
      onCancel: () => this.cancelConfirmation(),
    });
  }

  /**
   * Human-readable title for the confirmation modal. Routes through
   * safeCardName so a concealed hazard's identity never leaks through the title.
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

  // Masks the name to CONCEALED_HAZARD for a world card concealed at the
  // current Light, and for a missing card (defensive — should not happen).
  private safeCardName(card: Card | undefined): string {
    if (card === undefined) return CONCEALED_HAZARD;
    if (card.kind === "world" && isConcealed(card, this.game_.state.light)) {
      return CONCEALED_HAZARD;
    }
    return card.name;
  }

  // Cancelling a confirmation dispatches nothing and returns to idle rather
  // than back to mid-selection — same cleanup as the Cancel button. The view
  // hides itself before invoking this callback.
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

  private fxAfterDispatch(preHand: Card[], postHand: Card[], events: GameEvent[]): void {
    const playFx = (id: CardId, kind: CardFxType) => {
      const card = preHand.find((c) => c.id == id);
      if (card) {
        this.playCardFx(card, kind);
      }
    };

    for (const event of events) {
      switch (event.type) {
        case "CardPlayed":
          playFx(event.cardId, "Play");
          break;
        case "HazardDiscarded":
          playFx(event.cardId, "Discard");
          break;
        case "HazardResolved":
          playFx(event.hazardId, "Clear");
          break;
        case "HazardPartial":
          playFx(event.hazardId, "PartialClear");
          break;
        case "TurnEnded":
          {
            const preIds = preHand.map((c) => c.id);
            const stillHeld = postHand.filter((c) => preIds.includes(c.id));
            for (const card of stillHeld) {
              this.playCardFx(card, "EndTurn");
            }
          }
          break;
      }
    }
  }

  private dispatch(action: Action): void {
    const preHand = [...this.game_.state.hand];
    const result = this.game_.dispatch(action);
    const postHand = [...this.game_.state.hand];
    this.fxAfterDispatch(preHand, postHand, result.events);
    this.sel = IDLE;
    this.clearSelectedCardSnapshot();
    this.dismissModal();
    this.dismissDiscardChooser();
    this.updateBoonChoiceView();
    // Commit ends targeting; drop the connector and preview so nothing survives
    // the action.
    this.clearConnector();
    this.clearPreviewSlot();
    this.drawAll();
  }

  private playCardFx(card: Card, kind: CardFxType): void {
    if (!card) return;
    const fxSet = card.fx;
    if (!fxSet) return;

    const gain = fxGain(this.runtime_.userSettings.get());
    for (const fx of fxSet) {
      if (fx.kind === kind) {
        this.sound.play(fx.key, { volume: effectiveVolume(CARD_FX_BASE, gain), loop: false });
      }
    }
  }

  // Loads the world's music track on first play and reuses the cached asset on
  // later runs/restarts, since Phaser's audio cache persists across scene restarts.
  private startWorldMusic(worldId: string): Promise<void> {
    this.stopWorldMusic();

    const music = worldMusicManifest[worldId];
    if (music === undefined) {
      console.warn(`[TableScene] No music asset configured for world: ${worldId}`);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const resolveMusic = () => {
        const gain = musicGain(this.runtime_.userSettings.get());
        this.worldMusic = this.sound.add(music.key, {
          loop: true,
          volume: effectiveVolume(WORLD_MUSIC_BASE, gain),
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

  /** Re-apply effective music volume to the currently-playing world track. */
  private reapplyMusicVolume(): void {
    if (this.worldMusic === null) return;
    const gain = musicGain(this.runtime_.userSettings.get());
    (this.worldMusic as Phaser.Sound.WebAudioSound).setVolume(
      effectiveVolume(WORLD_MUSIC_BASE, gain),
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  // Resolves legality through the same EFFECTS registry the reducer uses, off
  // the captured card snapshot rather than live state, so a buff that lands
  // mid-selection can't reshape which targets are legal for the chosen effect.
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
    // Mirrors effectBranchesForModalStep: a Modal can be the card's whole
    // effect or nested at the current step, so check both shapes.
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

  // Hover preview for a legal targeting candidate: simulates picking it to
  // get the resulting preview, without mutating the real selection state.
  private showTargetPreview(targetId: string): void {
    const sel = this.sel;
    if (sel.phase !== "targeting" || isComplete(sel)) return;

    const state = this.game_.state;
    if (!this.currentLegalTargetIds().has(targetId)) return;

    const card = this.actingPlayerCardFor(sel.cardId);
    const target = state.hand.find((c) => c.id === targetId);
    if (card === null) return;

    // Fold the hovered target into the current step exactly as a click would,
    // then advance. For the common single-target hazard step this completes the
    // selection; buildAction then yields the real PlayCard action.
    const candidate = advance(togglePick(sel, targetId));
    const action = buildAction(candidate);

    if (action === null) {
      // Partial-intent fallback: the hazard step is one of several (compound
      // card), so no full action exists yet. Surface a concise targeted line
      // rather than nothing. A concealed target hides its math, so warn instead.
      if (target?.kind == "world") {
        this.renderPartialTargetPreview(target, state.light);
      }
      return;
    }

    const preview = this.game_.preview(action);
    this.renderPreview(preview, card.name);
  }

  private renderPreview(preview: ActionPreview, cardName?: string): void {
    // Drop the leading "Play <card>" line: the hover slot already sits beside the
    // acting card, so restating which card is played is noise. The consequence
    // lines (Progress, clears, warnings) are what previewPlay surfaced.
    const consequences = cardName
      ? preview.summaryLines.filter((line) => line !== `Play ${cardName}`)
      : preview.summaryLines;
    if (!preview.previewable || consequences.length === 0) {
      this.previewSlot.setVisible(false);
      return;
    }

    const detailed = this.runtime_.userSettings.get().detailedHoverPreviews;
    const lines = detailed ? consequences : minimalPreviewLines(consequences);
    this.showPreviewSlot(lines.join(PREVIEW_LINE_SEP), preview.severity);
  }

  // Called when no complete action exists yet to preview (an earlier step of
  // a compound selection); names the target instead of reconstructing a full summary.
  private renderPartialTargetPreview(target: WorldCard, light: number): void {
    const text = isConcealed(target, light)
      ? `${CONCEALED_HOVER_WARNING} (needs Light ${concealOf(target)})`
      : `Target ${target.name}`;
    this.showPreviewSlot(text, "warning");
  }

  // Previews DiscardHazard via the same game_.preview engine the targeted and
  // End Turn previews use, so wording can never disagree between them.
  private showIdleWorldPreview(card: WorldCard): void {
    if (this.sel.phase !== "idle") return;

    if (isConcealed(card, this.game_.state.light)) {
      this.showPreviewSlot(CONCEALED_HOOK_WARNING, "warning");
    } else {
      const action: Action = { type: "DiscardHazard", cardId: card.id };
      const preview = this.game_.preview(action);
      this.renderPreview(preview);
    }
  }

  // Only previews a play that wouldn't trigger targeting — narrows down to the
  // first compound step / first modal branch and bails (spec.kind != "none")
  // if that step itself needs a target, since hovering can't preview a play
  // whose action depends on a target the player hasn't chosen yet.
  private showIdlePlayerPreview(card: PlayerCard): void {
    if (this.sel.phase !== "idle") return;
    if (card.frozen ?? 0 > 0) return;

    const state = this.game_.state;
    if (state.pendingBoonChoices.length > 0) return;

    const available = availableActions(state);
    const entry = available.playable.find((p) => p.cardId === card.id);
    if (entry === undefined) return;

    const snapshot = effectivePlayerCard(card, state);
    let spec: TargetSpec = structuralSpecOf(snapshot.effect);
    if (spec.kind == "compound" && spec.steps.length > 0 && spec.steps[0]) {
      spec = spec.steps[0];
    }
    if (spec.kind == "modal" && spec.branches.length > 0 && spec.branches[0]) {
      spec = spec.branches[0];
    }

    if (spec.kind == "none") {
      const action: Action = { type: "PlayCard", cardId: card.id };
      const preview = this.game_.preview(action);
      this.renderPreview(preview);
    }
  }

  private showEndTurnPreview(): void {
    if (this.actionConfirmation.isOpen) return;
    // Mirrors the interactive gate in drawAll — the button is disabled outside
    // idle, so previewing then would advertise an action the player can't take.
    if (this.sel.phase !== "idle") return;

    const preview = this.game_.preview({ type: "EndTurn" });
    this.renderPreview(preview);
  }

  // Reads the same currentLegalTargetIds set the per-cycle repaint uses, so
  // hover emphasis always matches which cards show the `target` border.
  private emphasizeIfLegalTarget(cardId: string, container: CardView): void {
    if (!this.currentLegalTargetIds().has(cardId)) return;
    container.emphasize(this.theme_.frameStyle.targetGlow, this.game_.intensity());
  }

  // Only idle: mid-targeting, "playable" no longer reflects what a click does.
  private emphasizeIfPlayable(cardId: string, container: CardView): void {
    if (this.sel.phase !== "idle") return;
    const available = availableActions(this.game_.state);
    if (!available.playable.some((p) => p.cardId === cardId)) return;
    container.emphasize(this.theme_.frameStyle.playableGlow, this.game_.intensity());
  }

  // Draws a line from the acting card to the hovered legal target, styled by
  // the acting card's effect at the CURRENT step (not the card as a whole) —
  // a compound card like Barricade deals progress in step 0 and returns world
  // cards in step 1, so the connector must follow the active step.
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
    if (source === undefined || target === undefined) {
      this.clearConnector();
      return;
    }

    const { from, to } = connectorLine(source, target);
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

  // Mid-selection, returns the captured snapshot rather than the live hand
  // card so a buff landing during targeting can't reshape the acting effect.
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

  private showPreviewSlot(message: string, severity: ActionPreviewSeverity): void {
    this.previewSlot.setText(message);
    this.previewSlot.setVisible(true);
    this.previewSlot.setY(TABLE_LAYOUT.previewSlot.y - this.previewSlot.getBgHeight() / 2);
    switch (severity) {
      case "danger":
        this.previewSlot.setTint(this.theme_.realityPalette.cancel);
        break;
      case "warning":
        this.previewSlot.setTint(this.theme_.intrusionHue);
        break;
      default:
        this.previewSlot.setTint("#FFFFFF");
        break;
    }
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

  // Called on every drawAll, so the identity key lets a re-render with the
  // same pending choice skip rebuilding the view (and losing its UI state).
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
