import Phaser from 'phaser'
import { BootScene } from './BootScene'
import { TableScene } from './TableScene'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 900,
  height: 600,
  backgroundColor: '#1a2035',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TableScene],
})

// Prevent tree-shaking of the game instance in some bundler configurations
export { game }
