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

const PILE_CARD_W = 40
const PILE_CARD_H = 52
const PILE_OFFSET = 2 // px offset per stacked card

export class PileLayer {
  private playerPile: Phaser.GameObjects.Container
  private worldPile: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.playerPile = scene.add.container(80, 540)
    this.worldPile = scene.add.container(820, 540)
  }

  update(scene: Phaser.Scene, playerCount: number, worldCount: number): void {
    this.playerPile.removeAll(true)
    this.worldPile.removeAll(true)
    this.renderStack(scene, this.playerPile, playerCount)
    this.renderStack(scene, this.worldPile, worldCount)
  }

  private renderStack(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    count: number,
  ): void {
    if (count === 0) return
    const visibleCards = Math.min(count, 4) // show up to 4 cards in the stack
    for (let i = 0; i < visibleCards; i++) {
      const img = scene.add.image(-i * PILE_OFFSET, -i * PILE_OFFSET, 'cardback')
      img.setDisplaySize(PILE_CARD_W, PILE_CARD_H)
      img.setOrigin(0.5, 1)
      container.addAt(img, 0) // add at bottom so first card is on top visually
    }
    // Show count text below the stack
    const label = scene.add.text(0, 4, String(count), {
      fontSize: '10px',
      color: '#9aa3b2',
    })
    label.setOrigin(0.5, 0)
    container.add(label)
  }
}
