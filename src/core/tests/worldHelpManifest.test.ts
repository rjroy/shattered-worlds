import { describe, expect, it } from 'bun:test'
import { worldManifest } from '../../data/worldManifest'
import { worldHelpManifest } from '../../data/worldHelpManifest'

describe('worldHelpManifest', () => {
  const worldIds = Object.keys(worldManifest)  // keys only — never call builders

  it('has an entry for every world in worldManifest', () => {
    for (const id of worldIds) {
      expect(worldHelpManifest[id]).toBeDefined()
    }
  })

  it('every entry has at least one mechanic note with non-empty title and detail', () => {
    for (const id of worldIds) {
      const entry = worldHelpManifest[id]!
      expect(entry.mechanics.length).toBeGreaterThan(0)
      for (const note of entry.mechanics) {
        expect(note.title.length).toBeGreaterThan(0)
        expect(note.detail.length).toBeGreaterThan(0)
      }
    }
  })
})
