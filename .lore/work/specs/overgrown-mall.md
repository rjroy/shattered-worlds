# Overgrown Mall world: infest / prune & profit

- **Date:** 2026-06-11
- **Status:** draft
- **Tags:** world-design, overgrown-mall, infest, spore, deal-progress-scaled, player-keywords, core-effect
- **Modules:** core-engine, world-data, game-view, themes
- **Related:** [overgrown-mall-world.html](../brainstorm/overgrown-mall-world.html), [shard-response-archetypes.html](../brainstorm/shard-response-archetypes.html), [shard-response-archetypes.html](../plans/shard-response-archetypes.html), [theme-authoring.md](../../reference/theme-authoring.md), [visual-direction.html](../../reference/visual-direction.html)
- **Req prefix:** MALL

> Overgrown Mall · fourth world · spec covers full identity, no phasing

"The rot gets into your deck — prune it, or grow with it." The fourth world. Threat-verb **infest**: world cards inject Spore cards into the player deck. Response archetype **prune & profit**, with a symbiosis line (Bloom) for the player who refuses to prune. Clock: player-deck pollution. All decisions resolved in the [brainstorm](../brainstorm/overgrown-mall-world.html); this spec covers everything — core effects, world data, visuals, manifests, docs, and tests ship as one identity.

## 1 · Core engine — new capabilities (REQ-MALL-1 … 7)

Effect kinds and template fields the Mall needs that core does not have today. `{ kind: 'None' }` already exists in the effect union (`types.ts:37`); the work is playability and coverage, not a new kind.

#### REQ-MALL-1 — No-op player cards are playable *(core)*

A player card whose effect is `{ kind: 'None' }` is playable whenever its energy cost is payable (playability rule: always playable, energy permitting). Playing it pays the cost, applies `exhaust` if set, emits the standard card-played events, and changes no other state. Target spec is `{ kind: 'none' }` — no targeting UI.

#### REQ-MALL-2 — Player card templates support keywords *(core)*

`PlayerCardTemplate` gains an optional `keywords: readonly Keyword[]` (default `[]`), typed with the same `Keyword` union world cards use — **implement REQ-MALL-3 (extend the union) first** so player templates never fall back to loose `string[]`. Existing world JSON loads unchanged. Keywords on player cards are visible to the renderer the same way world card keywords are.

#### REQ-MALL-3 — `Spore` joins the keyword vocabulary *(core)*

The valid keyword set (currently `Hidden` / `Creature` / `Slow`, theme-authoring rule C2) is extended with `Spore`. Any validation or display logic that enumerates keywords handles it.

#### REQ-MALL-4 — `DealProgressScaled` effect with a counter spec *(core)*

New effect kind:

```json
{ "kind": "DealProgressScaled", "base": 1,
  "per": { "kind": "KeywordInHand", "keyword": "Spore" }, "amount": 1 }
```

Resolved amount = `base + amount × counter(state)`, computed at resolution time from current state — deterministic, no new randomness. `per` is a discriminated-union **counter spec**; `KeywordInHand` (count of hand cards, player or world, carrying the keyword) is the only member this spec requires. The union exists so future counters (e.g. the bird brainstorm's empty-hand-slot) are additive, but implementing them is out of scope here.

#### REQ-MALL-5 — `DealProgressScaled` targets and plays like `DealProgress` *(core)*

Target spec is `{ kind: 'hazard' }` (single world card in hand); playable only when at least one world card is in hand. Progress application, clear detection, and emitted events match `DealProgress` semantics. **Explicit cases required in `available.ts`**: `structuralSpec` must return `{ kind: 'hazard' }` and `isPlayable` must return `worldCardsInHand(state).length > 0` — both switches have `default` fallbacks (`{ kind: 'none' }` / `false`), so a missing case is a silent bug the compile trip-wire in REQ-MALL-6 does *not* catch.

#### REQ-MALL-6 — Display text covers the new kinds *(core)*

`describeEffect` produces player-readable text for `None` on player cards — currently it returns `[]` (`describe.ts`) and must change; pinned text: **"play to prune (leaves the run)"** — and for `DealProgressScaled` (e.g. "deal 1 progress, +1 per Spore in hand"). The switch has no default — compile breakage is the trip-wire (ForceDestroy retro), but it only protects this function, not `available.ts` (see REQ-MALL-5).

#### REQ-MALL-7 — Determinism preserved *(core)*

No new effect or field introduces non-seeded randomness or renderer feedback into core. Same seed + same actions remains byte-identical, including runs that play Spores and Bloom.

## 2 · The Spore card (REQ-MALL-8 … 10)

#### REQ-MALL-8 — Spore template (design B, locked)

`energyCost: 1, exhaust: true, effect: { kind: 'None' }, keywords: ["Spore"]`. Playing a Spore *is* pruning it: one energy, one card play, gone for the rest of the run. It is never in the starter deck — it enters play only via world card hooks.

#### REQ-MALL-9 — Infest delivery uses existing pathways

Spores are injected via `GainCard` (→ player discard, surfaces on reshuffle — accepted timing, brainstorm Q2) and `AddPlayerCardToTop` (→ top of draw pile, drawn next turn). No new injection mechanism.

#### REQ-MALL-10 — One pollution identity: no Panic

The Mall's world JSON references no `Panic` template in any hook or reward. Spore is the world's only junk card (brainstorm Q5).

## 3 · World data (REQ-MALL-11 … 17)

> Card costs, counts, and act distribution below are **initial tuning values** (brainstorm Q4) — freely adjustable in JSON without spec revision. Structure and hooks are requirements; numbers are not.

#### REQ-MALL-11 — World identity

`worldId: "overgrown-mall"` at `src/data/worlds/overgrown-mall.json`, using `deckComposition.acts` (three acts) like the other themed worlds. The same kebab-case id is the join key everywhere (theme-authoring RULE 0).

#### REQ-MALL-12 — Threat roster

World cards, with every card defining all three hooks (C3):

| Card | Act | Identity hook |
|---|---|---|
| Burst Planter | 1 | `onDiscarded: GainCard Spore` — dodging it dirties you |
| Pollen Haze | 1–2 | `onEndOfTurn: GainCard Spore` — the drip |
| Kudzu Curtain | 2 | `discardable: false` — pure obstruction |
| Something in the Atrium | 2–3 | `Creature` keyword — cross-world weapons stay relevant |
| Fountain Bloom | 3 | `onEndOfTurn: Sequence [AddPlayerCardToTop Spore, AddWorldCardToTop Burst Planter]` — intentional: the injected Burst Planter bypasses act gating and surfaces via world draw after injection (brainstorm-approved; flagged "tune carefully") |
| The Garden Center | find, `Hidden` | `onCleared` grants prune rewards |

#### REQ-MALL-13 — Acts escalate by delivery mechanism

Act 1 infests on avoidance (`onDiscarded`), act 2 on a timer (`onEndOfTurn: GainCard`), act 3 guarantees next-turn draws (`onEndOfTurn: AddPlayerCardToTop`). The escalation is the mechanism switch, not just counts.

#### REQ-MALL-14 — Walker capstone, untouched canon

Act 3 contains exactly one `The Walker`; `The Walker` and `Door` are referenced from the shared starter source, never redefined (N1).

#### REQ-MALL-15 — Reward roster — distinct cards, two lines

Garden Center / clear rewards (D2: no card identical to another world's reward):

| Card | Effect | Line |
|---|---|---|
| Pruning Shears | `Sequence [DestroyCardInHand { min: 1, max: 1 }, GainEnergy 1]` | prune & profit |
| Machete | `DealProgress 1, bonus Creature +3` | weapon slot |
| Weed Killer | `exhaust, DealProgressAll base 1` | answer to the green wall (Q6 resolved: keep — one exhaust copy doesn't dilute zombie's repeatable sweep) |
| Bloom | `DealProgressScaled base 1, per KeywordInHand "Spore", amount 1` | symbiosis — grow with it |

#### REQ-MALL-16 — Signature verb claim (SV1)

The Mall's exclusive verbs are the self-pruning no-op Spore and `DealProgressScaled` (Bloom). No other world's data may use `DealProgressScaled` until a future proposal claims a counter for it.

#### REQ-MALL-17 — Both strategic lines are live

The shipped composition must make both lines playable: prune-and-tempo (Spores exhausted early, Shears/Weed Killer value) and symbiosis (Spores hoarded, Bloom scaling). Neither line may be strictly dominant at initial tuning — verified by playtest, tuned in JSON.

## 4 · Visual & theme (REQ-MALL-18 … 21)

#### REQ-MALL-18 — Five artifacts, three registrations

Per theme-authoring W3: world JSON, `src/game/view/themes/overgrown-mall.ts` (`VisualTheme`), assets under `src/game/assets/themes/overgrown-mall/` (+ `insets/`), and entries in `assetManifest.ts`, `worldManifest.ts` (following the existing `makeWorldBuilder(…_SOURCE)` pattern — do not invent a per-world builder function), and `themeManifest.ts`. A missing registration is a spec failure, not a polish gap.

#### REQ-MALL-19 — Asset minimum, precedent art bar

Required: `overgrown-mall-reality.webp` backdrop (Walker present, distant), `intrusion-overlay.webp`, `overgrown-mall-cardfront.webp`, and one inset key per themed card (`mall-inset-…` namespace, every key registered). Card insets may ship as placeholders, matching bird-building and highway-volcano precedent.

#### REQ-MALL-20 — Visual identity fights the other retail interior

Intrusion hue is overgrowth-green and must read as distinct from zombie-big-box's palette at a glance (the brainstorm's stated risk: second retail interior). Direction: green light through a broken skylight, planters gone feral, act-3 forest. All visual-direction pass tests apply: ink-and-ash linework, desaturated reality with intrusion as the only true color, localized apocalypse radius, violet Door.

#### REQ-MALL-21 — Renderer shows the new information

Spore cards are visually identifiable in hand (keyword visible per REQ-MALL-2's display path), and Bloom's scaled value is comprehensible at the moment of play (current scaled amount surfaced via existing card text/describe path at minimum).

## 5 · Manifests & help (REQ-MALL-22 … 23)

#### REQ-MALL-22 — World select entry

`worldDisplayManifest.ts` gains an `overgrown-mall` entry (name, fiction blurb consistent with "nature rapidly reclaiming civilization; the decline, rushed").

#### REQ-MALL-23 — Help entry within budget

`worldHelpManifest.ts` gains an `overgrown-mall` entry: at most 6 notes (REQ-HELP-13), and at minimum a Spore note (what it is, that playing it removes it) and a Bloom note (scales per Spore in hand).

## 6 · Documentation (REQ-MALL-24 … 25)

#### REQ-MALL-24 — Theme-authoring doc amended with the proposal, not after

`.lore/reference/theme-authoring.md` updates: C1 effect vocabulary adds `DealProgressScaled` (and clears the stale "not yet available" marks on `Brace`/`DealProgressAll`/`ExileTopWorldCards`, which shipped); C2 keyword list adds `Spore` and documents keywords on player templates; SV1 table gains the Mall row — verbatim: *overgrown-mall · prune & profit · self-pruning no-op Spore; Bloom scales per Spore in hand; `DealProgressScaled` exclusive to this world*. Also swap the transposed bird/volcano rows per REQ-MALL-25 in the same edit.

#### REQ-MALL-25 — Fix the transposed SV1 rows

The signature-verb table currently swaps bird-building and highway-volcano ("travel light" / "everything is fuel"). Correct to match the archetype brainstorm: bird = travel light, volcano = everything is fuel.

## 7 · Tests (REQ-MALL-26 … 28)

#### REQ-MALL-26 — Core coverage for every new behavior

Unit tests, written alongside: None-effect playability and play resolution (cost paid, exhaust applied, nothing else changes); player-template keywords parse and default; `KeywordInHand` counting (0, mixed player/world keyword carriers, full hand); `DealProgressScaled` resolution math, clear detection, and unplayability with no world card in hand; determinism (seeded run including Spore and Bloom plays replays identically, using the same comparison the existing determinism tests use — state snapshot and event sequence — rather than inventing a new methodology).

#### REQ-MALL-27 — Catalog and manifest tests cover the new world

`worldManifest.test.ts` catalog-build covers `overgrown-mall` (every referenced template resolves — the safety net for the unchecked JSON cast); help-manifest completeness test covers the new entry.

#### REQ-MALL-28 — Golden tests stay green or are knowingly regenerated

Existing worlds' golden runs are unaffected. If shared code paths shift event ordering, regeneration is a deliberate, explained step — not a silent update.

## Not in scope

- Other counter-spec members (`EmptyHandSlot` etc.) — the union is built extensible, members land with the worlds that claim them (bird wave 2).
- Profit-per-prune scaling state ("gain X per card destroyed this turn") — parked in the brainstorm.
- Discard-pile-reading effects, time-based card mutation, world-deck Spores — recorded dead ends.
- Fog Beach Party and Whiteout Parking Garage — separate specs.
- Final inset art — placeholder precedent applies (REQ-MALL-19).

## AI Validation

How the AI verifies this spec is done. All commands from repo root.

| Check | Method | Covers |
|---|---|---|
| Full suite green | `bun test` exits 0; new test names match REQ-MALL-26/27 behaviors | 1–10, 26–28 |
| Core purity | `bun run lint` exits 0 (no Phaser in `src/core/`) | 7 |
| Build works | `bun run build` exits 0 | all |
| Spore semantics | Core test: dispatch a Spore play from a seeded state — assert energy −1, card exhausted (absent from deck/discard), hand otherwise unchanged, state hash otherwise equal | 1, 8 |
| Bloom math | Core test: hand with N player cards keyworded `Spore`, M world cards keyworded `Spore`, K cards without — progress dealt = 1 + N + M (both card kinds count, non-carriers don't) | 4, 5 |
| Playability coverage | Grep `DealProgressScaled` in `available.ts`: explicit cases in both `isPlayable` and `structuralSpec` (both have `default` fallbacks that hide a missing case from `tsc`) | 5 |
| Describe coverage | `describeEffect` returns non-empty text for `None` (player) and `DealProgressScaled`; `tsc` compiles (no-default switch trip-wire — covers this function only) | 6 |
| World JSON shape | Inspect `overgrown-mall.json`: 3 acts; act 3 has exactly one `The Walker`; no `Panic` reference; every world card has all three hooks; delivery mechanisms match act per REQ-MALL-13; Spore template is exactly `energyCost: 1, exhaust: true, effect: {kind: 'None'}, keywords: ["Spore"]` | 8, 10–14 |
| Distinct rewards | Diff reward templates against the other three worlds' JSON — no identical effect+cost pair | 15 |
| Registrations | Grep `overgrown-mall` in `assetManifest.ts`, `worldManifest.ts`, `themeManifest.ts`, `worldDisplayManifest.ts`, `worldHelpManifest.ts` — all five hit; every `mall-inset-*` key referenced in JSON exists in the asset manifest | 18, 19, 22, 23 |
| Help budget | `overgrown-mall` help entry has ≤ 6 notes including a Spore note and a Bloom note | 23 |
| Docs amended | theme-authoring.md: C1 lists `DealProgressScaled` with no stale "not yet available" rows; C2 includes `Spore` + player-keyword note; SV1 has the Mall row and corrected bird/volcano rows | 24, 25 |
| Runtime smoke | Launch the game, select Overgrown Mall, play one run: backdrop/cardfront/insets load (no missing-texture magenta), a Spore arrives in discard after triggering a hook, playing it removes it, Bloom is offered and resolves. Confirms reachability only, not line viability — see the REQ-MALL-17 playtest note | 17, 20, 21 (manual / browser-driven) |

**Both-lines check (REQ-MALL-17):** not AI-verifiable beyond existence (both Bloom and prune rewards reachable in data); dominance balance is explicit human playtest territory.

---
Spec · REQ-MALL · draft 2026-06-11 · source decisions: `.lore/work/brainstorm/overgrown-mall-world.html`
