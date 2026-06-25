---
title: "Game engine choice for AI-assisted development"
date: "2026-06-02"
status: "approved"
tags: ['game-engine', 'ai-assisted-development', 'typescript', 'rust', 'bevy', 'three-js', 'godot', 'phaser', 'deckbuilder', 'tooling']
---

Research · Tooling Decision

# What engine should Shattered Worlds use?

Fresh · gathered 2026-06-02 Scope: 2D roguelite deckbuilder, AI-assisted, free, typed + tested + CI

If this isn't a web app, the default is Godot + C# — the genre-proven engine (Slay the Spire 1 & 2 both ship on it), with C# for the typed, AI-friendly language layer. The only live alternative is a TypeScript web stack if instant browser reach matters more than native polish. three.js and Bevy stay out.

*Correction (2026-06-02, after follow-up):* an earlier draft tagged Godot "off axis." That was wrong — it assumed a GitHub Pages web deploy. Drop the web requirement and Godot is the front-runner, not a footnote. Details corrected throughout below.

- **Godot is the genre default, and its test/CI story is real.** Purpose-built 2D UI; stable 4.x API (no Bevy-style churn). GdUnit4 gives headless CLI test runs, JUnit XML, and an official GitHub Action for both GDScript and C# — a genuine typed-tested-CI pipeline, which is exactly what the vision demands.
- **Within Godot, use C#, not GDScript.** GDScript is thin in LLM training data; C# is a top-tier corpus *and* a real static-type guardrail — the discipline you correctly wanted from Rust, minus the churn. Either way the AI needs Godot-API grounding (docs in context), but that's a tooling problem, not a language one.
- **three.js is the wrong shape.** It's a 3D WebGL library; a deckbuilder is text-heavy 2D UI. You'd render text as canvas textures, building a 2D UI toolkit on top of a 3D engine.
- **Bevy/Rust gets the AI loop half-right, then breaks it.** Rust's compiler *is* a real guardrail (validated below), but Bevy is pre-1.0 and breaks its API ~quarterly, so training data is fragmented and the AI writes code that won't compile. The language helps; the framework's churn cancels it.
- **Whatever you pick, keep the rules core engine-independent.** Cards, effects, RNG, run/Destiny state — pure logic. A dependency-free, heavily-tested core (C# class library, or TS module) with the engine as a thin renderer makes the choice reversible and serves the vision's data-driven balance and "craft + fun are one gate" principles.

## ↻ The question, reframed

You framed this as three.js (JS, biggest training corpus) versus Bevy (Rust, strict compiler that disciplines the AI). Both halves of that reasoning are sound in isolation. But the framing assumes you're choosing a *3D-capable game engine*, and Shattered Worlds isn't that kind of game.

### A card game is UI + a state machine, not a render-heavy 3D world

Look at the genre's landmarks. **Balatro** — the best-selling deckbuilder after Slay the Spire — is ~30,000 lines of Lua on the LÖVE framework, shipped by one person. **Slay the Spire 2** runs on **Godot**. Neither needed a 3D engine; both needed clean state logic and responsive 2D UI. Your engine decision should optimize for **typed game logic, testability, and text-heavy interactive UI** — not polygon throughput.

Once the axis is right, the contenders change. The real question is: *which stack gives the AI the tightest correctness feedback loop, the most training data, and the least churn — while producing typed, tested, CI-backed code I can deploy to GitHub Pages?*

## ▦ Scorecard against your actual constraints

| Option | Training data | Type guardrail / (AI correctness) | API stability / (churn = AI errors) | 2D card-UI fit | Test + CI | Fits your skills / + GH Pages |
| --- | --- | --- | --- | --- | --- | --- |
| Godot 4 + C# / genre-proven 2D engine | C# huge | Strong (C#) | Stable (4.x) | Built for it | GdUnit4 + Action | Native + Steam |
| TypeScript web / DOM/Svelte/React or PixiJS | Huge | Good (strict) | Stable | Native | Easy | Browser reach |
| Phaser 3 / TS canvas framework | Huge | Good (strict) | Stable | Off-grain (canvas) | Core only | Browser + known |
| Bevy (Rust) | Small + fragmented | Excellent | Breaks ~q'ly | Immature | Strong | Wasm, heavy |
| three.js | Huge | TS-typed | Stable | Wrong tool (3D) | Logic only | Yes |

The two columns that decide an AI-assisted project are **training data** and **API stability** — they determine how often the AI writes code that's plausible but wrong. **Godot 4 + C# and the TS web stack both clear every column;** they differ only on distribution (native/Steam vs browser). The type guardrail (where Rust shines) is the tiebreaker against Bevy, and both C# and strict-mode TS recover most of it without the pre-1.0 churn. Godot's one asterisk is *engine-specific* API knowledge the AI must be grounded in — true in any engine, mitigated by docs-in-context and the maturing Godot AI tooling.

## ◆ Option by option

three.js JavaScript/TS · 3D WebGL renderer Don't use here

**For it**

Massive training corpus, stable API, deploys anywhere. Genuinely the right call — if you were building something 3D.

**Against it**

It solves a problem you don't have. Cards are text-heavy; in three.js text means rendering to a canvas and uploading it as a texture, or layering DOM on top and fighting the resulting performance and layout issues. You'd build a 2D UI toolkit by hand on top of a 3D engine.

Bevy Rust · ECS game engine Not yet — and not for this

**For it**

Your core intuition is real: Rust's type system, exhaustive matches, and explicit error handling give the AI a compiler that says "this is wrong, fix it" on every generation. That tight loop produces unusually correct one-shot code (see sources). ECS is a clean fit for card/effect systems, and the test story is strong.

**Against it**

Bevy is still pre-1.0 (0.18 as of Jan 2026) and ships breaking changes roughly every quarter — the community itself calls the "break every 3 months" churn a problem. For an AI workflow that's the worst trait possible: the model's training data is spread across many incompatible versions, so it confidently writes 0.13-era APIs into your 0.18 project. The compiler catches it, but you burn iterations on migration noise instead of game design. UI is improving (bevy_ui, Feathers) but is described as "where Godot was in 2022." Reviewers call it a real option for a *specific* kind of indie, not a default.

Godot 4 + C# C# (or GDScript) · genre-proven 2D/3D engine · MIT Top pick (native)

**For it**

Purpose-built for exactly this genre — **Slay the Spire 1 and 2 both ship on it**. Excellent 2D Control-node UI, free and open (MIT). Stable 4.x API means the AI's knowledge stays valid (unlike Bevy). C# is a top-tier training corpus with a real static-type guardrail, and the test/CI story is solid: GdUnit4 runs headless via CLI, emits JUnit XML, and has an official GitHub Action for both C# and GDScript. You also get a real engine — scenes, animation, audio, input, particles, Steam export — instead of hand-assembling it.

**Against it**

The AI needs **Godot-specific API/node knowledge** grounded in context; general models are weaker on engine specifics than on plain language code (true of any engine, but real). Prefer **C# over GDScript**: GDScript is thin in LLM training data — the godot-dodo fine-tuning project exists because general models hallucinate GDScript features. C# also means the engine/scene layer is Godot-flavored, not vanilla .NET, so keep the pure rules logic in a plain C# class library the AI can reason about without engine context.

TypeScript web stack pure-TS core + DOM/Svelte/React or PixiJS Co-pick (if browser reach)

**For it**

Largest training corpus of any option, so the AI's first draft is most often idiomatic and current. Card UI is literally DOM — text, layout, and CSS/spring animations are free, not a fight. Strict-mode TS plus a typed test suite gives you a real (if softer than Rust) correctness gate. Pure-logic core is trivially unit-tested and CI-friendly. Ships straight to GitHub Pages. Matches the Svelte/React/TS you already know.

**Against it**

TS's guardrail is weaker than Rust's — no borrow checker, and `any`/non-null escape hatches let the AI paper over mistakes if you let it. Mitigation: `strict: true`, lint rules banning `any` and non-null assertions, and tests as the real gate. (The typescript-quality and typescript-setup skills already encode this discipline.)

Phaser 3 TypeScript · canvas/WebGL 2D game framework Prototyping shortcut

**For it**

Free, TS-typed, batteries-included (scenes, input, tweening, audio, physics), and **you've already shipped with it** — which is the point. For the vision's "prove the fun cheap before investing in rigor" phase, familiarity is velocity: it's the fastest path *for you* to a playable feel-test of the card loop. And because the rules core is meant to be engine-independent, a Phaser prototype isn't throwaway — you port only the pure core to whatever ships.

**Against it**

It's optimized for **real-time sprite/action games** — many moving objects, particles, physics — which a turn-based deckbuilder barely uses. The genre's real surface is text-heavy UI (rich card text, tooltips, hover states, scrollable deck/relic/map views), and on canvas you hand-build all of it in pixel coordinates with near-zero accessibility — the same off-grain friction as three.js, milder but present. Within the web track, DOM/Svelte (+ Pixi for flashy effects) gives you that UI layer for free; Phaser makes you pay for a sprite engine you don't need and rebuild the layout the DOM hands you. Fine for the prototype; working against the grain for the polished, shipped UI.

## ✲ The AI-development lens, specifically

You're right that strictness helps AI — the evidence is strong. One developer ported 100,000 lines of TypeScript to Rust with Claude Code in ~4 weeks with no prior Rust, landing within 0.003% divergence across 2.4M test seeds, precisely because the compiler closed the loop on every step. That's the case *for* Rust the language.

But two forces matter more for AI throughput than raw type strength, and they both favor TypeScript here:

- **Training-data density** decides how often the first draft is right. JS/TS sit at the top; GDScript and Bevy-flavored Rust sit far lower, so the AI guesses and hallucinates more.
- **API stability** decides whether "right yesterday" is still "right today." A stable library means the model's knowledge stays valid; a pre-1.0 engine that rewrites its API quarterly means the model is perpetually a version or two behind, generating code that no longer compiles.

Rust's guardrail is a multiplier on correctness, but it's multiplying a smaller, staler base. The winning options multiply a strong guardrail by a large, fresh, *stable* base: **C# in Godot 4** (huge corpus, real static types, stable 4.x API) and **strict TypeScript** (largest corpus, softer types stiffened by tests). Both beat Bevy because Bevy's excellent gate sits on a churning base, and both beat GDScript because GDScript's stable engine sits on a thin corpus. The remaining gap for Godot is engine-specific API knowledge, which you close with docs-in-context rather than by changing language.

## ⚙ The move that de-risks the whole decision

Whatever renderer you pick, **split the game in two**:

- **A pure rules core** — cards, effects, RNG, run/Destiny state, win/loss resolution — as a dependency-free module with *no engine imports* : a plain C# class library if you go Godot, a plain TS module if you go web. Deterministic, seedable, exhaustively unit-tested. This is 70% of a deckbuilder and the part the vision cares most about (legible synergies, data-driven balance, instrumentation).
- **A thin rendering/UI layer** that observes core state and draws it. Swappable. Godot Control nodes, or DOM/Svelte to start with PixiJS later for canvas-grade card effects.

This makes the engine choice *reversible* and cheap, and it's the single biggest lever for AI reliability: a dependency-free core is pure functions the AI reasons about *without* needing engine-specific API knowledge — which is precisely Godot's one weak spot. It's also what lets you simulate thousands of runs headlessly for the balance data Principle 6 demands. Decide the renderer in a follow-up design; build this core first, in whichever of C# or TS you commit to, and it will outlast any engine you bolt onto it.

## ⌕ Sources

Gathered 2026-06-02. Click to expand the relevant finding.

### Bevy is pre-1.0 with quarterly breaking changes; UI maturing but "where Godot was in 2022"

As of Jan 2026 Bevy is at 0.18; 1.0 is unscheduled. Ecosystem (UI/input/audio/physics) has matured enough to assemble a real game; bevy_ui + Feathers widget set are landing. Still positioned as an option for a specific kind of indie, not a default.

[strayspark.studio — Bevy in 2026: Is Rust ready for indie?](https://www.strayspark.studio/blog/bevy-rust-game-engine-2026-indie-guide) / [bevy.org — Bevy 0.17 release notes](https://bevy.org/news/bevy-0-17/) / [GitHub — Discussing (eventual) Bevy 1.0 stabilization & the "break every 3 months" churn](https://github.com/bevyengine/bevy/discussions/9789)

### Rust is unusually strong for AI code generation — the compiler closes the loop

Strict types, borrow checker, and explicit errors act as guardrails; the compiler immediately tells the agent what's wrong. Cited port of 100k LOC TS→Rust via Claude Code in ~4 weeks, 0.003% divergence over 2.4M seeds. This is the case for Rust the *language* (distinct from Bevy the framework).

[Medium — Rust Is Winning the AI Code Generation Race](https://medium.com/@chalyi/rust-is-winning-the-ai-code-generation-race-60c65074236c) / [reltech — Why Learning Rust Still Matters in the Age of LLM Agents](https://reltech.substack.com/p/why-learning-rust-still-matters-in) / [Shuttle — Best AI Coding Tools for Rust](https://www.shuttle.dev/blog/2025/09/09/ai-coding-tools-rust)

### GDScript is underrepresented in LLM training data; models hallucinate its features

LLMs code well in mainstream languages but degrade on less common ones due to underrepresentation, producing syntax errors and non-existent features. The godot-dodo project fine-tunes models specifically because general models are unreliable at GDScript. C# is the mitigation.

[GitHub — godot-dodo: fine-tuning LLMs for GDScript](https://github.com/minosvasilias/godot-dodo) / [Ziva — Best AI Tools for Godot in 2026](https://ziva.sh/blogs/best-ai-tools-for-godot-2026) / [Godot Forum — general models often get Godot-specific questions wrong (any language)](https://forum.godotengine.org/t/is-there-a-large-ai-code-model-specifically-for-godot/104032)

### Godot has a real typed-tested-CI pipeline (C# and GDScript): GdUnit4 + headless runner + GitHub Action

GdUnit4 is an embedded Godot 4 test framework supporting GDScript and C# (via gdUnit4Net / VSTest), with a CLI for headless CI runs, JUnit XML output, and HTML reports. An official GitHub Action automates it in CI with configurable Godot/GdUnit versions. C# tooling runs/debugs in Rider, VS, and VS Code. This corrects an earlier draft that called Godot's test/CI story "awkward."

[GitHub — GdUnit4 (GDScript + C#)](https://github.com/godot-gdunit-labs/gdUnit4) / [GitHub — official GdUnit4 GitHub Action for CI](https://github.com/MikeSchulze/gdUnit4-action)

### Genre landmarks: Balatro = Lua/LÖVE solo; Slay the Spire 2 = Godot

Balatro is ~30k lines of Lua on the LÖVE framework by a solo dev. Slay the Spire 2 (best-performing deckbuilder ever, per analysts) runs on Godot. Confirms the genre is carried by 2D UI + state logic, not a 3D engine.

[Wikipedia — Balatro (Lua/LÖVE)](https://en.wikipedia.org/wiki/Balatro) / [GameFromScratch — Balatro made with LÖVE2D](https://gamefromscratch.com/balatro-made-with-love-love2d-that-is/) / [PC Gamer — Slay the Spire 2 performance (Godot)](https://www.pcgamer.com/games/roguelike/analysts-say-slay-the-spire-2-is-the-best-performing-deckbuilder-of-all-time-and-the-competition-isnt-close/)

### three.js for 2D UI: text needs canvas-texture or DOM-overlay workarounds, with perf costs

Text in three.js is typically a canvas drawn then uploaded as a texture; mixing DOM/SVG 2D UI with three.js can cause performance problems, pushing people toward Pixi/Konva/Two.js. Confirms three.js is off-axis for a text-heavy card UI.

[three.js forum — drawing 2D parts alongside three.js](https://discourse.threejs.org/t/which-solution-is-better-to-draw-2d-parts-that-plays-well-with-three-js/18908) / [Tutorialspoint — three.js text via canvas texture](https://www.tutorialspoint.com/threejs/threejs_creating_text.htm)

### TS 2D framework landscape: Phaser (full framework) vs PixiJS (renderer) vs Excalibur (TS-first)

Phaser is a complete game framework (scenes, input, tweening) suited to card games; PixiJS is a lighter, faster pure renderer (~450KB vs 1.2MB, ~2x render speed) where you build UI yourself; Excalibur.js is a TS-first OOP option. For a DOM-heavy card UI, a web-native (Svelte/React) layer over a pure-TS core is also a first-class path.

[Generalist Programmer — Phaser vs PixiJS (2025)](https://generalistprogrammer.com/comparisons/phaser-vs-pixijs) / [GitHub — JS rendering benchmark (three/pixi/phaser/DOM/…)](https://github.com/Shirajuki/js-game-rendering-benchmark)

  Research gathered 2026-06-02 for the engine decision behind [Shattered Worlds](../../reference/vision.html) (roguelite deckbuilder; typed, tested, CI-backed). Status **active**. Revised the same day after a follow-up clarified the game need not be a web app — which promotes Godot from "off axis" to front-runner. Bottom line: the three.js-vs-Bevy framing optimized the wrong axis; the real choice is **Godot 4 + C#** (native, genre-proven, Steam) versus a **TypeScript web stack** (browser reach), and with web optional, Godot+C# is the default. Either way, build a dependency-free, tested rules core first and keep the renderer swappable. Next step: a *design* artifact committing to engine + language and laying out the core/render split.
