---
title: "Player feedback: target clarity before commit and partial hazard progress"
date: "2026-06-05"
status: "spec-ready"
tags: ['ux', 'feedback', 'targeting', 'target-clarity', 'hazard-progress', 'juice']
modules: ['game-render', 'game-selection', 'game-tablescene']
---

# Player feedback: which hazard am I about to hit, and partial hazard progress

Brainstorm · open · two UX-feedback concerns raised before committing to a design

**Scope note.** This file is about *feedback design*: given the targeting and progress systems as they work today, how should the player read what they are about to do. It is not a bug report — the current behavior works as intended; the question is whether the *feedback* on top of it is strong enough.

## The two concerns

### 1. Target clarity before commit

While a play is still uncommitted, can the player tell **which world/hazard card is currently targeted**? The concern is the read on the *receiving end* of the action, not which card is in hand. Before they pull the trigger, the target the effect is about to land on should be unmistakable.

### 2. Partial hazard progress

When a hazard has taken **some** progress but is not yet cleared, how is that shown on the card? Today the player has almost no read on "how close am I."

## Grounding facts that shape the design

 **Partial progress is per-turn and resets.** verified in code

`handleEndTurn` sets `progress: {}`. The hazard card stays in hand, its `onEndOfTurn` keeps punishing, but every point of progress dealt this turn is wiped at end of turn. This is a **burst-it-down-this-turn-or-lose-the-work** model, not a slow accumulator.

 **Accumulated progress is currently never drawn on the card.** verified in code

The hazard face shows name, cost ("X to clear"), keywords, and effect lines. `state.progress[cardId]` is rendered *nowhere* on the card. The only place it surfaces is the one-line hover preview during active targeting (`previewPlay`: "Deals 2 → 1 more to clear").

 **The target read today is carried by color difference alone.** verified in code

- The acting card gets one colored border; legal targets get a *different* colored border. "Which card is my target" is therefore a color-decoding task, not a direct read — exactly the gap concern 1 attacks.
- Everything else dims to 35% alpha, so the targeted hazard and the merely-legal-but-unselected hazards are only weakly distinguished from each other.
- One ephemeral bottom-center hint line *also* doubles as the hover-preview slot, so target instructions and the live preview clobber each other.

**No connector is ever drawn.** "This card → that hazard" is implied by two same-time borders, never by a literal link. And multi-step plays lose earlier picks (e.g. once a compound advances to its return step, the already-chosen hazard target is no longer marked).

## Implementation anchors

Re-verified against current code on 2026-06-05, so the spec can point straight at the seams.

### Where each piece lives today (file:line)

- **Per-turn reset:** `handleEndTurn` — `src/core/reduce.ts:106` ; world cards kept in hand ( `:127` ), `onEndOfTurn` fired per held card ( `:111-118` ), `progress: {}` wipe ( `:129` ).
- **Progress value surfaces only in preview:** the sole read of `state.progress` in the renderer is `describe.ts:103` (inside `previewPlay` ). The card face draws cost ( `render.ts:130` , "to clear" label) but never progress — the cost-ring meter is net-new surface on the world card face.
- **Target read = three weak signals:** two border colors ( `selectedBorder` vs `targetBorder` , `render.ts:372-376` , applied at `TableScene.ts:323` vs `:330` ); 35% dim ( `dimAlpha: 0.35` , `render.ts:60` ); one shared hint slot, `this.selectionHint` , carrying both instructions ( `updateHint` , `TableScene.ts:683-703` ) and live preview ( `showTargetPreview` , `:675-676` ).
- **No connector geometry exists:** no `add.graphics` / `lineBetween` / line primitive anywhere in `src/game` . "Draw the link" is greenfield, not a tweak.
- **Earlier picks go dark:** `applyHighlight` re-lights `awaiting-return` selections ( `TableScene.ts:350-353` ) and current legal targets, but nothing re-lights a stored earlier hazard `targetId` once the flow advances.

## Concern 2 — partial progress, idea space

Frame: the player needs three things at a glance — **banked this turn**, **remaining**, and **it evaporates if I don't finish**. The per-turn reset is the hard part; a static bar teaches the first two and hides the third.

### Pip row cheap

For low costs (most hazards look small), draw N pips that fill solid as progress lands. "3 pips, 2 filled" is instantly countable at 150px card width in a way a bar is not. Fails for very high costs.

### Filling ring around the cost digit chosen direction

Keep the big cost number, wrap it in a ring that fills with progress. Reads as a *clock*, which accidentally implies "running out of time" — on-theme for the per-turn cliff. **Picked.** It also pairs naturally with the drain animation below: a clock that *fills* as you bank progress and *empties* at end of turn is one consistent visual telling the whole burst-or-lose story. Scales past the pip row's ceiling for higher costs (still pending Q2 on the real range).

### Fraction label cheapest

"1 / 3" replacing "3 to clear." Trivial, scales to any cost, but a bare number does not communicate the reset at all.

### The reset deserves its own animation maybe the real answer

Whatever the meter, at end of turn it should visibly **drain back to zero** rather than snap. Watching 2/3 bleed away *once* teaches the mechanic better than any tooltip. This may matter more than which meter style we pick.

### "Can't finish this turn" pre-warning

If the remaining hand cannot possibly cover the gap before end of turn, mark the hazard so the player does not pour cards into a meter that is about to reset. The math already exists in `previewPlay`; today it is only shown reactively on hover.

### Progressive "cracked / broken" art states parked

Most juice, most on-brand for a Balatro-maximalist feel, but expensive, doesn't scale to data-driven cards, and gives no exact number. Maybe worth it for a single hero hazard later; wrong as the general solution.

## Concern 1 — target clarity, idea space

Frame: the player is mid-targeting and needs one thing — **which world/hazard card will this land on** — to read at a glance, with zero ambiguity, before they commit. The acting card in hand is a *separate* concern (see the cut note below).

### Draw the link highest leverage

A literal connector (line or arrow) from the acting card to the hovered/committed target points the player's eye straight at the receiving card. The connector's real job here is to **name the target**, not to dress up the source — it replaces "bind two same-time border colors in your head" with "follow the line to the thing that's about to get hit."

**Decorate the line by targeting type.** The connector can carry *what* the action does, not just *where* it lands — one styled line that previews intent on the target end:

progress → accent line feeding into the cost ring destroy → harsh / jagged red back to deck → curved arrow looping toward the deck

This makes the link do double duty: it disambiguates the target (concern 1) *and* pre-reads the effect, so the player isn't guessing whether this hit chips the hazard, kills it, or bounces it. Keep the vocabulary small and consistent so the styles stay learnable.

### Make the target highlight unmistakable on its own cheap, direct

The hazard's "I am the target" state should be the loudest read on the board: not just a border tint, but lift/scale, a glow, or a reticle on the card itself, distinct from the merely-legal-target dim. Right now "targeted" and "legal but unselected" lean on a color difference the player has to decode. The target the trigger is aimed at should be obvious without comparison.

### Keep earlier picks lit through multi-step plays

During a compound's later step, keep the already-chosen target visibly marked so the player can still see **which hazard the earlier step is committed to**. Today that earlier target goes dark, so mid-sequence the player loses the read on where their first hit landed.

### Floating RPG-style damage numbers on the target parked

Lands on the right end (the target) but reads as *result*, not *intent* — it confirms after the fact rather than clarifying before commit. Redundant with the concern-2 meter work and gets noisy with modal/multi-effect cards. Revisit only if the highlight + link still underdeliver.

### Cut: acting-card feedback (action tray, echo modal branch) different concern

Earlier framing carried two ideas about the *card in hand* — a persistent "action tray" ("Playing **Baseball Bat** →...") and echoing the chosen modal branch label during targeting. Both answer "what am I doing / which card did I pick," which is **not** this concern. Parked here so the thinking isn't lost; pick them back up if "which acting card / which branch" ever becomes its own raised concern.

## Decisions and remaining open questions

As of 2026-06-05: Q1, Q2, Q3, Q5 resolved (below). Only Q4 (a prioritization within Concern 1) is still open, and it can be settled inside the spec. This brainstorm is spec-ready.

**Q1 — resolved: burst-or-lose is intended.** decided 2026-06-05 The per-turn reset is the design, not an artifact. The whole Concern 2 branch stands: cost-ring meter plus a drain animation, with the drain treated as **core mechanic-teaching, not polish**. (This also settles Q3 below.)

**Q2 — answered from catalog data.** verified in data Every normal hazard in `zombie-big-box.json` costs **1 or 2** (Strange Sounds, Rubble, Screams, Zombie, Door, Find Baseball Bat); one boss, **The Walker, costs 10**. `starter.json` is the player deck and carries no hazard costs. So the meter must read cleanly from 1 to 2 in the common case and survive a single 10 at the boss. This is why the ring beats the pip row: a 10-pip strip at 150px is cramped, a ring fills to 10 without changing shape. The 10 is the stress case the chosen meter has to pass.

**Q3 — resolved by Q1: managed tension.** decided 2026-06-05 The reset is meant to be *felt and managed* (a roguelike burst-timing decision), not an invisible gotcha. So the drain animation is the core teaching beat: watching banked progress bleed away once should make the timing pressure legible.

**Q4.** For concern 1, is the worst case "I committed to the *wrong hazard* because the target read was ambiguous" (fix = louder target highlight + link), or "mid-sequence I can't tell *which hazard* my earlier step is locked onto" (fix = keep earlier picks lit)? Both are target-read failures; rank which bites first.

**Q5 — resolved: stay click-to-commit.** decided 2026-06-05 No explicit confirm step for single-target plays. **Consequence for Concern 1:** there is no held "this is your target" beat, so the target read must land *on hover, before the click*. The hover-state highlight and the on-hover link therefore carry the full weight of preventing a wrong-target commit — they are the safety margin, not decoration.

## If I had to pick a starting thread

Concern 2 is settled: the **filling ring around the cost digit**, paired with a **drain animation** at end of turn so the ring visibly empties — one clock that tells the whole burst-or-lose story. Q1 confirmed the reset is intended (so the drain is core), and Q2 fixed the range it must cover (1–2 common, a single boss at 10). No open questions remain on this branch.

Concern 1 has a chosen lead: **draw the link** from acting card to target, **decorated by targeting type** (progress / destroy / back to deck) so the line names both the target and the effect, backed by a target highlight loud enough to read on its own. Together the player knows exactly *where* the hit lands and *what* it does before committing, instead of decoding two border colors. Because Q5 kept **click-to-commit** (no confirm beat), both must render on **hover** — the hover read is the only thing standing between the player and a wrong-target commit.
