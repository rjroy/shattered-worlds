import Phaser from 'phaser'
import type { GameState } from '../core/index'
import type { VisualTheme } from './theme'
import { intrusionForIntensity } from './visualMappers'
import { walkerPresentation } from './walker'
import type { WalkerPresentation } from './walker'

// Walker foreground position/scale — shown when the card is in hand.
const WALKER_FG = { x: 160, y: 300, scale: 0.52, alpha: 1.0 }

export class BackdropLayer {
  private scene: Phaser.Scene
  private realityImg: Phaser.GameObjects.Image
  private intrusionImg: Phaser.GameObjects.Image
  private intrusionTween: Phaser.Tweens.Tween

  // Walker (only present if the theme declares one)
  private walkerSprite?: Phaser.GameObjects.Image
  private walkerTween?: Phaser.Tweens.Tween
  private lastPresKind: WalkerPresentation['kind'] = 'hidden'
  private lastActIndex = -1

  constructor(scene: Phaser.Scene, theme: VisualTheme) {
    this.scene = scene

    // Reality at depth -10 (behind everything)
    this.realityImg = scene.add.image(0, 0, theme.backdrop.realityKey)
    this.realityImg.setOrigin(0, 0)
    this.realityImg.setDisplaySize(900, 600)
    this.realityImg.setDepth(-10)

    // Intrusion overlay at depth -9 (above reality, behind cards/HUD)
    this.intrusionImg = scene.add.image(0, 0, theme.backdrop.intrusionKey)
    this.intrusionImg.setOrigin(0, 0)
    this.intrusionImg.setDisplaySize(900, 600)
    this.intrusionImg.setDepth(-9)
    this.intrusionImg.setAlpha(0)

    // Intrusion tween — created on first update; field initialised to satisfy TS.
    this.intrusionTween = scene.tweens.add({
      targets: this.intrusionImg,
      alpha: 0,
      duration: 0,
      paused: true,
    })

    // Walker sprite (depth -8, just above intrusion)
    if (theme.walker !== undefined) {
      const sprite = scene.add.image(820, 480, theme.walker.textureKey)
      sprite.setOrigin(0.5, 1)
      sprite.setScale(0.18)
      sprite.setAlpha(0.35)
      sprite.setDepth(-8)
      this.walkerSprite = sprite
    }
  }

  /**
   * Call from drawAll(). Updates intrusion alpha and Walker position.
   * Transitions tween rather than snapping.
   */
  update(state: GameState, intensity: number): void {
    // Intrusion: kill any running tween and start a fresh one toward the target.
    // This is safe on every drawAll() because intensity only changes when game
    // state changes (dispatch), keeping tween churn proportional to state changes.
    const targetAlpha = intrusionForIntensity(intensity)
    this.scene.tweens.killTweensOf(this.intrusionImg)
    this.intrusionTween = this.scene.tweens.add({
      targets: this.intrusionImg,
      alpha: targetAlpha,
      duration: 1500,
      ease: 'Sine.easeInOut',
    })

    // Walker
    if (this.walkerSprite === undefined) return

    const pres = walkerPresentation(state, true)

    if (pres.kind === 'foreground') {
      if (this.lastPresKind !== 'foreground') {
        this.tweenWalker(WALKER_FG.x, WALKER_FG.y, WALKER_FG.scale, WALKER_FG.alpha)
      }
    } else if (pres.kind === 'proximity') {
      const actChanged = state.actIndex !== this.lastActIndex
      const returnFromFg = this.lastPresKind === 'foreground'
      if (actChanged || returnFromFg) {
        const p = pres.proximity
        this.tweenWalker(p.x, p.y, p.scale, p.alpha)
        this.lastActIndex = state.actIndex
      }
    }

    this.lastPresKind = pres.kind
  }

  private tweenWalker(x: number, y: number, scale: number, alpha: number): void {
    if (this.walkerSprite === undefined) return
    if (this.walkerTween !== undefined) {
      this.walkerTween.stop()
    }
    this.walkerTween = this.scene.tweens.add({
      targets: this.walkerSprite,
      x, y, scaleX: scale, scaleY: scale, alpha,
      duration: 1800,
      ease: 'Sine.easeInOut',
    })
  }
}
