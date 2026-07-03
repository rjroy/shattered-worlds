---
title: Observability Boundary — One Hidden-State Model, Two Consumers
date: 2026-07-02
status: current
tags: [observability, preview, sim, rng, hidden-information, determinization, architecture]
fg-type: architecture
fg-sources: [.lore/work/design/observability-boundary.md]
fg-status: current
fg-evidence:
  code:
    - src/core/model/observability.ts
    - src/sim/determinize.ts
    - src/core/view/actionPreview.ts
  tests:
    - src/core/tests/observability.test.ts
    - src/core/tests/observability-conformance.test.ts
    - src/sim/tests/determinize.test.ts
  symbols:
    - hiddenZones
    - isHidden
    - determinize
---

# Observability Boundary — One Hidden-State Model, Two Consumers

`reduce` is pure and deterministic: given the same `state.rng`, `previewAction` and the committed dispatch produce byte-identical results. That makes a naive preview or a naive sim agent read the exact future — draw-pile order, freeze victims, weighted-draw rolls — before it happens. Two very different consumers need this fixed: the player-facing preview (which must show nothing it shouldn't yet know) and the honest sim agent (which must plan without clairvoyance to produce a believable measure of human-achievable difficulty).

The two consumers want opposite treatments of the same hidden state:

| Concern | Player display wants | Sim agent wants |
|---|---|---|
| Resolution randomness (rng consumed at resolution) | "something random happens" — never a sampled outcome shown as fact | a plausible sample to average over across rollouts |
| Hidden information (predetermined deck order) | "draw N cards, contents unknown" | a plausible reshuffle of hidden zones, resampled per rollout |

Because the treatments are opposite (mask to "unknown" vs. produce "a plausible sample"), there is no single shared transform. What is shared is the *model* of what's hidden: `hiddenZones(state)` / `isHidden(card, state)` in `src/core/model/observability.ts` is the one place that defines which state a human player cannot see (draw-pile order, not-yet-reached acts). Both consumers derive from that single model:

- **Player display** (`src/core/view/actionPreview.ts`) stamps events at the point randomness is consumed or a hidden zone is read, then masks any stamped event to a generic summary.
- **Sim agent** (`src/sim/determinize.ts`) calls `determinize(state, agentRng)` to produce a full-information copy where every hidden zone is reshuffled under the agent's own rng before planning, so the agent learns no more from a snapshot than a player would.

`reduce` itself is never modified for either purpose — it stays pure and full-information, which is what makes an honest sim cheap to build (free fork-and-rollback per rollout). See [[pure-reducer-determinization-lesson]] for why faking randomness inside the reducer was rejected, and [[event-randomness-hidden-reveal-stamps]] for how the preview side of this model is implemented.
