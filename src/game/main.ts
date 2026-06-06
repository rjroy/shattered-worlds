import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { TableScene } from './scenes/TableScene'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 900,
  height: 600,
  backgroundColor: '#171920',
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
  scene: [BootScene, TableScene],
})

// Prevent tree-shaking of the game instance in some bundler configurations
export { game }
