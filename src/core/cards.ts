import type { Card } from './types'

// Returns a fixed deterministic 10-card library:
// card-01 to card-05 → value 1 (five cards)
// card-06 to card-08 → value 2 (three cards)
// card-09 to card-10 → value 3 (two cards)
// Total value sum = 5*1 + 3*2 + 2*3 = 17
export function buildLibrary(): Card[] {
  return [
    { id: 'card-01', value: 1 },
    { id: 'card-02', value: 1 },
    { id: 'card-03', value: 1 },
    { id: 'card-04', value: 1 },
    { id: 'card-05', value: 1 },
    { id: 'card-06', value: 2 },
    { id: 'card-07', value: 2 },
    { id: 'card-08', value: 2 },
    { id: 'card-09', value: 3 },
    { id: 'card-10', value: 3 },
  ]
}
