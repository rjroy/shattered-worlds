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
import Phaser from "phaser";
import { textStyle, TEXT } from "./presentation";
import { FONTS } from "./fonts";
import { CommonLabel } from "./components";
import { PILE_LAYOUT } from "./layout";
import { addTooltip } from "./TooltipView";
import { TooltipCopy } from "../../core/view/effectTooltips";

const PILE_CARD_W = PILE_LAYOUT.cardWidth;
const PILE_CARD_H = PILE_LAYOUT.cardHeight;
const PILE_OFFSET = PILE_LAYOUT.cardOffset; // px offset per stacked card
const PILE_TOOLTIPS: Record<string, TooltipCopy> = {
  Player: {
    title: "Player Draw Pile",
    body: "The deck of availabeble cards to be drawn by the player. When this reaches 0, the discard pile is shuffled to create a new draw pile.",
  },
  World: {
    title: "World Draw Pile",
    body: "The deck of hazards cards for the current act. When this reaches 0, a new act begins. You will draw at least 1 a turn and have a minimum of 2 world cards.",
  },
  Discard: {
    title: "Discard Draw Pile",
    body: "The deck of discarded cards for the player. Used to refill the player draw pile when it is empty.",
  },
};

export class PileLayer {
  private playerPile: Phaser.GameObjects.Container;
  private worldPile: Phaser.GameObjects.Container;
  private discardPile: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.playerPile = scene.add.container(PILE_LAYOUT.player.x, PILE_LAYOUT.player.y);
    this.worldPile = scene.add.container(PILE_LAYOUT.world.x, PILE_LAYOUT.world.y);
    this.discardPile = scene.add.container(PILE_LAYOUT.discard.x, PILE_LAYOUT.discard.y);
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
    return { x: this.worldPile.x, y: this.worldPile.y - PILE_CARD_H / 2 };
  }

  update(scene: Phaser.Scene, playerCount: number, worldCount: number, discardCount: number): void {
    this.playerPile.removeAll(true);
    this.worldPile.removeAll(true);
    this.discardPile.removeAll(true);
    this.renderStack(scene, this.playerPile, "Player", playerCount, "cardback");
    this.renderStack(scene, this.worldPile, "World", worldCount, "cardback");
    this.renderStack(scene, this.discardPile, "Discard", discardCount, "cardfront");
  }

  private renderStack(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    str: string,
    count: number,
    texture: string,
  ): void {
    if (count === 0) return;
    const visibleCards = Math.min(count, PILE_LAYOUT.maxVisibleCards);
    let lastImage: Phaser.GameObjects.Image | undefined = undefined;
    for (let i = 0; i < visibleCards; i++) {
      const img = scene.add.image(-i * PILE_OFFSET, -i * PILE_OFFSET, texture);
      img.setDisplaySize(PILE_CARD_W, PILE_CARD_H);
      img.setOrigin(0.5, 1);
      container.addAt(img, 0); // add at bottom so first card is on top visually
      lastImage = img;
    }
    if (lastImage !== undefined && PILE_TOOLTIPS[str] !== undefined) {
      addTooltip(scene, lastImage, PILE_TOOLTIPS[str]);
    }

    // Show count text below the stack
    const label = new CommonLabel(
      scene,
      0,
      PILE_LAYOUT.labelY,
      `${str}: ${count}`,
      textStyle({
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: TEXT.textMuted,
      }),
    );
    container.add(label);
    if (PILE_TOOLTIPS[str] !== undefined) {
      label.setTooltip(PILE_TOOLTIPS[str]);
    }
  }
}
