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
import { createGame, availableActions } from '../core/index'
import type { GameCore, Card, Action, TargetSpec } from '../core/index'
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
} from './render'
import type { HUDRefs } from './render'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Vertical centre of the world cards (hazard) row. */
const WORLD_ROW_Y = 200
/** Vertical centre of the player hand row. */
const HAND_ROW_Y = 430
/** Horizontal start for the first card, with centering handled dynamically. */
const CARD_SPACING = 140
// ROW_LEFT reserved for future fixed-layout mode
// const ROW_LEFT = 80

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class TableScene extends Phaser.Scene {
  private game_!: GameCore
  private sel: SelectionState = IDLE

  /** All live card containers, keyed by card id. */
  private cardObjects: Map<string, Phaser.GameObjects.Container> = new Map()

  // Persistent HUD objects (created once, updated on drawAll)
  private hudRefs!: HUDRefs
  private endTurnBtn!: Phaser.GameObjects.Text
  private cancelBtn!: Phaser.GameObjects.Text
  private confirmBtn!: Phaser.GameObjects.Text
  private winScreen!: Phaser.GameObjects.Container
  private lossScreen!: Phaser.GameObjects.Container

  // Modal chooser UI (created/destroyed per card play)
  private modalContainer: Phaser.GameObjects.Container | null = null

  // Selection status text
  private selectionHint!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'TableScene' })
  }

  create(): void {
    this.game_ = createGame(42) // fixed seed for the demo

    this.hudRefs = createHUD(this)
    this.endTurnBtn = createEndTurnButton(this, 820, 560)
    this.endTurnBtn.on('pointerdown', () => this.onEndTurnClick())

    this.cancelBtn = createCancelButton(this)
    this.cancelBtn.on('pointerdown', () => {
      this.sel = cancel()
      this.dismissModal()
      this.drawAll()
    })

    this.confirmBtn = createConfirmButton(this)
    this.confirmBtn.on('pointerdown', () => this.onConfirmClick())

    this.winScreen = createWinScreen(this)
    this.lossScreen = createLossScreen(this)

    this.selectionHint = this.add.text(450, 568, '', {
      fontSize: '12px',
      color: '#9aa3b2',
    })
    this.selectionHint.setOrigin(0.5, 1)

    // Bring overlays to the top of the display list so they cover everything
    this.children.bringToTop(this.winScreen)
    this.children.bringToTop(this.lossScreen)

    this.drawAll()
  }

  // ---------------------------------------------------------------------------
  // Full repaint
  // ---------------------------------------------------------------------------

  /**
   * Destroy all card objects, recreate them from current state, apply
   * highlights derived from availableActions, and update the HUD.
   *
   * Called after every dispatch and after every selection-state change that
   * affects highlights.
   */
  private drawAll(): void {
    // Destroy existing card containers
    for (const container of this.cardObjects.values()) {
      container.destroy()
    }
    this.cardObjects.clear()

    const state = this.game_.state
    const available = availableActions(state)

    // Determine sets for highlight computation
    const playableIds = new Set(available.playable.map((p) => p.cardId))
    const discardableIds = new Set(available.discardable)

    let legalTargetIds = new Set<string>()
    if (
      this.sel.phase === 'awaiting-hazard' ||
      this.sel.phase === 'awaiting-discard' ||
      this.sel.phase === 'awaiting-destroy' ||
      this.sel.phase === 'awaiting-return'
    ) {
      const step =
        this.sel.phase === 'awaiting-return' && 'targetId' in this.sel && this.sel.targetId !== undefined
          ? 1
          : 0
      const targets = available.legalTargets(this.sel.cardId, step)
      legalTargetIds = new Set(targets)
    }

    // Split hand into world row and player row for layout
    const worldCards = state.hand.filter((c): c is import('../core/index').WorldCard => c.kind === 'world')
    const playerCards = state.hand.filter((c) => c.kind === 'player')

    this.layoutRow(worldCards, WORLD_ROW_Y, playableIds, discardableIds, legalTargetIds)
    this.layoutRow(playerCards, HAND_ROW_Y, playableIds, discardableIds, legalTargetIds)

    // HUD
    updateHUD(this.hudRefs, state)

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
   * Layout a row of cards centred horizontally, applying appropriate
   * interactive handlers and highlight styles.
   */
  private layoutRow(
    cards: readonly Card[],
    rowY: number,
    playableIds: Set<string>,
    discardableIds: Set<string>,
    legalTargetIds: Set<string>,
  ): void {
    const totalWidth = (cards.length - 1) * CARD_SPACING
    const startX = 450 - totalWidth / 2

    cards.forEach((card, i) => {
      const x = startX + i * CARD_SPACING
      const container = createCardObject(this, card, x, rowY)
      this.cardObjects.set(card.id, container)

      // Make card interactive
      container.setSize(120, 160)
      container.setInteractive({ useHandCursor: true })

      const id = card.id

      // Main card click
      container.on('pointerdown', () => {
        if (card.kind === 'player') {
          this.onCardClick(id)
        } else {
          // World cards: clicking them acts as target selection or card click
          this.onCardClick(id)
        }
      })

      // Apply visual state
      this.applyHighlight(container, card, playableIds, discardableIds, legalTargetIds)
    })
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

    // Selected card (all non-idle variants have cardId)
    if ('cardId' in sel && sel.cardId === id) {
      applyCardHighlight(container, 'selected')
      dimCard(container, false)
      return
    }

    // Legal target during a targeting phase
    if (legalTargetIds.has(id)) {
      applyCardHighlight(container, 'target')
      dimCard(container, false)
      return
    }

    // Discardable world card (not during a selection)
    if (discardableIds.has(id) && sel.phase === 'idle') {
      applyCardHighlight(container, 'discard')
      dimCard(container, false)
      return
    }

    // Playable player card (in idle state)
    if (card.kind === 'player' && playableIds.has(id) && sel.phase === 'idle') {
      applyCardHighlight(container, 'none')
      dimCard(container, false)
      return
    }

    // During awaiting-return, mark already-selected return targets
    if (sel.phase === 'awaiting-return' && sel.selected.includes(id)) {
      applyCardHighlight(container, 'selected')
      dimCard(container, false)
      return
    }

    // Everything else is dimmed when a selection is active, or when unplayable
    const selActive = sel.phase !== 'idle'
    if (selActive) {
      applyCardHighlight(container, 'none')
      dimCard(container, true)
    } else if (card.kind === 'player' && !playableIds.has(id)) {
      applyCardHighlight(container, 'none')
      dimCard(container, true)
    } else {
      applyCardHighlight(container, 'none')
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
      const step = 0
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
        // Compound starts with the first step (hazard targeting for Barricade)
        this.sel = { phase: 'awaiting-hazard', cardId }
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

    const title = this.add.text(0, -80, 'Choose an effect:', {
      fontSize: '16px',
      color: '#e8eaf0',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5, 0.5)
    container.add(title)

    spec.branches.forEach((branchSpec, idx) => {
      const label = branchLabel(branchSpec, idx, available, cardId)
      const isLegal = branchIsLegal(branchSpec, available, cardId)

      const btnY = -30 + idx * 60
      const btn = this.add.text(0, btnY, label, {
        fontSize: '14px',
        color: isLegal ? '#88aaff' : '#555577',
        fontStyle: 'bold',
      })
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
    const cancelBtn = this.add.text(0, 80, '[ Cancel ]', {
      fontSize: '13px',
      color: '#ff8888',
    })
    cancelBtn.setOrigin(0.5, 0.5)
    cancelBtn.setInteractive({ useHandCursor: true })
    cancelBtn.on('pointerdown', () => {
      this.sel = cancel()
      this.dismissModal()
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
    this.drawAll()
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Return the TargetSpec for the card currently being played, or null. */
  private currentSpec(): TargetSpec | null {
    if (this.sel.phase === 'idle') return null
    const cardId = this.sel.cardId
    const entry = availableActions(this.game_.state).playable.find((p) => p.cardId === cardId)
    return entry !== undefined ? entry.spec : null
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

function branchLabel(
  spec: TargetSpec,
  idx: number,
  _available: import('../core/index').AvailableActions,
  _cardId: string,
): string {
  // Sprint-specific labels
  if (idx === 0) return 'Draw cards (+ world draw)'
  if (idx === 1) return 'Hit Slow (+bonus vs Slow)'

  // Fallback generic labels
  switch (spec.kind) {
    case 'hazard':
      return `Option ${idx + 1}: Target Hazard`
    case 'none':
      return `Option ${idx + 1}: No target`
    default:
      return `Option ${idx + 1}`
  }
}

function branchIsLegal(
  spec: TargetSpec,
  available: import('../core/index').AvailableActions,
  cardId: string,
): boolean {
  if (spec.kind === 'hazard') {
    const tag = (spec as Extract<TargetSpec, { kind: 'hazard' }>).tag
    const targets = available.legalTargets(cardId, 1) // branch index 1 for Slow branch
    if (tag !== undefined && targets.length === 0) return false
    // For branch 0 (any hazard) always legal if there are world cards
    return true
  }
  return true
}
