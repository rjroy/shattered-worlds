import { describe, expect, it } from 'bun:test'
import { assetManifest } from '../data/assetManifest'
import { worldMusicManifest } from '../data/audioManifest'
import { worldDataRegistry } from '../../data/worlds/registry'
import { referencedAssetKeys } from '../../data/worlds/types'

describe.each([...worldDataRegistry])('world asset bindings: "$id"', (bundle) => {
  it('all referenced asset keys are bound in assetManifest', () => {
    const missing: string[] = []
    for (const key of referencedAssetKeys(bundle)) {
      if (!(key in assetManifest)) missing.push(key)
    }
    expect(missing).toEqual([])
  })

  it('musicKey is bound in worldMusicManifest', () => {
    // worldMusicManifest is keyed by worldId; the entry's .key is the Phaser
    // audio key that must match bundle.musicKey.
    const entry = worldMusicManifest[bundle.id]
    expect(entry).toBeDefined()
    expect(entry?.key).toBe(bundle.musicKey)
  })
})
