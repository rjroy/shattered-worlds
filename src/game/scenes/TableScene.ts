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
import Phaser from 'phaser'
import { assetManifest } from '../data/assetManifest'
import { worldMusicManifest } from '../data/audioManifest'
import { getRealityPalette } from '../view/themes/theme'
import { selectTheme } from '../view/themes/themeManifest'
import type { VisualTheme } from '../view/themes/theme'
import { createGame, availableActions, CatalogError } from '../../core/index'
import type {
  GameCore,
  Card,
  Action,
  TargetSpec,
} from '../../core/index'
import {
  IDLE,
  cancel,
  chooseModal,
  addTarget,
  removeTarget,
  buildAction,
  isComplete,
  activeStep,
  hintForSelection,
} from '../interaction/selection'
import type { SelectionState } from '../interaction/selection'
import { classifyHighlight } from '../interaction/highlight'
import { CardView } from '../view/CardView'
import { HUDView } from '../view/HUDView'
import { EndScreenView } from '../view/EndScreenView'
import { HelpOverlayView } from '../view/HelpOverlayView'
import { textStyle, TEXT } from '../view/presentation'
import { ringFraction, connectorLine, selectConnectorStyle, effectAtStep } from '../interaction/feedback'
import type { ConnectorStyle } from '../interaction/feedback'
import { drawConnector } from '../view/connector'
import { resolveBranchLabels } from '../../core/view/branchLabels'
import { ModalChooserView } from '../view/ModalChooserView'
import { CommonLabel, CommonButton } from '../view/components'
import { previewPlay } from '../../core/view/describe'
import { PileLayer } from '../view/PileLayer'
import { BackdropLayer } from '../view/backdrop'
import { buildWorld } from '../../data/worldManifest'
import { CARD_FACE, TABLE_LAYOUT } from '../view/layout'
import { rowCardPositions } from '../view/tableLayout'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Vertical centre of the world cards (hazard) row. */
const WORLD_ROW_Y = TABLE_LAYOUT.worldRowY
/** Vertical centre of the player hand row. */
const HAND_ROW_Y = TABLE_LAYOUT.handRowY
/**
 * Depth for the targeting connector. Cards live at the default depth 0 and the
 * win/loss overlays at 1000; 500 draws the connector over the (possibly dimmed)
 * cards while staying below the end-game screens. The connector is decorative
 * and never interactive, so this depth only affects draw order, not input.
 */
const CONNECTOR_DEPTH = TABLE_LAYOUT.connectorDepth
// ROW_LEFT reserved for future fixed-layout mode
// const ROW_LEFT = 80

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class TableScene extends Phaser.Scene {
  private game_!: GameCore
  private theme_!: VisualTheme
  private sel: SelectionState = IDLE

  /** All live card containers, keyed by card id. */
  private cardObjects: Map<string, CardView> = new Map()

  /**
   * Id of the card currently under the pointer, or null. Maintained by the
   * pointerover/out handlers so a later phase (S9) can re-assert the base
   * transform on every non-hovered card without re-reading the pointer. No
   * emphasis behavior is attached to it yet; it is wired and kept accurate now.
   */
  private hoveredCardId: string | null = null

  // Persistent HUD objects (created once, updated on drawAll)
  private hudView!: HUDView
  private endTurnBtn!: CommonButton
  private cancelBtn!: CommonButton
  private confirmBtn!: CommonButton
  private winScreen!: EndScreenView
  private lossScreen!: EndScreenView
  private helpOverlay!: HelpOverlayView
  private questionBtn!: CommonButton

  // Modal chooser UI (created/destroyed per card play)
  private modalChooser: ModalChooserView | null = null
  private worldMusic: Phaser.Sound.BaseSound | null = null

  // Pile layer — persistent containers for player draw and world draw stacks
  private pileLayer!: PileLayer

  // Backdrop: reality image + intensity-driven intrusion overlay
  private backdropLayer!: BackdropLayer

  // Phase-instruction text ("Select a Hazard target", etc.)
  private selectionHint!: CommonLabel

  // Live target preview ("Deals 3 → clears …"), a separate surface from the
  // instruction so the two never overwrite each other.
  private previewSlot!: CommonLabel

  // Targeting connector: a single persistent Graphics that draws a line from the
  // acting card to the hovered legal target. Created once, redrawn on hover,
  // cleared on hover-out / commit / cancel. It is NEVER made interactive — it
  // draws only and must not hit-test (the open clicking bug forbids any new
  // pointer-eating object over the cards).
  private connectorGfx!: Phaser.GameObjects.Graphics

  private worldId_ = 'zombie-big-box'
  private seed_ = 0
  private loadError_ = false

  constructor() {
    super({ key: 'Table' })
  }

  init(data: { worldId?: string; seed?: number }): void {
    this.worldId_ = data.worldId ?? 'zombie-big-box'
    this.seed_ = data.seed ?? Math.floor(Math.random() * 2 ** 32)
    this.loadError_ = false
  }

  preload(): void {
    for (const [key, url] of Object.entries(assetManifest)) {
      if (url !== undefined) {
        if (url.endsWith('.json')) {
          this.load.json(key, url)
        } else {
          this.load.image(key, url)
        }
      }
    }

    for (const { key, url } of Object.values(worldMusicManifest)) {
      this.load.audio(key, url)
    }

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.type === 'json') this.loadError_ = true
      if (file.type === 'audio') {
        console.warn(`[TableScene] Music asset failed to load: ${file.key}`)
      }
    })
  }

  create(): void {
    if (this.loadError_) {
      console.error('[TableScene] A JSON asset failed to load — cannot assemble catalog.')
      throw new CatalogError('JSON asset failed to load')
    }

    const { catalog, worldData } = buildWorld(this.worldId_)

    this.game_ = createGame(catalog, worldData, this.seed_)
    this.theme_ = selectTheme(this.game_.state.worldId)
    this.startWorldMusic(this.game_.state.worldId)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopWorldMusic())

    this.hudView = new HUDView(this)

    const endTurnStyle = textStyle({
      fontSize: '16px',
      color: getRealityPalette(this.theme_, 'text', TEXT.textKeyword),
      fontStyle: 'bold',
    })
    this.endTurnBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.endTurn.x,
      TABLE_LAYOUT.buttons.endTurn.y,
      '[ End Turn ]',
      endTurnStyle,
    )
      .on('pointerdown', () => this.onEndTurnClick())

    const cancelStyle = textStyle({
      fontSize: '13px',
      color: getRealityPalette(this.theme_, 'cancel', TEXT.textPenalty),
    })
    this.cancelBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.cancel.x,
      TABLE_LAYOUT.buttons.cancel.y,
      '[ Cancel ]',
      cancelStyle,
    )
      .on('pointerdown', () => {
        this.sel = cancel()
        this.dismissModal()
        this.clearConnector()
        this.drawAll()
      })
      .setVisible(false)

    const confirmStyle = textStyle({
      fontSize: '13px',
      fontStyle: 'bold',
      color: getRealityPalette(this.theme_, 'confirm', TEXT.textReward),
    })
    this.confirmBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.confirm.x,
      TABLE_LAYOUT.buttons.confirm.y,
      '[ Confirm ]',
      confirmStyle,
    )
      .on('pointerdown', () => this.onConfirmClick())
      .setVisible(false)

    this.winScreen = new EndScreenView(this, {
      title: 'YOU WIN',
      titleColor: TEXT.textReward,
      subtitle: 'You survived.',
    })

    this.lossScreen = new EndScreenView(this, {
      title: 'YOU LOSE',
      titleColor: TEXT.textPenalty,
      subtitle: 'You did not survive meeting the Walker.',
    })

    this.helpOverlay = new HelpOverlayView(
      this,
      this.worldId_,
      this.game_.state.totalActs,
    )

    const questionStyle = textStyle({
      fontSize: '16px',
      fontStyle: 'bold',
      color: TEXT.textLight,
    })
    this.questionBtn = new CommonButton(
      this,
      TABLE_LAYOUT.buttons.help.x,
      TABLE_LAYOUT.buttons.help.y,
      '?',
      questionStyle,
    )
      .on('pointerup', () => this.helpOverlay.setVisible(true))

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.helpOverlay.visible) this.helpOverlay.setVisible(false)
    })

    this.selectionHint = new CommonLabel(this, TABLE_LAYOUT.selectionHint.x, TABLE_LAYOUT.selectionHint.y, '', textStyle({
      fontSize: '12px',
      color: getRealityPalette(this.theme_, 'text', TEXT.textLight),
    })).setVisible(false)

    // Sits in a dedicated slot directly above selectionHint. selectionHint has
    // origin (0.5, 1) at y=568, so with 12px text + 2px vertical padding it
    // tops out around y=552; anchoring previewSlot's bottom edge at y=550 keeps
    // the two surfaces from ever overlapping. Degrades fine on touch (no hover
    // means this slot simply stays empty).
    this.previewSlot = new CommonLabel(this, TABLE_LAYOUT.previewSlot.x, TABLE_LAYOUT.previewSlot.y, '', textStyle({
      fontSize: '12px',
      color: getRealityPalette(this.theme_, 'title', TEXT.textLight),
    }))
    this.previewSlot.setVisible(false)

    // Persistent connector graphic. setDepth controls draw order only; we never
    // call setInteractive on it, so Phaser keeps it out of the input hit-test
    // list and it cannot intercept clicks meant for the cards beneath it.
    this.connectorGfx = this.add.graphics()
    this.connectorGfx.setDepth(CONNECTOR_DEPTH)

    this.pileLayer = new PileLayer(this)
    this.backdropLayer = new BackdropLayer(this, selectTheme(this.game_.state.worldId))

    this.drawAll()
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
    const state = this.game_.state

    // Update backdrop intensity before reconciling cards
    this.backdropLayer.update(state, this.game_.intensity())

    const available = availableActions(state)

    // Determine sets for highlight computation
    const playableIds = new Set(available.playable.map((p) => p.cardId))
    const discardableIds = new Set(available.discardable)

    const legalTargetIds = this.currentLegalTargetIds(available)

    // Seam case (b): if a hovered card is no longer a legal target after this
    // repaint (e.g. drawAll fired mid-hover and the phase/legal set changed),
    // S9 owns clearing it here — drop the stored hovered id and restore that
    // container's base transform. (Case (a) hover-out and case (c) card-left-hand
    // are handled in the pointerout handler and the destruction pass below.)
    if (this.hoveredCardId !== null && !legalTargetIds.has(this.hoveredCardId)) {
      const stale = this.cardObjects.get(this.hoveredCardId)
      if (stale !== undefined) stale.clearEmphasis()
      this.hoveredCardId = null
    }

    // Split hand into world row and player row for layout. The hand order is the
    // desired order; row filtering preserves it, so the per-row layout below
    // reproduces exactly the positions the old destroy-and-recreate produced.
    const worldCards = state.hand.filter((c): c is import('../../core/index').WorldCard => c.kind === 'world')
    const playerCards = state.hand.filter((c) => c.kind === 'player')

    // Reconcile each row in place; collect the ids that should still exist after
    // this cycle so anything no longer desired can be destroyed afterward.
    const desiredIds = new Set<string>()
    this.layoutRow(worldCards, WORLD_ROW_Y, playableIds, discardableIds, legalTargetIds, desiredIds)
    this.layoutRow(playerCards, HAND_ROW_Y, playableIds, discardableIds, legalTargetIds, desiredIds)

    // Destroy containers whose card left the hand. Never touches a card still in
    // state.hand — only ids absent from desiredIds. Kill any tweens on the
    // container first so a recycled Tween can never retarget a live object.
    for (const [id, container] of this.cardObjects) {
      if (desiredIds.has(id)) continue
      this.tweens.killTweensOf(container)
      this.tweens.killTweensOf(container.list)
      if (this.hoveredCardId === id) this.hoveredCardId = null
      container.destroy()
      this.cardObjects.delete(id)
    }

    // HUD
    this.hudView.update(state)

    // Pile stacks (player draw + world draw)
    this.pileLayer.update(this, state.playerDraw.length, state.worldDraw.length, state.playerDiscard.length)

    // End Turn button
    const selectionActive = this.sel.phase !== 'idle'
    this.endTurnBtn.setAlpha(selectionActive ? 0.35 : 1.0)
    this.endTurnBtn.disableInteractive()
    if (!selectionActive && available.canEndTurn) {
      this.endTurnBtn.setInteractive({ useHandCursor: true })
    }

    // Cancel / Confirm buttons
    this.cancelBtn.setVisible(selectionActive)
    const showConfirm =
      this.sel.phase === 'awaiting-return' || this.sel.phase === 'awaiting-destroy'
    this.confirmBtn.setVisible(showConfirm)

    // Selection hint text
    this.updateHint()

    // Win / loss screens
    if (state.status === 'won') {
      this.winScreen.setVisible(true)
      this.lossScreen.setVisible(false)
    } else if (state.status === 'lost') {
      this.lossScreen.setVisible(true)
      this.winScreen.setVisible(false)
    }

    // Help overlay / ? button
    this.questionBtn.setVisible(state.status === 'playing')
    if (state.status !== 'playing') this.helpOverlay.setVisible(false)
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

    const positions = rowCardPositions(cards.length, rowY)

    cards.forEach((card, i) => {
      const { x, y } = positions[i]!
      const container = this.obtainCardContainer(card)
      desiredIds.add(card.id)

      // Position is mutable per cycle (a card may shift slots as the hand
      // changes). The static face was set once, at creation.
      container.setCardPosition(x, y)

      // Re-apply mutable visual state every cycle, reused or freshly created.
      this.applyHighlight(container, card, playableIds, discardableIds, legalTargetIds)

      // Emphasis re-assert (S9): a reused container must never keep stale
      // emphasis. Re-assert the BASE transform (scale 1, glow off) on every card
      // that is NOT the still-legal hovered one; the hovered-and-still-legal card
      // KEEPS its emphasis (re-applied idempotently so the magnitude tracks the
      // current intensity without jitter). drawAll already cleared hoveredCardId
      // for any hovered card that is no longer legal (seam case b), so reaching
      // here with hoveredCardId === card.id means the card is still a legal
      // target.
      if (this.hoveredCardId === card.id) {
        container.emphasize(this.theme_.frameStyle.targetGlow, this.game_.intensity())
      } else {
        container.clearEmphasis()
      }

      // World cards carry a progress ring around the cost digit. Animate it
      // toward the current accumulated progress every cycle (idempotent on an
      // unchanged target). Banking raises the target (ring fills); the
      // end-of-turn progress wipe drops it to 0 (the same ring drains) — one
      // clock. Player cards have no ring; updateCostRing no-ops on them, but
      // only world cards reach here with a costRing so guard by kind to keep
      // intent explicit.
      if (card.kind === 'world') {
        const progress = this.game_.state.progress[card.id] ?? 0
        const fraction = ringFraction(progress, card.cost)
        container.updateCostRing(fraction, this.theme_.frameStyle.ringAccent)
      }
    })
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
    const existing = this.cardObjects.get(card.id)
    if (existing !== undefined) return existing

    const container = new CardView(this, card, 0, 0, this.theme_, selectTheme)
    this.cardObjects.set(card.id, container)

    // Make card interactive
    container.setSize(CARD_FACE.width, CARD_FACE.height)
    container.setInteractive({ useHandCursor: true })

    const id = card.id

    // Main card click — player and world cards both route through onCardClick,
    // which decides play / target / discard from availableActions live.
    container.on('pointerdown', () => this.onCardClick(id))

    // Hovering a legal Hazard target during targeting shows the live preview
    // (Progress dealt, and whether it clears the Hazard). Track the hovered id
    // so a later phase can re-assert base transform on non-hovered cards.
    container.on('pointerover', () => {
      this.hoveredCardId = id
      this.showTargetPreview(id)
      // Connector generalizes across all three targeting phases (the preview
      // text is hazard-only). showConnector gates on phase + legal target.
      this.showConnector(id)
      // Loud hover emphasis (S9): only a card that is a legal target RIGHT NOW
      // gets lifted + ringed. Player cards are never legal targets, so this
      // gate keeps emphasis off them. Magnitude scales with intensity().
      this.emphasizeIfLegalTarget(id, container)
    })
    container.on('pointerout', () => {
      // Seam case (a): pointer-out clears the stored hovered id AND restores
      // this container's base transform (scale 1, glow off).
      if (this.hoveredCardId === id) this.hoveredCardId = null
      container.clearEmphasis()
      // Instruction stays stable in its own slot; clear only the preview slot.
      this.updateHint()
      this.previewSlot.setText('')
      this.previewSlot.setVisible(false)
      // No stale line may survive hover-out.
      this.clearConnector()
    })

    return container
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
    )
    container.applyHighlight(kind, this.theme_.frameStyle)
    container.setDimmed(dim)
  }

  // ---------------------------------------------------------------------------
  // Interaction handlers
  // ---------------------------------------------------------------------------

  private onCardClick(cardId: string): void {
    const state = this.game_.state
    if (state.status !== 'playing') return

    const available = availableActions(state)

    // ---- Idle: check what this card can do ----
    if (this.sel.phase === 'idle') {
      // Check if it's a discardable world card
      if (available.discardable.includes(cardId)) {
        this.onDiscardClick(cardId)
        return
      }

      const entry = available.playable.find((p) => p.cardId === cardId)
      if (entry === undefined) return // not playable

      const spec = entry.spec
      this.startSelection(cardId, spec)
      return
    }

    // ---- Active selection: check if this is a legal target ----
    if (
      this.sel.phase === 'awaiting-hazard' ||
      this.sel.phase === 'awaiting-discard' ||
      this.sel.phase === 'awaiting-destroy'
    ) {
      const legalTargets = available.legalTargets(this.sel.cardId, activeStep(this.sel))
      if (!legalTargets.includes(cardId)) return

      const newSel = addTarget(this.sel, cardId)

      // For hazard that is part of a compound (Barricade): transition to return step
      if (newSel.phase === 'awaiting-hazard' && newSel.targetId !== undefined) {
        const selCardId = newSel.cardId
        const entry = available.playable.find((p) => p.cardId === selCardId)
        if (entry !== undefined && entry.spec.kind === 'compound') {
          const returnStep = entry.spec.steps[1]
          if (returnStep !== undefined && returnStep.kind === 'returnWorld') {
            this.sel = {
              phase: 'awaiting-return',
              cardId: selCardId,
              selected: [],
              min: returnStep.min,
              max: returnStep.max,
              targetId: newSel.targetId,
            }
            this.clearConnector()
            this.drawAll()
            return
          }
        }
      }

      // Single-target selection: try to commit immediately
      const action = buildAction(newSel)
      if (action !== null) {
        this.dispatch(action)
      } else {
        this.sel = newSel
        this.drawAll()
      }
      return
    }

    // ---- Awaiting return multi-select ----
    if (this.sel.phase === 'awaiting-return') {
      const legalTargets = available.legalTargets(this.sel.cardId, activeStep(this.sel))
      if (!legalTargets.includes(cardId)) return

      if (this.sel.selected.includes(cardId)) {
        this.sel = removeTarget(this.sel, cardId)
      } else {
        this.sel = addTarget(this.sel, cardId)
      }
      this.clearConnector()
      this.drawAll()
      return
    }
  }

  /** Begin a new selection for a playable card. */
  private startSelection(cardId: string, spec: TargetSpec): void {
    switch (spec.kind) {
      case 'none': {
        // Immediate commit — no targeting needed
        this.dispatch({ type: 'PlayCard', cardId })
        return
      }
      case 'hazard': {
        // Transition directly to awaiting-hazard
        this.sel = { phase: 'awaiting-hazard', cardId }
        this.drawAll()
        return
      }
      case 'modal': {
        this.sel = { phase: 'awaiting-modal', cardId }
        this.showModalChooser(cardId, spec)
        return
      }
      case 'compound': {
        const firstStep= spec.steps[0]
        if (firstStep !== undefined) {
          this.startSelection(cardId, firstStep)
        }
        return
      }
      case 'discardPlayer': {
        this.sel = { phase: 'awaiting-discard', cardId }
        this.drawAll()
        return
      }
      case 'destroyHand': {
        this.sel = { phase: 'awaiting-destroy', cardId }
        this.drawAll()
        return
      }
      case 'returnWorld': {
        this.sel = {
          phase: 'awaiting-return',
          cardId,
          selected: [],
          min: spec.min,
          max: spec.max,
        }
        this.drawAll()
        return
      }
    }
  }

  private onDiscardClick(cardId: string): void {
    const available = availableActions(this.game_.state)
    if (available.discardable.includes(cardId)) {
      this.dispatch({ type: 'DiscardHazard', cardId })
    }
  }

  private onEndTurnClick(): void {
    if (this.sel.phase !== 'idle') return
    this.dispatch({ type: 'EndTurn' })
  }

  private onConfirmClick(): void {
    const spec = this.currentSpec()
    if (spec === null) return
    if (!isComplete(this.sel)) return
    const action = buildAction(this.sel)
    if (action !== null) {
      this.dispatch(action)
    }
  }

  // ---------------------------------------------------------------------------
  // Modal chooser
  // ---------------------------------------------------------------------------

  private showModalChooser(
    cardId: string,
    spec: Extract<TargetSpec, { kind: 'modal' }>,
  ): void {
    this.dismissModal()

    const available = availableActions(this.game_.state)
    // Label each branch from the card's actual Modal effect, so the chooser can
    // never drift from what the card does.
    const card = this.game_.state.hand.find((c) => c.id === cardId)
    const effectBranches =
      card?.kind === 'player' && card.effect.kind === 'Modal' ? card.effect.branches : []
    const branches = resolveBranchLabels(spec.branches, effectBranches, available, cardId)

    this.modalChooser = new ModalChooserView(
      this,
      this.theme_,
      branches,
      (idx) => this.onModalChoose(cardId, spec, idx),
      () => {
        this.sel = cancel()
        this.dismissModal()
        this.clearConnector()
        this.drawAll()
      },
    )
  }

  /** Apply a chosen modal branch: advance selection, or commit if it's a 'none' branch. */
  private onModalChoose(
    cardId: string,
    spec: Extract<TargetSpec, { kind: 'modal' }>,
    idx: number,
  ): void {
    this.dismissModal()
    const newSel = chooseModal(this.sel, idx, spec)
    this.sel = newSel

    // If the branch is 'none' after modal — build and dispatch immediately
    if (newSel.phase === 'selected') {
      const action = buildAction({ ...newSel, cardId })
      if (action !== null) {
        this.dispatch({ ...action, choice: idx } as Action)
        return
      }
    }

    this.drawAll()
  }

  private dismissModal(): void {
    if (this.modalChooser !== null) {
      this.modalChooser.destroy()
      this.modalChooser = null
    }
  }

  // ---------------------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------------------

  private dispatch(action: Action): void {
    this.game_.dispatch(action)
    this.sel = IDLE
    this.dismissModal()
    // Commit ends targeting; drop the connector so no line survives the action.
    this.clearConnector()
    this.drawAll()
  }

  private startWorldMusic(worldId: string): void {
    this.stopWorldMusic()

    const music = worldMusicManifest[worldId]
    if (music === undefined || !this.cache.audio.exists(music.key)) return

    this.worldMusic = this.sound.add(music.key, {
      loop: true,
      volume: 0.45,
    })
    this.worldMusic.play()
  }

  private stopWorldMusic(): void {
    if (this.worldMusic === null) return
    this.worldMusic.stop()
    this.worldMusic.destroy()
    this.worldMusic = null
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * The set of legal target card ids for the active targeting phase and its
   * current step, or an empty set when no targeting phase is active. Single
   * source of truth for "is this card a legal target right now": the per-cycle
   * highlight/emphasis pass (drawAll) and the pointerover emphasis hook both
   * read it, so the two paths can never disagree about legality (the step index
   * matches the click-gating in onCardClick and showConnector).
   */
  private currentLegalTargetIds(
    available: import('../../core/index').AvailableActions,
  ): Set<string> {
    if (
      this.sel.phase !== 'awaiting-hazard' &&
      this.sel.phase !== 'awaiting-discard' &&
      this.sel.phase !== 'awaiting-destroy' &&
      this.sel.phase !== 'awaiting-return'
    ) {
      return new Set<string>()
    }
    return new Set(available.legalTargets(this.sel.cardId, activeStep(this.sel)))
  }

  /** Return the TargetSpec for the card currently being played, or null. */
  private currentSpec(): TargetSpec | null {
    if (this.sel.phase === 'idle') return null
    const cardId = this.sel.cardId
    const entry = availableActions(this.game_.state).playable.find((p) => p.cardId === cardId)
    return entry !== undefined ? entry.spec : null
  }

  /**
   * While targeting a Hazard, write the live preview for the Hazard under the
   * pointer into its own slot (previewSlot): how much Progress the play deals
   * and whether it clears the Hazard. The phase instruction in selectionHint is
   * untouched. No-ops unless this card is a legal target right now.
   */
  private showTargetPreview(targetId: string): void {
    const sel = this.sel
    if (sel.phase !== 'awaiting-hazard') return

    const state = this.game_.state
    const branchIndex = sel.modalChoice
    const legal = availableActions(state).legalTargets(sel.cardId, branchIndex ?? 0)
    if (!legal.includes(targetId)) return

    const card = state.hand.find((c) => c.id === sel.cardId)
    const target = state.hand.find((c) => c.id === targetId)
    if (card?.kind !== 'player' || target?.kind !== 'world') return

    const preview = previewPlay(card, target, state, branchIndex)
    if (preview !== null) {
      this.previewSlot.setText(preview)
      this.previewSlot.setVisible(true)
    } else {
      this.previewSlot.setVisible(false)
    }
  }

  /**
   * Apply S9 hover emphasis to a card iff it is a legal target for the active
   * targeting step. Reads the same currentLegalTargetIds set the per-cycle pass
   * uses, so a player card (never a legal target) is never emphasized, and the
   * hover read matches exactly which cards show the `target` border. Magnitude
   * scales with this.game_.intensity() (FEEDBACK-12 emphasis half).
   */
  private emphasizeIfLegalTarget(
    cardId: string,
    container: CardView,
  ): void {
    const available = availableActions(this.game_.state)
    if (!this.currentLegalTargetIds(available).has(cardId)) return
    container.emphasize(this.theme_.frameStyle.targetGlow, this.game_.intensity())
  }

  /**
   * Draw a connector from the acting card to the legal target currently under
   * the pointer. Active for the three single-target
   * targeting phases (awaiting-hazard, awaiting-destroy, awaiting-return); any
   * other phase no-ops. The target must be legal for the current step, and both
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
    const sel = this.sel
    if (
      sel.phase !== 'awaiting-hazard' &&
      sel.phase !== 'awaiting-destroy' &&
      sel.phase !== 'awaiting-return'
    ) {
      return
    }

    const step = activeStep(sel)
    const legal = availableActions(this.game_.state).legalTargets(sel.cardId, step)
    if (!legal.includes(targetId)) return

    const source = this.cardObjects.get(sel.cardId)
    const target = this.cardObjects.get(targetId)
    if (source === undefined || target === undefined) return

    const { from, to } = connectorLine(source, target)
    // Resolve the style from the acting card's effect for THIS step, then render.
    // selectConnectorStyle is the single source of truth (S1, unit-tested).
    const style = this.stepConnectorStyle(sel.cardId, step)
    this.connectorGfx.clear()
    drawConnector(
      this.connectorGfx,
      style,
      from,
      to,
      this.pileLayer.worldPileCenter(),
      this.theme_.frameStyle,
    )
  }

  /**
   * Resolve the ConnectorStyle for the acting card's effect at `step` (looked up
   * through any Sequence/Modal via effectAtStep, so the style tracks the active
   * branch/step rather than the card as a whole). Null when no effect is found;
   * drawConnector then falls back to the plain accent line.
   */
  private stepConnectorStyle(cardId: string, step: number): ConnectorStyle | null {
    const card = this.game_.state.hand.find((c) => c.id === cardId)
    if (card === undefined || card.kind !== 'player') return null
    const effect = effectAtStep(card.effect, step)
    return effect !== null ? selectConnectorStyle(effect) : null
  }

  /** Remove any drawn connector. Safe to call when nothing is drawn. */
  private clearConnector(): void {
    this.connectorGfx.clear()
  }

  private updateHint(): void {
    const { text, visible } = hintForSelection(this.sel)
    this.selectionHint.setText(text)
    this.selectionHint.setVisible(visible)
  }
}
