import { describe, expect, it } from 'bun:test'

import { formatDuration } from '../view/format'
import { worldBadgeLabel } from '../view/worldBadge'

describe('stats view helpers', () => {
  it('formats durations without raw milliseconds', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(59_000)).toBe('59s')
    expect(formatDuration(754_000)).toBe('12m 34s')
    expect(formatDuration(3_720_000)).toBe('1h 02m')
  })

  it('builds world-select badge labels only for played worlds', () => {
    expect(worldBadgeLabel(undefined)).toBeNull()
    expect(worldBadgeLabel({ runs: 0, wins: 0, losses: 0, abandoned: 0 })).toBeNull()
    expect(worldBadgeLabel({ runs: 3, wins: 2, losses: 1, abandoned: 0 })).toBe('2 / 3')
  })
})
