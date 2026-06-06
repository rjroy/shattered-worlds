/**
 * Test preload: registers a real (headless) DOM so Phaser can be imported
 * under Bun. Phaser assumes browser globals (window, document, navigator,
 * canvas) exist at module-load time — see `class CommonLabel extends
 * Phaser.GameObjects.Container` in render.ts, which forces the engine to
 * evaluate the moment a test imports that module.
 *
 * happy-dom supplies a maintained DOM, replacing the hand-rolled window /
 * document / navigator / HTMLCanvasElement stubs this file used to carry.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

/**
 * The one thing happy-dom (like jsdom) does not implement is a working 2D
 * canvas context — that requires the native `node-canvas` package. Phaser's
 * device detection probes a context at import time anyway
 * (CanvasFeatures.checkInverseAlpha), so we install a minimal stub.
 *
 * checkInverseAlpha writes a pixel, reads it back, re-plots it, and reads
 * again, asserting the two reads match. A single shared 4-channel buffer makes
 * that round-trip stable, which is the entire reason for the pixel array.
 */
const pixels = [10, 20, 30, 40]

const stubContext = {
  fillStyle: '',
  globalCompositeOperation: '',
  fillRect() {},
  clearRect() {},
  drawImage() {},
  getImageData: () => ({ data: [...pixels] }),
  putImageData: (imageData: { data: number[] }) => {
    pixels.splice(0, pixels.length, ...imageData.data)
  },
}

const canvasProto = (globalThis as { HTMLCanvasElement?: { prototype: { getContext?: unknown } } })
  .HTMLCanvasElement?.prototype

if (canvasProto) {
  canvasProto.getContext = (type: string) => (type === '2d' ? stubContext : null)
}
