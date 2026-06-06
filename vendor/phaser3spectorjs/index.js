/* eslint-disable no-undef */
class Spector {
  constructor() {
    this.onCapture = { add() {} }
  }

  captureCanvas() {}
  captureNextFrame() {}
  getFps() {
    return 0
  }
  log() {}
  startCapture() {}
  stopCapture() {}
  getResultUI() {
    return null
  }
}

module.exports = { Spector }
