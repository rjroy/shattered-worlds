/**
 * Full-screen end-game overlays (win / loss). Stateless Phaser factories; the
 * scene toggles visibility based on GameState.status.
 */
import Phaser from 'phaser'
import { textStyle, CANVAS_W, CANVAS_H } from './presentation'

/** Create a full-screen end overlay (hidden by default), centered on the canvas. */
function createEndScreen(
  scene: Phaser.Scene,
  title: string,
  titleColor: string,
  subtitle: string,
): Phaser.GameObjects.Container {
  const container = scene.add.container(CANVAS_W / 2, CANVAS_H / 2)
  container.setDepth(1000)
  container.setVisible(false)

  const bg = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x000000, 0.8)
  container.add(bg)

  const text = scene.add.text(0, -30, title, textStyle({
    fontSize: '72px',
    color: titleColor,
    fontStyle: 'bold',
  }))
  text.setOrigin(0.5, 0.5)
  container.add(text)

  const sub = scene.add.text(0, 50, subtitle, textStyle({
    fontSize: '20px',
    color: '#9aa3b2',
  }))
  sub.setOrigin(0.5, 0.5)
  container.add(sub)

  return container
}

/** Create a full-screen win overlay (hidden by default). */
export function createWinScreen(scene: Phaser.Scene): Phaser.GameObjects.Container {
  return createEndScreen(scene, 'YOU WIN', '#88ee88', 'You survived.')
}

/** Create a full-screen loss overlay (hidden by default). */
export function createLossScreen(scene: Phaser.Scene): Phaser.GameObjects.Container {
  return createEndScreen(scene, 'YOU LOSE', '#ff8888', 'You did not survive meeting the Walker.')
}
