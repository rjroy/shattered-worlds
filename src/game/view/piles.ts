/**
 * PileLayer — renders the player draw pile and world draw pile as small stacks
 * of face-down cardback images at the bottom corners of the table.
 *
 * The two containers are created once in the constructor and persist for the
 * lifetime of the scene. Only their contents (images + count label) are
 * cleared and rebuilt on each update() call. This makes them invisible to the
 * cardObjects map in TableScene, which wipes and recreates card containers on
 * every drawAll().
 */
import Phaser from 'phaser'
import { textStyle } from './presentation'
import { CommonLabel } from './components'

const PILE_CARD_W = 50
const PILE_CARD_H = 64
const PILE_OFFSET = 2 // px offset per stacked card

export class PileLayer {
  private playerPile: Phaser.GameObjects.Container
  private worldPile: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.playerPile = scene.add.container(80, 500)
    this.worldPile = scene.add.container(820, 500)
  }

  /**
   * Screen-space centre of the world-draw pile, read live from the pile
   * container's own position rather than hardcoded. The stack images are
   * placed relative to the container origin (the first card sits at 0,0 with
   * origin 0.5,1), so the container's (x, y) is the pile's anchor point — the
   * sensible endpoint for a "return to deck" connector. Lifting it slightly
   * (PILE_CARD_H / 2) points at the visual middle of the stack instead of its
   * bottom edge.
   */
  worldPileCenter(): { x: number; y: number } {
    return { x: this.worldPile.x, y: this.worldPile.y - PILE_CARD_H / 2 }
  }

  update(scene: Phaser.Scene, playerCount: number, worldCount: number): void {
    this.playerPile.removeAll(true)
    this.worldPile.removeAll(true)
    this.renderStack(scene, this.playerPile, 'Player', playerCount)
    this.renderStack(scene, this.worldPile, 'World', worldCount)
  }

  private renderStack(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    str: string,
    count: number,
  ): void {
    if (count === 0) return
    const visibleCards = Math.min(count, 5) // show up to 4 cards in the stack
    for (let i = 0; i < visibleCards; i++) {
      const img = scene.add.image(-i * PILE_OFFSET, -i * PILE_OFFSET, 'cardback')
      img.setDisplaySize(PILE_CARD_W, PILE_CARD_H)
      img.setOrigin(0.5, 1)
      container.addAt(img, 0) // add at bottom so first card is on top visually
    }

    // Show count text below the stack
    const label = new CommonLabel(scene, 0, 20, `${str}: ${count}`, textStyle({
      fontSize: '10px',
      color: '#b6c0d1',
    }))
    container.add(label)
  }
}
