import { CANVAS_W, TABLE_LAYOUT } from './layout'

export const ROW_WINDOW_VISIBLE_LIMIT = 5

export interface RowCardPosition {
  x: number
  y: number
}

export interface RowWindowState {
  offset: number
}

export interface RowWindowLayout<CardId extends string = string> {
  totalCount: number
  visibleLimit: number
  requestedOffset: number
  offset: number
  startIndex: number
  endIndex: number
  visibleIds: CardId[]
  positions: RowCardPosition[]
  rangeLabel: string
  hasOverflow: boolean
  canPageBackward: boolean
  canPageForward: boolean
}

function nonnegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function positiveInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1
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

export function clampRowWindowOffset(
  cardCount: number,
  desiredOffset: number,
  visibleLimit = ROW_WINDOW_VISIBLE_LIMIT,
): number {
  const safeCardCount = nonnegativeInteger(cardCount)
  const safeVisibleLimit = positiveInteger(visibleLimit)
  const safeDesiredOffset = Number.isFinite(desiredOffset) ? Math.trunc(desiredOffset) : 0
  const maxOffset = Math.max(0, safeCardCount - safeVisibleLimit)

  return Math.min(Math.max(0, safeDesiredOffset), maxOffset)
}

export function clampRowWindowOffsetAfterRemoval(
  currentOffset: number,
  remainingCardCount: number,
  visibleLimit = ROW_WINDOW_VISIBLE_LIMIT,
): number {
  return clampRowWindowOffset(remainingCardCount, currentOffset, visibleLimit)
}

export function rowWindowPageOffset(
  cardCount: number,
  currentOffset: number,
  direction: -1 | 1,
  visibleLimit = ROW_WINDOW_VISIBLE_LIMIT,
): number {
  const offset = clampRowWindowOffset(cardCount, currentOffset, visibleLimit)
  return clampRowWindowOffset(cardCount, offset + direction * visibleLimit, visibleLimit)
}

export function rowWindowSlotOffset(
  cardCount: number,
  currentOffset: number,
  direction: -1 | 1,
  visibleLimit = ROW_WINDOW_VISIBLE_LIMIT,
): number {
  const offset = clampRowWindowOffset(cardCount, currentOffset, visibleLimit)
  return clampRowWindowOffset(cardCount, offset + direction, visibleLimit)
}

export function bringRowIndexIntoView(
  cardIndex: number,
  currentOffset: number,
  cardCount: number,
  visibleLimit = ROW_WINDOW_VISIBLE_LIMIT,
): number {
  const offset = clampRowWindowOffset(cardCount, currentOffset, visibleLimit)
  const safeCardIndex = Math.trunc(cardIndex)

  if (safeCardIndex < 0 || safeCardIndex >= cardCount) return offset
  if (safeCardIndex < offset) return clampRowWindowOffset(cardCount, safeCardIndex, visibleLimit)
  if (safeCardIndex >= offset + visibleLimit) {
    return clampRowWindowOffset(cardCount, safeCardIndex - visibleLimit + 1, visibleLimit)
  }

  return offset
}

export function bringRowCardIdIntoView<CardId extends string>(
  cardIds: readonly CardId[],
  cardId: string,
  currentOffset: number,
  visibleLimit = ROW_WINDOW_VISIBLE_LIMIT,
): number {
  const cardIndex = cardIds.findIndex((id) => id === cardId)
  return bringRowIndexIntoView(cardIndex, currentOffset, cardIds.length, visibleLimit)
}

export function rowWindowRangeLabel(startIndex: number, endIndex: number, totalCount: number): string {
  if (totalCount <= 0) return '0 of 0'
  return `${startIndex + 1}-${endIndex} of ${totalCount}`
}

export function rowWindowLayout<CardId extends string>(
  cardIds: readonly CardId[],
  desiredOffset: number,
  rowY: number,
  visibleLimit = ROW_WINDOW_VISIBLE_LIMIT,
): RowWindowLayout<CardId> {
  const totalCount = cardIds.length
  const safeVisibleLimit = positiveInteger(visibleLimit)
  const offset = clampRowWindowOffset(totalCount, desiredOffset, safeVisibleLimit)
  const endIndex = Math.min(totalCount, offset + safeVisibleLimit)
  const visibleIds = cardIds.slice(offset, endIndex)
  const hasOverflow = totalCount > safeVisibleLimit

  return {
    totalCount,
    visibleLimit: safeVisibleLimit,
    requestedOffset: desiredOffset,
    offset,
    startIndex: offset,
    endIndex,
    visibleIds,
    positions: rowCardPositions(visibleIds.length, rowY),
    rangeLabel: rowWindowRangeLabel(offset, endIndex, totalCount),
    hasOverflow,
    canPageBackward: hasOverflow && offset > 0,
    canPageForward: hasOverflow && endIndex < totalCount,
  }
}
