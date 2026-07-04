import { describe, expect, it } from 'bun:test'
import { assetManifest } from '../data/assetManifest'
import { worldMusicManifest } from '../data/audioManifest'
import { worldDataRegistry } from '../../data/worlds/registry'
import { referencedAssetKeys } from '../../data/worlds/types'

/**
 * Worlds registered before their music track was produced. Remove an entry
 * here once `bun run audio:generate` (or equivalent) lands a real track and
 * a worldMusicManifest entry for that worldId.
 */
const PENDING_MUSIC_TRACK: ReadonlySet<string> = new Set(['questions'])

describe.each([...worldDataRegistry])('world asset bindings: "$id"', (bundle) => {
  it('all referenced asset keys are bound in assetManifest', () => {
    const missing: string[] = []
    for (const key of referencedAssetKeys(bundle)) {
      if (!(key in assetManifest)) missing.push(key)
    }
    expect(missing).toEqual([])
  })

  // worldMusicManifest is keyed by worldId; the entry's .key is the Phaser
  // audio key that must match bundle.musicKey. Worlds in PENDING_MUSIC_TRACK
  // are skipped (not silently passed) because no track has been produced yet.
  const testMusicBinding = PENDING_MUSIC_TRACK.has(bundle.id) ? it.skip : it
  testMusicBinding('musicKey is bound in worldMusicManifest', () => {
    const entry = worldMusicManifest[bundle.id]
    expect(entry).toBeDefined()
    expect(entry?.key).toBe(bundle.musicKey)
  })
})
