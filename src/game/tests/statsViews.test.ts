import { describe, expect, it } from 'bun:test'

import { formatDuration } from '../view/format'
import { worldBadgeLabel, difficultyPips } from '../view/worldBadge'

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

  it('renders difficulty as filled/empty pips', () => {
    expect(difficultyPips(1)).toBe('●○○○○')
    expect(difficultyPips(3)).toBe('●●●○○')
    expect(difficultyPips(5)).toBe('●●●●●')
  })

  it('clamps and rounds malformed difficulty to exactly max pips', () => {
    expect(difficultyPips(0)).toBe('○○○○○')
    expect(difficultyPips(-2)).toBe('○○○○○')
    expect(difficultyPips(9)).toBe('●●●●●')
    expect(difficultyPips(2.4)).toBe('●●○○○')
    expect(difficultyPips(3).length).toBe(5)
  })
})
