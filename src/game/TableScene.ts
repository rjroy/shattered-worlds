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
import { assetManifest } from './assetManifest'
import { selectTheme } from './theme'
import type { VisualTheme } from './theme'
import { createGame, availableActions, assembleCatalog } from '../core/index'
import type { GameCore, Card, Action, TargetSpec, WorldData, CardEffect } from '../core/index'
import { CatalogError } from '../core/errors'
import type { RawCardSource } from '../core/catalog'
import {
  IDLE,
  cancel,
  selectCard,
  chooseModal,
  addTarget,
  removeTarget,
  buildAction,
  isComplete,
} from './selection'
import type { SelectionState } from './selection'
import {
  createCardObject,
  createHUD,
  updateHUD,
  createWinScreen,
  createLossScreen,
  createEndTurnButton,
  createCancelButton,
  createConfirmButton,
  applyCardHighlight,
  dimCard,
  positionCard,
  updateCostRing,
  emphasizeCard,
  clearEmphasis,
  textStyle,
} from './render'
import { ringFraction, connectorLine, selectConnectorStyle } from './feedback'
import type { ConnectorStyle, Point } from './feedback'
import type { HUDRefs } from './render'
import { describeEffect, previewPlay } from './describe'
import { PileLayer } from './piles'
import { BackdropLayer } from './backdrop'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Vertical centre of the world cards (hazard) row. */
const WORLD_ROW_Y = 180
/** Vertical centre of the player hand row. */
const HAND_ROW_Y = 420
/** Horizontal spacing between card centres (cards are 150px wide). */
const CARD_SPACING = 156

/**
 * Depth for the targeting connector. Cards live at the default depth 0 and the
 * win/loss overlays at 1000; 500 draws the connector over the (possibly dimmed)
 * cards while staying below the end-game screens. The connector is decorative
 * and never interactive, so this depth only affects draw order, not input.
 */
const CONNECTOR_DEPTH = 500
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
  private cardObjects: Map<string, Phaser.GameObjects.Container> = new Map()

  /**
   * Id of the card currently under the pointer, or null. Maintained by the
   * pointerover/out handlers so a later phase (S9) can re-assert the base
   * transform on every non-hovered card without re-reading the pointer. No
   * emphasis behavior is attached to it yet; it is wired and kept accurate now.
   */
  private hoveredCardId: string | null = null

  // Persistent HUD objects (created once, updated on drawAll)
  private hudRefs!: HUDRefs
  private endTurnBtn!: Phaser.GameObjects.Text
  private cancelBtn!: Phaser.GameObjects.Text
  private confirmBtn!: Phaser.GameObjects.Text
  private winScreen!: Phaser.GameObjects.Container
  private lossScreen!: Phaser.GameObjects.Container

  // Modal chooser UI (created/destroyed per card play)
  private modalContainer: Phaser.GameObjects.Container | null = null

  // Pile layer — persistent containers for player draw and world draw stacks
  private pileLayer!: PileLayer

  // Backdrop: reality image + intensity-driven intrusion overlay
  private backdropLayer!: BackdropLayer

  // Phase-instruction text ("Select a Hazard target", etc.)
  private selectionHint!: Phaser.GameObjects.Text

  // Live target preview ("Deals 3 → clears …"), a separate surface from the
  // instruction so the two never overwrite each other.
  private previewSlot!: Phaser.GameObjects.Text

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
    const theme = selectTheme(this.worldId_)
    const keysToLoad = [
      'cardback',
      'cardfront',
      theme.backdrop.realityKey,
      theme.backdrop.intrusionKey,
      ...(theme.walker ? [theme.walker.textureKey] : []),
      ...(theme.worldCardfrontKey ? [theme.worldCardfrontKey] : []),
    ]
    for (const key of keysToLoad) {
      const url = assetManifest[key]
      if (url !== undefined) {
        this.load.image(key, url)
      }
    }

    const starterUrl = assetManifest['world-starter']
    const worldUrl = assetManifest['world-' + this.worldId_]
    if (starterUrl !== undefined) this.load.json('world-starter', starterUrl)
    if (worldUrl !== undefined) this.load.json('world-' + this.worldId_, worldUrl)
    this.load.once('loaderror', () => { this.loadError_ = true })
  }

  create(): void {
    if (this.loadError_) {
      console.error('[TableScene] A JSON asset failed to load — cannot assemble catalog.')
      throw new CatalogError('JSON asset failed to load')
    }

    const starterRaw = this.cache.json.get('world-starter') as RawCardSource | undefined
    const worldRaw = this.cache.json.get('world-' + this.worldId_) as RawCardSource | undefined

    if (starterRaw === undefined || worldRaw === undefined) {
      console.error('[TableScene] JSON cache miss — cannot assemble catalog.')
      throw new CatalogError('JSON not available in Phaser cache')
    }

    const catalog = assembleCatalog([starterRaw, worldRaw])
    const worldData: WorldData = {
      worldId: worldRaw.worldId,
      starterDeck: starterRaw.starterDeck ?? [],
      deckComposition: worldRaw.deckComposition ?? { acts: [] },
    }
    this.game_ = createGame(catalog, worldData, this.seed_)
    this.theme_ = selectTheme(this.game_.state.worldId)

    this.hudRefs = createHUD(this)
    this.endTurnBtn = createEndTurnButton(this, 820, 560)
    this.endTurnBtn.on('pointerdown', () => this.onEndTurnClick())

    this.cancelBtn = createCancelButton(this)
    this.cancelBtn.on('pointerdown', () => {
      this.sel = cancel()
      this.dismissModal()
      this.clearConnector()
      this.drawAll()
    })

    this.confirmBtn = createConfirmButton(this)
    this.confirmBtn.on('pointerdown', () => this.onConfirmClick())

    this.winScreen = createWinScreen(this)
    this.lossScreen = createLossScreen(this)

    this.selectionHint = this.add.text(450, 568, '', textStyle({
      fontSize: '12px',
      color: '#9aa3b2',
      backgroundColor: 'rgba(0,0,0,0.75)',
      padding: { x: 6, y: 2 },
    }))
    this.selectionHint.setOrigin(0.5, 1)

    // Sits in a dedicated slot directly above selectionHint. selectionHint has
    // origin (0.5, 1) at y=568, so with 12px text + 2px vertical padding it
    // tops out around y=552; anchoring previewSlot's bottom edge at y=550 keeps
    // the two surfaces from ever overlapping. Degrades fine on touch (no hover
    // means this slot simply stays empty).
    this.previewSlot = this.add.text(450, 550, '', textStyle({
      fontSize: '12px',
      color: '#9aa3b2',
      backgroundColor: 'rgba(0,0,0,0.75)',
      padding: { x: 6, y: 2 },
    }))
    this.previewSlot.setOrigin(0.5, 1)

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
      if (stale !== undefined) clearEmphasis(stale)
      this.hoveredCardId = null
    }

    // Split hand into world row and player row for layout. The hand order is the
    // desired order; row filtering preserves it, so the per-row layout below
    // reproduces exactly the positions the old destroy-and-recreate produced.
    const worldCards = state.hand.filter((c): c is import('../core/index').WorldCard => c.kind === 'world')
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
    updateHUD(this.hudRefs, state)

    // Pile stacks (player draw + world draw)
    this.pileLayer.update(this, state.playerDraw.length, state.worldDraw.length)

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
    const totalWidth = (cards.length - 1) * CARD_SPACING
    const startX = 450 - totalWidth / 2

    cards.forEach((card, i) => {
      const x = startX + i * CARD_SPACING
      const container = this.obtainCardContainer(card)
      desiredIds.add(card.id)

      // Position is mutable per cycle (a card may shift slots as the hand
      // changes). The static face was set once, at creation.
      positionCard(container, x, rowY)

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
        emphasizeCard(this, container, this.theme_.frameStyle.targetGlow, this.game_.intensity())
      } else {
        clearEmphasis(container)
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
        updateCostRing(this, container, fraction, this.theme_.frameStyle.ringAccent)
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
  private obtainCardContainer(card: Card): Phaser.GameObjects.Container {
    const existing = this.cardObjects.get(card.id)
    if (existing !== undefined) return existing

    const container = createCardObject(this, card, 0, 0, this.theme_, selectTheme)
    this.cardObjects.set(card.id, container)

    // Make card interactive
    container.setSize(150, 196)
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
      clearEmphasis(container)
      // Instruction stays stable in its own slot; clear only the preview slot.
      this.updateHint()
      this.previewSlot.setText('')
      // No stale line may survive hover-out.
      this.clearConnector()
    })

    return container
  }

  /** Apply the correct highlight and alpha to a card container. */
  private applyHighlight(
    container: Phaser.GameObjects.Container,
    card: Card,
    playableIds: Set<string>,
    discardableIds: Set<string>,
    legalTargetIds: Set<string>,
  ): void {
    const id = card.id
    const sel = this.sel

    const fs = this.theme_.frameStyle

    // Selected card (all non-idle variants have cardId)
    if ('cardId' in sel && sel.cardId === id) {
      applyCardHighlight(container, 'selected', fs)
      dimCard(container, false)
      return
    }

    // Legal target during a targeting phase
    if (legalTargetIds.has(id)) {
      applyCardHighlight(container, 'target', fs)
      dimCard(container, false)
      return
    }

    // Discardable world card (not during a selection)
    if (discardableIds.has(id) && sel.phase === 'idle') {
      applyCardHighlight(container, 'discard', fs)
      dimCard(container, false)
      return
    }

    // Playable player card (in idle state)
    if (card.kind === 'player' && playableIds.has(id) && sel.phase === 'idle') {
      applyCardHighlight(container, 'none', fs)
      dimCard(container, false)
      return
    }

    // During awaiting-return, mark already-selected return targets
    if (sel.phase === 'awaiting-return' && sel.selected.includes(id)) {
      applyCardHighlight(container, 'selected', fs)
      dimCard(container, false)
      return
    }

    // During awaiting-return, keep the hazard the EARLIER step locked onto lit
    // with a muted "committed" mark (S10/REQ-FEEDBACK-6). It is no longer a live
    // legal target in the return phase, so without this it would fall through to
    // dimmed/neutral and go dark. Placed AFTER the legal-target and selected-list
    // checks so an actively selectable card always wins precedence; the committed
    // hazard id is never one of those, so the marked card stays distinct. Not
    // dimmed — the muted mark itself carries "settled, not active".
    if (sel.phase === 'awaiting-return' && sel.targetId === id) {
      applyCardHighlight(container, 'committed', fs)
      dimCard(container, false)
      return
    }

    // Everything else is dimmed when a selection is active, or when unplayable
    const selActive = sel.phase !== 'idle'
    if (selActive) {
      applyCardHighlight(container, 'none', fs)
      dimCard(container, true)
    } else if (card.kind === 'player' && !playableIds.has(id)) {
      applyCardHighlight(container, 'none', fs)
      dimCard(container, true)
    } else {
      applyCardHighlight(container, 'none', fs)
      dimCard(container, false)
    }
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
      const step =
        this.sel.phase === 'awaiting-hazard' && this.sel.modalChoice !== undefined
          ? this.sel.modalChoice
          : 0
      const legalTargets = available.legalTargets(this.sel.cardId, step)
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
      const step = this.sel.targetId !== undefined ? 1 : 0
      const legalTargets = available.legalTargets(this.sel.cardId, step)
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
        this.sel = selectCard(IDLE, cardId)
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
        const firstStep = spec.steps[0]
        if (firstStep !== undefined && firstStep.kind === 'returnWorld') {
          this.sel = {
            phase: 'awaiting-return',
            cardId,
            selected: [],
            min: firstStep.min,
            max: firstStep.max,
          }
        } else {
          // Default: first step is hazard targeting (Barricade)
          this.sel = { phase: 'awaiting-hazard', cardId }
        }
        this.drawAll()
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
    if (!isComplete(this.sel, spec)) return
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
    const container = this.add.container(450, 300)
    this.modalContainer = container

    // Backdrop
    const bg = this.add.rectangle(0, 0, 500, 220, 0x0f1117, 0.95)
    bg.setStrokeStyle(1, 0x2a2f3d)
    container.add(bg)

    const title = this.add.text(0, -80, 'Choose an effect:', textStyle({
      fontSize: '16px',
      color: '#e8eaf0',
      fontStyle: 'bold',
    }))
    title.setOrigin(0.5, 0.5)
    container.add(title)

    // Label each branch from the card's actual Modal effect, so the chooser
    // can never drift from what the card does.
    const card = this.game_.state.hand.find((c) => c.id === cardId)
    const effectBranches =
      card?.kind === 'player' && card.effect.kind === 'Modal' ? card.effect.branches : []

    spec.branches.forEach((branchSpec, idx) => {
      const label = branchLabel(effectBranches[idx], idx)
      const isLegal = branchIsLegal(branchSpec, idx, available, cardId)

      const btnY = -30 + idx * 60
      const btn = this.add.text(0, btnY, label, textStyle({
        fontSize: '14px',
        color: isLegal ? '#88aaff' : '#555577',
        fontStyle: 'bold',
      }))
      btn.setOrigin(0.5, 0.5)

      if (isLegal) {
        btn.setInteractive({ useHandCursor: true })
        btn.on('pointerdown', () => {
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
        })
      }

      container.add(btn)
    })

    // Cancel modal button
    const cancelBtn = this.add.text(0, 80, '[ Cancel ]', textStyle({
      fontSize: '13px',
      color: '#ff8888',
    }))
    cancelBtn.setOrigin(0.5, 0.5)
    cancelBtn.setInteractive({ useHandCursor: true })
    cancelBtn.on('pointerdown', () => {
      this.sel = cancel()
      this.dismissModal()
      this.clearConnector()
      this.drawAll()
    })
    container.add(cancelBtn)

    this.children.bringToTop(container)
  }

  private dismissModal(): void {
    if (this.modalContainer !== null) {
      this.modalContainer.destroy()
      this.modalContainer = null
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
    available: import('../core/index').AvailableActions,
  ): Set<string> {
    if (
      this.sel.phase !== 'awaiting-hazard' &&
      this.sel.phase !== 'awaiting-discard' &&
      this.sel.phase !== 'awaiting-destroy' &&
      this.sel.phase !== 'awaiting-return'
    ) {
      return new Set<string>()
    }
    const step =
      this.sel.phase === 'awaiting-return' && 'targetId' in this.sel && this.sel.targetId !== undefined
        ? 1
        : this.sel.phase === 'awaiting-hazard' && this.sel.modalChoice !== undefined
        ? this.sel.modalChoice
        : 0
    return new Set(available.legalTargets(this.sel.cardId, step))
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
    if (preview !== null) this.previewSlot.setText(preview)
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
    container: Phaser.GameObjects.Container,
  ): void {
    const available = availableActions(this.game_.state)
    if (!this.currentLegalTargetIds(available).has(cardId)) return
    emphasizeCard(this, container, this.theme_.frameStyle.targetGlow, this.game_.intensity())
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
   * card as a whole. See stepEffect() for how the per-step CardEffect is found.
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

    // Step index mirrors the click/highlight gating: awaiting-return advances to
    // step 1 once its hazard target is chosen; awaiting-hazard with a modal
    // choice keys off that branch; everything else is step 0.
    const step =
      sel.phase === 'awaiting-return' && sel.targetId !== undefined
        ? 1
        : sel.phase === 'awaiting-hazard' && sel.modalChoice !== undefined
        ? sel.modalChoice
        : 0
    const legal = availableActions(this.game_.state).legalTargets(sel.cardId, step)
    if (!legal.includes(targetId)) return

    const source = this.cardObjects.get(sel.cardId)
    const target = this.cardObjects.get(targetId)
    if (source === undefined || target === undefined) return

    const { from, to } = connectorLine(source, target)
    // Resolve the style from the acting card's effect for THIS step, then hand
    // off to the matching draw routine. selectConnectorStyle is the single
    // source of truth (S1, unit-tested); we only render its verdict here.
    const style = this.stepConnectorStyle(sel.cardId, step)
    this.connectorGfx.clear()
    this.drawConnector(style, from, to)
  }

  /**
   * The CardEffect the acting card runs at `step`, looking through a Sequence
   * or Modal so the connector style tracks the active branch/step.
   *
   * The acting card is always a player card; its `effect` is either a single
   * CardEffect (Explore→DealProgress, Regroup/Zombie-Big-Box→DestroyCardInHand)
   * or a compound effect indexed by `step`:
   *
   *  - Sequence: `steps` line up 1:1 with the TargetSpec compound steps the
   *    click/highlight gating already indexes by `step` (Barricade: step 0
   *    DealProgress, step 1 ReturnWorldCards) — so we take `steps[step]`.
   *  - Modal: `step` is the chosen branch index (`sel.modalChoice`), matching
   *    how core's computeLegalTargets resolves a Modal via `effect.branches[step]`
   *    and how onCardClick/showConnector pass the step — so we take
   *    `branches[step]`. Without this the style would scan all branches and pick
   *    the first match, ignoring the player's modal choice.
   *
   * Otherwise the card's lone effect. Returns null if the acting card can't be
   * found or the step is out of range (drawConnector then falls back to a plain
   * accent line).
   */
  private stepEffect(cardId: string, step: number): CardEffect | null {
    const card = this.game_.state.hand.find((c) => c.id === cardId)
    if (card === undefined || card.kind !== 'player') return null
    const effect = card.effect
    if (effect.kind === 'Sequence') {
      return effect.steps[step] ?? null
    }
    if (effect.kind === 'Modal') {
      return effect.branches[step] ?? null
    }
    return effect
  }

  /**
   * Resolve the ConnectorStyle for the current step's effect. Wraps stepEffect
   * + selectConnectorStyle so callers get one answer. Returns null only when no
   * effect is found; drawConnector then falls back to the plain accent line.
   */
  private stepConnectorStyle(cardId: string, step: number): ConnectorStyle | null {
    const effect = this.stepEffect(cardId, step)
    return effect !== null ? selectConnectorStyle(effect) : null
  }

  /**
   * Draw the connector in one of three learnable styles, colours from the theme.
   *
   *  - progress → straight accent line (connectorProgress, pairs with ringAccent)
   *    feeding the acting card into the target's cost ring.
   *  - destroy  → harsh jagged red line (connectorDestroy) acting → target.
   *  - return   → curved arrow looping from the hovered target toward the world
   *    deck (connectorReturn), endpoint read live from pileLayer.worldPileCenter()
   *    to read "this world card goes back to the deck".
   *
   * A null style (shouldn't occur for the three real phases) falls back to the
   * plain progress accent line rather than throwing or drawing nothing.
   */
  private drawConnector(style: ConnectorStyle | null, from: Point, to: Point): void {
    const fs = this.theme_.frameStyle
    switch (style) {
      case 'destroy':
        this.drawJaggedLine(from, to, fs.connectorDestroy)
        break
      case 'return':
        this.drawReturnArrow(to, this.pileLayer.worldPileCenter(), fs.connectorReturn)
        break
      case 'progress':
      default:
        this.drawStraightLine(from, to, fs.connectorProgress)
        break
    }
  }

  /** Plain straight accent line (progress / fallback). */
  private drawStraightLine(from: Point, to: Point, color: number): void {
    this.connectorGfx.lineStyle(3, color, 0.9)
    this.connectorGfx.lineBetween(from.x, from.y, to.x, to.y)
  }

  /**
   * Harsh jagged line for destroy: a zig-zag of segments perpendicular-offset
   * from the straight path, evoking a tear/strike rather than a clean feed.
   */
  private drawJaggedLine(from: Point, to: Point, color: number): void {
    const segments = 8
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy) || 1
    // Unit normal, perpendicular to the line, to push alternating vertices off.
    const nx = -dy / len
    const ny = dx / len
    const amp = 7
    this.connectorGfx.lineStyle(3, color, 0.95)
    this.connectorGfx.beginPath()
    this.connectorGfx.moveTo(from.x, from.y)
    for (let i = 1; i < segments; i++) {
      const t = i / segments
      const sign = i % 2 === 0 ? 1 : -1
      this.connectorGfx.lineTo(from.x + dx * t + nx * amp * sign, from.y + dy * t + ny * amp * sign)
    }
    this.connectorGfx.lineTo(to.x, to.y)
    this.connectorGfx.strokePath()
  }

  /**
   * Curved arrow looping from the hovered world card toward the world-deck pile,
   * communicating "this card goes back to the deck". Source is the target card
   * (the world card being returned); destination is the live pile centre. A
   * quadratic curve bows the path and a small arrowhead marks the deck end.
   */
  private drawReturnArrow(from: Point, deck: Point, color: number): void {
    this.connectorGfx.lineStyle(3, color, 0.9)
    // Control point bowed above the chord so the arc reads as a loop, not a line.
    const midX = (from.x + deck.x) / 2
    const midY = (from.y + deck.y) / 2
    const ctrlX = midX
    const ctrlY = midY - 60
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(from.x, from.y),
      new Phaser.Math.Vector2(ctrlX, ctrlY),
      new Phaser.Math.Vector2(deck.x, deck.y),
    )
    curve.draw(this.connectorGfx, 32)
    // Arrowhead at the deck end, aimed along the tangent leaving the control pt.
    const angle = Math.atan2(deck.y - ctrlY, deck.x - ctrlX)
    const headLen = 12
    const spread = Math.PI / 7
    this.connectorGfx.beginPath()
    this.connectorGfx.moveTo(deck.x, deck.y)
    this.connectorGfx.lineTo(
      deck.x - headLen * Math.cos(angle - spread),
      deck.y - headLen * Math.sin(angle - spread),
    )
    this.connectorGfx.moveTo(deck.x, deck.y)
    this.connectorGfx.lineTo(
      deck.x - headLen * Math.cos(angle + spread),
      deck.y - headLen * Math.sin(angle + spread),
    )
    this.connectorGfx.strokePath()
  }

  /** Remove any drawn connector. Safe to call when nothing is drawn. */
  private clearConnector(): void {
    this.connectorGfx.clear()
  }

  private updateHint(): void {
    const sel = this.sel
    switch (sel.phase) {
      case 'idle':
        this.selectionHint.setText('')
        break
      case 'awaiting-hazard':
        this.selectionHint.setText('Select a Hazard target')
        break
      case 'awaiting-return':
        this.selectionHint.setText(
          `Select ${sel.min}–${sel.max} world cards to return (${sel.selected.length} chosen)`,
        )
        break
      case 'awaiting-discard':
        this.selectionHint.setText('Select a player card to discard')
        break
      case 'awaiting-destroy':
        this.selectionHint.setText('Select a card to destroy (optional)')
        break
      case 'awaiting-modal':
        this.selectionHint.setText('Choose an option above')
        break
      case 'selected':
        this.selectionHint.setText('')
        break
    }
  }
}

// ---------------------------------------------------------------------------
// Modal label helpers (module-level, not class methods)
// ---------------------------------------------------------------------------

function branchLabel(effectBranch: import('../core/index').CardEffect | undefined, idx: number): string {
  // Derive the label from the branch's actual effect (Sprint, etc.); no
  // hardcoded, index-keyed strings that could lie if the catalog changes.
  return effectBranch !== undefined ? describeEffect(effectBranch).join(', ') : `Option ${idx + 1}`
}

function branchIsLegal(
  spec: TargetSpec,
  idx: number,
  available: import('../core/index').AvailableActions,
  cardId: string,
): boolean {
  if (spec.kind === 'hazard') {
    const targets = available.legalTargets(cardId, idx)
    return targets.length > 0
  }
  return true
}
