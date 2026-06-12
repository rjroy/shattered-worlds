/**
 * Unit tests for reduce.ts.
 *
 * All tests operate on pure GameState — no Phaser, no browser globals.
 * Crafted minimal states are used wherever a full createWorld game would
 * introduce too many variables.
 */

import { describe, expect, it } from 'bun:test'
import { createWorld } from '../engine/world'
import { mintCard } from '../model/cards'
import { reduce } from '../engine/reduce'
import { IllegalActionError } from '../model/errors'
import { buildWorld } from '../../data/worldManifest'
import type { GameState, PlayerCard, WorldCard } from '../model/types'
import { catalog, worldData } from './testFixture'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal GameState seeded from createWorld(42) but with the hand,
 * piles, and progress replaced by what the test needs.
 */
function makeState(overrides: Partial<GameState>): GameState {
  const base = createWorld(catalog, worldData, 42)
  return {
    ...base,
    playerDraw: [],
    playerDiscard: [],
    worldDraw: [],
    acts: [],
    progress: {},
    energy: 0,
    status: 'playing',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. PlayCard basic: Explore on a 1-cost hazard auto-resolves
// ---------------------------------------------------------------------------

describe('PlayCard basic', () => {
  it('playing Explore on Screams (cost 1) emits CardPlayed + ProgressDealt + HazardResolved', () => {
    // seed 42 starting hand: Strange Sounds(id=11) + Screams(id=14) + Sprint(id=1) + Panic(id=8) + MedKit(id=7) + Explore(id=2)
    const state = createWorld(catalog, worldData, 42)
    const screams = state.hand.find((c): c is WorldCard => c.kind === 'world' && c.name === 'Screams')
    const explore = state.hand.find((c): c is PlayerCard => c.kind === 'player' && c.name === 'Explore')
    if (!screams || !explore) throw new Error('Expected Screams and Explore in seed 42 hand')

    const result = reduce(catalog, state, { type: 'PlayCard', cardId: explore.id, targetId: screams.id })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('ProgressDealt')
    expect(types).toContain('HazardResolved')

    // Screams removed from hand
    expect(result.state.hand.some((c) => c.id === screams.id)).toBe(false)
    // Explore removed from hand (played)
    expect(result.state.hand.some((c) => c.id === explore.id)).toBe(false)
    // Status still playing
    expect(result.state.status).toBe('playing')
  })
})

// ---------------------------------------------------------------------------
// 2. No carry-over: progress resets to {} after EndTurn
// ---------------------------------------------------------------------------

describe('progress reset on EndTurn', () => {
  it('partial progress on a 2-cost hazard is wiped on EndTurn', () => {
    // Screams costs 1 and would resolve with 1 Explore, but Strange Sounds costs 2.
    // We build a crafted state with a Strange Sounds (cost 2) and a single Explore.
    const base = createWorld(catalog, worldData, 42)
    const [strangeSounds, s1] = mintCard(catalog, base, 'Strange Sounds')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')

    const state = makeState({
      ...s2,
      hand: [strangeSounds as WorldCard, explore as PlayerCard],
    })

    // Play Explore on Strange Sounds → 1 progress (not enough to resolve)
    const r1 = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: explore.id,
      targetId: strangeSounds.id,
    })
    expect(r1.state.progress[strangeSounds.id]).toBe(1)

    // EndTurn should wipe progress
    const r2 = reduce(catalog, r1.state, { type: 'EndTurn' })
    expect(r2.state.progress).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// 3. Hold vs discard: world cards stay in hand, player cards go to playerDiscard
// ---------------------------------------------------------------------------

describe('EndTurn hold vs discard', () => {
  it('world cards remain in hand; player cards move to playerDiscard', () => {
    // Use a large playerDraw so refillHand does not recycle the discarded card
    // back into hand immediately. Use Find Baseball Bat (onEndOfTurn: None) so
    // the world card stays in hand instead of self-destructing.
    const base = createWorld(catalog, worldData, 42)
    const [findBat, s1] = mintCard(catalog, base, 'Find Baseball Bat')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')

    // Seed enough player draws so the discard is not re-drawn this turn
    const [e2, s3] = mintCard(catalog, s2, 'Explore')
    const [e3, s4] = mintCard(catalog, s3, 'Explore')
    const [e4, s5] = mintCard(catalog, s4, 'Explore')
    const [e5, s6] = mintCard(catalog, s5, 'Explore')
    const [e6, finalState] = mintCard(catalog, s6, 'Explore')

    const state = makeState({
      ...finalState,
      hand: [findBat as WorldCard, explore as PlayerCard],
      playerDraw: [e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard, e6 as PlayerCard],
      playerDiscard: [],
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })

    // Find Baseball Bat (world) should still be in hand
    expect(result.state.hand.some((c) => c.id === findBat.id)).toBe(true)
    // Explore (player) should be in playerDiscard (it was discarded, not re-drawn)
    expect(result.state.playerDiscard.some((c) => c.id === explore.id)).toBe(true)
    // Explore should NOT be in hand (unless refillHand pulled it from discard,
    // which won't happen here because playerDraw has 5 cards to fill from)
    const handIds = result.state.hand.map((c) => c.id)
    expect(handIds).not.toContain(explore.id)
  })

  it('CardsDiscarded event lists the discarded player card ids', () => {
    const base = createWorld(catalog, worldData, 42)
    const [screams, s1] = mintCard(catalog, base, 'Screams')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')
    const [e2, s3] = mintCard(catalog, s2, 'Explore')
    const [e3, s4] = mintCard(catalog, s3, 'Explore')
    const [e4, s5] = mintCard(catalog, s4, 'Explore')
    const [e5, finalState] = mintCard(catalog, s5, 'Explore')

    const state = makeState({
      ...finalState,
      hand: [screams as WorldCard, explore as PlayerCard],
      playerDraw: [e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard],
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })
    const discardedEvent = result.events.find((e) => e.type === 'CardsDiscarded')
    expect(discardedEvent).toBeDefined()
    if (discardedEvent?.type === 'CardsDiscarded') {
      expect(discardedEvent.cardIds).toContain(explore.id)
      expect(discardedEvent.cardIds).not.toContain(screams.id)
    }
  })
})

// ---------------------------------------------------------------------------
// 4. DiscardHazard legal: discarding Zombie applies Damage(5) onDiscarded
// ---------------------------------------------------------------------------

describe('DiscardHazard legal', () => {
  it('discarding Zombie (Damage 5) decrements HP', () => {
    const base = createWorld(catalog, worldData, 42)
    const [zombie, s1] = mintCard(catalog, base, 'Zombie')

    const state = makeState({
      ...s1,
      hp: 10,
      hand: [zombie as WorldCard],
    })

    const result = reduce(catalog, state, { type: 'DiscardHazard', cardId: zombie.id })

    expect(result.state.hp).toBe(5)

    const types = result.events.map((e) => e.type)
    expect(types).toContain('HazardDiscarded')
    expect(types).toContain('DamageDealt')
    expect(types).toContain('HpChanged')

    // HazardDiscarded should come before DamageDealt
    const hdIdx = types.indexOf('HazardDiscarded')
    const dmgIdx = types.indexOf('DamageDealt')
    expect(hdIdx).toBeLessThan(dmgIdx)
  })
})

// ---------------------------------------------------------------------------
// 4b. ForceDestroy: discard queues a charge that hits the NEXT hand
// ---------------------------------------------------------------------------

describe('ForceDestroy onDiscarded', () => {
  /** A discardable world card whose onDiscarded queues a ForceDestroy. */
  function grippingTalon(base: GameState): [WorldCard, GameState] {
    const [zombie, next] = mintCard(catalog, base, 'Zombie')
    const talon: WorldCard = {
      ...(zombie as WorldCard),
      name: 'Gripping Talon',
      onDiscarded: { kind: 'ForceDestroy', amount: 1 },
    }
    return [talon, next]
  }

  it('discarding queues a charge but does NOT destroy from the current hand', () => {
    const base = createWorld(catalog, worldData, 42)
    const [talon, s1] = grippingTalon(base)
    const state = makeState({ ...s1, hand: [talon] })

    const result = reduce(catalog, state, { type: 'DiscardHazard', cardId: talon.id })

    expect(result.state.pendingForceDestroy).toBe(1)
    expect(result.events.map((e) => e.type)).toContain('HazardDiscarded')
    // Nothing is destroyed yet — the charge resolves at the next turn start.
    expect(result.events.map((e) => e.type)).not.toContain('CardDestroyed')
  })

  it('the queued charge destroys a player card from the refilled hand on EndTurn', () => {
    const base = createWorld(catalog, worldData, 42)
    const [talon, s1] = grippingTalon(base)

    // Six player cards to refill from, plus world cards so the livelock guard
    // (no world cards anywhere) does not fire and the refill draws normally.
    let acc: GameState = s1
    const playerDraw: PlayerCard[] = []
    for (let i = 0; i < 6; i++) {
      const [c, next] = mintCard(catalog, acc, 'Explore')
      playerDraw.push(c as PlayerCard)
      acc = next
    }
    const worldDraw: WorldCard[] = []
    for (let i = 0; i < 3; i++) {
      const [c, next] = mintCard(catalog, acc, 'Rubble')
      worldDraw.push(c as WorldCard)
      acc = next
    }

    const state = makeState({
      ...acc,
      hand: [talon],
      playerDraw,
      worldDraw,
    })

    // Discard the talon → charge queued.
    const afterDiscard = reduce(catalog, state, { type: 'DiscardHazard', cardId: talon.id })
    expect(afterDiscard.state.pendingForceDestroy).toBe(1)

    // End the turn → hand refills, then the charge takes one player card.
    const afterEnd = reduce(catalog, afterDiscard.state, { type: 'EndTurn' })

    expect(afterEnd.state.status).toBe('playing')
    expect(afterEnd.state.pendingForceDestroy).toBe(0)
    expect(afterEnd.events.map((e) => e.type)).toContain('CardDestroyed')

    // The destroyed card is gone from the new hand.
    const destroyed = afterEnd.events.find((e) => e.type === 'CardDestroyed')
    const destroyedId = (destroyed as { id: string }).id
    expect(afterEnd.state.hand.some((c) => c.id === destroyedId)).toBe(false)
    // One player card fewer than a full refill would have produced.
    expect(afterEnd.state.hand.filter((c) => c.kind === 'player')).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// 5. DiscardHazard on Door throws IllegalActionError
// ---------------------------------------------------------------------------

describe('DiscardHazard on Door', () => {
  it('attempting to discard the Door throws IllegalActionError', () => {
    const base = createWorld(catalog, worldData, 42)
    const [door, s1] = mintCard(catalog, base, 'Door')

    const state = makeState({
      ...s1,
      hand: [door as WorldCard],
    })

    expect(() => {
      reduce(catalog, state, { type: 'DiscardHazard', cardId: door.id })
    }).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// 6. Post-terminal: any action throws after status=lost or status=won
// ---------------------------------------------------------------------------

describe('post-terminal throws', () => {
  it('any action after WorldLost throws IllegalActionError', () => {
    const base = createWorld(catalog, worldData, 42)
    const [zombie, s1] = mintCard(catalog, base, 'Zombie')

    const lostState = makeState({
      ...s1,
      hp: 0,
      hand: [zombie as WorldCard],
      status: 'lost',
    })

    expect(() => reduce(catalog, lostState, { type: 'EndTurn' })).toThrow(IllegalActionError)
    expect(() =>
      reduce(catalog, lostState, { type: 'DiscardHazard', cardId: zombie.id }),
    ).toThrow(IllegalActionError)
  })

  it('any action after WorldWon throws IllegalActionError', () => {
    const base = createWorld(catalog, worldData, 42)
    const [explore, s1] = mintCard(catalog, base, 'Explore')

    const wonState = makeState({
      ...s1,
      hand: [explore as PlayerCard],
      status: 'won',
    })

    expect(() => reduce(catalog, wonState, { type: 'EndTurn' })).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// 7. PlayCard with no legal play throws
// ---------------------------------------------------------------------------

describe('PlayCard with no legal play', () => {
  it('playing Explore when no world card is in hand throws IllegalActionError', () => {
    const base = createWorld(catalog, worldData, 42)
    const [explore, s1] = mintCard(catalog, base, 'Explore')

    const state = makeState({
      ...s1,
      // No world cards in hand — Explore requires a world card target
      hand: [explore as PlayerCard],
    })

    expect(() => {
      reduce(catalog, state, { type: 'PlayCard', cardId: explore.id, targetId: 'nonexistent' })
    }).toThrow(IllegalActionError)
  })

  it('playing a card not in hand throws IllegalActionError', () => {
    const state = createWorld(catalog, worldData, 42)
    expect(() => {
      reduce(catalog, state, { type: 'PlayCard', cardId: 'ghost-card-id' })
    }).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// 8. Modal choice: Sprint
// ---------------------------------------------------------------------------

describe('Sprint modal', () => {
  it('Sprint choice=0 draws player and world cards', () => {
    // seed 42 hand contains Sprint (id=1); worldDraw has 4 remaining world cards
    const state = createWorld(catalog, worldData, 42)
    const sprint = state.hand.find((c) => c.kind === 'player' && c.name === 'Sprint')
    if (!sprint) throw new Error('Sprint not found in seed 42 hand')

    const result = reduce(catalog, state, { type: 'PlayCard', cardId: sprint.id, choice: 0 })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('CardsDrawn')
  })

  it('Sprint choice=1 (Slow hazard) deals progress on a Slow hazard and resolves it', () => {
    const base = createWorld(catalog, worldData, 42)
    const [sprint, s1] = mintCard(catalog, base, 'Sprint')

    // Construct a Slow hazard directly — avoids dependency on which world cards carry the keyword
    const slowHazard: WorldCard = {
      kind: 'world', id: 'slow-test', name: 'Slow Hazard', insetKey: undefined,
      cost: 1, keywords: ['Slow'], discardable: false, canExile: true,
      onDiscarded: { kind: 'None' }, onCleared: { kind: 'None' }, onEndOfTurn: { kind: 'None' },
    }

    const state = makeState({
      ...s1,
      hand: [slowHazard, sprint as PlayerCard],
      energy: 1,
    })

    // Sprint branch 1: DealProgress base=0 bonus={Slow,+3} → 3 on cost-1 Slow hazard → resolves
    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: sprint.id,
      choice: 1,
      targetId: slowHazard.id,
    })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('ProgressDealt')
    expect(types).toContain('HazardResolved')
    expect(result.state.hand.some((c) => c.id === slowHazard.id)).toBe(false)
  })

  it('Sprint choice=1 throws when no Slow hazard is in hand', () => {
    // Strange Sounds has no keywords, so Sprint branch 1 can't target it
    const base = createWorld(catalog, worldData, 42)
    const [strangeSounds, s1] = mintCard(catalog, base, 'Strange Sounds')
    const [sprint, s2] = mintCard(catalog, s1, 'Sprint')

    const state = makeState({
      ...s2,
      hand: [strangeSounds as WorldCard, sprint as PlayerCard],
    })

    expect(() => {
      reduce(catalog, state, { type: 'PlayCard', cardId: sprint.id, choice: 1, targetId: strangeSounds.id })
    }).toThrow(IllegalActionError)
  })

  it('Sprint throws when choice is out of range', () => {
    const state = createWorld(catalog, worldData, 42)
    const sprint = state.hand.find((c) => c.kind === 'player' && c.name === 'Sprint')
    if (!sprint) throw new Error('Sprint not found in seed 42 hand')

    expect(() => {
      reduce(catalog, state, { type: 'PlayCard', cardId: sprint.id, choice: 5 })
    }).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// 9. Compound: Barricade (DealProgress + ReturnWorldCards)
// ---------------------------------------------------------------------------

describe('Barricade compound', () => {
  it('Barricade deals 1 progress on Rubble (resolves) with empty returnIds', () => {
    const base = createWorld(catalog, worldData, 42)
    const [rubble, s1] = mintCard(catalog, base, 'Rubble')
    const [barricade, s2] = mintCard(catalog, s1, 'Barricade')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, barricade as PlayerCard],
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: barricade.id,
      targetId: rubble.id,
      returnIds: [],
    })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('ProgressDealt')
    expect(types).toContain('HazardResolved')
  })
})

// ---------------------------------------------------------------------------
// 10. discardPlayer: Adrenaline
// ---------------------------------------------------------------------------

describe('Adrenaline discardPlayer', () => {
  it('Adrenaline discards a player card and draws 2', () => {
    const base = createWorld(catalog, worldData, 42)
    const [adrenaline, s1] = mintCard(catalog, base, 'Adrenaline')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')
    const [rubble, s3] = mintCard(catalog, s2, 'Rubble')
    // Provide player cards to draw
    const [e1, s4] = mintCard(catalog, s3, 'Explore')
    const [e2, s5] = mintCard(catalog, s4, 'Explore')

    const state = makeState({
      ...s5,
      hand: [rubble as WorldCard, adrenaline as PlayerCard, explore as PlayerCard],
      playerDraw: [e1 as PlayerCard, e2 as PlayerCard],
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: adrenaline.id,
      discardId: explore.id,
    })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('CardsDrawn')

    // explore moved to playerDiscard
    expect(result.state.playerDiscard.some((c) => c.id === explore.id)).toBe(true)
    // adrenaline played, not in hand
    expect(result.state.hand.some((c) => c.id === adrenaline.id)).toBe(false)
  })

  it('Adrenaline throws when discardId is not a legal target', () => {
    const base = createWorld(catalog, worldData, 42)
    const [adrenaline, s1] = mintCard(catalog, base, 'Adrenaline')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')
    const [explore, s3] = mintCard(catalog, s2, 'Explore')

    const state = makeState({
      ...s3,
      hand: [rubble as WorldCard, adrenaline as PlayerCard, explore as PlayerCard],
    })

    expect(() => {
      reduce(catalog, state, {
        type: 'PlayCard',
        cardId: adrenaline.id,
        discardId: rubble.id, // world card — not a legal discard target
      })
    }).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// 11. destroyHand: Regroup
// ---------------------------------------------------------------------------

describe('Regroup destroyHand', () => {
  it('Regroup with no destroyId plays without destroying anything', () => {
    const base = createWorld(catalog, worldData, 42)
    const [regroup, s1] = mintCard(catalog, base, 'Regroup')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, regroup as PlayerCard],
    })

    const result = reduce(catalog, state, { type: 'PlayCard', cardId: regroup.id })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).not.toContain('CardDestroyed')
  })

  it('Regroup with destroyId removes the card from hand permanently', () => {
    const base = createWorld(catalog, worldData, 42)
    const [regroup, s1] = mintCard(catalog, base, 'Regroup')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')

    const state = makeState({
      ...s2,
      hand: [explore as WorldCard, regroup as PlayerCard],
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: regroup.id,
      destroyId: explore.id,
    })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardDestroyed')
    expect(result.state.hand.some((c) => c.id === explore.id)).toBe(false)
    // Destroyed — not in discard either
    expect(result.state.playerDiscard.some((c) => c.id === explore.id)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 11b. Exhaust: a played card is destroyed instead of discarded
// ---------------------------------------------------------------------------

describe('PlayCard exhaust', () => {
  /**
   * Mint an Explore (cost-0, DealProgress on a hazard) and flag it exhaust.
   * Mirrors the grippingTalon helper: mint from the catalog, then spread an
   * override onto the minted card.
   */
  function exhaustExplore(base: GameState): [PlayerCard, GameState] {
    const [explore, next] = mintCard(catalog, base, 'Explore')
    return [{ ...(explore as PlayerCard), exhaust: true }, next]
  }

  /** Mint a Med Kit (Heal) and flag it exhaust. */
  function exhaustMedKit(base: GameState): [PlayerCard, GameState] {
    const [medKit, next] = mintCard(catalog, base, 'Med Kit')
    return [{ ...(medKit as PlayerCard), exhaust: true }, next]
  }

  it('playing an exhaust card removes it from hand AND keeps it out of playerDiscard', () => {
    const base = createWorld(catalog, worldData, 42)
    const [exhaustCard, s1] = exhaustExplore(base)
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, exhaustCard],
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: exhaustCard.id,
      targetId: rubble.id,
    })

    expect(result.state.hand.some((c) => c.id === exhaustCard.id)).toBe(false)
    expect(result.state.playerDiscard.some((c) => c.id === exhaustCard.id)).toBe(false)
  })

  it('playing an exhaust card emits CardDestroyed with the card id alongside CardPlayed', () => {
    const base = createWorld(catalog, worldData, 42)
    const [exhaustCard, s1] = exhaustExplore(base)
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, exhaustCard],
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: exhaustCard.id,
      targetId: rubble.id,
    })

    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')
    expect(types).toContain('CardDestroyed')

    const destroyed = result.events.find((e) => e.type === 'CardDestroyed')
    expect(destroyed).toBeDefined()
    if (destroyed?.type === 'CardDestroyed') {
      expect(destroyed.id).toBe(exhaustCard.id)
    }

    // CardDestroyed must come AFTER CardPlayed and after the effect events.
    const cardPlayedIdx = types.indexOf('CardPlayed')
    const destroyedIdx = types.indexOf('CardDestroyed')
    const progressIdx = types.indexOf('ProgressDealt')
    expect(cardPlayedIdx).toBeLessThan(destroyedIdx)
    expect(progressIdx).toBeLessThan(destroyedIdx)
  })

  it("an exhaust card's effect still applies (exhaust + Heal raises hp)", () => {
    const base = createWorld(catalog, worldData, 42)
    const [medKit, s1] = exhaustMedKit(base)

    const state = makeState({
      ...s1,
      hp: 5,
      hand: [medKit],
    })

    const result = reduce(catalog, state, { type: 'PlayCard', cardId: medKit.id })

    // Med Kit heals 2 (starter.json) — effect resolves despite the exhaust.
    expect(result.state.hp).toBe(7)
    expect(result.events.map((e) => e.type)).toContain('CardDestroyed')
    // Destroyed, not recycled.
    expect(result.state.playerDiscard.some((c) => c.id === medKit.id)).toBe(false)
  })

  it('control: a non-exhaust card lands in playerDiscard and emits NO CardDestroyed', () => {
    const base = createWorld(catalog, worldData, 42)
    const [explore, s1] = mintCard(catalog, base, 'Explore')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, explore as PlayerCard],
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: explore.id,
      targetId: rubble.id,
    })

    expect(result.state.playerDiscard.some((c) => c.id === explore.id)).toBe(true)
    expect(result.events.map((e) => e.type)).not.toContain('CardDestroyed')
  })

  it("deck-recycle guard: an exhausted card's id never reappears in any zone after a reshuffle", () => {
    // Empty playerDraw with a non-empty playerDiscard forces refillHand to
    // recycle the discard into a reshuffled draw pile on the next turn start.
    // The exhausted card must not be anywhere to be recycled.
    const base = createWorld(catalog, worldData, 42)
    const [exhaustCard, s1] = exhaustExplore(base)
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')
    // A second player card lands in playerDiscard so the reshuffle path runs.
    const [filler, s3] = mintCard(catalog, s2, 'Explore')

    const state = makeState({
      ...s3,
      hand: [rubble as WorldCard, exhaustCard],
      playerDraw: [],
      playerDiscard: [filler as PlayerCard],
    })

    // Play the exhaust card → destroyed.
    const afterPlay = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: exhaustCard.id,
      targetId: rubble.id,
    })

    // End the turn → hand refills, draw recycles from discard (reshuffle).
    const afterEnd = reduce(catalog, afterPlay.state, { type: 'EndTurn' })

    const everywhere = [
      ...afterEnd.state.hand,
      ...afterEnd.state.playerDraw,
      ...afterEnd.state.playerDiscard,
    ]
    expect(everywhere.some((c) => c.id === exhaustCard.id)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 12. onEndOfTurn: world cards fire their effect at the end of each turn
// ---------------------------------------------------------------------------

describe('EndTurn onEndOfTurn', () => {
  function makeEndTurnState(worldCard: WorldCard, hp: number): GameState {
    const base = createWorld(catalog, worldData, 42)
    const [e1, s1] = mintCard(catalog, base, 'Explore')
    const [e2, s2] = mintCard(catalog, s1, 'Explore')
    const [e3, s3] = mintCard(catalog, s2, 'Explore')
    const [e4, s4] = mintCard(catalog, s3, 'Explore')
    const [e5, s5] = mintCard(catalog, s4, 'Explore')
    return makeState({
      ...s5,
      hp,
      hand: [worldCard],
      playerDraw: [e1 as PlayerCard, e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard],
    })
  }

  it('Zombie in hand deals 1 damage at end of turn', () => {
    const base = createWorld(catalog, worldData, 42)
    const [zombie, _s1] = mintCard(catalog, base, 'Zombie')
    const state = makeEndTurnState(zombie as WorldCard, 10)

    const result = reduce(catalog, state, { type: 'EndTurn' })

    expect(result.state.hp).toBe(9)
    expect(result.events.map((e) => e.type)).toContain('DamageDealt')
  })

  it('onEndOfTurn fires after TurnEnded and before CardsDiscarded', () => {
    const base = createWorld(catalog, worldData, 42)
    const [zombie, s1] = mintCard(catalog, base, 'Zombie')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')
    const [e2, s3] = mintCard(catalog, s2, 'Explore')
    const [e3, s4] = mintCard(catalog, s3, 'Explore')
    const [e4, s5] = mintCard(catalog, s4, 'Explore')
    const [e5, finalState] = mintCard(catalog, s5, 'Explore')

    const state = makeState({
      ...finalState,
      hp: 10,
      hand: [zombie as WorldCard, explore as PlayerCard],
      playerDraw: [e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard],
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })
    const types = result.events.map((e) => e.type)

    const turnEndedIdx = types.indexOf('TurnEnded')
    const damageIdx = types.indexOf('DamageDealt')
    const discardIdx = types.indexOf('CardsDiscarded')

    expect(turnEndedIdx).toBeLessThan(damageIdx)
    expect(damageIdx).toBeLessThan(discardIdx)
  })

  it('onEndOfTurn can kill the player and short-circuits to status=lost', () => {
    const base = createWorld(catalog, worldData, 42)
    const [zombie, _s1] = mintCard(catalog, base, 'Zombie')
    const state = makeEndTurnState(zombie as WorldCard, 1)

    const result = reduce(catalog, state, { type: 'EndTurn' })

    expect(result.state.hp).toBe(0)
    expect(result.state.status).toBe('lost')
    expect(result.events.map((e) => e.type)).toContain('WorldLost')
  })

  it('world cards with onEndOfTurn=None deal no damage', () => {
    const base = createWorld(catalog, worldData, 42)
    const [findBat, _s1] = mintCard(catalog, base, 'Find Baseball Bat')
    const state = makeEndTurnState(findBat as WorldCard, 10)

    const result = reduce(catalog, state, { type: 'EndTurn' })

    expect(result.state.hp).toBe(10)
    expect(result.events.map((e) => e.type)).not.toContain('DamageDealt')
  })

  it('Door in zombie-big-box adds Zombie threat to the world deck', () => {
    const { catalog: worldCatalog, worldData: world } = buildWorld('zombie-big-box')
    const base = createWorld(worldCatalog, world, 42)
    const [door, s1] = mintCard(worldCatalog, base, 'Door')
    const [e1, s2] = mintCard(worldCatalog, s1, 'Explore')
    const [e2, s3] = mintCard(worldCatalog, s2, 'Explore')
    const [e3, s4] = mintCard(worldCatalog, s3, 'Explore')
    const [e4, s5] = mintCard(worldCatalog, s4, 'Explore')
    const [e5, s6] = mintCard(worldCatalog, s5, 'Explore')

    const state: GameState = {
      ...s6,
      hand: [door as WorldCard],
      worldDraw: [],
      acts: [],
      playerDraw: [e1 as PlayerCard, e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard],
      playerDiscard: [],
      progress: {},
    }

    const result = reduce(worldCatalog, state, { type: 'EndTurn' })
    const gained = result.events.find((e) => e.type === 'CardGained')
    expect(gained).toBeDefined()
    if (gained?.type === 'CardGained') {
      const spawned = [...result.state.hand, ...result.state.worldDraw].find((c) => c.id === gained.id)
      expect(spawned).toBeDefined()
      if (spawned?.kind === 'world') {
        expect(spawned.name).toBe('Zombie')
      }
    }
  })

  it('Door in highway-volcano adds Lava Flow threat to the world deck', () => {
    const { catalog: worldCatalog, worldData: world } = buildWorld('highway-volcano')
    const base = createWorld(worldCatalog, world, 42)
    const [door, s1] = mintCard(worldCatalog, base, 'Door')
    const [e1, s2] = mintCard(worldCatalog, s1, 'Explore')
    const [e2, s3] = mintCard(worldCatalog, s2, 'Explore')
    const [e3, s4] = mintCard(worldCatalog, s3, 'Explore')
    const [e4, s5] = mintCard(worldCatalog, s4, 'Explore')
    const [e5, s6] = mintCard(worldCatalog, s5, 'Explore')

    const state: GameState = {
      ...s6,
      hand: [door as WorldCard],
      worldDraw: [],
      acts: [],
      playerDraw: [e1 as PlayerCard, e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard],
      playerDiscard: [],
      progress: {},
    }

    const result = reduce(worldCatalog, state, { type: 'EndTurn' })
    const gained = result.events.find((e) => e.type === 'CardGained')
    expect(gained).toBeDefined()
    if (gained?.type === 'CardGained') {
      const spawned = [...result.state.hand, ...result.state.worldDraw].find((c) => c.id === gained.id)
      expect(spawned).toBeDefined()
      if (spawned?.kind === 'world') {
        expect(spawned.name).toBe('Lava Flow')
      }
    }
  })

  it('Door in bird-building adds Gripping Talon threat to the world deck', () => {
    const { catalog: worldCatalog, worldData: world } = buildWorld('bird-building')
    const base = createWorld(worldCatalog, world, 42)
    const [door, s1] = mintCard(worldCatalog, base, 'Door')
    const [e1, s2] = mintCard(worldCatalog, s1, 'Explore')
    const [e2, s3] = mintCard(worldCatalog, s2, 'Explore')
    const [e3, s4] = mintCard(worldCatalog, s3, 'Explore')
    const [e4, s5] = mintCard(worldCatalog, s4, 'Explore')
    const [e5, s6] = mintCard(worldCatalog, s5, 'Explore')

    const state: GameState = {
      ...s6,
      hand: [door as WorldCard],
      worldDraw: [],
      acts: [],
      playerDraw: [e1 as PlayerCard, e2 as PlayerCard, e3 as PlayerCard, e4 as PlayerCard, e5 as PlayerCard],
      playerDiscard: [],
      progress: {},
    }

    const result = reduce(worldCatalog, state, { type: 'EndTurn' })
    const gained = result.events.find((e) => e.type === 'CardGained')
    expect(gained).toBeDefined()
    if (gained?.type === 'CardGained') {
      const spawned = [...result.state.hand, ...result.state.worldDraw].find((c) => c.id === gained.id)
      expect(spawned).toBeDefined()
      if (spawned?.kind === 'world') {
        expect(spawned.name).toBe('Gripping Talon')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// 8b. EndTurn Corpse self-transform (DestroySelf + AddWorldCardToTop)
// ---------------------------------------------------------------------------

describe('EndTurn Corpse self-transform', () => {
  // Mints one Corpse plus five Explores from a single id-allocation chain (so
  // no ids collide), puts the Corpse alone in hand, and empties the world/act
  // piles so the only world card that can appear is one the end-of-turn loop
  // spawns. Returns the crafted state and the minted Corpse.
  function makeCorpseState(): { state: GameState; corpse: WorldCard } {
    const base = createWorld(catalog, worldData, 42)
    const [corpse, c1] = mintCard(catalog, base, 'Corpse')

    let acc: GameState = c1
    const playerDraw: PlayerCard[] = []
    for (let i = 0; i < 5; i++) {
      const [c, next] = mintCard(catalog, acc, 'Explore')
      playerDraw.push(c as PlayerCard)
      acc = next
    }

    const state = makeState({
      ...acc,
      hp: 10,
      hand: [corpse as WorldCard],
      worldDraw: [],
      acts: [],
      playerDraw,
    })
    return { state, corpse: corpse as WorldCard }
  }

  it('an undealt Corpse degrades: gone from hand and a Zombie is spawned onto the world deck', () => {
    const { state, corpse } = makeCorpseState()

    const beforeWorldDraw = state.worldDraw.length
    const result = reduce(catalog, state, { type: 'EndTurn' })

    // The DestroySelf step removes the Corpse and the AddWorldCardToTop step
    // mints a Zombie onto worldDrawTop. CardGained fires for that Zombie, and
    // CardDestroyed for the Corpse, in onEndOfTurn order (before the refill).
    const gained = result.events.find((e) => e.type === 'CardGained')
    expect(gained).toBeDefined()
    const destroyed = result.events.find((e) => e.type === 'CardDestroyed')
    expect(destroyed).toBeDefined()
    if (destroyed?.type === 'CardDestroyed') {
      expect(destroyed.id).toBe(corpse.id)
    }

    // Net world-card count grew by exactly one (the spawned Zombie), even
    // though startTurn then draws it from worldDraw into the next hand.
    const corpseGone = !result.state.hand.some((c) => c.id === corpse.id)
    expect(corpseGone).toBe(true)
    const worldCardsAfter =
      result.state.worldDraw.length +
      result.state.hand.filter((c) => c.kind === 'world').length
    expect(worldCardsAfter).toBe(beforeWorldDraw + 1)

    // The spawned world card is a Zombie (it was drawn into the refilled hand).
    const spawnedZombie = result.state.hand.find(
      (c) => c.kind === 'world' && c.name === 'Zombie',
    )
    expect(spawnedZombie).toBeDefined()
  })

  it('does not re-fire same turn: exactly one Zombie is spawned by one Corpse', () => {
    const { state } = makeCorpseState()

    const result = reduce(catalog, state, { type: 'EndTurn' })

    // Exactly one CardGained event: the spawned Zombie does NOT also run its
    // own onEndOfTurn this turn (which would add more cards / deal damage),
    // because the end-of-turn loop iterates a snapshot taken at loop entry.
    const gained = result.events.filter((e) => e.type === 'CardGained')
    expect(gained).toHaveLength(1)

    // The spawned Zombie's onEndOfTurn (Damage 1) never ran this turn.
    expect(result.events.some((e) => e.type === 'DamageDealt')).toBe(false)
    expect(result.state.hp).toBe(10)
  })

  it('the spawned Zombie behaves as a normal Zombie next turn: its onEndOfTurn deals 1 damage on turn 2', () => {
    const { state } = makeCorpseState()

    // Turn 1: the Corpse degrades and a Zombie spawns. World cards stay in hand
    // across EndTurn (only player cards are discarded), so the spawned Zombie is
    // drawn into the refilled hand and persists into turn 2. The Corpse's own
    // onEndOfTurn deals no damage, so hp is unchanged this turn — our baseline.
    const afterTurn1 = reduce(catalog, state, { type: 'EndTurn' })
    expect(afterTurn1.state.hp).toBe(10)
    const spawnedZombie = afterTurn1.state.hand.find(
      (c) => c.kind === 'world' && c.name === 'Zombie',
    )
    expect(spawnedZombie).toBeDefined()

    // Turn 2: the spawned Zombie is now a normal world card in hand, so its own
    // onEndOfTurn (Damage 1, per zombie-big-box.json) fires this turn.
    const afterTurn2 = reduce(catalog, afterTurn1.state, { type: 'EndTurn' })

    expect(afterTurn2.events.map((e) => e.type)).toContain('DamageDealt')
    expect(afterTurn2.state.hp).toBe(afterTurn1.state.hp - 1)
  })
})

// ---------------------------------------------------------------------------
// 9. Energy lifecycle (gainEnergy, spendEnergy, startTurn)
// ---------------------------------------------------------------------------

describe('EndTurn gains energy', () => {
  it('EndTurn with no plays gains exactly +1 energy', () => {
    const base = createWorld(catalog, worldData, 42)
    const initialEnergy = base.energy
    expect(initialEnergy).toBe(1) // Opening hand is a turn start

    // Crafted state with just world cards (no plays)
    const state = makeState({
      hand: base.hand.filter((c) => c.kind === 'world'),
      energy: initialEnergy,
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })
    expect(result.state.energy).toBe(initialEnergy + 1)
  })

  it('several EndTurns are monotonic +1 with no cap', () => {
    const base = createWorld(catalog, worldData, 42)
    const [rubble, s1] = mintCard(catalog, base, 'Rubble')
    const [explore, seeded] = mintCard(catalog, s1, 'Explore')
    let state = makeState({
      ...seeded,
      hand: [rubble as WorldCard],
      playerDraw: [explore as PlayerCard],
      worldDraw: [],
      acts: [],
      energy: 1,
    })

    for (let i = 0; i < 5; i++) {
      const energyBefore = state.energy
      const result = reduce(catalog, state, { type: 'EndTurn' })
      expect(result.state.energy).toBe(energyBefore + 1)
      state = result.state
    }

    expect(state.energy).toBe(6)
  })

  it('skipDrawNext does not prevent energy gain', () => {
    const base = createWorld(catalog, worldData, 42)
    const state = makeState({
      hand: base.hand.filter((c) => c.kind === 'world'),
      energy: 1,
      skipDrawNext: true,
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })

    expect(result.state.energy).toBe(2)
    expect(result.state.skipDrawNext).toBe(false)
    expect(result.events.map((e) => e.type)).toContain('DrawSkipped')
  })

  it('EnergyChanged event appears during turn start (after TurnEnded)', () => {
    const base = createWorld(catalog, worldData, 42)
    const state = makeState({
      hand: base.hand.filter((c) => c.kind === 'world'),
      energy: 1,
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })
    const types = result.events.map((e) => e.type)

    const turnEndedIdx = types.indexOf('TurnEnded')
    const energyChangedIdx = types.indexOf('EnergyChanged')

    expect(turnEndedIdx).not.toBe(-1)
    expect(energyChangedIdx).not.toBe(-1)
    expect(turnEndedIdx).toBeLessThan(energyChangedIdx)
  })

  it('energy is identical across ActAdvanced boundary', () => {
    // Create a state where the next EndTurn will cause an ActAdvanced event.
    // We do this by draining worldDraw to empty and queuing an act.
    const base = createWorld(catalog, worldData, 42)
    const [walker, s1] = mintCard(catalog, base, 'The Walker')

    const state = makeState({
      ...s1,
      hand: [walker as WorldCard],
      worldDraw: [],
      acts: base.acts, // Copy the queued acts
      actIndex: 1,
      energy: 2,
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })

    // Energy should be 3 (2 + 1)
    expect(result.state.energy).toBe(3)
    // ActAdvanced should have occurred
    expect(result.events.map((e) => e.type)).toContain('ActAdvanced')
  })
})

// ---------------------------------------------------------------------------
// 10. Energy deduction on costed card play (Step 5)
// ---------------------------------------------------------------------------

describe('PlayCard deducts energy cost (Step 5)', () => {
  it('playing a cost-1 card deducts energy: energy 1 → 0', () => {
    const base = createWorld(catalog, worldData, 42)
    // Find or create a cost-1 card and a target
    const [listen, s1] = mintCard(catalog, base, 'Listen')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, listen as PlayerCard],
      energy: 1,
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: listen.id,
      targetId: rubble.id,
    })

    expect(result.state.energy).toBe(0)
    // EnergyChanged event should be present in events (after CardPlayed, before effect events)
    const types = result.events.map((e) => e.type)
    expect(types).toContain('EnergyChanged')
    const cardPlayedIdx = types.indexOf('CardPlayed')
    const energyChangedIdx = types.indexOf('EnergyChanged')
    expect(cardPlayedIdx).toBeLessThan(energyChangedIdx)
  })

  it('playing a cost-1 card when energy 2 leaves energy 1', () => {
    const base = createWorld(catalog, worldData, 42)
    const [listen, s1] = mintCard(catalog, base, 'Listen')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, listen as PlayerCard],
      energy: 2,
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: listen.id,
      targetId: rubble.id,
    })

    expect(result.state.energy).toBe(1)
  })

  it('playing a cost-0 card leaves energy unchanged and no EnergyChanged event', () => {
    const base = createWorld(catalog, worldData, 42)
    const [explore, s1] = mintCard(catalog, base, 'Explore')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, explore as PlayerCard],
      energy: 1,
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: explore.id,
      targetId: rubble.id,
    })

    expect(result.state.energy).toBe(1)
    const types = result.events.map((e) => e.type)
    // No EnergyChanged event for cost-0 cards
    expect(types).not.toContain('EnergyChanged')
  })

  it('playing a cost-1 card with energy 0 throws IllegalActionError (affordability gate)', () => {
    const base = createWorld(catalog, worldData, 42)
    const [listen, s1] = mintCard(catalog, base, 'Listen')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, listen as PlayerCard],
      energy: 0,
    })

    expect(() => {
      reduce(catalog, state, {
        type: 'PlayCard',
        cardId: listen.id,
        targetId: rubble.id,
      })
    }).toThrow(IllegalActionError)
  })

  it('energy never goes negative during play', () => {
    const base = createWorld(catalog, worldData, 42)
    const [barricade, s1] = mintCard(catalog, base, 'Barricade')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, barricade as PlayerCard],
      energy: 1, // cost-1 card, should not go negative
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: barricade.id,
      targetId: rubble.id,
      returnIds: [],
    })

    expect(result.state.energy).toBeGreaterThanOrEqual(0)
  })

  it('EnergyChanged event carries the new energy total', () => {
    const base = createWorld(catalog, worldData, 42)
    const [listen, s1] = mintCard(catalog, base, 'Listen')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, listen as PlayerCard],
      energy: 3,
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: listen.id,
      targetId: rubble.id,
    })

    const energyEvent = result.events.find((e) => e.type === 'EnergyChanged')
    expect(energyEvent).toBeDefined()
    if (energyEvent?.type === 'EnergyChanged') {
      expect(energyEvent.energy).toBe(2) // 3 - 1
    }
  })

  it('REQ-12: Barricade (cost-1 Sequence) deducts energy exactly once despite multi-step effect', () => {
    // Barricade is a Sequence with DealProgress + ReturnWorldCards.
    // Energy should be deducted once for the whole card, not per step.
    const base = createWorld(catalog, worldData, 42)
    const [barricade, s1] = mintCard(catalog, base, 'Barricade')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, barricade as PlayerCard],
      energy: 2,
    })

    const result = reduce(catalog, state, {
      type: 'PlayCard',
      cardId: barricade.id,
      targetId: rubble.id,
      returnIds: [],
    })

    // Energy should be 2 - 1 = 1 (deducted once for the whole card)
    expect(result.state.energy).toBe(1)

    // Exactly one EnergyChanged event should be present
    const energyChangedEvents = result.events.filter((e) => e.type === 'EnergyChanged')
    expect(energyChangedEvents).toHaveLength(1)
    expect(energyChangedEvents[0]).toBeDefined()
    if (energyChangedEvents[0]?.type === 'EnergyChanged') {
      expect(energyChangedEvents[0].energy).toBe(1)
    }
  })
})

// ---------------------------------------------------------------------------
// 11. Loss guard A: unaffordable cards do not trigger loss when energy is the
// only blocker (Step 6: fix ignoreEnergy flag)
// ---------------------------------------------------------------------------

describe('EndTurn loss guard A with ignoreEnergy', () => {
  it('unaffordable cost-1 card does NOT trigger loss (energy will rise)', () => {
    // Craft a state with:
    // - All draw piles and acts exhausted (no future cards)
    // - Barricade (cost 1 card) in hand but with energy=0 (unaffordable)
    // - A world card in hand to make Barricade structurally playable
    // Expected: status stays 'playing' (not lost), because energy rises +1/turn
    // and Barricade will become affordable

    const base = createWorld(catalog, worldData, 42)
    const [barricade, s1] = mintCard(catalog, base, 'Barricade')
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard, barricade as PlayerCard],
      playerDraw: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 0,
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })

    // Status should be 'playing' — the card is structurally playable (ignoring energy)
    expect(result.state.status).toBe('playing')
    // No WorldLost event should be emitted
    expect(result.events.map((e) => e.type)).not.toContain('WorldLost')
    // Energy should have risen
    expect(result.state.energy).toBe(1)
  })

  it('genuinely dead state (no structural play at all) still loses', () => {
    // Craft a state with:
    // - All draw piles and acts exhausted
    // - No cards in hand (world or player)
    // Expected: WorldLost is emitted, because there is NO structural play at all,
    // not even when ignoring energy

    const base = createWorld(catalog, worldData, 42)

    const state = makeState({
      ...base,
      hand: [], // Completely empty
      playerDraw: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 5,
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })

    // Status should be 'lost'
    expect(result.state.status).toBe('lost')
    // WorldLost event should be emitted
    expect(result.events.map((e) => e.type)).toContain('WorldLost')
  })

  it('world card in hand still avoids livelock loss when a player draw is available', () => {
    // Craft a state with:
    // - No future world cards in piles
    // - A discardable world card in hand (Rubble)
    // - At least one player card available to draw
    // Expected: status stays 'playing' (not a dead state).

    const base = createWorld(catalog, worldData, 42)
    const [rubble, s1] = mintCard(catalog, base, 'Rubble')
    const [explore, s2] = mintCard(catalog, s1, 'Explore')

    const state = makeState({
      ...s2,
      hand: [rubble as WorldCard],
      playerDraw: [explore as PlayerCard],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 0,
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })

    // Status should be 'playing' — Rubble is discardable
    expect(result.state.status).toBe('playing')
    // No WorldLost event
    expect(result.events.map((e) => e.type)).not.toContain('WorldLost')
  })
})

// ---------------------------------------------------------------------------
// 12. Draw-phase loss: if no player cards are drawn at turn start, lose
// ---------------------------------------------------------------------------

describe('EndTurn draw-phase loss', () => {
  it('loses when hazards fill the hand and leave no room for player draws', () => {
    const base = createWorld(catalog, worldData, 42)
    let seeded = base
    const hazards: WorldCard[] = []

    for (let i = 0; i < 6; i++) {
      const [rubble, next] = mintCard(catalog, seeded, 'Rubble')
      hazards.push(rubble as WorldCard)
      seeded = next
    }

    const state = makeState({
      ...seeded,
      hand: hazards,
      playerDraw: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 2,
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })

    expect(result.state.status).toBe('lost')
    expect(result.events.map((e) => e.type)).toContain('WorldLost')
  })

  it('loses when no player cards can be drawn from player piles', () => {
    const base = createWorld(catalog, worldData, 42)
    const [rubble, seeded] = mintCard(catalog, base, 'Rubble')

    const state = makeState({
      ...seeded,
      hand: [rubble as WorldCard],
      playerDraw: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      energy: 2,
    })

    const result = reduce(catalog, state, { type: 'EndTurn' })

    expect(result.state.status).toBe('lost')
    expect(result.events.map((e) => e.type)).toContain('WorldLost')
  })
})

// ---------------------------------------------------------------------------
// 14. Brace integration: play Steady → discard Sliding Debris → EndTurn → no snatch
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DealProgressAll integration: sweep + kill-energy
// ---------------------------------------------------------------------------

describe('DealProgressAll integration', () => {
  it('sweep clears 3 Zombies and fires kill-energy 3 times', () => {
    // Shelf Sweep: DealProgressAll base 1, bonus Creature +1 = 2 progress vs Creature.
    // Zombie: cost 3, keyword Creature, onCleared GainEnergy 1.
    // With 1 existing progress per Zombie, the sweep deals 2 more → total 3 → clears each.
    let state = makeState({ energy: 2 })

    const [shelfSweep, s1] = mintCard(catalog, state, 'Shelf Sweep')
    const [z1, s2] = mintCard(catalog, s1, 'Zombie')
    const [z2, s3] = mintCard(catalog, s2, 'Zombie')
    const [z3, s4] = mintCard(catalog, s3, 'Zombie')
    state = {
      ...s4,
      energy: 2,
      hand: [shelfSweep as PlayerCard, z1 as WorldCard, z2 as WorldCard, z3 as WorldCard],
      progress: {
        [z1.id]: 1,
        [z2.id]: 1,
        [z3.id]: 1,
      },
    }

    const result = reduce(catalog, state, { type: 'PlayCard', cardId: shelfSweep.id })

    const hazardResolved = result.events.filter((e) => e.type === 'HazardResolved')
    expect(hazardResolved).toHaveLength(3)

    const energyEvents = result.events.filter((e) => e.type === 'EnergyChanged')
    expect(energyEvents.length).toBeGreaterThanOrEqual(3)

    // Each Zombie.onCleared grants 1 energy; started at 0 after cost deduction (2-2=0), gained 3 × 1
    expect(result.state.energy).toBe(3)
  })
})

describe('Brace integration', () => {
  it('play Steady → discard Sliding Debris → EndTurn → next hand intact (no CardDestroyed)', () => {
    // Steady grants Brace 1. Sliding Debris.onDiscarded fires ForceDestroy 1.
    // With one brace charge banked the ForceDestroy should be absorbed —
    // no CardDestroyed event should fire on the next turn start.
    const { catalog: birdCatalog, worldData: birdWorld } = buildWorld('bird-building')
    const base = createWorld(birdCatalog, birdWorld, 42)

    const [steady, s1] = mintCard(birdCatalog, base, 'Steady')
    const [slidingDebris, s2] = mintCard(birdCatalog, s1, 'Sliding Debris')

    // Provide enough player and world cards for refillHand so the turn
    // actually completes without losing.
    let acc: GameState = s2
    const playerDraw: PlayerCard[] = []
    for (let i = 0; i < 6; i++) {
      const [c, next] = mintCard(birdCatalog, acc, 'Find Footing')
      playerDraw.push(c as PlayerCard)
      acc = next
    }
    const worldDraw: WorldCard[] = []
    for (let i = 0; i < 3; i++) {
      const [c, next] = mintCard(birdCatalog, acc, 'Groaning Girders')
      worldDraw.push(c as WorldCard)
      acc = next
    }

    const state: GameState = {
      ...acc,
      hand: [steady as PlayerCard, slidingDebris as WorldCard],
      playerDraw,
      playerDiscard: [],
      worldDraw,
      acts: [],
      progress: {},
      energy: 1, // enough to play Steady (cost 1)
      braceCharges: 0,
      pendingForceDestroy: 0,
    }

    // Step 1: play Steady → braceCharges = 1
    const afterSteady = reduce(birdCatalog, state, {
      type: 'PlayCard',
      cardId: (steady as PlayerCard).id,
    })
    expect(afterSteady.state.braceCharges).toBe(1)
    expect(afterSteady.events.some((e) => e.type === 'BraceChanged')).toBe(true)

    // Step 2: discard Sliding Debris → pendingForceDestroy = 1
    const afterDiscard = reduce(birdCatalog, afterSteady.state, {
      type: 'DiscardHazard',
      cardId: (slidingDebris as WorldCard).id,
    })
    expect(afterDiscard.state.pendingForceDestroy).toBe(1)
    // No CardDestroyed yet — the snatch is still pending
    expect(afterDiscard.events.some((e) => e.type === 'CardDestroyed')).toBe(false)

    // Step 3: EndTurn → hand refills → resolveForceDestroy absorbs the charge
    const afterEnd = reduce(birdCatalog, afterDiscard.state, { type: 'EndTurn' })

    expect(afterEnd.state.pendingForceDestroy).toBe(0)
    expect(afterEnd.state.braceCharges).toBe(0)
    // The brace absorbed the snatch — no card was destroyed
    expect(afterEnd.events.some((e) => e.type === 'CardDestroyed')).toBe(false)
    expect(afterEnd.events.some((e) => e.type === 'BraceConsumed')).toBe(true)

    const consumed = afterEnd.events.find((e) => e.type === 'BraceConsumed')
    if (consumed?.type === 'BraceConsumed') {
      expect(consumed.absorbed).toBe(1)
      expect(consumed.remaining).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// ExileTopWorldCards: livelock guard
// ---------------------------------------------------------------------------

describe('ExileTopWorldCards: livelock guard', () => {
  it('exile empties worldDraw while acts remain, next EndTurn advances act normally', () => {
    // Build a state with: two exilable cards in worldDraw, one act remaining,
    // and a Floor-It-like card in hand (ExileTopWorldCards amount=5).
    let state = makeState({})
    const [w1, s1] = mintCard(catalog, state, 'Rubble')
    const [w2, s2] = mintCard(catalog, s1, 'Screams')
    state = s2

    // Craft a player card with ExileTopWorldCards effect
    const floorIt: PlayerCard = {
      kind: 'player',
      id: 'floor-it-test',
      name: 'Floor It',
      insetKey: undefined,
      sourceWorldId: 'highway-volcano',
      energyCost: 0,
      exhaust: true,
      keywords: [],
      effect: { kind: 'ExileTopWorldCards', amount: 5 },
    }

    // One remaining act with one card
    const [actCard, s3] = mintCard(catalog, state, 'Zombie')
    state = s3

    state = {
      ...state,
      hand: [floorIt],
      worldDraw: [w1 as WorldCard, w2 as WorldCard],
      acts: [[actCard as WorldCard]],
      actIndex: 0,
      totalActs: 1,
      playerDraw: [],
      playerDiscard: [],
      energy: 0,
    }

    // Play Floor It: exiles both worldDraw cards, leaving worldDraw empty
    const afterExile = reduce(catalog, state, { type: 'PlayCard', cardId: floorIt.id })
    expect(afterExile.state.worldDraw).toHaveLength(0)
    expect(afterExile.events.some((e) => e.type === 'WorldCardsExiled')).toBe(true)

    // EndTurn should advance the act (draw from acts[0]) without livelock
    const afterEnd = reduce(catalog, afterExile.state, { type: 'EndTurn' })
    // The act card should have been drawn into hand
    expect(afterEnd.state.hand.some((c) => c.id === actCard.id)).toBe(true)
    expect(afterEnd.events.some((e) => e.type === 'ActAdvanced')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// PlayCard Cut It Loose (Sequence: destroyHand → hazard)
// ---------------------------------------------------------------------------

describe('PlayCard Cut It Loose (Sequence: destroyHand → hazard)', () => {
  const { catalog: birdCatalog, worldData: birdWorld } = buildWorld('bird-building')

  /** Build a minimal state seeded from bird-building for Cut It Loose tests. */
  function makeBirdState(overrides: Partial<GameState> = {}): GameState {
    const base = createWorld(birdCatalog, birdWorld, 42)
    return {
      ...base,
      playerDraw: [],
      playerDiscard: [],
      worldDraw: [],
      acts: [],
      progress: {},
      energy: 0,
      status: 'playing',
      ...overrides,
    }
  }

  /**
   * Build a ready-to-play state: Cut It Loose in hand, one other player card
   * to destroy (Find Footing), and one world card to target (Groaning Girders,
   * cost 1 so a base-4 progress resolves it).
   */
  function makeCutItLooseState(): {
    state: GameState
    cutItLoose: PlayerCard
    findFooting: PlayerCard
    groaningGirders: WorldCard
  } {
    const base = makeBirdState()
    const [cutItLoose, s1] = mintCard(birdCatalog, base, 'Cut It Loose')
    const [findFooting, s2] = mintCard(birdCatalog, s1, 'Find Footing')
    const [groaningGirders, s3] = mintCard(birdCatalog, s2, 'Groaning Girders')

    const state = makeBirdState({
      ...s3,
      hand: [cutItLoose as PlayerCard, findFooting as PlayerCard, groaningGirders as WorldCard],
    })

    return {
      state,
      cutItLoose: cutItLoose as PlayerCard,
      findFooting: findFooting as PlayerCard,
      groaningGirders: groaningGirders as WorldCard,
    }
  }

  it('full dispatch: destroys the player card and deals progress to the world card', () => {
    const { state, cutItLoose, findFooting, groaningGirders } = makeCutItLooseState()

    const result = reduce(birdCatalog, state, {
      type: 'PlayCard',
      cardId: cutItLoose.id,
      destroyId: findFooting.id,
      targetId: groaningGirders.id,
    })

    // Cut It Loose played successfully
    const types = result.events.map((e) => e.type)
    expect(types).toContain('CardPlayed')

    // Destroyed player card is removed from hand and not in discard
    expect(result.state.hand.some((c) => c.id === findFooting.id)).toBe(false)
    expect(result.state.playerDiscard.some((c) => c.id === findFooting.id)).toBe(false)
    expect(types).toContain('CardDestroyed')

    // Progress was dealt to the world card (base 4 resolves Groaning Girders cost 1)
    expect(types).toContain('ProgressDealt')
    expect(types).toContain('HazardResolved')
    expect(result.state.hand.some((c) => c.id === groaningGirders.id)).toBe(false)
  })

  it('rejection: missing destroyId throws IllegalActionError', () => {
    const { state, cutItLoose, groaningGirders } = makeCutItLooseState()

    expect(() => {
      reduce(birdCatalog, state, {
        type: 'PlayCard',
        cardId: cutItLoose.id,
        // destroyId omitted — step 0 requires it (min=1)
        targetId: groaningGirders.id,
      })
    }).toThrow(IllegalActionError)
  })

  it('rejection: missing targetId throws IllegalActionError', () => {
    const { state, cutItLoose, findFooting } = makeCutItLooseState()

    expect(() => {
      reduce(birdCatalog, state, {
        type: 'PlayCard',
        cardId: cutItLoose.id,
        destroyId: findFooting.id,
        // targetId omitted — step 1 (DealProgress) requires a world card target
      })
    }).toThrow(IllegalActionError)
  })
})

// ---------------------------------------------------------------------------
// None-effect play semantics (REQ-MALL-1 — Spore)
// ---------------------------------------------------------------------------

describe('PlayCard None effect (Spore semantics)', () => {
  /**
   * Mint a Spore-shaped card: cost 1, exhaust, effect None, keyword Spore.
   * No catalog template yet — mint Explore and spread the Spore shape onto it
   * (same pattern as exhaustExplore above).
   */
  function mintSpore(base: GameState): [PlayerCard, GameState] {
    const [explore, next] = mintCard(catalog, base, 'Explore')
    return [
      {
        ...(explore as PlayerCard),
        name: 'Spore',
        effect: { kind: 'None' },
        energyCost: 1,
        exhaust: true,
        keywords: ['Spore'],
      },
      next,
    ]
  }

  it('playing Spore pays 1 energy, exhausts it from every zone, and changes nothing else', () => {
    const base = createWorld(catalog, worldData, 42)
    const [spore, s1] = mintSpore(base)
    const [rubble, s2] = mintCard(catalog, s1, 'Rubble')
    const [filler, s3] = mintCard(catalog, s2, 'Explore')

    const state = makeState({
      ...s3,
      energy: 2,
      hand: [rubble as WorldCard, spore],
      playerDraw: [filler as PlayerCard],
    })

    const result = reduce(catalog, state, { type: 'PlayCard', cardId: spore.id })

    // Cost paid.
    expect(result.state.energy).toBe(1)

    // Exhausted: absent from hand, discard, AND draw pile.
    expect(result.state.hand.some((c) => c.id === spore.id)).toBe(false)
    expect(result.state.playerDiscard.some((c) => c.id === spore.id)).toBe(false)
    expect(result.state.playerDraw.some((c) => c.id === spore.id)).toBe(false)

    // Standard events, in play → spend → vanish order, and nothing else.
    expect(result.events).toEqual([
      { type: 'CardPlayed', cardId: spore.id },
      { type: 'EnergyChanged', energy: 1 },
      { type: 'CardDestroyed', id: spore.id },
    ])

    // Nothing else changed: the remaining state equals the pre-play state
    // minus the Spore card and the energy spent.
    const expected: GameState = {
      ...state,
      hand: state.hand.filter((c) => c.id !== spore.id),
      energy: 1,
    }
    expect(result.state).toEqual(expected)
  })
})
