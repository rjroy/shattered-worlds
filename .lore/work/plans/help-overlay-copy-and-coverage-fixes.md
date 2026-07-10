---
title: "Implementation plan: help overlay copy and coverage fixes"
date: 2026-07-09
status: executed
tags: [help-overlay, ui-copy, phaser, keywords, rarity, regression-test]
modules: [game-view]
related:
  - .lore/reference/client/story-detail-and-help-screen-decisions.md
  - .lore/reference/client/full-screen-overlay-input-blocking-pattern.md
  - .lore/reference/client/phaser-text-heavy-overlay-tradeoffs-lesson.md
  - .lore/reference/cards/rarity-and-weighted-reward-pools.md
  - .lore/reference/engine/effects-and-keywords/persistent-keyword-cost-modifiers.md
  - .lore/reference/engine/effects-and-keywords/numeric-keywords-and-scaled-effects.md
  - .lore/work/specs/fog-beach-party.md
---

# Implementation plan: help overlay copy and coverage fixes

## Source

A manual review of `src/game/view/HelpOverlayView.ts` against the current engine (keywords, effects, icons, rarity) found one factual error and several coverage gaps. This plan fixes all of them. No item from the review is dropped — the table below is the traceability checklist; every row must show `fixed` before this plan moves to `executed`.

<table style="width:100%; border-collapse:collapse; font-size:0.92em;">
<tr style="background:#222; color:#eee;">
<th style="text-align:left; padding:6px 8px;">#</th>
<th style="text-align:left; padding:6px 8px;">Finding</th>
<th style="text-align:left; padding:6px 8px;">Resolution</th>
<th style="text-align:left; padding:6px 8px;">Steps</th>
</tr>
<tr><td style="padding:6px 8px;">1</td><td style="padding:6px 8px;">"Hidden" keyword name is stale (renamed to "Obstructed")</td><td style="padding:6px 8px; color:#e0a526;">Text fix</td><td style="padding:6px 8px;">Step 1</td></tr>
<tr><td style="padding:6px 8px;">2</td><td style="padding:6px 8px;">Exhaust vs. Vanish vocabulary drift</td><td style="padding:6px 8px; color:#e0a526;">Source-of-truth fix (2nd file)</td><td style="padding:6px 8px;">Step 2</td></tr>
<tr><td style="padding:6px 8px;">3</td><td style="padding:6px 8px;">Icons page missing 5 of 26 IconIds</td><td style="padding:6px 8px; color:#4a90d9;">Layout refactor + new rows</td><td style="padding:6px 8px;">Steps 3–4</td></tr>
<tr><td style="padding:6px 8px;">4</td><td style="padding:6px 8px;">onDraw hazard trigger undocumented (Turn page + Icons strip)</td><td style="padding:6px 8px; color:#4a90d9;">Layout refactor + new rows</td><td style="padding:6px 8px;">Step 5</td></tr>
<tr><td style="padding:6px 8px;">5</td><td style="padding:6px 8px;">No rarity explanation anywhere</td><td style="padding:6px 8px; color:#4a90d9;">New compact legend</td><td style="padding:6px 8px;">Step 6</td></tr>
<tr><td style="padding:6px 8px;">6</td><td style="padding:6px 8px;">No general keyword-cost-modifier explanation</td><td style="padding:6px 8px; color:#4caf50;">Resolved — no new copy needed (rationale in Step 4)</td><td style="padding:6px 8px;">Step 4</td></tr>
<tr><td style="padding:6px 8px;">7</td><td style="padding:6px 8px;">Hand size stated as a flat number</td><td style="padding:6px 8px; color:#e0a526;">Text fix</td><td style="padding:6px 8px;">Step 7</td></tr>
</table>

Research pass (lore-researcher + Explore agents) confirmed every finding against `.lore/reference/` and live source — nothing here rests on the original review's memory alone. Key confirmations and constraints carried into the steps below:

- `Hidden` → `Obstructed` is a known, already-diagnosed rename (`src/core/model/types.ts`), not a guess.
- `onDraw` is a real 5th `WorldCard` reaction field, added for Eden Prime's Alarm mechanic, alongside `onCleared` / `onPartialClear` / `onDiscarded` / `onEndOfTurn`.
- Rarity is 5 tiers (`common` 80w / `uncommon` 40w / `rare` 20w / `legendary` 10w / `signature` 160w-always-present), styled entirely in `src/game/view/rarity.ts` — no presentation strings exist in `src/core/model/rarity.ts` by design, so any prose is new copy, not a reused string.
- **Constraint**: any keyword row added to help text must render as a "Name value" chip, not bare joined text (`REQ-FOG-5`, already binding on `HelpOverlayView.ts`). No new row in this plan renders a live keyword value, so this constraint is inherited but not directly exercised — flagged in case a step's scope grows during implementation.
- **Constraint**: the grief-arc trilogy's help copy (`questions`/`answers`/`the-beginning` `meta.ts`) deliberately never names the Kübler-Ross stages — it describes mechanics only ("Bargaining taxes every other card"). Any new *generic* copy this plan adds must hold the same line: describe "keywords can raise or lower clear cost," never narrate that the specific keyword set maps onto grief stages.
- **Constraint** (`.lore/reference/client/phaser-text-heavy-overlay-tradeoffs-lesson.md`): if a page needs scrolling to fit new content, that's a signal to redesign, not to hand-roll a Phaser scroll view. This plan treats "must fit without scrolling" as a hard constraint on every layout step.
- "Exhaust" is the term used consistently across every per-world help note already shipped (`highway-volcano`, `overgrown-mall`); "Vanish" is copy drift confined to `effectTooltips.ts` and the Icons page. Confirmed, not assumed.

## Layout ground truth (Icons page)

`src/game/view/HelpOverlayView.ts` lines 687–885. Local coordinate space (container origin at canvas center) has a de-facto safe content box of **x ∈ [-380, 380], y ∈ [-200, 230]** — no enforced mask, purely convention from where the title/subtitle/Prev-Next chrome sit on every page.

A fresh-eyes plan review re-derived this budget with row-footprint math (a row's visual span is `[y-11, y+13]`, ~24px, since name text sits at `y-11` and single-line gloss ends around `y+13`) and found the original draft's numbers didn't support its own conclusions. Corrected budget:

- **Left column** (`leftX = -360`): last existing row (`heat`) visual bottom ≈83. Hazard Triggers panel top edge y=160. **77px free.** Needing 3 new rows (`progressCost`, `freeze`, `thaw`) at a 25px tail-only spacing fits with 2px to spare — see Step 4 for exact coordinates.
- **Right column** (`rightX = 40`): last existing row (`vanish`) visual bottom ≈139. Panel top edge y=160. **21px free** — genuinely too tight for even 1 new row at the ~24px minimum footprint (a naive append overlaps by several px). Fixed in Step 4 by shrinking the Hazard Triggers panel height slightly (70→58, same center) to buy back the needed clearance, rather than by cramming multiple rows into an already-negative budget the way the original draft did.
- **Hazard Triggers strip** (`addPanel(page, 0, 195, 750, 70)`, 4 items at `y=194`, `trigWrap=150`): panel spans x ∈ [-375, 375]. The safe non-overlap rule for `addIconRow` is `wrapWidth <= gap - 31` (icon centered on `x`, text starting at `x+20`). The original 4-item layout (gaps 182–197, `trigWrap=150`) passes this by 1px — already at its own margin. A naive 750/5=150px even split with `trigWrap≈130` **fails** the same rule by 11px (`130 > 150-31`). Fixed in Step 5a using the existing ~182px gap convention instead of a naive even split.
- `progressCost` and `onDraw` currently share texture art with `progress` and `worldDraw` respectively (`EFFECT_ICON_TEXTURES` in `src/game/view/effectLineLayout.ts`, lines 52–53) — a new row for either will show a duplicate glyph, distinguished only by its text label. Commissioning distinct icon art is out of scope for this plan; flagged as a follow-up, not a blocker.
- **Rarity legend relocated to the Hazards page.** The combined new-content need (4 icon rows + a 5-swatch rarity legend) doesn't fit in the Icons page's ~98px of total column slack even with tightening. The Hazards page's right panel (`addPanel(page, 250, 72, 245, 245)`, top edge -50.5, bottom edge 194.5) has its last existing content (the "Example: Explore adds..." line) ending ≈114, leaving **~80px free** — a better-fitting, thematically sound host since rarity applies to both hazard and player cards and this page already demonstrates "reading a card." See Step 6.

This is why Steps 3–6 lead with a structural layout fix and an explicit space budget rather than hand-placing more magic-number coordinates on a page that was already oversubscribed before any new content was added.

---

## Steps

<div style="border-left:3px solid #4a90d9; padding-left:12px; margin:8px 0;">

### Step 1 — Fix the stale "Hidden" keyword name

**File:** `src/game/view/HelpOverlayView.ts`

Two occurrences, both plain text edits, no layout risk:
- Line ~599: `"Example: Explore adds 1 Progress, or 1 Progress against Hidden."` → replace `Hidden` with `Obstructed`.
- Lines ~658–659: `"If a player card says it gets a bonus against Hidden, Creature, or Slow, ..."` → replace `Hidden` with `Obstructed`.

Do this first — it's independent of every other step, zero layout impact, and fixes the one item that's an outright factual error (the demo effect two lines above the second occurrence already renders `Obstructed` via `compileEffect`, so today the callout text contradicts the card it's pointing at).

**Validation gate:** grep the file for the literal string `Hidden` afterward — zero matches.

</div>

<div style="border-left:3px solid #4a90d9; padding-left:12px; margin:8px 0;">

### Step 2 — Standardize on "Exhaust" (root-cause fix, touches a second file)

**Files:** `src/core/view/effectTooltips.ts` **and** `src/game/view/HelpOverlayView.ts`

**2a.** In `effectTooltips.ts`, the `vanish` entry's `title` is currently `"Vanish"`; change it to `"Exhaust"`. Leave the `IconId` value (`"vanish"`), the texture key, and the body copy untouched — only the display title changes.

**2b.** `HelpOverlayView.ts` does **not** currently read this table for the `vanish` row — verify before editing, since an earlier draft of this plan wrongly assumed it did. The Icons page's `vanish` row (around line 829) is a hardcoded `addIconRow` call:
```ts
addIconRow(
  page, rightX, 126, "vanish", "Vanish",
  "This card exhausts — one use, then it is gone.",
  colWrap,
);
```
Change this call to `addIconTooltipRow(page, rightX, 126, "vanish", colWrap)` so it pulls `title`/`body` from the (now-fixed) `EFFECT_ICON_TOOLTIPS.vanish` entry instead of a hardcoded string — this is the same pattern Step 4 uses for every new row, so this row becomes consistent with the rest of the page instead of being the one holdout still hand-typing copy that exists canonically elsewhere.

This is a source-of-truth fix, not a `HelpOverlayView.ts`-local patch: `EFFECT_ICON_TOOLTIPS` is consumed by more than the help overlay (live in-game card tooltips too), and every per-world help note already shipped uses "exhaust" (`highway-volcano/meta.ts`, `overgrown-mall/meta.ts`). Fixing only the table without also fixing the hardcoded call would leave the Icons page showing "Vanish" regardless — 2a alone does not close finding #2.

**Validation gate:** `grep -rn '"Vanish"' src/core src/game` returns nothing (this now genuinely requires both edits); `bun run typecheck`.

</div>

<div style="border-left:3px solid #4a90d9; padding-left:12px; margin:8px 0;">

### Step 3 — Refactor the Icons page from hand-placed coordinates to a computed layout helper

**File:** `src/game/view/HelpOverlayView.ts`, Icons page `build()` (lines ~691–884)

Add a small local helper scoped to the Icons page only (not a file-wide rewrite — the other four pages aren't full and don't need it). Unlike the original draft of this step, this does **not** apply a uniform row height across the whole column — it accepts a per-row gap so existing rows keep their exact authored spacing and only newly-appended rows use a tighter gap:

```ts
function layoutIconColumn(
  page: Phaser.GameObjects.Container,
  x: number,
  startY: number,
  rows: ReadonlyArray<
    | { kind: "header"; label: string; gap: number }
    | { kind: "icon"; iconId: IconId; wrapWidth?: number; nameColor?: string; gap: number }
  >,
): number {
  let y = startY;
  for (const row of rows) {
    if (row.kind === "header") {
      addIconSectionHeader(page, x, y, row.label);
    } else {
      addIconTooltipRow(page, x, y, row.iconId, row.wrapWidth, row.nameColor);
    }
    y += row.gap;
  }
  return y;
}
```

Replace the current left-column and right-column call sequences with two `layoutIconColumn` invocations. For every **existing** row, set `gap` to the value that reproduces its current authored y-coordinate exactly (27, 30, 30, 29, 27, 30, 30, 30, 30 for the left column's existing 10 items in order; the equivalent authored gaps for the right column's existing 12 items) — this step's own validation gate depends on this being a true no-op for existing content. Step 4 then appends new rows to each column's spec array using a smaller `gap` (computed there, not here) — this refactor only builds the mechanism; it does not itself change any row's position.

Do **not** refactor the Hazard Triggers strip in this step — that's a distinct layout problem (horizontal, not vertical) and belongs in Step 5.

**Rationale:** the right column is already down to 21px of free space with the current row set. Hand-placing more magic-number y-coordinates on top of a page that's already nearly overflowed is exactly the fragility that let the "Hidden" bug and the missing-icon gaps go unnoticed — a computed, gap-driven helper makes every future addition (icon rows now, whatever comes next) safe by construction instead of by luck, without requiring a global re-layout every time.

**Validation gate:** `bun run typecheck`; visual screenshot of the Icons page shows byte-for-byte identical row positions and text to before the refactor for all existing rows (this is now literally achievable, since the refactor makes zero position changes — Step 4 is where new positions appear).

</div>

<div style="border-left:3px solid #4a90d9; padding-left:12px; margin:8px 0;">

### Step 4 — Add the 4 missing non-trigger icon rows (`progressCost`, `freeze`, `thaw`, `randomCard`)

**File:** `src/game/view/HelpOverlayView.ts`, Icons page

A fresh-eyes plan review found the original 3-rows-in-the-right-column split doesn't fit: the right column only has 21px of slack, below the ~24px minimum row footprint even for a single new row. Corrected distribution, weighted toward the column with real headroom:

- **Left column** — append `progressCost`, `freeze`, `thaw` (3 rows) after the `heat` row, each using `addIconTooltipRow` so copy is pulled verbatim from `EFFECT_ICON_TOOLTIPS` (`progressCost`: "Extra cost" / "Increased cost based on keyword modifiers."; `freeze`: "Freeze" / "Frozen cards cannot be played until thawed."; `thaw`: "Thaw" / "Remove frozen state from player cards.") — do not invent new wording. Use a 25px gap for just these 3 new rows (existing rows keep their current gaps per Step 3): `heat(70) → progressCost(95) → freeze(120) → thaw(145)`. Row footprints: progressCost `[84,108]`, freeze `[109,133]`, thaw `[134,158]` — each clears the previous by 1px, and the final row clears the panel's post-shrink top edge (y=166, see the right-column note below) by 8px. `freeze`/`thaw` land in the left column purely for space, not thematic grouping with "Make Progress" — acceptable, note it as a placement-of-convenience if it reads oddly during Step 9's visual check.
- **Right column** — append `randomCard` only, after `vanish`. The column has no room for even this one row at the current panel-top boundary (160), so pair this addition with a small, justified panel adjustment: shrink the Hazard Triggers panel height from 70 to 58 (`addPanel(page, 0, 195, 750, 58)` — same center y=195, so the strip itself is unaffected; a single row of small icons/text never needed 70px of panel height to begin with). This moves the panel's top edge from 160 to 166. Add `randomCard` at `y=150` (24px gap from `vanish` at 126) via `addIconTooltipRow`, pulling `EFFECT_ICON_TOOLTIPS.randomCard` ("Random card" / "Gain a random card from a named pool — the reward, not a specific card or tier, is guaranteed."). Footprint `[139,163]`, clearing the new panel top (166) by 3px.

Both distributions are tight by design — this is a genuinely full page. Step 9's visual check is not optional here; if either footprint calculation is off by even a few px once real font metrics render, nudge the affected gap down by 1-2px rather than reintroducing a global re-layout.

**Resolves finding #6 (general keyword-cost-modifier explanation) with no new copy:** the `progressCost` row's existing canonical tooltip ("Increased cost based on keyword modifiers") is the generic explanation of the mechanic. The specific keyword names and values (Alarm, Denial, Bargaining, Anger, Lockdown, Reroute, Acceptance) are already documented per-world in each world's `WorldHelpData.mechanics` (the World tab), which this plan intentionally does not duplicate — the research pass found the grief-arc worlds' notes already explain their own cost-modifier mechanics mechanically (e.g. "Every point of Bargaining on a card raises what every other card in your hand costs to clear"), and duplicating that generically would risk re-narrating the grief metaphor the trilogy's own copy deliberately avoids naming. If a future reviewer wants a dedicated cross-world "Keywords" page, that's a new scope decision, not something silently owed by this plan.

**Known limitation to accept, not fix here:** `progressCost` shares texture art with `progress` (both use `effect-icon-progress`) — the two rows will show visually identical glyphs, distinguished by label text only. Commissioning a distinct `progressCost` icon texture is out of scope; note it as a follow-up if it reads as confusing during Step 9's visual check.

**Validation gate:** visual check confirms all 4 new rows render fully inside the safe content box (no overlap with the Hazard Triggers panel below or the page title above); `bun run typecheck`.

</div>

<div style="border-left:3px solid #4a90d9; padding-left:12px; margin:8px 0;">

### Step 5 — Add `onDraw` as the 5th hazard trigger (Icons strip + Turn page)

**File:** `src/game/view/HelpOverlayView.ts`

Two sub-edits, both needed — `onDraw` is documented nowhere today:

**5a. Icons page "Hazard Triggers" strip** (lines ~841–883): the current 4-item strip at fixed x-positions (`-360, -178, 19, 206`) with `trigWrap=150` has no room for a 5th item at that spacing. A naive even 750/5=150px split with a narrower `trigWrap≈130` was checked by plan review and **fails** the strip's own non-overlap rule (`wrapWidth <= gap - 31`): `130 > 150-31=119`. Use the existing ~182px gap convention instead — it's what the original 4-item layout already relies on (passes the same rule by 1px: `150 <= 182-31=151`). Five items at a 182px gap, centered on 0: `x_i = -364, -182, 0, 182, 364` — spans the 750px panel (half-width 375) with an 11px margin on each end. Keep `trigWrap=150` unchanged. Add the 5th item as `onDraw` / label "When drawn" / gloss from `EFFECT_ICON_TOOLTIPS.onDraw.body` ("Fires when the hazard is drawn.") with its own trigger color (pick one not already used by the other four, or reuse `TEXT.textLight` if no thematic color fits).

*Fallback if the visual check in Step 9 shows this is still too tight:* grow the panel to two rows (`h≈110`, 3 items top row / 2 items bottom row) and shift its top edge up — but only if the primary computed-split approach visibly fails; don't default to the fallback pre-emptively.

**5b. Turn page "Hazard reactions use icons" panel** (lines ~477–536): the panel currently has 4 `addIconRow` calls at `y = -68, -6, 56, 118` (62px spacing) inside a panel of height 335 centered at y=10 (bottom edge ≈177.5). A naive 5th row at `y=180` would sit ~2.5px past the panel's bottom edge — add the 5th row (`onDraw` / "When drawn" / "Fires when the hazard is drawn, before you've had a chance to react.") and either (a) tighten the existing 62px spacing slightly (to ~58px) so 5 rows fit within the current panel height, or (b) grow the panel height by ~15–20px and shift the "If the next draw phase..." warning text below it down to match. Prefer (a) first — it's a smaller, more contained change.

**Validation gate:** visual check on both the Turn page and Icons page confirms 5 distinct, non-overlapping trigger rows/items, each legible against its panel background.

</div>

<div style="border-left:3px solid #4a90d9; padding-left:12px; margin:8px 0;">

### Step 6 — Add a compact rarity legend (relocated to the Hazards page)

**File:** `src/game/view/HelpOverlayView.ts`, Hazards page (not the Icons page — see rationale below)

A fresh-eyes plan review found the Icons page doesn't have room for both the 4 icon rows from Step 4 and a rarity legend — total new-content need exceeds the page's combined column slack even with tightening. The Hazards page's existing right panel (`addPanel(page, 250, 72, 245, 245)`, lines ~575–606) has real headroom: its last content ("Example: Explore adds..." at y=102) ends ≈114, and the panel's bottom edge is 194.5, leaving **~80px free**. This page already demonstrates "reading a card," and rarity applies to both hazard and player cards, so it's a better-fitting host than forcing more content onto an already-full reference page.

New imports: `rarityStyle` from `src/game/view/rarity.ts`, `RARITY_ORDER` from `src/core/model/rarity.ts`.

Within that panel, after the existing "Example: Explore adds..." text:
- Header "Rarity" (reuse the existing header text style used elsewhere on this page) at `y=126`.
- One row of 5 small filled circles at `y=150`, looping `RARITY_ORDER`, colored via `rarityStyle(tier).color`, spaced across the panel's ~210px usable width (e.g. x offsets `-80, -40, 0, 40, 80` relative to the panel's own x=250) — panel-relative, so actual scene x = `250 + offset`.
- One tiny caption line per swatch at `y=164` using `rarityStyle(tier).label`.
- One closing prose line at `y=182` describing the actual rendering mechanism, not invented flavor text — source it from `CardView.ts`'s real implementation (lines ~259–274): rarity shows as a colored outline-and-glow around a card's edge (not a fill, not the card art), alpha 0.5, and higher tiers glow more strongly (`glowStrength` 1/3/5/7/3 for common/uncommon/rare/legendary/signature). Something close to: *"A card's rarity shows as a colored glow around its edge — brighter and stronger at higher tiers."*

All of this fits within the panel's 194.5 bottom edge (last line at y=182, well clear).

Do not name drop rates or weights (`RARITY_WEIGHTS`) — that's meta-progression detail, not something a mid-run help overlay needs to teach.

**Validation gate:** visual check confirms all 5 swatches are distinguishable against the panel background (`0x101725`) and legible at the small size this page uses elsewhere (~10–12px labels); `bun run typecheck`.

</div>

<div style="border-left:3px solid #4a90d9; padding-left:12px; margin:8px 0;">

### Step 7 — Soften the flat hand-size claim

**File:** `src/game/view/HelpOverlayView.ts`, Turn page (line ~447)

Current: `` `Draw up to ${WORLD_CONSTS.baseHandSize} cards. World cards are hazards; player cards are tools.` ``. `effectiveHandSize()` (`src/core/engine/world.ts`) can exceed `baseHandSize` via act index and unlocks, so a flat number overpromises. Change to something like: `` `Draw up to your hand size (starts at ${WORLD_CONSTS.baseHandSize}). World cards are hazards; player cards are tools.` ``. Low-risk text-only change; keep the exact wording flexible for whoever implements — the requirement is "don't state a number that isn't always true," not this exact phrasing.

**Validation gate:** `bun run typecheck`; visual check the line still fits its existing `wordWrap` width without new overflow.

</div>

<div style="border-left:3px solid #4a90d9; padding-left:12px; margin:8px 0;">

### Step 8 — New regression-guard test

**File (new):** `src/game/tests/helpOverlayView.test.ts`

No test file exists for `HelpOverlayView.ts` today. A fresh-eyes plan review found two problems with the original approach here that would have produced a test that looks like coverage but isn't — both are fixed below.

**8a. Architecture check before writing the test.** `settingsOverlayView.test.ts`'s `Object.create` + prototype-stub pattern only works because `SettingsOverlayView` was deliberately refactored to extract a `private build(scene, settings)` method, callable independently of the constructor (see the rationale comment at `SettingsOverlayView.ts` lines 87-90 — an ES6 constructor can't be re-applied via `.call()`, which is why the extraction exists). `HelpOverlayView`'s entire construction (tabs, pages, panels) lives inline in the constructor body — there is no separable `build()` method. Before writing the test:
- First try direct construction: `new HelpOverlayView(fakeScene, worldId, totalActs)` against a fake scene built the same way `settingsOverlayView.test.ts` builds one (`makeFakeRect`/`makeFakeText`/`makeFakeContainer`-style stubs), and see whether the real `Phaser.GameObjects.Container` base constructor runs cleanly under the `happy-dom` + stubbed-canvas test harness already set up in `testSetup.ts`.
- If it does, no refactor is needed — proceed with assertions below using the real instance.
- If the base constructor fails or misbehaves the way it apparently did for `SettingsOverlayView` (motivating that extraction), add a preliminary sub-step: extract a `private build(scene, worldId, totalActs)` method from `HelpOverlayView`'s constructor, mirroring `SettingsOverlayView`'s documented rationale, before writing the test against it. This is a mechanical extraction (move the constructor body into a method, call it from the constructor) — not a design change — but it is real work this plan must account for rather than assume away.

**8b. Assertions**, in order of value:

1. **Completeness guard (the systemic fix — this is what should have caught the original gap).** The original draft of this test tried to capture icon coverage by recording `add.image` texture keys and inverting `EFFECT_ICON_TEXTURES` back to `IconId`s — plan review found this doesn't work: `EFFECT_ICON_TEXTURES` is not invertible (`progressCost`/`progress` share `"effect-icon-progress"`, `onDraw`/`worldDraw` share `"effect-icon-world-draw"`), so a texture-key-based capture cannot tell whether the `progressCost` or `onDraw` rows exist at all — two of the five icons this plan exists to add. Capture at the **text level** instead, which sidesteps texture sharing entirely: record every string passed to the fake `add.text` stub across all pages, then assert that for every entry in `EFFECT_ICON_TOOLTIPS`, its exact `title` string appears somewhere in the captured set (exact match against a captured entry, not substring search, to avoid false positives from unrelated text). This is sourced from the canonical tooltip table, so it also guards against future drift — a 27th `IconId` added later without a corresponding help-page row fails this test the same way.
2. Assert the literal substring `"Hidden"` does not appear in any captured `add.text` string, across all 5 pages — regression guard for Step 1.
3. Assert the literal substring `"Vanish"` does not appear in any captured `add.text` string — regression guard for Step 2.
4. Assert tab count is 5 with labels `["Turn", "Hazards", "Tools", "Icons", "World"]`, and `updatePage` wraps correctly at both ends (existing behavior, cheap to cover since there's no coverage today).
5. Assert the World tab renders one panel per `helpData.mechanics` entry for a sample `worldId` (basic regression on the per-world loop, cheap to add alongside the others).

**Validation gate:** `bun run test` passes, including this new file.

</div>

<div style="border-left:3px solid #4a90d9; padding-left:12px; margin:8px 0;">

### Step 9 — Manual visual verification (cannot be skipped — this is Phaser canvas layout)

Typecheck and unit tests cannot catch silent visual overlap in hand-positioned Phaser containers — the Step 8 tests guard *content coverage*, not *pixel layout*. Launch the dev server (`bun run dev`, or via the `run` skill) and, in a browser:

1. Open the help overlay for at least one world.
2. Click through all 5 tabs. On **Icons**, confirm: both columns show all rows with no overlap (left column's new `progressCost`/`freeze`/`thaw` rows especially — they're the tightest fit in the plan), the shrunk Hazard Triggers panel still comfortably fits its now-5-item strip, and the `randomCard` row above it doesn't crowd the panel's new top edge.
3. On **Turn**, confirm the 5th hazard-reaction row fits inside its panel without spilling past the panel border or crowding the "If the next draw phase..." warning text below it.
4. On **Hazards**, confirm the Step 1 text change ("Obstructed") renders correctly without overflowing its `wordWrap` bounds (word length changed from "Hidden" 6 chars to "Obstructed" 10 chars — check this didn't push a line wrap), and confirm the new rarity legend (Step 6) fits inside the right panel with all 5 swatches distinguishable and no overlap with the "Example: Explore adds..." text above it.
5. On **Tools**, confirm the Step 1-adjacent text ("Hidden, Creature, or Slow" → "Obstructed, Creature, or Slow") renders correctly.
6. On **Icons**, also confirm the `vanish` row (Step 2b) now reads "Exhaust" rather than "Vanish."
7. Screenshot each modified page for the record (attach to the implementation notes, not this plan).

**Validation gate:** no visual overlap, clipping, or off-canvas content anywhere in the modified pages. If any layout step's primary approach fails this check, apply that step's documented fallback (Step 5) or return to Step 3's row-height tuning (Step 4/6) before proceeding.

</div>

<div style="border-left:3px solid #4a90d9; padding-left:12px; margin:8px 0;">

### Step 10 — Full check suite

```sh
bun run test
bun run typecheck
bun run lint
bun run build
```

All four must pass clean. This is a UI-copy/layout change touching two files (`HelpOverlayView.ts`, `effectTooltips.ts`) plus one new test file — `bun run test` is the minimum bar per project convention, but given the cross-file tooltip change in Step 2 and the layout refactor in Step 3, run the full sequence rather than just the targeted test file.

</div>

<div style="border-left:3px solid #4caf50; padding-left:12px; margin:8px 0;">

### Step 11 — Final validation against the source findings

Re-check the traceability table at the top of this document against the finished diff. Every row must be either `fixed` (text/behavior changed) or `resolved — no action` (Step 4's explicit rationale for finding #6) — none left `open`. If Step 9's visual check forced a fallback layout, note which fallback was used and why, so a future editor of this file understands the actual constraint rather than re-deriving it from scratch.

</div>

## Explicitly out of scope

- Commissioning distinct icon art for `progressCost` (shares `progress`'s texture) or `onDraw` (shares `worldDraw`'s texture) — flagged as a follow-up, not blocking.
- A dedicated cross-world "Keywords" glossary page explaining Alarm/Lockdown/Reroute/Denial/Anger/Bargaining/Depression/Acceptance individually — the research pass concluded this is already covered per-world and duplicating it risks breaking the grief-arc trilogy's deliberate non-naming of the Kübler-Ross metaphor (see Step 4 rationale).
- Renaming the `IconId` value `"vanish"` or its texture key — only the display title changes (Step 2); a full identifier rename is a larger, unrelated refactor.
- Any DOM-based help overlay redesign — explicitly rejected by prior lore (`phaser-text-heavy-overlay-tradeoffs-lesson.md`); this plan works within the existing in-canvas Phaser approach.
