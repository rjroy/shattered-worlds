---
title: "Story detail screen and help screen"
date: "2026-06-08"
status: "open"
tags: ['ui', 'screens', 'story', 'help', 'overlay', 'phaser', 'ux', 'immersion']
modules: ['table-scene', 'overlays', 'view']
---

# Story detail screen and help screen

Brainstorm · 2026-06-08 · status: open

## What are we actually designing?

Story detail screen

Per-world narrative context. *Why are you in this shard? Who is the Walker? What are these hazards?* Sets the flavor before (or during) a run. Content volume: 2–5 paragraphs + optional image. Changes per world, possibly per run variant.

Likely trigger: world-select screen (pre-run), or a "lore" button accessible mid-game.

Help screen

Mechanical reference. Rules, keyword glossary (Energy, Exhaust, ForceDestroy…), per-world mechanic differences. Content volume: potentially long — glossary can grow to 20–40 terms. Doesn't change per run.

Likely trigger: ? button in HUD, first-run prompt, or pause menu.

**Core tension:** The game lives inside a fixed Phaser canvas (900px wide). Both screens want to display text-heavy content. Phaser text objects are expensive and scrolling requires custom implementation. But leaving the canvas — whether via a new tab or DOM overlay — risks breaking the immersive "game shell" feel.

## Implementation options (for both screens)

1

**Phaser full-screen overlay** / Same pattern as win/loss screens — containers at depth 1000. Already proven in codebase.

- Zero immersion break
- Themed automatically by world VisualTheme
- Single codebase, no routing

- Scrolling text = custom code
- Every paragraph is Phaser text objects (perf/memory)
- Hard to author (no markdown)

2

**Phaser stacked scene** / Launch a StoryScene or HelpScene on top of TableScene using Phaser's scene manager (`scene.launch` / `scene.bringToTop`).

- Full canvas, can do slide/fade transitions
- Pause/resume TableScene cleanly
- Dedicated scene = cleaner code

- Same text-heavy pain as option 1
- Scene lifecycle adds complexity
- No new rendering capabilities

3

**DOM overlay on canvas** / A `<div>` absolutely positioned over the Phaser canvas. CSS-styled to match game palette. Phaser can create DOM elements via `scene.add.dom()`, or we can use a plain CSS div.

- Rich text, real scrolling, markdown possible
- Easy to author story content
- Game canvas still visible underneath (letterbox/blur)

- Two rendering pipelines (canvas + DOM)
- CSS theming separate from VisualTheme system
- Interaction model changes (pointer leaves canvas)

4

**Separate web page (same domain)** / Vite multi-page: `/shattered-worlds/story/zombie-big-box`, `/shattered-worlds/help`. Same HTML/CSS palette, opened via link in main page.

- Fully decoupled — easy to maintain, search-engine friendly
- Richest formatting, images, anchor links
- Can share links ("here's the zombie shard lore")

- Leaves game context (new tab or navigation)
- "Return to game" button UX is clunky
- Build/deploy complexity (Vite multi-page config)

5

**Content embedded in game data, rendered on-demand** / Story content lives in world data files. Help keywords live in card/effect definitions. Rendered inline as tooltips, card details, or a lightweight modal — no dedicated "screen" at all.

- No new screen architecture needed
- Context-sensitive (see story for the hazard you're hovering)
- Incremental — add as you go

- Story "screen" loses its narrative weight
- Hard to expose a complete glossary
- Help fragmented across interaction points

## These two screens might want different answers

**Asymmetry:** "Story detail" is a pre-run or between-run screen — you're not mid-action, immersion is already at a seam. "Help" is often triggered mid-run, where you want to glance and return. These different triggers suggest different optimal implementations.

Story detail — candidate: DOM overlay or separate page

You read world lore *before* you start a run. A world-select screen is a natural seam — not mid-game. Richer HTML formatting makes the lore feel more substantial. Could live at `/story/[worldId]` or as a DOM panel on the world-select screen.

If story detail is on the world-select screen (not yet built), a DOM overlay on that screen is natural — the "game canvas" for world-select is already different from the play canvas.

Help — candidate: Phaser overlay or DOM panel

You hit ? mid-game. A full-page navigation is disruptive. A Phaser overlay (option 1) is lowest friction. Content volume is the main challenge — a keyword glossary might need 30+ entries.

One approach: keep the help overlay thin (5–8 most important keywords) and rely on card tooltips/descriptions for the rest. The full glossary lives on a /help page that's linked from the thin overlay.

## When do these appear?

### Story detail — trigger options

On world select (before run)

Shown when you pick a destiny-shard. Could be a card-flip reveal — front shows shard name/visual, back shows lore text. World select doesn't exist yet so we can design this together.

natural seam pre-run context

? / lore button mid-game

Always accessible. Could show current world's story. Less narrative weight — you're already playing. Good for "wait, what IS the Walker?"

serves curiosity weaker framing

Forced prologue (first run only)

Like Hades — story cutscene before your first run of a new shard. Strong narrative framing. Can be skipped on repeat runs. Requires first-run detection.

high narrative impact adds state (first-run tracking)

Post-run debrief

Story advances *after* each run based on outcome (won/lost). Meta-progression narrative. Interesting but complex — requires story state machine.

deep potential major scope increase

### Help — trigger options

? button in HUD

Always present. Opens thin keyword reference. Probably the right primary trigger. Question: does pressing ? pause the game? It should, since you're reading rules not watching the board.

First-run tooltip sequence

Guided "first time" overlay highlighting each HUD element with a brief description. After that, ? is the reference. Roguelite convention. Requires first-run flag.

Hover tooltips on keywords

Cards/effects could have keyword terms linked to definitions that pop on hover. No dedicated screen needed — help is contextual. Incremental but doesn't give a glossary overview.

Pause menu (not yet built)

If a pause screen exists, help lives there. Logical grouping with settings, restart, quit. Adds dependency on pause screen existing first.

## Bad ideas (worth recording)

**Help screen as a "tutorial world"** — a special destiny-shard that teaches mechanics through play. Would be amazing. Scope: enormous. Not now.

**window.open for story or help** — breaks everything. Popup blockers, loses game focus, UX disaster. Immediate no.

**Story told entirely through card flavor text** — tempting minimalism, but the Walker/shard context is world-level, not card-level. Cards can *reinforce* story but can't establish it.

**Scrollable Phaser text list for help glossary** — technically possible with a mask + drag handler, but the implementation effort is 80% of building a DOM overlay anyway, with fewer capabilities. If you're scrolling, use the DOM.

**Help and story combined into one screen** — they serve different purposes at different times. Merging them muddles both. Separate concerns.

## Open questions — resolved 2026-06-08

✓ **Does world-select exist yet?** / No, but it's going on the roadmap now. Story detail lives *inside* world-select — not a separate screen. The select card for each shard includes a short flavor paragraph.

✓ **How much story content exists?** / Very little — by design. Each shard is a vibe sketch: Walker shows up, world goes sideways. Zombie-big-box: big box store, lights flicker, strange sounds, zombies. 2–4 sentences of mood-setting. Not deep lore.

✓ (partial) **How large does the help glossary get?** / Unknown, but probably small — one keyword set per world, grows as worlds are added. Bird-building and highway-volcano not rebalanced yet, so their entries can wait. Phaser overlay is fine for now.

✓ **Should help be world-aware?** / Yes. Help shows base rules + a "in this world" section with gameplay differences per shard. Bird-building and highway-volcano mechanics are still being rebalanced, so those sections are deferred.

## Decided shape

**Story detail:** Lives inside the world-select screen (not a separate screen). Each shard card shows a 2–4 sentence mood sketch — vibe-setting, not deep lore. The Walker arrives, the world goes sideways, that's enough. Content is authored per world in world data (worldManifest or a parallel story file). World-select is the next major screen to build; story comes along for free.

**Help screen:** Phaser overlay (depth 1000, same pattern as win/loss). Structure: base rules brief → keyword glossary → "in this world" section with world-specific mechanic notes. Triggered by a ? button added to the HUD. Glossary size is small for now (5–8 terms). Bird-building and highway-volcano mechanic sections are placeholders until those worlds are rebalanced. Phaser overlay is sufficient at current volume — revisit if it grows past ~15 entries.

**The "breaks emergence" resolution:** Story is pre-run (world-select seam) so immersion is already broken — richer HTML would be fine, but since content is short, in-canvas is equally valid. Help is mid-game, so overlay wins. Both stay in-canvas. No new tabs needed.

## What's next

- Spec the world-select screen (story detail is a sub-section of that spec)
- Spec the help overlay (simpler, could go first as a standalone)
- Write zombie-big-box flavor text (2–4 sentences, mood over exposition)
- Define worldManifest shape changes needed to carry story + help data per shard
