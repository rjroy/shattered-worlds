/** Composite effect handlers: `Modal` and `Sequence`. */
import type { CardEffect, CardId, GameState, TargetSpec } from '../model/types'
import type { EffectLine } from '../view/effectGlyphs'
import type { CompileContext, EffectContext, EffectResult } from './EffectContext'
import { EffectHandler } from './EffectHandler'
import { describeEffect } from '../view/describe'
import { isPlayableOf, structuralSpecOf } from '../engine/available'
import { main, text } from './tokens'

type ModalEffect = Extract<CardEffect, { kind: 'Modal' }>
type SequenceEffect = Extract<CardEffect, { kind: 'Sequence' }>

/**
 * `Modal`: the player picks one branch (`ctx.choice`); that branch's behavior is
 * the card's behavior. Ports the `Modal` cases from `applyEffect`,
 * `describeEffect`, the private `compile`, `structuralSpec`, and `isPlayable`.
 */
export class ModalHandler extends EffectHandler<ModalEffect> {
  override apply(ctx: EffectContext, effect: ModalEffect): EffectResult {
    // Mirrors effects.ts `Modal`: select the chosen branch (default 0) and run
    // it with the same context. Targeting fields and selfId are NOT reset — the
    // child branch sees the same ctx the Modal did, exactly as the current code
    // threads `action`/`selfId` unchanged into the recursive applyEffect.
    const choice = ctx.choice ?? 0
    const branch = effect.branches[choice]
    if (branch === undefined) return { state: ctx.state, events: [] }
    return ctx.apply(ctx, branch)
  }

  override describe(effect: ModalEffect): string[] {
    return ['Choose one:', ...effect.branches.map((b) => `• ${describeEffect(b).join(', ')}`)]
  }

  override compile(effect: ModalEffect, ctx: CompileContext): EffectLine[] {
    return [
      // A "Choose:" header, then each branch's lines.
      main([text('Choose:')]),
      // A branch's first (main) line becomes a 'branch' line; rider lines it
      // produced stay riders, and nested 'branch' lines stay 'branch' — the
      // indent level deliberately does not stack. Inside a branch a Sequence
      // always joins onto one line, so compactSequences is forced true.
      ...effect.branches.flatMap((branch) =>
        ctx.compile(branch, { ...ctx, compactSequences: true }).map(
          (l): EffectLine => ({ ...l, role: l.role ?? 'branch' }),
        ),
      ),
    ]
  }

  override structuralSpec(effect: ModalEffect): TargetSpec {
    return { kind: 'modal', branches: effect.branches.map(structuralSpecOf) }
  }

  override isPlayable(effect: ModalEffect, state: GameState, selfId: CardId): boolean {
    // Playable as long as at least one branch is viable.
    return effect.branches.some((branch) => isPlayableOf(branch, state, selfId))
  }

  override legalTargets(_effect: ModalEffect, _selfId: CardId, _state: GameState): readonly CardId[] {
    // Resolved at the branch level by available.ts's computeLegalTargets, not here.
    return []
  }
}

/**
 * `Sequence`: run each step in order, threading state and accumulating events.
 * Ports the `Sequence` cases from `applyEffect`, `describeEffect`, the private
 * `compile` (including the join-vs-split budget and `compactSequences`
 * propagation), `structuralSpec`, and `isPlayable`.
 */
export class SequenceHandler extends EffectHandler<SequenceEffect> {
  override apply(ctx: EffectContext, effect: SequenceEffect): EffectResult {
    // Mirrors effects.ts `Sequence`: fold the steps, threading the running state
    // into each child and concatenating events. Each step sees a ctx carrying
    // the running `state`; targeting fields and selfId pass through unchanged,
    // exactly as the current code reuses the same `action`/`selfId` for every
    // step's recursive applyEffect call.
    let current = ctx.state
    const events: EffectResult['events'] = []

    for (const step of effect.steps) {
      const r = ctx.apply({ ...ctx, state: current }, step)
      current = r.state
      events.push(...r.events)
    }

    return { state: current, events }
  }

  override describe(effect: SequenceEffect): string[] {
    return effect.steps.flatMap((step, i) =>
      describeEffect(step).map((line, j) => (i > 0 && j === 0 ? `then ${lowerFirst(line)}` : line)),
    )
  }

  override compile(effect: SequenceEffect, ctx: CompileContext): EffectLine[] {
    // None steps contribute nothing, so the join-vs-split count is over the
    // steps that actually produced lines.
    const compiledSteps = effect.steps
      .map((step) => ctx.compile(step, ctx))
      .filter((compiled) => compiled.length > 0)

    if (ctx.compactSequences || compiledSteps.length <= 2) {
      // Step main lines join onto one line with '→' connectives; any
      // rider/branch lines the steps produced follow after, roles preserved.
      const joined: EffectLine['tokens'] = []
      const trailing: EffectLine[] = []
      for (const [first, ...rest] of compiledSteps) {
        if (first === undefined) continue
        if (joined.length > 0) joined.push(text('→'))
        joined.push(...first.tokens)
        trailing.push(...rest)
      }
      return joined.length > 0 ? [main(joined), ...trailing] : trailing
    }

    // 3+ steps would overflow a single line, so each step gets its own line,
    // continuation lines led by '→'. Each step's rider/branch lines immediately
    // follow that step's line, keeping riders bound to their owner.
    return compiledSteps.flatMap(([first, ...rest], index) => {
      if (first === undefined) return []
      const tokens = index === 0 ? first.tokens : [text('→'), ...first.tokens]
      return [{ ...first, tokens }, ...rest]
    })
  }

  override structuralSpec(effect: SequenceEffect): TargetSpec {
    return { kind: 'compound', steps: effect.steps.map(structuralSpecOf) }
  }

  override isPlayable(effect: SequenceEffect, state: GameState, selfId: CardId): boolean {
    // The first step determines whether the whole sequence is playable.
    return isPlayableOf(effect.steps[0]!, state, selfId)
  }

  override legalTargets(
    _effect: SequenceEffect,
    _selfId: CardId,
    _state: GameState,
  ): readonly CardId[] {
    // Resolved at the step level by available.ts's computeLegalTargets, not here.
    return []
  }
}

// ---------------------------------------------------------------------------
// Composite-structure navigation
// ---------------------------------------------------------------------------

/**
 * The CardEffect that runs at `step`, looking through a Sequence (steps line up
 * 1:1 with the compound targeting steps) or a Modal (step is the chosen branch
 * index). For a single effect, `step` is ignored and the effect is returned.
 * Returns null when the step/branch index is out of range.
 *
 * This answers a composite-structure question ("which child runs at step N"),
 * so it lives beside the composite handlers in core. `feedback.ts` re-exports it
 * for the renderer until TableScene switches to the core import in Step 8.
 */
export function effectAtStep(effect: CardEffect, step: number): CardEffect | null {
  if (effect.kind === 'Sequence') return effect.steps[step] ?? null
  if (effect.kind === 'Modal') return effect.branches[step] ?? null
  return effect
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0]!.toLowerCase() + s.slice(1) : s
}
