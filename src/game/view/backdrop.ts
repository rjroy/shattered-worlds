import Phaser from 'phaser'
import type { GameState } from '../../core/index'
import type { VisualTheme } from './theme'
import { intrusionForIntensity, VISUAL_CONSTS } from './visualMappers'
import { CANVAS_W, CANVAS_H } from './presentation'
import { doorPresentation, walkerPresentation } from './walker'
import type { WalkerPresentation } from './walker'

const WALKER_START = { size: VISUAL_CONSTS.walker.proximity.far.size, x: 450, y: 330 }
const WALKER_END = { size: VISUAL_CONSTS.walker.proximity.present.size, x: 180, y: 480 }
const DOOR = { size: VISUAL_CONSTS.door.size, x: 120, y: 490 }

/** Scale an image so it renders `size` px tall (base art is 75px tall at 1.0). */
function scaleToSize(sprite: Phaser.GameObjects.Image, size: number): void {
  sprite.setScale(size / sprite.height)
}

export class BackdropLayer {
  private scene: Phaser.Scene
  private realityImg: Phaser.GameObjects.Image
  private intrusionImg: Phaser.GameObjects.Image
  private intrusionTween?: Phaser.Tweens.Tween

  // Door + its glow halo
  private doorSprite: Phaser.GameObjects.Image
  private doorGlowSprite: Phaser.GameObjects.Image
  private doorTween?: Phaser.Tweens.Tween
  private doorGlowTween?: Phaser.Tweens.Tween
  private lastDoorPresKind: WalkerPresentation['kind'] = 'hidden'
  private lastDoorActIndex = -1

  // Walker (the antagonist sprite advancing through the acts)
  private walkerSprite: Phaser.GameObjects.Image
  private walkerTween?: Phaser.Tweens.Tween
  private lastWalkerPresKind: WalkerPresentation['kind'] = 'hidden'
  private lastWalkerActIndex = -1
  private hasWalkerLeft = false

  constructor(scene: Phaser.Scene, theme: VisualTheme) {
    this.scene = scene

    // Reality at depth -10 (behind everything)
    this.realityImg = scene.add.image(0, 0, theme.backdrop.realityKey)
    this.realityImg.setOrigin(0, 0)
    this.realityImg.setDisplaySize(CANVAS_W, CANVAS_H)
    this.realityImg.setDepth(-10)

    // Door (depth -9) and its glow halo (depth -8), just above reality. Both
    // start invisible and fade in via tween. Defaults: brown door, magenta glow.
    this.doorSprite = this.addDoorLayer('door', -9, theme.doorTint, 0x734d26)
    this.doorGlowSprite = this.addDoorLayer('door-glow', -8, theme.doorGlowTint, 0xff30ff)

    // Walker sprite (depth -7, just above reality)
    const walker = scene.add.image(WALKER_START.x, WALKER_START.y, 'walker')
    walker.setOrigin(0.5, 1)
    scaleToSize(walker, WALKER_START.size)
    walker.setAlpha(0)
    walker.setDepth(-7)
    this.walkerSprite = walker

    // Intrusion overlay at depth -8 (above reality and walker, behind cards/HUD)
    this.intrusionImg = scene.add.image(0, 0, theme.backdrop.intrusionKey)
    this.intrusionImg.setOrigin(0, 0)
    this.intrusionImg.setDisplaySize(CANVAS_W, CANVAS_H)
    this.intrusionImg.setAlpha(0)
    this.intrusionImg.setDepth(-8)
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

  updateDoor(state: GameState): void {
    if (this.lastDoorPresKind === 'foreground') return // Stop at foreground

    const pres = doorPresentation(state, true)

    if (pres.kind === 'foreground') {
      this.tweenDoor(pres.proximity.alpha)
    } else if (pres.kind === 'proximity') {
      const actChanged = state.actIndex !== this.lastDoorActIndex
      if (actChanged) {
        this.tweenDoor(pres.proximity.alpha)
        this.lastDoorActIndex = state.actIndex
      }
    }

    this.lastDoorPresKind = pres.kind
  }

  updateWalker(state: GameState): void {
    if (this.hasWalkerLeft) return // Once the Walker has left, it doesn't come back

    const pres = walkerPresentation(state, true)

    if (pres.kind === 'foreground') {
      if (this.lastWalkerPresKind !== 'foreground') {
        const p = pres.proximity
        this.tweenWalker(1, p.size, p.alpha)
      }
    } else if (pres.kind === 'proximity') {
      const p = pres.proximity
      const returnFromFg = this.lastWalkerPresKind === 'foreground'
      if (returnFromFg) {
        this.tweenWalker(1, VISUAL_CONSTS.walker.proximity.present.size, 0)
        this.hasWalkerLeft = true
      } else {
        const actChanged = state.actIndex !== this.lastWalkerActIndex
        if (actChanged) {
          this.tweenWalker(state.actIndex / 3, p.size, p.alpha)
          this.lastWalkerActIndex = state.actIndex
        }
      }
    }

    this.lastWalkerPresKind = pres.kind
  }

  /**
   * Call from drawAll(). Updates intrusion alpha and Walker position.
   * Transitions tween rather than snapping.
   */
  update(state: GameState, intensity: number): void {
    this.updateIntrusion(intensity)
    this.updateDoor(state)
    this.updateWalker(state)
  }

  private tweenWalker(position: number, size: number, alpha: number): void {
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

  private tweenDoor(alpha: number): void {
    if (this.doorTween !== undefined) {
      this.doorTween.stop()
    }
    if (this.doorGlowTween !== undefined) {
      this.doorGlowTween.stop()
    }
    this.doorTween = this.scene.tweens.add({
      targets: this.doorSprite,
      alpha,
      duration: 1800,
      ease: 'Sine.easeInOut',
    })
    this.doorGlowTween = this.scene.tweens.add({
      targets: this.doorGlowSprite,
      alpha: alpha * VISUAL_CONSTS.door.glowAlpha,  // glow is a bit dimmer than the door itself
      duration: 1800,
      ease: 'Sine.easeInOut',
    })
  }

  /**
   * Build a door-tier sprite (the door or its glow): positioned at the door
   * anchor, scaled, hidden (fades in via tween), depth-sorted, and tinted by
   * the theme or the given default.
   */
  private addDoorLayer(
    key: string,
    depth: number,
    tint: number | undefined,
    defaultTint: number,
  ): Phaser.GameObjects.Image {
    const img = this.scene.add.image(DOOR.x, DOOR.y, key)
    img.setOrigin(0.5, 1)
    scaleToSize(img, DOOR.size)
    img.setAlpha(0) // start invisible, fades in via tween
    img.setDepth(depth)
    img.setTint(tint ?? defaultTint)
    return img
  }
}
