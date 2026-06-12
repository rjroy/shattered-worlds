import Phaser from 'phaser'
import { createGameplayRuntime } from './runtime/gameplayRuntime'
import { BootScene } from './scenes/BootScene'
import { WorldSelectScene } from './scenes/WorldSelectScene'
import { TableScene } from './scenes/TableScene'
import { CANVAS_W, CANVAS_H } from './view/layout'
import { TEXT } from './view/presentation'

// localStorage access itself can throw under restrictive privacy settings;
// fall back to in-memory-only stats rather than failing to boot.
function statsStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

// Composition root for gameplay observation: every TableScene session emits
// into this runtime's stream, and cross-run consumers (run stats today,
// meta progression and save policy later) subscribe here.
const gameplayRuntime = createGameplayRuntime({ storage: statsStorage() })

// Scene shutdown never fires when the tab closes; close open runs as
// abandoned so their streams end and stats persist. pagehide is the last
// reliable point for synchronous localStorage writes.
window.addEventListener('pagehide', () => gameplayRuntime.abandonAll())

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  backgroundColor: TEXT.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // roundPixels snaps texture draws to whole-integer positions, removing the
  // sub-pixel smear that setOrigin(0.5, …) produces on odd-width text (CARD_W is
  // 150). Antialias stays on (the AUTO/WebGL default) and pixelArt stays off —
  // text crispness comes from per-object resolution (see render.ts textStyle),
  // not nearest-neighbor scaling.
  render: {
    roundPixels: true,
  },
  scene: [new BootScene(), new WorldSelectScene(), new TableScene(gameplayRuntime)],
})

// Prevent tree-shaking of the game instance in some bundler configurations
export { game }
