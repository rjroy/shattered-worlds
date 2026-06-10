/**
 * Modal-effect chooser overlay. ModalChooserView owns the Phaser panel/buttons;
 * the caller (TableScene) resolves the per-branch view data and supplies the
 * onChoose / onCancel callbacks that own selection-state transitions.
 */
import Phaser from 'phaser'
import { getRealityPalette } from './themes/theme'
import type { VisualTheme } from './themes/theme'
import { textStyle, TEXT } from './presentation'
import { TABLE_LAYOUT } from './layout'
import { BranchLabel } from '../../core/view/branchLabels'

export class ModalChooserView extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    theme: VisualTheme,
    branches: readonly BranchLabel[],
    onChoose: (idx: number) => void,
    onCancel: () => void,
  ) {
    super(scene, 450, 300)
    scene.add.existing(this)
    this.setDepth(TABLE_LAYOUT.modalDepth)

    const bg = scene.add
      .nineslice(0, 0, 'text-back', undefined, 480, 240, 32, 32, 16, 16)
      .setTint(0x666666)
    this.add(bg)

    const title = scene.add.text(0, -80, 'Choose an effect:', textStyle({
      fontSize: '16px',
      color: getRealityPalette(theme, 'title', TEXT.textLight),
      fontStyle: 'bold',
    }))
    title.setOrigin(0.5, 0.5)
    this.add(title)

    branches.forEach((branch, idx) => {
      const btn = scene.add.text(0, -30 + idx * 60, branch.label, textStyle({
        fontSize: '14px',
        color: branch.isLegal
          ? getRealityPalette(theme, 'text', TEXT.textLight)
          : getRealityPalette(theme, 'disabled', TEXT.textDisabled),
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
      color: getRealityPalette(theme, 'cancel', TEXT.textPenalty),
    }))
    cancelBtn.setOrigin(0.5, 0.5)
    cancelBtn.setInteractive({ useHandCursor: true })
    cancelBtn.on('pointerdown', onCancel)
    this.add(cancelBtn)

    scene.children.bringToTop(this)
  }
}
