---
title: Oversized hand layout implementation plan
date: 2026-06-25
status: draft
tags: [plan, ux, hand-layout, table-scene, overflow]
modules: [game-ui, game-tablescene, game-layout, tests]
related: [.lore/work/specs/oversized-hand-layout.md]
---

# Oversized hand layout implementation plan

Source spec: `.lore/work/specs/oversized-hand-layout.md`

## Planning Decisions

- Use a fixed visible window of five full-size cards per table row. Six cards
  already requires spacing below `CARD_FACE.width` on the 900px canvas, so five
  is the readable threshold.
- Keep overflow handling entirely in the Phaser renderer layer. Core hand state,
  `effectiveHand()`, `availableActions()`, reducers, and effects continue to
  operate on the full hand.
- Maintain separate overflow/window state for the world-card row and the
  player-card row.
- Destroy `CardView` objects for cards outside the visible window, using the
  existing reconciliation cleanup path. Recreate them when they re-enter view.
  Card ids and gameplay state remain in core; only renderer objects are windowed.
- Prefer explicit click/tap navigation controls as the required affordance.
  Wheel, keyboard, or drag support can be added once the core behavior is stable.

## Step 1: Add Pure Row Windowing Model

Files:

- `src/game/view/tableLayout.ts`
- `src/game/tests/tableLayout.test.ts`

Work:

- Introduce row window types, for example:
  - `RowWindowState`: current row offset.
  - `RowWindowLayout`: visible index range, clamped offset, range label,
    positions, and overflow flags.
- Add a pure helper that accepts row card ids/count, desired offset, row y, and
  visible limit, then returns the visible slice metadata and centered positions.
- Keep `rowCardPositions()` for non-windowed callers or refactor it into the new
  helper while preserving small-row behavior.
- Add offset clamp helpers for page/slot navigation and for card removal.
- Add a helper to bring a specific card id/index into the current visible
  window.

Validation gate:

- Unit tests cover empty rows, one-card rows, five-card rows, six-card overflow,
  twenty-plus-card overflow, offset clamping, range labels, stable ordering, and
  bring-into-view behavior.

Requirements covered:

- `REQ-HANDLAYOUT-2`
- `REQ-HANDLAYOUT-3`
- `REQ-HANDLAYOUT-5`
- `REQ-HANDLAYOUT-12`
- `REQ-HANDLAYOUT-13`

## Step 2: Add TableScene Row Window State

Files:

- `src/game/scenes/TableScene.ts`

Work:

- Add private row offset fields for world and player rows.
- Reset offsets in `init()` so a new run starts at the first window.
- In `drawAll()`, split `effectiveHand(state)` exactly as today, then compute
  window layouts for each row before calling `layoutRow()`.
- Change `layoutRow()` to receive the visible cards and precomputed positions
  instead of deriving positions from the full row count.
- Ensure `desiredIds` only includes visible card ids so the existing cleanup path
  destroys off-window `CardView` objects.
- Clamp offsets each repaint after cards leave the row.
- Preserve `playerCardDisplaySignatures` behavior for visible player cards and
  let cleanup remove signatures for cards leaving the rendered window.

Validation gate:

- Existing tests that use `drawAll()` still pass after their harness is updated
  for the new `layoutRow()` signature or row-window call shape.

Requirements covered:

- `REQ-HANDLAYOUT-1`
- `REQ-HANDLAYOUT-2`
- `REQ-HANDLAYOUT-4`
- `REQ-HANDLAYOUT-5`
- `REQ-HANDLAYOUT-10`
- `REQ-HANDLAYOUT-13`

## Step 3: Render Row Navigation Chrome

Files:

- `src/game/scenes/TableScene.ts`
- `src/game/view/layout.ts`
- optional: `src/game/view/TableRowNavView.ts`

Work:

- Add stable layout constants for row navigation controls and range labels.
  Controls should sit near the affected row without overlapping cards, HUD,
  pile stacks, preview/hint labels, or action buttons.
- Implement previous/next controls for each overflowing row. Use existing
  `CommonButton`/`CommonLabel` patterns if they fit; otherwise create a small
  renderer-local view class to own the controls.
- Show controls and range labels only when a row overflows.
- Disable or hide previous/next affordances at the start/end of a row.
- On navigation, update the row offset, clear hover-only surfaces that reference
  now-hidden cards, and call `drawAll()`.
- Add discoverable click/tap controls first. Add wheel or keyboard navigation
  only after pointer behavior is stable.

Validation gate:

- Scene tests can observe navigation range state or view text. Manual browser
  inspection confirms controls are visible only for overflowing rows and do not
  overlap table chrome at 900x600.

Requirements covered:

- `REQ-HANDLAYOUT-3`
- `REQ-HANDLAYOUT-4`
- `REQ-HANDLAYOUT-9`
- `REQ-HANDLAYOUT-14`

## Step 4: Preserve Selection And Targeting Across Windows

Files:

- `src/game/scenes/TableScene.ts`
- `src/game/tests/cardObjects.test.ts`

Work:

- When `nextSelection()` begins targeting from a player card, bring that acting
  card into the player row window before repaint.
- During targeting, allow navigation of any row that contains legal targets.
  Navigating must not call `cancel()`, clear selected card snapshots, or drop
  completed picks.
- Ensure `showConnector()` gracefully no-ops when either endpoint is off-window,
  and redraws correctly once both endpoint cards are visible.
- Ensure hover previews, `emphasizeIfLegalTarget()`, `emphasizeIfPlayable()`,
  `applyHighlight()`, and concealment updates continue to run for visible cards.
- If a legal target exists only off-window, surface that through range controls
  or row state so the player can discover it without guessing.

Validation gate:

- Tests prove an acting card remains visible after selection starts.
- Tests prove legal targets can be reached and selected after row navigation.
- Tests prove navigation while targeting does not reset `sel` or
  `selectedCardSnapshot`.

Requirements covered:

- `REQ-HANDLAYOUT-6`
- `REQ-HANDLAYOUT-7`
- `REQ-HANDLAYOUT-8`
- `REQ-HANDLAYOUT-11`

## Step 5: Update Scene And Interaction Tests

Files:

- `src/game/tests/tableLayout.test.ts`
- `src/game/tests/cardObjects.test.ts`
- optional new file: `src/game/tests/tableRowWindow.test.ts`

Work:

- Add a draw harness with more than 20 cards in hand.
- Assert that only the visible window is sent to `layoutRow()` or converted into
  `CardView` objects.
- Assert that range labels and offsets update as navigation moves through an
  oversized row.
- Assert that rows keep independent offsets.
- Assert that off-window cards remain present in `game_.state.hand` and can be
  acted on after navigation.
- Adjust any legacy table layout test that expects six compressed cards to
  reflect the new five-card readable threshold.

Validation gate:

- Run:

```bash
bun test src/game/tests/tableLayout.test.ts src/game/tests/cardObjects.test.ts
```

Requirements covered:

- `REQ-HANDLAYOUT-1`
- `REQ-HANDLAYOUT-3`
- `REQ-HANDLAYOUT-4`
- `REQ-HANDLAYOUT-7`
- `REQ-HANDLAYOUT-10`
- `REQ-HANDLAYOUT-12`

## Step 6: Browser Smoke Test

Files:

- no expected source files unless a debug setup is needed

Work:

- Start the existing local dev server.
- Create or seed an oversized-hand scenario with more than 20 total hand cards.
- Inspect the table at the 900x600 game viewport.
- Verify:
  - Full-size visible cards remain readable.
  - World and player rows page independently.
  - Range labels report accurate positions and totals.
  - Play, discard, target, hover preview, connector, cancel, confirm, end turn,
    help, settings, and run summary surfaces still behave.
  - Navigation chrome does not overlap table controls.

Validation gate:

- Capture at least one desktop screenshot of the oversized hand after navigation
  and confirm the canvas is nonblank and readable.

Requirements covered:

- all `REQ-HANDLAYOUT-*`

## Risks And Mitigations

- **Risk:** Destroying off-window `CardView` objects could interrupt hover or
  connector state.
  **Mitigation:** Clear hover preview/connector on navigation and let `drawAll()`
  reapply visible-card state from durable selection ids.

- **Risk:** Navigation controls can crowd the already dense bottom row.
  **Mitigation:** make the controls small, row-local, and visible only on
  overflow. Validate visually at the fixed game viewport.

- **Risk:** Scene tests may need brittle access to private fields.
  **Mitigation:** keep the pure windowing model heavily tested and use existing
  prototype-based scene harnesses only for integration boundaries.

## Definition Of Done

- Oversized hand rows no longer compress all cards into unreadable overlap.
- Every in-hand card remains reachable without changing game rules.
- Existing targeting, previews, connectors, and confirmation behavior continue
  for visible cards.
- Pure layout/window tests and scene interaction tests pass.
- Manual browser smoke confirms the oversized-hand state is playable and table
  chrome remains coherent.

