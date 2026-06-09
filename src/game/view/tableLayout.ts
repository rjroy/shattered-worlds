import { CANVAS_W, TABLE_LAYOUT } from './layout'

export interface RowCardPosition {
  x: number
  y: number
}

/**
 * Compute centered row positions for `count` cards.
 *
 * The row compresses when it would overflow the logical canvas, matching the
 * original TableScene behavior.
 */
export function rowCardPositions(count: number, rowY: number): RowCardPosition[] {
  if (count <= 0) return []

  const totalWidth = Math.min(
    CANVAS_W - TABLE_LAYOUT.cardSpacing - TABLE_LAYOUT.rowWidthPadding,
    (count - 1) * TABLE_LAYOUT.cardSpacing,
  )
  const startX = TABLE_LAYOUT.rowCenterX - totalWidth / 2
  const spacing = count > 1 ? totalWidth / (count - 1) : TABLE_LAYOUT.cardSpacing

  return Array.from({ length: count }, (_, i) => ({
    x: startX + i * spacing,
    y: rowY,
  }))
}
