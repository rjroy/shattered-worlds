/**
 * Targeting-connector drawing. Pure Phaser drawing on a provided Graphics — no
 * scene state, no GameState. The scene resolves the ConnectorStyle and endpoints
 * (TableScene.showConnector) and hands them here to render.
 */
import Phaser from 'phaser'
import type { ConnectorStyle, Point } from '../interaction/feedback'
import type { FrameStyle } from './theme'

/** Plain straight accent line (progress / fallback). */
function drawStraightLine(gfx: Phaser.GameObjects.Graphics, from: Point, to: Point, color: number): void {
  gfx.lineStyle(3, color, 0.9)
  gfx.lineBetween(from.x, from.y, to.x, to.y)
}

/**
 * Harsh jagged line for destroy: a zig-zag of segments perpendicular-offset
 * from the straight path, evoking a tear/strike rather than a clean feed.
 */
function drawJaggedLine(gfx: Phaser.GameObjects.Graphics, from: Point, to: Point, color: number): void {
  const segments = 8
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  // Unit normal, perpendicular to the line, to push alternating vertices off.
  const nx = -dy / len
  const ny = dx / len
  const amp = 7
  gfx.lineStyle(3, color, 0.95)
  gfx.beginPath()
  gfx.moveTo(from.x, from.y)
  for (let i = 1; i < segments; i++) {
    const t = i / segments
    const sign = i % 2 === 0 ? 1 : -1
    gfx.lineTo(from.x + dx * t + nx * amp * sign, from.y + dy * t + ny * amp * sign)
  }
  gfx.lineTo(to.x, to.y)
  gfx.strokePath()
}

/**
 * Curved arrow looping from the hovered world card toward the world-deck pile,
 * communicating "this card goes back to the deck". Source is the target card
 * (the world card being returned); destination is the live pile centre. A
 * quadratic curve bows the path and a small arrowhead marks the deck end.
 */
function drawReturnArrow(gfx: Phaser.GameObjects.Graphics, from: Point, deck: Point, color: number): void {
  gfx.lineStyle(3, color, 0.9)
  // Control point bowed above the chord so the arc reads as a loop, not a line.
  const midX = (from.x + deck.x) / 2
  const midY = (from.y + deck.y) / 2
  const ctrlX = midX
  const ctrlY = midY - 60
  const curve = new Phaser.Curves.QuadraticBezier(
    new Phaser.Math.Vector2(from.x, from.y),
    new Phaser.Math.Vector2(ctrlX, ctrlY),
    new Phaser.Math.Vector2(deck.x, deck.y),
  )
  curve.draw(gfx, 32)
  // Arrowhead at the deck end, aimed along the tangent leaving the control pt.
  const angle = Math.atan2(deck.y - ctrlY, deck.x - ctrlX)
  const headLen = 12
  const spread = Math.PI / 7
  gfx.beginPath()
  gfx.moveTo(deck.x, deck.y)
  gfx.lineTo(deck.x - headLen * Math.cos(angle - spread), deck.y - headLen * Math.sin(angle - spread))
  gfx.moveTo(deck.x, deck.y)
  gfx.lineTo(deck.x - headLen * Math.cos(angle + spread), deck.y - headLen * Math.sin(angle + spread))
  gfx.strokePath()
}

/**
 * Draw the connector in one of three learnable styles, colours from the theme.
 *
 *  - progress → straight accent line (connectorProgress, pairs with ringAccent)
 *    feeding the acting card into the target's cost ring.
 *  - destroy  → harsh jagged red line (connectorDestroy) acting → target.
 *  - return   → curved arrow looping from the hovered target toward the world
 *    deck (connectorReturn); `deck` is read live from pileLayer.worldPileCenter().
 *
 * A null style (shouldn't occur for the three real phases) falls back to the
 * plain progress accent line rather than throwing or drawing nothing. Does not
 * clear the Graphics — the caller clears before drawing.
 */
export function drawConnector(
  gfx: Phaser.GameObjects.Graphics,
  style: ConnectorStyle | null,
  from: Point,
  to: Point,
  deck: Point,
  fs: FrameStyle,
): void {
  switch (style) {
    case 'destroy':
      drawJaggedLine(gfx, from, to, fs.connectorDestroy)
      break
    case 'return':
      drawReturnArrow(gfx, to, deck, fs.connectorReturn)
      break
    case 'progress':
    default:
      drawStraightLine(gfx, from, to, fs.connectorProgress)
      break
  }
}
