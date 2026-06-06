import Phaser from 'phaser'
import type { GameState } from '../core/index'
import type { VisualTheme } from './theme'
import { intrusionForIntensity, WALKER_CONSTS, DOOR_CONSTS } from './visualMappers'
import { walkerPresentation } from './walker'
import type { WalkerPresentation } from './walker'

const WALKER_START = { size: WALKER_CONSTS.far.size, x: 450, y: 330 }
const WALKER_END = { size: WALKER_CONSTS.present.size, x: 180, y: 480 }
const DOOR = { size: WALKER_CONSTS.far.size * DOOR_CONSTS.scalar, x: 120, y: 490 }

export class BackdropLayer {
  private scene: Phaser.Scene
  private realityImg: Phaser.GameObjects.Image
  private intrusionImg: Phaser.GameObjects.Image
  private intrusionTween?: Phaser.Tweens.Tween

  // Door (only present if the theme declares one)
  private doorSprite?: Phaser.GameObjects.Image
  private doorGlowSprite?: Phaser.GameObjects.Image
  private doorTween?: Phaser.Tweens.Tween
  private doorGlowTween?: Phaser.Tweens.Tween
  private lastDoorPresKind: WalkerPresentation['kind'] = 'hidden'
  private lastDoorActIndex = -1

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

    // Door sprite (depth -9, just above reality)
    const doorSprint = scene.add.image(DOOR.x, DOOR.y, 'door')
    doorSprint.setOrigin(0.5, 1)
    doorSprint.setScale(DOOR.size / doorSprint.height)  // base size is 75 height at 1.0 scale
    doorSprint.setAlpha(WALKER_CONSTS.far.alpha / 2)
    doorSprint.setDepth(-9)
    if (theme.doorTint !== undefined) {
      doorSprint.setTint(theme.doorTint)
    } else {
      doorSprint.setTint(0x734d26) // default door tint if not specified by theme (brown)
    }
    this.doorSprite = doorSprint

    // Door Glow sprite (depth -8, just above door)
    const doorGlowSprint = scene.add.image(DOOR.x, DOOR.y, 'door-glow')
    doorGlowSprint.setOrigin(0.5, 1)
    doorGlowSprint.setScale(DOOR.size / doorGlowSprint.height)  // base size is 75 height at 1.0 scale
    doorGlowSprint.setAlpha(WALKER_CONSTS.far.alpha * DOOR_CONSTS.glowAlpha)
    doorGlowSprint.setDepth(-8)
    if (theme.doorGlowTint !== undefined) {
      doorGlowSprint.setTint(theme.doorGlowTint)
    } else {
      doorGlowSprint.setTint(0xff30ff) // default glow tint if not specified by theme (magenta)
    }
    this.doorGlowSprite = doorGlowSprint
    

    // Walker sprite (depth -7, just above reality)
    const walkerSprint = scene.add.image(WALKER_START.x, WALKER_START.y, 'walker')
    walkerSprint.setOrigin(0.5, 1)
    walkerSprint.setScale(WALKER_START.size / walkerSprint.height)  // base size is 75 height at 1.0 scale
    walkerSprint.setAlpha(WALKER_CONSTS.far.alpha)
    walkerSprint.setDepth(-7)
    this.walkerSprite = walkerSprint

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

  updateDoor(state: GameState): void {
    if (this.doorSprite === undefined || this.doorGlowSprite === undefined) return
    if (this.lastDoorPresKind === 'foreground') return // Stop at foreground

    const pres = walkerPresentation(state, true)

    if (pres.kind === 'foreground') {
      const p = pres.proximity
      this.tweenDoor(p.size, p.alpha)
    } else if (pres.kind === 'proximity') {
      const actChanged = state.actIndex !== this.lastDoorActIndex
      if (actChanged) {
        const p = pres.proximity
        this.tweenDoor(p.size, p.alpha)
        this.lastDoorActIndex = state.actIndex
      }
    }

    this.lastDoorPresKind = pres.kind
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
    this.updateDoor(state)
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


  private tweenDoor(size: number, alpha: number): void {
    if (this.doorSprite === undefined || this.doorGlowSprite === undefined) return
    if (this.doorTween !== undefined) {
      this.doorTween.stop()
    }
    if (this.doorGlowTween !== undefined) {
      this.doorGlowTween.stop()
    }
    const doorSize = size * DOOR_CONSTS.scalar // Door is a bit bigger than the walker proximity size to make it more visible
    this.doorTween = this.scene.tweens.add({
      targets: this.doorSprite,
      scaleX: doorSize / this.doorSprite.height,
      scaleY: doorSize / this.doorSprite.height,
      alpha,
      duration: 1800,
      ease: 'Sine.easeInOut',
    })
    this.doorGlowTween = this.scene.tweens.add({
      targets: this.doorGlowSprite,
      scaleX: doorSize / this.doorGlowSprite.height,
      scaleY: doorSize / this.doorGlowSprite.height,
      alpha: alpha * DOOR_CONSTS.glowAlpha,  // glow is a bit dimmer than the door itself
      duration: 1800,
      ease: 'Sine.easeInOut',
    })
  }}
