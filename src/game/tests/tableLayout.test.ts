import { describe, expect, it } from 'bun:test'
import { CANVAS_H, CANVAS_W, CARD_FACE, TABLE_LAYOUT } from '../view/layout'
import {
  ROW_WINDOW_VISIBLE_LIMIT,
  bringRowCardIdIntoView,
  bringRowIndexIntoView,
  clampRowWindowOffset,
  clampRowWindowOffsetAfterRemoval,
  rowCardPositions,
  rowWindowLayout,
  rowWindowPageOffset,
  rowWindowSlotOffset,
} from '../view/tableLayout'

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

describe('rowWindowLayout', () => {
  it('returns an empty first window for an empty row', () => {
    expect(rowWindowLayout([], 0, TABLE_LAYOUT.handRowY)).toEqual({
      totalCount: 0,
      visibleLimit: ROW_WINDOW_VISIBLE_LIMIT,
      requestedOffset: 0,
      offset: 0,
      startIndex: 0,
      endIndex: 0,
      visibleIds: [],
      positions: [],
      rangeLabel: '0 of 0',
      hasOverflow: false,
      canPageBackward: false,
      canPageForward: false,
    })
  })

  it('keeps a one-card row centered without overflow', () => {
    const layout = rowWindowLayout(['card-1'], 3, TABLE_LAYOUT.handRowY)

    expect(layout.offset).toBe(0)
    expect(layout.visibleIds).toEqual(['card-1'])
    expect(layout.positions).toEqual([{ x: TABLE_LAYOUT.rowCenterX, y: TABLE_LAYOUT.handRowY }])
    expect(layout.rangeLabel).toBe('1-1 of 1')
    expect(layout.hasOverflow).toBe(false)
  })

  it('keeps a five-card row centered at natural spacing without overflow', () => {
    const layout = rowWindowLayout(['c1', 'c2', 'c3', 'c4', 'c5'], 0, TABLE_LAYOUT.worldRowY)

    expect(layout.visibleIds).toEqual(['c1', 'c2', 'c3', 'c4', 'c5'])
    expect(layout.positions).toEqual(rowCardPositions(5, TABLE_LAYOUT.worldRowY))
    expect(layout.rangeLabel).toBe('1-5 of 5')
    expect(layout.hasOverflow).toBe(false)
    expect(layout.canPageBackward).toBe(false)
    expect(layout.canPageForward).toBe(false)
  })

  it('windows a six-card overflow row at the readable visible limit', () => {
    const layout = rowWindowLayout(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], 0, TABLE_LAYOUT.handRowY)

    expect(layout.visibleIds).toEqual(['c1', 'c2', 'c3', 'c4', 'c5'])
    expect(layout.positions).toEqual(rowCardPositions(5, TABLE_LAYOUT.handRowY))
    expect(layout.rangeLabel).toBe('1-5 of 6')
    expect(layout.hasOverflow).toBe(true)
    expect(layout.canPageBackward).toBe(false)
    expect(layout.canPageForward).toBe(true)
  })

  it('preserves stable order and labels middle windows in twenty-plus-card overflow rows', () => {
    const ids = Array.from({ length: 23 }, (_, i) => `card-${i + 1}`)
    const layout = rowWindowLayout(ids, 5, TABLE_LAYOUT.worldRowY)

    expect(layout.offset).toBe(5)
    expect(layout.startIndex).toBe(5)
    expect(layout.endIndex).toBe(10)
    expect(layout.visibleIds).toEqual(['card-6', 'card-7', 'card-8', 'card-9', 'card-10'])
    expect(layout.rangeLabel).toBe('6-10 of 23')
    expect(layout.hasOverflow).toBe(true)
    expect(layout.canPageBackward).toBe(true)
    expect(layout.canPageForward).toBe(true)
  })

  it('clamps windows past the end to the last readable slice', () => {
    const ids = Array.from({ length: 23 }, (_, i) => `card-${i + 1}`)
    const layout = rowWindowLayout(ids, 999, TABLE_LAYOUT.handRowY)

    expect(layout.requestedOffset).toBe(999)
    expect(layout.offset).toBe(18)
    expect(layout.visibleIds).toEqual(['card-19', 'card-20', 'card-21', 'card-22', 'card-23'])
    expect(layout.rangeLabel).toBe('19-23 of 23')
    expect(layout.canPageForward).toBe(false)
  })
})

describe('row window navigation helpers', () => {
  it('clamps offsets for empty, fitting, and overflowing rows', () => {
    expect(clampRowWindowOffset(0, 12)).toBe(0)
    expect(clampRowWindowOffset(5, 3)).toBe(0)
    expect(clampRowWindowOffset(6, -3)).toBe(0)
    expect(clampRowWindowOffset(6, 3)).toBe(1)
    expect(clampRowWindowOffset(23, 99)).toBe(18)
    expect(clampRowWindowOffset(23, Number.NaN)).toBe(0)
  })

  it('moves by page and by slot while clamping at row boundaries', () => {
    expect(rowWindowPageOffset(23, 0, 1)).toBe(5)
    expect(rowWindowPageOffset(23, 16, 1)).toBe(18)
    expect(rowWindowPageOffset(23, 5, -1)).toBe(0)
    expect(rowWindowSlotOffset(23, 5, 1)).toBe(6)
    expect(rowWindowSlotOffset(23, 0, -1)).toBe(0)
    expect(rowWindowSlotOffset(23, 18, 1)).toBe(18)
  })

  it('clamps the current offset after removals', () => {
    expect(clampRowWindowOffsetAfterRemoval(18, 23)).toBe(18)
    expect(clampRowWindowOffsetAfterRemoval(18, 12)).toBe(7)
    expect(clampRowWindowOffsetAfterRemoval(7, 5)).toBe(0)
    expect(clampRowWindowOffsetAfterRemoval(7, 0)).toBe(0)
  })

  it('brings a row index into the current visible window', () => {
    expect(bringRowIndexIntoView(4, 0, 23)).toBe(0)
    expect(bringRowIndexIntoView(5, 0, 23)).toBe(1)
    expect(bringRowIndexIntoView(20, 1, 23)).toBe(16)
    expect(bringRowIndexIntoView(2, 10, 23)).toBe(2)
    expect(bringRowIndexIntoView(99, 10, 23)).toBe(10)
  })

  it('brings a card id into the current visible window', () => {
    const ids = Array.from({ length: 23 }, (_, i) => `card-${i + 1}`)

    expect(bringRowCardIdIntoView(ids, 'card-1', 8)).toBe(0)
    expect(bringRowCardIdIntoView(ids, 'card-9', 8)).toBe(8)
    expect(bringRowCardIdIntoView(ids, 'card-23', 8)).toBe(18)
    expect(bringRowCardIdIntoView(ids, 'missing', 8)).toBe(8)
  })
})

describe('row navigation geometry', () => {
  it('keeps overflow controls outside five-card centers and away from bottom chrome', () => {
    const fiveCardPositions = rowCardPositions(5, TABLE_LAYOUT.handRowY)
    const cardCenterMinX = fiveCardPositions[0]!.x
    const cardCenterMaxX = fiveCardPositions.at(-1)!.x
    const cardHalfWidth = CARD_FACE.width / 2
    const previewBandTop = Math.min(
      TABLE_LAYOUT.buttons.confirm.y,
      TABLE_LAYOUT.buttons.endTurn.y,
      TABLE_LAYOUT.previewSlot.y,
      TABLE_LAYOUT.selectionHint.y,
    )

    expect(TABLE_LAYOUT.rowNav.previousX).toBeLessThan(cardCenterMinX - cardHalfWidth)
    expect(TABLE_LAYOUT.rowNav.nextX).toBeGreaterThan(cardCenterMaxX + cardHalfWidth)
    expect(TABLE_LAYOUT.rowNav.world.buttonY).toBeGreaterThan(
      TABLE_LAYOUT.worldRowY + CARD_FACE.height / 2,
    )
    expect(TABLE_LAYOUT.rowNav.player.buttonY).toBeLessThan(
      TABLE_LAYOUT.handRowY - CARD_FACE.height / 2,
    )
    expect(TABLE_LAYOUT.rowNav.player.buttonY).toBeLessThan(previewBandTop)
    expect(TABLE_LAYOUT.rowNav.world.labelX).toBeLessThan(cardCenterMinX)
    expect(TABLE_LAYOUT.rowNav.player.labelX).toBeGreaterThan(cardCenterMaxX)
    expect(TABLE_LAYOUT.rowNav.nextX).toBeLessThan(CANVAS_W)
    expect(TABLE_LAYOUT.rowNav.player.buttonY).toBeLessThan(CANVAS_H)
  })
})
