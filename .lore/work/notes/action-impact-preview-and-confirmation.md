---
title: "Implementation notes: action-impact-preview-and-confirmation"
date: 2026-06-19
status: in_progress
tags: [implementation, notes, action-preview, confirmation, settings]
source: .lore/work/plans/action-impact-preview-and-confirmation.md
modules: [core, game-ui, interaction, settings]
---

# Implementation notes: action-impact-preview-and-confirmation

## Progress

- [x] Phase 1: Add pure action preview types and engine
- [x] Phase 2: Add concealment-safe preview masking (REDESIGN: event provenance)
- [x] Phase 3: Expose preview through core and runtime
- [x] Phase 4: Add extensible user settings store
- [x] Phase 5: Build settings overlay view
- [x] Phase 6: Replace targeted hover preview with unified preview
- [x] Phase 7: Add idle world-card and end-turn previews
- [x] Phase 8: Add confirmation modal view
- [x] Phase 9: Gate dispatch through confirmation
- [x] Phase 10: Integrate terminal, boon, and selection cleanup
- [~] Phase 11: Full validation

## Log

### 2026-06-19

- Initialized from `.lore/work/plans/action-impact-preview-and-confirmation.md`.
- No task breakdown directory was present at `.lore/work/tasks/action-impact-preview-and-confirmation/`; plan steps are being used as phases.
- No `.lore/lore-agents.md` registry was present; using the available generic sub-agent roles for implementation, testing, and review.
- Lore research found the main related context: existing narrow `previewPlay`, separate `previewSlot`, effective-card selected snapshots, Help overlay patterns, guarded localStorage patterns, and concealment behavior from Fog Beach Party. No existing action-preview/settings/confirmation implementation was present.
- Phase 1 added `src/core/view/actionPreview.ts`, exported preview types/helpers through `src/core/contract.ts`, and added `src/core/tests/actionPreview.test.ts`.
- Phase 1 review found world-card additions represented by `CardGained` were not classified as `attention`. The fix now treats `worldDraw` and `worldDrawTop` `CardGained` events as attention/warning and covers both destinations in tests.
- Phase 1 validation passed after correction: focused action preview tests reported 10 passing cases, typecheck passed in the testing pass, and final review found no Phase 1 non-conformances.
- Phase 2 added concealment masking for action previews and expanded `src/core/tests/actionPreview.test.ts`.
- Phase 2 first review found concealed EndTurn handling over-suppressed visible hook consequences and could leak concealed resource/draw/shuffle hook events. A correction replaced broad suppression with hook-segment suppression and added regressions.
- Phase 2 re-test then found downstream EndTurn discard/draw/deck summaries could still reveal concealed draw/shuffle hooks. A second correction added taint tracking for later player-card discard/draw/shuffle flow and passed focused tests/typecheck.
- Phase 2 final review still found concealed EndTurn leak paths: `ForceDestroy` hooks can reveal later `CardDestroyed` fallout, and concealed world-card-add hooks can reveal exact added hazards through downstream world refill summaries. This hit the two-attempt stuck-loop threshold for the same concealment-masking issue.

### Escalation resolution (Opus session, resuming Codex work)

- Root cause: `GameEvent` carries no provenance, so `actionPreview` re-derives which
  events came from concealed cards by mirroring `reduce`'s emission (`countHookEvents`,
  `countDrawHookEvents`, `countProgressBlocks`). Any drift from `reduce` leaks. The two
  known leaks are this class; more likely lurk. Verified `reduce`/`draw`/`effects` push
  event literals inline (no central emitter), and `applyEffect(catalog, state, effect,
  action?, selfId?)` already threads a firing-card `selfId` at some hook sites.
- DECISION (user, 2026-06-19): adopt **event provenance** as the structural fix.
  - Add optional `sourceCardId?: CardId` to `GameEvent` (intersection over the union).
  - Stamp at the `applyEffect` boundary: when `selfId` is set, tag returned
    `EffectResult.events` whose `sourceCardId` is still undefined (preserve innermost).
  - Ensure all four world-card hook resolution sites pass `selfId`: `onEndOfTurn`
    (reduce:151 already does), `onDiscarded` (reduce:126 does NOT yet), `onCleared` /
    `onPartialClear` (dealProgress, to verify/thread).
  - Rewrite `actionPreview` masking to: any event whose `sourceCardId` resolves to a
    concealed world card is genericized/dropped. Delete the `countHookEvents` mirror
    machinery (`countHookEvents`, `countDrawHookEvents`, `countProgressBlocks`,
    `concealedEndTurnHookSuppression`, `eventSliceHasTerminal`, player-card-flow taint).
  - This supersedes the original plan Step 2's event-counting approach.

- Phase 2 IMPLEMENTED (provenance): `GameEvent` gained optional `sourceCardId`;
  `applyEffect` stamps it from `selfId` (innermost-wins, immutable). Hook sites threaded:
  `onEndOfTurn` (reduce), `onDiscarded` (reduce), `onCleared`/`onPartialClear`
  (dealProgress). `actionPreview` masking rewritten to provenance; the entire
  `countHookEvents` mirror deleted.
- Phase 2 review (fresh context) found NO blockers and NO spec leak (REQ-ACTIONPREV-20..24),
  but two conservative concerns tied to the one deferred effect (`ForceDestroy`, queued into
  numeric `pendingForceDestroy`, emitted later at turn start): (a) `BraceConsumed` hinted a
  concealed snatch; (b) the ForceDestroy taint over-masked co-firing VISIBLE hooks.
- Phase 2 completion: threaded provenance through the deferred path too. Added
  `pendingForceDestroySource?: CardId` to `GameState` (first-wins), recorded in
  `ForceDestroyHandler`, stamped on the deferred `CardDestroyed`/`BraceConsumed` in
  `resolveForceDestroy`, cleared on every reset. Deleted the static ForceDestroy detection +
  its taint. Both concerns resolved. No RNG/order/state behavior changed.
- IRREDUCIBLE special case (documented, kept): a concealed hook that ADDS a card to the world
  deck — the later refill's `HazardAdded`/`CardsDrawn` are unstamped (emitted by drawWorld, not
  a hook), so a small downstream "taint" masks them. This is the one remaining non-provenance
  mask and is intentional.
- Phase 2 final state: typecheck clean; core suite 427 pass / 0 fail; full suite 989 pass / 0 fail.

- Phase 3 IMPLEMENTED: `GameCore.preview(action)` (game.ts) delegates to `previewAction(catalog,
  current, action)` with no mutation; `GameplaySession.preview` delegates to core with NO
  stream emit / stats / closeRun / state change (does not guard on runEnded — pure read).
  Tests assert state ref unchanged (`toBe`) and subscriber spy silent on preview but firing on
  dispatch. `ActionPreview` already reachable via core/index → contract. Review skipped by
  triviality (2-line delegators, gates asserted by tests). typecheck clean; session tests 27/0;
  core 427/0.

- Phase 4 IMPLEMENTED: `src/game/runtime/userSettings.ts` — `UserSettings { version:1,
  confirmationMode: "always"|"risk-only"|"off", detailedHoverPreviews: boolean }`, defaults
  `always`/`true`, key `shattered-worlds/settings/v1`. `UserSettingsStore { get, set, update }`,
  guarded load/save mirroring `featsProfile`. Unknown-future-key tolerant on read (validates
  only known keys, re-projects known fields, drops unknown from typed object); whole-object
  fallback to defaults on malformed known key. Wired onto `GameplayRuntime.userSettings` from
  the same `options.storage`; no main.ts change (TableScene already gets the runtime). Tests
  15/0; runtime tests 10/0; typecheck clean.

- Phase 10 IMPLEMENTED: closed lifecycle gaps. (A) `actionConfirmation.hide()` added to
  `showRunSummaryFromStats` + the per-frame terminal cleanup block. (B) ESC: if confirmation
  open → cancel it and return (top-most wins); else close help/settings. (C) help "?"/settings
  "S" button handlers no-op while confirmation open (explicit, commented). (D) boon + isOpen
  guards compose; ChooseBoon stays direct. (E) `previewable:false` → dispatch directly (no blank
  modal; reducer stays authority). (F) SHUTDOWN hide-without-fire confirmed. Tests +3 (cardObjects
  68/0; boon 6/0); full suite 1049/0; typecheck clean.

- Phase 9 IMPLEMENTED: `maybeConfirmOrDispatch(action)` gates the four committed sites
  (DiscardHazard, EndTurn, completed PlayCard, modal-none PlayCard); ChooseBoon stays direct.
  Decision: off→direct; risk-only→confirm iff risk attention|harmful; always→confirm. Stores
  exact action+preview; commit dispatches once (view once-guard). `confirmationTitle`/`safeCardName`
  mask concealed world cards to `CONCEALED_HAZARD` (exported via contract). `cancelConfirmation`
  →idle, clears snapshot/modal/connector/preview, redraw. `isOpen` guards on onCardClick/EndTurn/
  Discard/Confirm/ModalChoose/pointerover/showEndTurnPreview. SHUTDOWN hides (no fire) + abandons.
  Tests 12 new (cardObjects 65/0); full suite 1046/0; typecheck clean.
  Phase 9 REVIEW (fresh context): all 9 PASS, no blockers. CONCERN: `previewable:false` not
  special-cased in the gate (not currently reachable; callers only build legal actions). → fold
  a one-line guard into Phase 10.

- Phase 8 IMPLEMENTED: `src/game/view/ActionConfirmationView.ts` — pure Phaser modal (no
  runtime/dispatch import). `show({title, lines, onCommit, onCancel})`, `isOpen`, `hide`/`close`.
  Blocking full-canvas interactive backdrop. Depth `TABLE_LAYOUT.confirmDepth: 2500` (above
  tooltips 2000). Exactly-once guard: commit/cancel null BOTH callbacks before firing + hide.
  Line cap MAX_LINES=12 ("+N more"); per-show line objects destroyed on hide/next show.
  TableScene instantiates it + hides on SHUTDOWN. Phase-9 seam: held off on uncalled helper
  (avoids no-unused-private-members lint); Phase 9 calls `.show(...)` directly. Tests 7/0;
  full suite 1036/0; typecheck clean.

- Phase 7 IMPLEMENTED: `describeWorldCardHooks(card, state)` in describe.ts (reuses
  `describeEffect`; concealed → only `"Effect is concealed. Beware."`; visible → "End of turn:"
  + "If discarded:" gated on `card.discardable` field, the engine's own discard gate). TableScene
  idle `pointerover` branch → `showIdleWorldPreview(card)` (only when `sel.phase==="idle"`);
  `showEndTurnPreview()` on `endTurnBtn` pointerover (gated to idle/interactive), previews
  `game_.preview({type:"EndTurn"})`. Off-mode trimming via `minimalPreviewLines`. No new
  interactive overlays (handlers on existing button; renders into previewSlot). Idle vs targeted
  separated by phase (mutually exclusive). describe tests 4/0; cardObjects 55/0 (8 new). CHECKPOINT
  full suite 1029/0, typecheck clean.

- Phase 6 IMPLEMENTED: `showTargetPreview` now builds the candidate action via
  `buildAction(advance(togglePick(this.sel, targetId)))` (identical chain to a real click; uses
  `actingPlayerCardFor` effective snapshot) and renders `game_.preview(action).summaryLines`
  joined with " · " into `previewSlot`. `detailedHoverPreviews` off → `minimalPreviewLines`
  keeps first substantive line + every concealment-warning line (matched via new exported
  `isConcealmentWarning`). Partial-intent fallback `renderPartialTargetPreview` for compound
  non-final hazard steps (never prints concealed name). `clearPreviewSlot()`+`clearConnector()`
  paired on hover-out/cancel/modal-cancel/advance/dispatch/terminal. `previewPlay` KEPT in
  describe.ts (still a live oracle for feedback.ts ring-fraction). Core stays Phaser-free.
  Phase 6 REVIEW (fresh context): all 7 areas PASS, no blockers/concerns; action fidelity,
  preview purity, concealment off-mode, clearing all verified with file:line. Suite 1016/0.

- Phase 5 IMPLEMENTED: `src/game/view/SettingsOverlayView.ts` modeled on HelpOverlayView
  (Container, depth 1000, hidden, backdrop + interactive blocking bg). Takes
  `UserSettingsStore` by DI (no runtime/global import). Segmented controls from option tables;
  public handlers `selectConfirmationMode(mode)` / `setDetailedHoverPreviews(bool)` call
  `settings.update` then refresh. `open()`/`close()` helpers; `open()` re-syncs highlights from
  `settings.get()`. Layout: `TABLE_LAYOUT.buttons.settings {818,22}`. TableScene wires "S"
  button, ESC closes whichever overlay is visible, opening one hides the other, terminal paths
  close+hide the settings button. Tests 5/0. Constructor split into `build()` so tests bypass
  the heavy Phaser ctor via Object.create. CHECKPOINT: full suite 1013/0, typecheck clean.
