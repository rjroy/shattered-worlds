/**
 * Modal-effect chooser overlay. ModalChooserView owns the Phaser panel/buttons;
 * the caller (TableScene) resolves the per-branch view data and supplies the
 * onChoose / onCancel callbacks that own selection-state transitions.
 */
import Phaser from 'phaser'
import { getRealityPalette } from './themes/theme'
import type { VisualTheme } from './themes/theme'
import { textStyle } from './presentation'
import { describeEffect } from '../interaction/describe'
import type { AvailableActions, CardEffect, TargetSpec } from '../../core/index'

export interface ModalBranchView {
  label: string
  isLegal: boolean
}

/** Label a branch from its actual effect, so the chooser can't drift from the card. */
function branchLabel(effectBranch: CardEffect | undefined, idx: number): string {
  return effectBranch !== undefined ? describeEffect(effectBranch).join(', ') : `Option ${idx + 1}`
}

/** A branch is legal unless it needs a hazard target and none are available. */
function branchIsLegal(
  spec: TargetSpec,
  idx: number,
  available: AvailableActions,
  cardId: string,
): boolean {
  if (spec.kind === 'hazard') {
    return available.legalTargets(cardId, idx).length > 0
  }
  return true
}

/** Resolve the label + legality for each modal branch. */
export function modalBranchViews(
  branchSpecs: readonly TargetSpec[],
  effectBranches: readonly CardEffect[],
  available: AvailableActions,
  cardId: string,
): ModalBranchView[] {
  return branchSpecs.map((spec, idx) => ({
    label: branchLabel(effectBranches[idx], idx),
    isLegal: branchIsLegal(spec, idx, available, cardId),
  }))
}

export class ModalChooserView extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    theme: VisualTheme,
    branches: readonly ModalBranchView[],
    onChoose: (idx: number) => void,
    onCancel: () => void,
  ) {
    super(scene, 450, 300)
    scene.add.existing(this)

    const bg = scene.add
      .nineslice(0, 0, 'text-back', undefined, 480, 240, 32, 32, 16, 16)
      .setTint(0x666666)
    this.add(bg)

    const title = scene.add.text(0, -80, 'Choose an effect:', textStyle({
      fontSize: '16px',
      color: getRealityPalette(theme, 'title', '#9aa3b2'),
      fontStyle: 'bold',
    }))
    title.setOrigin(0.5, 0.5)
    this.add(title)

    branches.forEach((branch, idx) => {
      const btn = scene.add.text(0, -30 + idx * 60, branch.label, textStyle({
        fontSize: '14px',
        color: branch.isLegal
          ? getRealityPalette(theme, 'text', '#88aaff')
          : getRealityPalette(theme, 'disabled', '#555577'),
        fontStyle: 'bold',
      }))
      btn.setOrigin(0.5, 0.5)
      if (branch.isLegal) {
        btn.setInteractive({ useHandCursor: true })
        btn.on('pointerdown', () => onChoose(idx))
      }
      this.add(btn)
    })

    const cancelBtn = scene.add.text(0, 80, '[ Cancel ]', textStyle({
      fontSize: '13px',
      color: getRealityPalette(theme, 'cancel', '#ff8888'),
    }))
    cancelBtn.setOrigin(0.5, 0.5)
    cancelBtn.setInteractive({ useHandCursor: true })
    cancelBtn.on('pointerdown', onCancel)
    this.add(cancelBtn)

    scene.children.bringToTop(this)
  }
}
