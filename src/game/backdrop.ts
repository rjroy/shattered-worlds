import Phaser from 'phaser'
import type { GameState } from '../core/index'
import type { VisualTheme } from './theme'
import { intrusionForIntensity } from './visualMappers'
import { walkerPresentation } from './walker'
import type { WalkerPresentation } from './walker'

const WALKER_START = { x: 450, y: 300 }
const WALKER_END = { x: 180, y: 480 }

export class BackdropLayer {
  private scene: Phaser.Scene
  private realityImg: Phaser.GameObjects.Image
  private intrusionImg: Phaser.GameObjects.Image
  private intrusionTween?: Phaser.Tweens.Tween

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

    // Walker sprite (depth -9, just above reality)
    if (theme.walker !== undefined) {
      const sprite = scene.add.image(WALKER_START.x, WALKER_START.y, theme.walker.textureKey)
      sprite.setOrigin(0.5, 1)
      sprite.setScale(75.0 / sprite.height)  // base size is 75 height at 1.0 scale
      sprite.setAlpha(0.35)
      sprite.setDepth(-9)
      this.walkerSprite = sprite
    }

    // Intrusion overlay at depth -8 (above reality and walker, behind cards/HUD)
    this.intrusionImg = scene.add.image(0, 0, theme.backdrop.intrusionKey)
    this.intrusionImg.setOrigin(0, 0)
    this.intrusionImg.setDisplaySize(900, 600)
    this.intrusionImg.setDepth(-8)
    this.intrusionImg.setAlpha(0)
  }

  updateIntrusion(intensity: number): void {
    // Intrusion: kill any running tween and start a fresh one toward the target.
    // This is safe on every drawAll() because intensity only changes when game
    // state changes (dispatch), keeping tween churn proportional to state changes.
    if (this.intrusionTween !== undefined) {
      this.intrusionTween.stop()
    }
    const targetAlpha = intrusionForIntensity(intensity)
    this.intrusionTween = this.scene.tweens.add({
      targets: this.intrusionImg,
      alpha: targetAlpha,
      duration: 1500,
      ease: 'Sine.easeInOut',
    })
  }

  updateWalker(state: GameState): void {
    // Walker
    if (this.walkerSprite === undefined) return

    const pres = walkerPresentation(state, true)

    if (pres.kind === 'foreground') {
      if (this.lastPresKind !== 'foreground') {
        const p = pres.proximity
        this.tweenWalker(1, p.size, p.alpha)
      }
    } else if (pres.kind === 'proximity') {
      const actChanged = state.actIndex !== this.lastActIndex
      const returnFromFg = this.lastPresKind === 'foreground'
      if (actChanged || returnFromFg) {
        const p = pres.proximity
        this.tweenWalker(state.actIndex / 3, p.size, p.alpha)
        this.lastActIndex = state.actIndex
      }
    }

    this.lastPresKind = pres.kind
  }
 
  /**
   * Call from drawAll(). Updates intrusion alpha and Walker position.
   * Transitions tween rather than snapping.
   */
  update(state: GameState, intensity: number): void {
    this.updateIntrusion(intensity)
    this.updateWalker(state)
 }

  private tweenWalker(position: number, size: number, alpha: number): void {
    if (this.walkerSprite === undefined) return
    if (this.walkerTween !== undefined) {
      this.walkerTween.stop()
    }
    this.walkerTween = this.scene.tweens.add({
      targets: this.walkerSprite,
      x: WALKER_START.x + position * (WALKER_END.x - WALKER_START.x),
      y: WALKER_START.y + position * (WALKER_END.y - WALKER_START.y),
      scaleX: size / this.walkerSprite.height,
      scaleY: size / this.walkerSprite.height,
      alpha,
      duration: 1800,
      ease: 'Sine.easeInOut',
    })
  }
}
