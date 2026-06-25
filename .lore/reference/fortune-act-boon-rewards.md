---
title: Fortune Act Boon Rewards
date: 2026-06-25
status: current
tags: [fortune, act-rewards, boons, unlocks, temporary-cards]
fg-type: architecture
fg-sources: [.lore/work/plans/fortune-boon-cards.md, .lore/work/notes/fortune-boon-cards.md]
fg-status: current
---

# Fortune Act Boon Rewards

Fortune is the implemented behavior for the `act-reward` unlock. Its stable unlock id remains `act-reward`, but activation creates an act-boon run modifier instead of a placeholder effect.

The modifier carries the concrete boon pool id, template ids, offered count, and choose count. The reducer receives all data through `GameState.runModifiers`; it does not import or hard-code the Fortune pool.

## Choice Model

Fortune keeps `GameState.status` as `playing` and uses a separate pending boon field. Normal play, discard, and end-turn actions are blocked while a boon choice is pending. Choosing mints one offered exhaust player card and grants it directly to hand.

Offers store template ids, not minted cards. This prevents rejected options from consuming `nextId` and lets the UI render choices through a read-only template lookup exposed by the gameplay session.

## Trigger Rule

Fortune triggers on real act advancement from the end-turn path, not on the opening deal. If an act transition would otherwise lead into a post-refill loss check, the pending boon choice takes priority so the player can resolve the offered rescue card first.

Fortune intentionally creates at most one pending act-boon choice per reducer dispatch. If a single end-turn refill emits multiple `ActAdvanced` events, the offer uses the first advanced act from that event batch rather than queueing multiple choices.
