import { describe, expect, it } from 'bun:test'
import { buildWorld } from '../../data/worldManifest'
import { worldDataRegistry } from '../../data/worlds/registry'
import { FOG_BEACH_PARTY_BUNDLE } from '../../data/worlds/fog-beach-party/index'
import { parseKeyword } from '../model/keywords'
import { createWorld } from '../engine/world'
import type { CardEffect } from '../model/types'
import type { WorldCardTemplate, PlayerCardTemplate } from '../model/cards'

// ---------------------------------------------------------------------------
// Fog Beach Party world-data shape (Gate 4). The cards.json is cast through
// `as unknown as RawCardSource` and never typechecked, so these tests are the
// runtime safety net for the authored data: the catalog must build, every
// template must resolve, and the Fog-specific structural rules (REQ-FOG-17,
// 19, 20, 21, 22, 23, 24, 25, 26) must hold.
// ---------------------------------------------------------------------------

const FOG_ID = 'fog-beach-party'
const fogSource = FOG_BEACH_PARTY_BUNDLE.source
const fogTemplates = fogSource.cardTemplates

/** Names of effect kinds reachable from an effect, walking Modal/Sequence. */
function effectKinds(effect: CardEffect): string[] {
  switch (effect.kind) {
    case 'Modal':
      return [effect.kind, ...effect.branches.flatMap(effectKinds)]
    case 'Sequence':
      return [effect.kind, ...effect.steps.flatMap(effectKinds)]
    default:
      return [effect.kind]
  }
}

/** Template ids named by an effect, walking Modal/Sequence. */
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

function worldTemplate(id: string): WorldCardTemplate {
  const t = fogTemplates[id] as unknown as WorldCardTemplate
  expect(t, `template "${id}" missing`).toBeDefined()
  expect(t.kind).toBe('world')
  return t
}

function playerTemplate(id: string): PlayerCardTemplate {
  const t = fogTemplates[id] as unknown as PlayerCardTemplate
  expect(t, `template "${id}" missing`).toBeDefined()
  expect(t.kind).toBe('player')
  return t
}

/** True when the keyword string list carries a Concealed:N keyword. */
function concealDepth(keywords: readonly string[]): number {
  for (const k of keywords) {
    const parsed = parseKeyword(k)
    if (parsed.name === 'Concealed') return parsed.value ?? 0
  }
  return 0
}

describe('fog-beach-party world data', () => {
  it('is registered with usesLight and opens on the Light economy', () => {
    expect(FOG_BEACH_PARTY_BUNDLE.usesLight).toBe(true)
    expect(fogSource.startLight).toBeGreaterThan(0)
  })

  it('builds a catalog and every referenced template resolves (untyped-JSON safety net)', () => {
    const { catalog } = buildWorld(FOG_ID)
    const refs: string[] = []
    for (const template of Object.values(catalog)) {
      if (template.kind === 'player') refs.push(...templateRefs(template.effect))
      else {
        refs.push(...templateRefs(template.onDiscarded))
        refs.push(...templateRefs(template.onCleared))
        refs.push(...templateRefs(template.onEndOfTurn))
        refs.push(...templateRefs(template.onPartialClear))
      }
    }
    const missing = refs.filter((id) => catalog[id] === undefined)
    expect(missing).toEqual([])
  })

  it('runs exactly three acts ending on a single The Walker (REQ-FOG-25)', () => {
    const { worldData } = buildWorld(FOG_ID)
    const acts = worldData.deckComposition.acts
    expect(acts).toHaveLength(3)
    const lastAct = acts[acts.length - 1]!
    expect(lastAct.cards[lastAct.cards.length - 1]!.templateId).toBe('The Walker')
    const walkerCount = acts
      .flatMap((a) => a.cards)
      .filter((c) => c.templateId === 'The Walker')
      .reduce((n, c) => n + c.count, 0)
    expect(walkerCount).toBe(1)
  })

  // REQ-FOG-20: every concealed hazard with a damaging onEndOfTurn must be
  // discardable, so a reveal-starved player always has the blind-discard valve.
  it('every concealed hazard with a damaging onEndOfTurn is discardable (REQ-FOG-20)', () => {
    const offenders: string[] = []
    for (const [id, raw] of Object.entries(fogTemplates)) {
      const t = raw as unknown as WorldCardTemplate
      if (t.kind !== 'world') continue
      const concealed = concealDepth(t.keywords) > 0
      if (!concealed) continue
      const eotKinds = effectKinds(t.onEndOfTurn)
      const damaging = eotKinds.includes('Damage') || eotKinds.includes('DamageScaled')
      if (damaging && t.discardable !== true) offenders.push(id)
    }
    expect(offenders).toEqual([])
  })

  // REQ-FOG-19: hazards (except the always-visible Bonfire and Walker) carry
  // Concealed:N + Hidden so the once-lit Explore/Searchlight payoff applies.
  it('concealed hazards also carry the Hidden tag (REQ-FOG-19)', () => {
    const offenders: string[] = []
    for (const [id, raw] of Object.entries(fogTemplates)) {
      const t = raw as unknown as WorldCardTemplate
      if (t.kind !== 'world') continue
      if (concealDepth(t.keywords) === 0) continue
      const hasHidden = t.keywords.some((k) => parseKeyword(k).name === 'Hidden')
      if (!hasHidden) offenders.push(id)
    }
    expect(offenders).toEqual([])
  })

  // REQ-FOG-21: The Bonfire capstone is visible (no Concealed), high HP, and
  // grants the full light kit on clear.
  it('The Bonfire is visible and grants the light kit on clear (REQ-FOG-21)', () => {
    const bonfire = worldTemplate('The Bonfire')
    expect(concealDepth(bonfire.keywords)).toBe(0)
    expect(bonfire.cost).toBeGreaterThanOrEqual(6)
    expect(bonfire.onCleared.kind).toBe('Sequence')
    const granted = templateRefs(bonfire.onCleared).sort()
    expect(granted).toEqual(['Bonfire', 'Flare Gun', 'Flashlight', 'Searchlight'])
    // ~3 act-1 copies, like the Garden Center.
    const { worldData } = buildWorld(FOG_ID)
    const act1 = worldData.deckComposition.acts[0]!
    const bonfireCopies = act1.cards
      .filter((c) => c.templateId === 'The Bonfire')
      .reduce((n, c) => n + c.count, 0)
    expect(bonfireCopies).toBeGreaterThanOrEqual(3)
  })

  // REQ-FOG-22: a harmless concealed card shares a depth with a dangerous one,
  // so spending Light is a real gamble.
  it('a harmless concealed card shares a Conceal depth with a dangerous one (REQ-FOG-22)', () => {
    const cooler = worldTemplate('Abandoned Cooler')
    const coolerDepth = concealDepth(cooler.keywords)
    expect(coolerDepth).toBeGreaterThan(0)
    // Harmless: no damaging reaction anywhere.
    const coolerKinds = [
      ...effectKinds(cooler.onEndOfTurn),
      ...effectKinds(cooler.onDiscarded),
      ...effectKinds(cooler.onPartialClear),
    ]
    expect(coolerKinds.includes('Damage') || coolerKinds.includes('DamageScaled')).toBe(false)
    // Some other concealed card at the same depth deals damage.
    const dangerousAtDepth = Object.entries(fogTemplates).some(([id, raw]) => {
      if (id === 'Abandoned Cooler') return false
      const t = raw as unknown as WorldCardTemplate
      if (t.kind !== 'world') return false
      if (concealDepth(t.keywords) !== coolerDepth) return false
      return effectKinds(t.onEndOfTurn).some((k) => k === 'Damage' || k === 'DamageScaled')
    })
    expect(dangerousAtDepth).toBe(true)
  })

  // REQ-FOG-23: Whiteout reuses the generalized KeywordInHand counter.
  it('Whiteout scales damage by Concealed cards in hand via the shared counter (REQ-FOG-23)', () => {
    const whiteout = worldTemplate('Whiteout')
    const eot = whiteout.onEndOfTurn
    expect(eot.kind).toBe('DamageScaled')
    if (eot.kind !== 'DamageScaled') return
    expect(eot.base).toBe(0)
    expect(eot.amount).toBe(1)
    expect(eot.per.kind).toBe('KeywordInHand')
    if (eot.per.kind !== 'KeywordInHand') return
    expect(eot.per.keyword).toBe('Concealed')
  })

  // REQ-FOG-24: no Spore-equivalent junk-injection into the player deck.
  it('injects no junk cards into the player deck (REQ-FOG-24)', () => {
    const injectors = ['AddPlayerCardToTop', 'AddCard']
    const offenders: string[] = []
    for (const [id, raw] of Object.entries(fogTemplates)) {
      const t = raw as unknown as WorldCardTemplate | PlayerCardTemplate
      const effects =
        t.kind === 'player'
          ? [t.effect]
          : [t.onDiscarded, t.onCleared, t.onEndOfTurn, t.onPartialClear]
      for (const e of effects) {
        if (effectKinds(e).some((k) => injectors.includes(k))) offenders.push(id)
      }
    }
    expect(offenders).toEqual([])
  })

  // REQ-FOG-16: kit card shapes.
  it('the light kit matches the specified shapes (REQ-FOG-16)', () => {
    const flashlight = playerTemplate('Flashlight')
    expect(flashlight.energyCost).toBe(1)
    expect(flashlight.exhaust ?? false).toBe(false)
    expect(flashlight.effect).toEqual({ kind: 'GainLight', amount: 2 })

    const flare = playerTemplate('Flare Gun')
    expect(flare.energyCost).toBe(1)
    expect(flare.exhaust).toBe(true)
    expect(flare.effect).toEqual({ kind: 'GainLight', amount: 6 })

    const bonfireCard = playerTemplate('Bonfire')
    expect(bonfireCard.energyCost).toBe(2)
    expect(bonfireCard.exhaust ?? false).toBe(false)
    expect(bonfireCard.effect).toEqual({ kind: 'GainLight', amount: 4 })

    const searchlight = playerTemplate('Searchlight')
    expect(searchlight.energyCost).toBe(2)
    expect(searchlight.exhaust).toBe(true)
    expect(searchlight.effect).toEqual({
      kind: 'DealProgressAll',
      base: 1,
      bonus: { tag: 'Hidden', amount: 1 },
    })
  })

  it('every card template maps to a fog-namespaced inset (REQ-FOG-31)', () => {
    for (const [id, raw] of Object.entries(fogTemplates)) {
      const t = raw as unknown as { insetKey?: string }
      expect(t.insetKey, `template "${id}" has no insetKey`).toBeDefined()
      expect(t.insetKey!.startsWith('fog-inset-')).toBe(true)
    }
  })
})

// REQ-FOG-17: GainLight is Fog's exclusive signature verb. No other world's
// data may use it.
describe('GainLight signature claim (REQ-FOG-17)', () => {
  it('only fog-beach-party uses the GainLight effect', () => {
    const usingGainLight: string[] = []
    for (const bundle of worldDataRegistry) {
      const templates = bundle.source.cardTemplates
      for (const raw of Object.values(templates)) {
        const t = raw as unknown as WorldCardTemplate | PlayerCardTemplate
        const effects =
          t.kind === 'player'
            ? [t.effect]
            : [t.onDiscarded, t.onCleared, t.onEndOfTurn, t.onPartialClear]
        if (effects.some((e) => effectKinds(e).includes('GainLight'))) {
          usingGainLight.push(bundle.id)
          break
        }
      }
    }
    expect([...new Set(usingGainLight)]).toEqual([FOG_ID])
  })
})

// REQ-FOG-26: the Bonfire kit rewards are distinct from every other world's
// reward — no card identical in name+effect+cost to another world's reward.
describe('distinct rewards (REQ-FOG-26)', () => {
  it('no Fog kit card is identical in name+effect+cost to another world card', () => {
    const kit = ['Flashlight', 'Flare Gun', 'Bonfire', 'Searchlight']
    const collisions: string[] = []
    for (const name of kit) {
      const fogCard = playerTemplate(name)
      for (const bundle of worldDataRegistry) {
        if (bundle.id === FOG_ID) continue
        for (const [otherId, raw] of Object.entries(bundle.source.cardTemplates)) {
          const t = raw as unknown as PlayerCardTemplate
          if (t.kind !== 'player') continue
          const sameCost = (t.energyCost ?? 0) === (fogCard.energyCost ?? 0)
          const sameEffect = JSON.stringify(t.effect) === JSON.stringify(fogCard.effect)
          if (sameCost && sameEffect) collisions.push(`${name} ~= ${bundle.id}/${otherId}`)
        }
      }
    }
    expect(collisions).toEqual([])
  })
})

// REQ-FOG carryover: the opening-turn decay means startLight opens one lower.
describe('opening Light after turn-start decay', () => {
  it('createWorld then the first startTurn lands at startLight - 1', () => {
    const { catalog, worldData } = buildWorld(FOG_ID)
    const state = createWorld(catalog, worldData, 12345)
    // createWorld deals the opening hand via startTurn, which decays Light once.
    expect(state.light).toBe((fogSource.startLight ?? 0) - 1)
  })
})
