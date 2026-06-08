import { describe, expect, it } from 'bun:test'
import { worldManifest } from '../../data/worldManifest'
import { worldDisplayManifest } from '../../data/worldDisplayManifest'

describe('worldDisplayManifest', () => {
  const worldIds = Object.keys(worldManifest)  // keys only — never call builders

  it('has an entry for every world in worldManifest', () => {
    for (const id of worldIds) {
      expect(worldDisplayManifest[id]).toBeDefined()
    }
  })

  it('every entry has non-empty name, tagline, and story', () => {
    for (const id of worldIds) {
      const entry = worldDisplayManifest[id]!
      expect(entry.name.length).toBeGreaterThan(0)
      expect(entry.tagline.length).toBeGreaterThan(0)
      expect(entry.story.length).toBeGreaterThan(0)
    }
  })
})
