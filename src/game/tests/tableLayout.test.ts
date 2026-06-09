import { describe, expect, it } from 'bun:test'
import { CANVAS_W, TABLE_LAYOUT } from '../view/layout'
import { rowCardPositions } from '../view/tableLayout'

describe('rowCardPositions', () => {
  it('returns no positions for an empty row', () => {
    expect(rowCardPositions(0, TABLE_LAYOUT.handRowY)).toEqual([])
  })

  it('centers a single card on the row', () => {
    expect(rowCardPositions(1, TABLE_LAYOUT.handRowY)).toEqual([
      { x: TABLE_LAYOUT.rowCenterX, y: TABLE_LAYOUT.handRowY },
    ])
  })

  it('uses natural spacing while the row fits', () => {
    const positions = rowCardPositions(3, TABLE_LAYOUT.worldRowY)

    expect(positions).toEqual([
      { x: TABLE_LAYOUT.rowCenterX - TABLE_LAYOUT.cardSpacing, y: TABLE_LAYOUT.worldRowY },
      { x: TABLE_LAYOUT.rowCenterX, y: TABLE_LAYOUT.worldRowY },
      { x: TABLE_LAYOUT.rowCenterX + TABLE_LAYOUT.cardSpacing, y: TABLE_LAYOUT.worldRowY },
    ])
  })

  it('compresses wide rows to fit inside the table bounds', () => {
    const positions = rowCardPositions(6, TABLE_LAYOUT.handRowY)
    const maxWidth = CANVAS_W - TABLE_LAYOUT.cardSpacing - TABLE_LAYOUT.rowWidthPadding

    expect(positions[0]!.x).toBeCloseTo(TABLE_LAYOUT.rowCenterX - maxWidth / 2)
    expect(positions[5]!.x).toBeCloseTo(TABLE_LAYOUT.rowCenterX + maxWidth / 2)
    expect(positions[1]!.x - positions[0]!.x).toBeCloseTo(maxWidth / 5)
  })
})
