import { describe, expect, it } from 'bun:test'
import { buildWorld } from '../../data/worldManifest'
import { worldDataRegistry, } from '../../data/worlds/registry'
import { referencedAssetKeys } from '../../data/worlds/types'
import type { CardCatalog } from '../model/catalog'
import type { CardEffect } from '../model/types'

// ---------------------------------------------------------------------------
// worldRegistry contract. Every bundle in the registry must have consistent
// ids, required fields present, valid asset key references, and effect template
// references that resolve in the assembled catalog.
// ---------------------------------------------------------------------------

/** Template ids an effect can name, walking Modal branches and Sequence steps. */
function templateRefs(effect: CardEffect): string[] {
  switch (effect.kind) {
    case 'AddCard':
    case 'AddWorldCardToDeck':
    case 'AddPlayerCardToTop':
    case 'GainCard':
      return [effect.template]
    case 'Modal':
      return effect.branches.flatMap(templateRefs)
    case 'Sequence':
      return effect.steps.flatMap(templateRefs)
    default:
      return []
  }
}

/** Every template id referenced by any effect across the whole catalog. */
function allReferencedTemplates(catalog: CardCatalog): string[] {
  const refs: string[] = []
  for (const template of Object.values(catalog)) {
    if (template.kind === 'player') {
      refs.push(...templateRefs(template.effect))
    } else {
      refs.push(...templateRefs(template.onDiscarded))
      refs.push(...templateRefs(template.onCleared))
      refs.push(...templateRefs(template.onEndOfTurn))
    }
  }
  return refs
}

it('no duplicate world ids in registry', () => {
  const ids = worldDataRegistry.map((b) => b.id)
  expect(new Set(ids).size).toBe(ids.length)
})

describe.each([...worldDataRegistry])('world registry: "$id"', (bundle) => {
  it('id is unique within registry and matches source.worldId', () => {
    // Uniqueness is covered by the top-level test; this asserts the per-bundle
    // contract that bundle.id and bundle.source.worldId agree.
    expect(bundle.id).toBe(bundle.source.worldId)
  })

  it('theme, display, help, and musicKey are present', () => {
    expect(bundle.theme).not.toBeUndefined()
    expect(bundle.theme).not.toBeNull()

    expect(bundle.display).not.toBeUndefined()
    expect(bundle.display).not.toBeNull()

    expect(bundle.help).not.toBeUndefined()
    expect(bundle.help).not.toBeNull()

    expect(typeof bundle.musicKey).toBe('string')
    expect(bundle.musicKey.length).toBeGreaterThan(0)
  })

  it('referencedAssetKeys are all non-empty strings', () => {
    const keys = referencedAssetKeys(bundle)
    expect(keys.size).toBeGreaterThan(0)
    for (const key of keys) {
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    }
  })

  it('every GainCard/AddWorldCardToDeck/AddPlayerCardToTop template reference resolves in the assembled catalog', () => {
    const { catalog } = buildWorld(bundle.id)
    const missing = allReferencedTemplates(catalog).filter((id) => catalog[id] === undefined)
    expect(missing).toEqual([])
  })
})
