---
title: Token IR for compact, icon-based card effect rendering
date: 2026-06-12
status: approved
tags: [card-face, icons, rendering, refactor, core-boundary, ui-density]
modules: [core-view, game-view]
related: [.lore/work/design/core-render-architecture.html]
---

# Token IR for compact, icon-based card effect rendering

## Problem

Card faces render effect rules as full English sentences. `CardView` calls
`describeEffect(effect)` and paints the joined prose onto the face
(`src/game/view/CardView.ts:231` for player cards, `addEffectBlock` for the
four world-card trigger blocks). The result is verbose: a world card carries up
to four sentence blocks ("Each turn: …", "If discarded: …", "Clear it: …",
"Partial clear: …"), and player cards with Modal/Sequence effects render every
branch as prose. Cards were literally sized around the text (comment at
`CardView.ts:29`).

We want compressed phrasing plus icon-based communication. The blocker is
architectural, not cosmetic: by the time the renderer sees an effect, it is
already a flat string. There is nowhere to attach an icon, and no per-part
styling signal. The existing code already strains against this — `addCardText`
does `line.includes('Progress')` to decide which lines get a glow
(`CardView.ts:105`), string-sniffing the prose to recover structure the
`CardEffect` data had all along.

Icon artwork is explicitly out of scope. This design fixes the contract so art
can be produced and swapped later without touching core.

## Current state

- `src/core/view/describe.ts` — `describeEffect(effect): string[]` is the
  single source of English for effects. Pure, headless, exhaustively
  unit-tested (`src/game/tests/describe.test.ts`). Also feeds
  `branchLabels.ts` (modal chooser) and `previewPlay` (live target preview).
- `src/game/view/CardView.ts` — `addCardText` wraps and splits prose into
  per-line `Text` objects; `addEffectBlock` prefixes world trigger sentences
  and stacks blocks by measured height.
- The `core`/`game` boundary is lint-enforced: anything in `src/core/` must be
  Phaser-free. `describe.ts` sits on the pure side; the new IR must too.

## Design

Insert a structured intermediate representation between `CardEffect` and the
card face. Core compiles effects into **token lines**; the renderer lays out
tokens as icon images and short text runs.

### 1. Token IR in core (`src/core/view/effectGlyphs.ts`)

```ts
/** Closed set of semantic icon identifiers. No Phaser types, no texture keys. */
export type IconId =
  // resources & actions
  | 'progress' | 'progressAll' | 'draw' | 'worldDraw' | 'hp' | 'energy'
  | 'discard' | 'destroy' | 'exile' | 'return' | 'addCard' | 'threat'
  | 'brace' | 'skipDraw' | 'survive' | 'vanish'
  // world-card triggers
  | 'eachTurn' | 'onDiscard' | 'onClear' | 'onPartialClear'

export type EffectToken =
  | { kind: 'icon'; icon: IconId }
  | { kind: 'value'; text: string; emphasis?: 'progress' | 'reward' | 'penalty' }
  | { kind: 'text'; text: string } // connectives ('then', 'vs', 'per', '·') and keyword names

export interface EffectLine {
  tokens: EffectToken[]
  /**
   * 'branch' indents under a Modal header; 'rider' renders smaller (bonus
   * clauses). undefined means 'main' — the renderer treats them identically.
   */
  role?: 'main' | 'branch' | 'rider'
}

export function compileEffect(effect: CardEffect): EffectLine[]
```

**Keywords are deliberately not icons.** `Hidden`/`Creature`/`Slow`/`Spore`
render as plain text wherever they appear (bonus riders, the keyword line).
This caps the icon vocabulary the player must memorize at the resource/action
set plus four trigger icons, and keywords — the most world-specific, fastest-
growing vocabulary in the game — stay self-explanatory. It also removes an
entire failure class: no `Keyword → IconId` mapping exists to drift out of
sync as worlds add keywords.

Properties this must keep:

- **Pure and headless.** Imports core types only. Unit-tested the same way
  `describe.ts` is, kind by kind.
- **Exhaustive switch.** A new `CardEffect` kind fails to compile until it has
  a compact form — the same forcing function `describeEffect` provides today.
  The `switch` over `CardEffect.kind` is the compile-time check; keyword names
  pass through as text tokens, so no parallel keyword mapping exists to keep
  in sync.
- **Semantic, not visual.** `IconId` names what the icon *means*. Texture
  keys, atlas frames, sizes, and colors are renderer concerns.

### 2. Compression vocabulary

The compression itself lives in `compileEffect`, one deliberate phrasing per
effect kind. `[x]` denotes an icon token.

Every member of the `CardEffect` union appears here; the implementation's
exhaustive switch must match this table one-to-one.

| Effect kind | Current prose | Compact tokens |
|---|---|---|
| DealProgress | `Add 3 Progress` `(+2 vs Spore)` | `[progress] 3` + rider `+2 vs Spore` |
| DealProgressScaled | `Add 1 Progress` / `+1 per Spore in hand` | `[progress] 1` + rider `+1 per Spore in hand` |
| DealProgressAll | `2 Progress to every hazard` `(+2 vs Spore)` | `[progressAll] 2 all` + rider `+2 vs Spore` (bonus field, same as DealProgress) |
| Draw (both) | `Draw 2, +1 world` | `[draw] 2 · [worldDraw] +1` |
| Draw (player only) | `Draw 2` | `[draw] 2` |
| Draw (world only) | `+1 world` | `[worldDraw] +1` |
| Draw (neither) | `Draw nothing` | text `draw nothing` (degenerate authoring case; kept for parity) |
| Heal | `Heal 2 HP` | `[hp] +2` |
| Damage | `-2 HP` | `[hp] −2` |
| DamageScaled | `-1 HP` / `-1 per Spore in hand` | `[hp] −1` + rider `−1 per Spore in hand` |
| GainEnergy | `Gain 1 Energy` | `[energy] +1` |
| ReturnWorldCards | `Return 1–2 world cards to the deck` | `[return] 1–2` |
| DestroyCardInHand | `Destroy a card in hand` `(optional)` / `Destroy 2–4 cards in hand` | `[destroy] 1 in hand` + rider `(optional)` / `[destroy] 2–4 in hand` |
| DiscardThenDraw | `Discard a card, then draw 2` | `[discard] 1 then [draw] 2` |
| ExileTopWorldCards | `Exile the top 2 cards of the world deck` | `[exile] top 2` |
| Brace | `Brace: absorb the next snatch` | `[brace] 1` |
| AddCard / GainCard | `Gain a Torch card` | `[addCard] Torch` |
| AddPlayerCardToTop | `+Torch to your deck` | `[addCard] Torch` + rider `top of deck` |
| AddWorldCardToDeck | `+Collapse to world deck` | `[threat] Collapse` |
| AddThreatToWorldDeck | `+theme threat to world deck` | `[threat] +1` |
| SkipDrawNextTurn | `skip next draw` | `[skipDraw] next turn` |
| SurviveWorld | `you survive the world` | `[survive]` + text `survive` |
| ForceDestroy | `destroy a random card from your next hand` | `[destroy] random, next hand` |
| DestroySelf | `vanishes` | `[vanish]` |
| None | `no effect` | `[]` (no lines — matches the face's existing skip of `None` blocks) |
| Modal | `Choose one:` + `• …` bullets | `Choose:` header + indented `branch` lines |
| Sequence | `…` / `then …` | step lines joined with a `then` text token |

Exact wordings are an implementation detail to settle in tests; the table
fixes the *shape* (icon + number + minimal connective, riders for
conditionals). Some effects stay word-heavy (`ForceDestroy`) — that is fine;
the IR permits text tokens, it just stops requiring them.

Note one behavioral divergence from `describeEffect`: `None` compiles to an
empty array rather than a `'no effect'` line. The card face already skips
`None` blocks before describing them (`addEffectBlock` returns early), so the
empty compile encodes that rule once instead of leaving it to every caller.

**Nested composition.** The two composite kinds recurse the same way
`describeEffect` does, with the output shape fixed as follows:

- *Sequence of simple effects* (e.g. Barricade: DealProgress then
  ReturnWorldCards) — one or two steps join onto one line with `then` text
  tokens; three or more steps emit one line per step, continuation lines led
  by `then`. The split is a pure step-count heuristic: `compileEffect` cannot
  measure pixels, so the budget is structural. (Concrete driver: Garden
  Center's 4-step `onCleared` Sequence would otherwise overflow every render.)
- *Modal of simple/sequence branches* (e.g. Sprint: Draw or DealProgress) — a
  `Choose:` header line, then one `role: 'branch'` line per branch. A branch
  that is itself a Sequence joins its steps with `then` inside the single
  branch line.
- *Deeper nesting* (Modal inside Modal, Modal inside Sequence) compiles
  without error but renders at a single indent level — `branch` does not
  stack. No current card nests this deep; if one ever does, revisit then
  rather than designing speculative depth now.
- *Rider binding*: a `rider` line renders at the indent of the line that
  precedes it — a rider following a `branch` line indents with that branch.
  This keeps bonus clauses (e.g. Sprint's `+3 vs Slow`) visually bound to
  their owner without complicating the IR with nesting. When a block has a
  lead trigger icon (§4), the hanging indent is the floor: every line after
  the first hangs at least `hangIndent`, so a rider bound to the first line
  hangs under its text rather than sitting flush with the trigger icon.

<div style="display:flex; gap:24px; align-items:flex-start; margin:12px 0;">
  <div style="border:2px solid #555; border-radius:10px; padding:10px 14px; width:200px; background:#1b1b22; color:#ddd; font-family:monospace; font-size:12px;">
    <div style="text-align:center; font-weight:bold;">Mycelial Surge</div>
    <div style="text-align:center; color:#8fc97f; font-size:10px;">Spore</div>
    <div style="margin-top:8px; background:#000a; padding:6px; border-radius:4px; line-height:1.5;">
      Add 2 Progress<br>(+2 vs Spore)<br>then draw 1,<br>+1 world
    </div>
    <div style="text-align:center; color:#888; font-size:10px; margin-top:8px;">— current: prose —</div>
  </div>
  <div style="border:2px solid #555; border-radius:10px; padding:10px 14px; width:200px; background:#1b1b22; color:#ddd; font-family:monospace; font-size:12px;">
    <div style="text-align:center; font-weight:bold;">Mycelial Surge</div>
    <div style="text-align:center; color:#8fc97f; font-size:10px;">Spore</div>
    <div style="margin-top:8px; background:#000a; padding:6px; border-radius:4px; line-height:1.7; text-align:center;">
      <span style="color:#f4c542;">◉ 2</span><br>
      <span style="font-size:10px; color:#aaa;">+2 vs <span style="color:#8fc97f;">Spore</span></span><br>
      then <span style="color:#7fb4f0;">🂠 1</span> · <span style="color:#b48ff0;">🌐 +1</span>
    </div>
    <div style="text-align:center; color:#888; font-size:10px; margin-top:8px;">— proposed: tokens —</div>
  </div>
</div>

### 3. Token-row renderer in `src/game/view`

A new module (e.g. `EffectLineView.ts`, or a function `addEffectLines` beside
`addCardText`) that, given `EffectLine[]`, a max width, and a base color:

- creates an `Image` per icon token and a `Text` per text/value token,
- measures token widths, lays each line out horizontally, centers it,
- applies role styling: `branch` indents, `rider` drops to a smaller size
  (`undefined` role renders as `main`),
- returns `{ container, height }` so `CardView`'s vertical stacking keeps
  working. Today `addEffectBlock` returns `Text[]` and `CardView` measures
  `text.y + text.height` to advance `currY`; the new contract replaces that
  with `currY += height + spacing`. This return type is the agreed interface
  between migration steps 2 and 3 — both sides build to it.

**Overflow handling.** Lines never word-wrap (see Risks), so an over-wide
compiled line must be loud, not clipped. The row renderer enforces this: when
a measured row exceeds `maxWidth`, it scales the row down to fit (visibly
cramped, never clipped or overlapping) **and** emits a `console.warn` naming
the card and line. The warn is unconditional — the codebase has no dev-flag
convention and other TableScene warns fire unconditionally too. A compression
bug therefore degrades visibly and announces itself, rather than rendering
broken in silence.

The **`IconId → texture key` mapping lives here**, typed as an exhaustive
`Record<IconId, string>` (possibly theme-overridable later) so that adding an
`IconId` without registering a texture is a compile error, not a Phaser
missing-texture error at runtime. This is the seam that makes icon art
swappable: regenerating art means replacing textures behind stable IconIds,
with zero core changes. Until real art exists, `preload` registers placeholder
generated textures (colored circle + letter) under those keys so layout work
is not blocked on art.

`emphasis: 'progress'` on a value token drives the glow that today's
`includes('Progress')` hack approximates. The hack is deleted.

### 4. World-card trigger blocks

`addEffectBlock`'s sentence prefixes are the highest-value compression target
because they repeat on every world card. The block becomes
`(trigger: IconId, effect: CardEffect, color)`:

| Prefix today | Trigger icon | Row tint (unchanged) |
|---|---|---|
| `Each turn: ` | `eachTurn` (clock) | `textHeld` |
| `If discarded: ` | `onDiscard` | `textPenalty` |
| `Clear it: ` | `onClear` (check) | `textReward` |
| `Partial clear: ` | `onPartialClear` (half-check) | `textPenalty` |

The trigger icon leads the first line; subsequent lines of the same block hang
indented under it.

### 5. What stays prose

`describeEffect` is **kept, not replaced**:

- `branchLabels.ts` — modal chooser buttons want sentences.
- `previewPlay` — the live target preview is inherently a sentence.
- Future hover tooltip — compact face, full prose on hover is the standard
  deckbuilder pattern (Slay the Spire keywords, Balatro detail panes), and is
  the planned mitigation for icon learnability.

Both representations are pure functions of the same `CardEffect`, so they
cannot drift apart.

## Alternatives considered

**Inline markup in the prose strings** (e.g. `describeEffect` emits
`"{progress} 3"` and the renderer parses placeholders). Rejected: keeps
string-parsing at the boundary, loses per-token type safety, makes emphasis
and roles stringly-typed, and pollutes the three prose consumers that want
plain sentences.

**A Phaser rich-text / BBCode plugin** (e.g. rexUI tag text). Rejected: adds a
dependency for what is a ~100-line layout function, is still string-markup
underneath, and gives core no say in compression — the verbose phrasing
problem would remain.

**Compile in the renderer directly from `CardEffect`** (no core module).
Rejected: duplicates the effect-kind walk on the renderer side of the
boundary, where it cannot be headless-tested, and creates a second source of
truth beside `describeEffect`. The whole point of `core/view` is that "what a
card communicates" is decided once, purely.

## Risks and trade-offs

- **Icon learnability.** Compressed faces shift load onto the player's icon
  vocabulary. Mitigations: keep short text connectives (this is icon-assisted
  text, not pure iconography), keep keywords as plain text everywhere (the
  decision in §1 — they are the fastest-growing vocabulary and would bloat the
  icon set), and plan the hover tooltip as the follow-up.
- **Layout complexity.** Horizontal token measurement replaces Phaser's
  built-in word wrap. Deliberately so: lines never wrap; `compileEffect`
  decides line breaks, and an over-long line is a compression bug. The
  scale-to-fit + dev `console.warn` behavior in the row renderer (above) is
  what keeps that bug visible instead of silently clipped.
- **Card proportions.** `CARD_FACE` dimensions were chosen for full prose
  (the comment at `CardView.ts:29` says so explicitly), and the inset, cost
  ring, and keyword offsets were all placed around a tall text block. Compact
  faces may read as bottom-heavy or misproportioned even when every block fits
  — treat step 3 as carrying a visual-regression risk and eyeball every card
  template in the browser, not just the test suite. The proportion redesign
  itself stays a follow-up decision, not part of this refactor.
- **Test surface doubles for effects.** Every effect kind now has prose tests
  and token tests. Acceptable: both are cheap pure-function tests, and the
  exhaustive switch keeps them honest.

## Migration plan

1. **Core compiler.** Add `IconId`/`EffectToken`/`EffectLine` and
   `compileEffect` in `src/core/view/effectGlyphs.ts` with tests covering
   every effect kind in the vocabulary table, the `Draw` variants, riders,
   and the Sprint/Barricade composite shapes.
2. **Row renderer.** Build the token-row layout in `src/game/view` returning
   `{ container, height }`, with the exhaustive `Record<IconId, string>`
   texture map, scale-to-fit overflow warning, and placeholder icon textures
   registered in preload.
3. **Switch the faces.** Player-card effect block first, then the four
   world-card blocks with trigger icons. Delete the `includes('Progress')`
   glow hack and any `addCardText` wrap/background paths that go unused.
   Manually eyeball every card template in the browser for the proportion
   regression noted under Risks.
4. **Follow-ups (separate efforts).** Hover tooltip using `describeEffect`
   prose; real icon art behind the IconId keys; `CARD_FACE` proportion pass.

## Decision

Adopt the token IR: `compileEffect` in `src/core/view/effectGlyphs.ts`
produces `EffectLine[]` of typed tokens; a token-row renderer in
`src/game/view` maps `IconId → texture` and lays out icon+text rows.
`describeEffect` remains the prose source for chooser labels, previews, and
future tooltips. Icon artwork is deferred behind the stable `IconId` contract;
placeholder textures unblock all layout work.
