import { describe, expect, it } from 'bun:test'
import { buildLibrary } from './cards'

describe('buildLibrary', () => {
  it('returns exactly 10 cards', () => {
    const library = buildLibrary()
    expect(library).toHaveLength(10)
  })

  it('contains exactly 5 value-1 cards, 3 value-2 cards, and 2 value-3 cards', () => {
    const library = buildLibrary()
    const byValue = { 1: 0, 2: 0, 3: 0 }
    for (const card of library) {
      byValue[card.value] += 1
    }
    expect(byValue[1]).toBe(5)
    expect(byValue[2]).toBe(3)
    expect(byValue[3]).toBe(2)
  })

  it('has a total value sum of 17', () => {
    const library = buildLibrary()
    const total = library.reduce((sum, card) => sum + card.value, 0)
    expect(total).toBe(17)
  })

  it('has all unique ids', () => {
    const library = buildLibrary()
    const ids = library.map((card) => card.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(library.length)
  })

  it('has ids exactly card-01 through card-10', () => {
    const library = buildLibrary()
    const expected = [
      'card-01',
      'card-02',
      'card-03',
      'card-04',
      'card-05',
      'card-06',
      'card-07',
      'card-08',
      'card-09',
      'card-10',
    ]
    const ids = library.map((card) => card.id)
    expect(ids).toEqual(expected)
  })
})
