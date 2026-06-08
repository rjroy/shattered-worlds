import { describe, expect, it } from 'bun:test'
import { buildWorld, worldManifest } from '../../data/worldManifest'
import type { CardCatalog } from '../model/catalog'
import type { CardEffect } from '../model/types'

// ---------------------------------------------------------------------------
// World assembly contract. Every world registered in the manifest must follow
// the theme-authoring rules: it assembles without duplicate-template errors,
// runs three escalating acts, ends on The Walker, and every card-effect that
// names another template must resolve in the assembled catalog (an unresolved
// reference is an authoring typo that would only surface mid-run otherwise).
// ---------------------------------------------------------------------------

const worldIds = Object.keys(worldManifest)

/** Template ids an effect can name, walking Modal branches and Sequence steps. */
function templateRefs(effect: CardEffect): string[] {
  switch (effect.kind) {
    case 'AddCard':
    case 'AddWorldCardToTop':
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

it('registers more than one world', () => {
  expect(worldIds.length).toBeGreaterThan(1)
})

describe.each(worldIds)('world "%s"', (worldId) => {
  it('assembles without throwing (no duplicate template ids)', () => {
    expect(() => buildWorld(worldId)).not.toThrow()
  })

  it('descriptor carries the matching worldId and a non-empty starter deck', () => {
    const { worldData } = buildWorld(worldId)
    expect(worldData.worldId).toBe(worldId)
    expect(worldData.starterDeck.length).toBeGreaterThan(0)
  })

  it('runs three acts and ends the last act on The Walker', () => {
    const { worldData } = buildWorld(worldId)
    const acts = worldData.deckComposition.acts
    expect(acts).toHaveLength(3)
    const finalAct = acts[acts.length - 1]!
    const lastCard = finalAct.cards[finalAct.cards.length - 1]!
    expect(lastCard.templateId).toBe('The Walker')
  })

  it('every card-effect template reference resolves in the catalog', () => {
    const { catalog } = buildWorld(worldId)
    const missing = allReferencedTemplates(catalog).filter((id) => catalog[id] === undefined)
    expect(missing).toEqual([])
  })

  it('every templateId in the deck composition exists in the catalog', () => {
    const { catalog, worldData } = buildWorld(worldId)
    const deckIds = worldData.deckComposition.acts.flatMap((act) =>
      act.cards.map((c) => c.templateId),
    )
    const missing = deckIds.filter((id) => catalog[id] === undefined)
    expect(missing).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Corpse self-transform card: confirm the zombie-big-box catalog builds with
// the Corpse template and its onEndOfTurn Sequence references a valid Zombie.
// ---------------------------------------------------------------------------

describe('zombie-big-box Corpse card', () => {
  it('resolves Corpse and its onEndOfTurn Sequence references a valid Zombie template', () => {
    const { catalog } = buildWorld('zombie-big-box')

    const corpse = catalog['Corpse']
    expect(corpse).toBeDefined()
    if (corpse === undefined || corpse.kind !== 'world') return

    const eot = corpse.onEndOfTurn
    expect(eot.kind).toBe('Sequence')
    if (eot.kind !== 'Sequence') return

    // The Sequence spawns a Zombie then destroys itself.
    const kinds = eot.steps.map((s) => s.kind)
    expect(kinds).toContain('AddWorldCardToTop')
    expect(kinds).toContain('DestroySelf')

    // Every template the Sequence names resolves in the catalog (Zombie).
    const refs = eot.steps.flatMap(templateRefs)
    expect(refs).toContain('Zombie')
    expect(refs.filter((id) => catalog[id] === undefined)).toEqual([])
  })
})
