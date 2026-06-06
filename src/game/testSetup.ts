/* eslint-disable @typescript-eslint/no-explicit-any */
const g = globalThis as any

if (g.window === undefined) {
  g.window = g
}

if (g.document === undefined) {
  g.document = {}
}

if (g.document.documentElement === undefined) {
  g.document.documentElement = {}
}

if (g.document.createElement === undefined) {
  g.document.createElement = (tag: string) => {
    if (tag === 'audio') {
      return {
        canPlayType(): string {
          return ''
        },
      }
    }

    if (tag === 'canvas') {
      return new g.HTMLCanvasElement()
    }

    return {}
  }
}

if (g.navigator === undefined) {
  g.navigator = { maxTouchPoints: 0 }
} else if (g.navigator.maxTouchPoints === undefined) {
  g.navigator.maxTouchPoints = 0
}

class TestCanvas {
  width = 0
  height = 0
  private pixels = [10, 20, 30, 40]

  getContext(type: string) {
    if (type !== '2d') return null

    return {
      fillRect: () => {},
      drawImage: () => {},
      getImageData: () => ({ data: [...this.pixels] }),
      putImageData: (imageData: { data: number[] }) => {
        this.pixels = [...imageData.data]
      },
    }
  }
}

if (g.HTMLCanvasElement === undefined) {
  g.HTMLCanvasElement = TestCanvas
}

if (g.Image === undefined) {
  g.Image = class {
    onload: null | (() => void) = null
    set src(_value: string) {}
    get src(): string {
      return ''
    }
  }
}
