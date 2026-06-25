---
title: AI Development Timeline
date: 2026-06-25
status: complete
tags: [timeline, report, ai-development, notes]
source: .lore/work/plans/ai-development-timeline.md
modules: [lore, project-history]
---

# AI Development Timeline

## Progress Tracker

- [x] Extract daily git skeleton from author dates.
- [x] Classify each day by changed files, assets, and lore artifacts.
- [x] Cross-reference major lore artifacts and reference documents.
- [x] Identify asset and external-tool events visible in git.
- [x] Draft 2-4 sentence narratives per work day.
- [x] Add evidence and open questions for provenance gaps.
- [x] Review for report readiness.

## Implementation Log

- 2026-06-25: Used `git log --date=short --reverse` as the timeline spine. The represented date range is 2026-06-02 through 2026-06-25, with commits present on every calendar day in that range.
- 2026-06-25: Extracted per-day commit counts, changed-file areas, extension mix, and representative asset/doc paths. Merge commits are preserved in evidence where useful, but the narrative focuses on work outcomes rather than PR mechanics.
- 2026-06-25: Kept tool attribution separate from implementation evidence. Commit subjects containing `[codex]` are treated as git-visible hints, while Copilot, qwen3.6, Claude Code, Suno, ElevenLabs, Flux, and ChatGPT provenance remains unconfirmed unless the user supplies memory or metadata.

## Timeline

### 2026-06-02

The project began with both code scaffolding and a substantial planning layer: initial vision, research, POC core-loop spec, plan, task breakdown, and implementation all landed on the first day. The first playable foundation appears to have focused on proving the deckbuilding loop, seeded simulation, and Phaser-based game surface before committing to deeper content. The early workflow already used lore artifacts as part of the build process, which matters for the final report because the repo preserved intent alongside code from the start.

Evidence: `5025269 Initial commit`; `4f30d8e docs: initial vision and research documentation.`; `4a305cc docs: POC core-loop design, spec, plan, and task breakdown`; `500e4a0 feat: implement POC core loop (Steps 1-9)`; `.lore/work/specs/poc-core-loop.html`; `.lore/work/research/game-engine-for-ai-development.html`. Tool attribution: unknown.

### 2026-06-03

The second day shifted from raw loop viability toward concept, presentation, and project framing. AI style drafts, rough mockups, README/CONTRIBUTING docs, and world-deck/targeting design artifacts suggest the game was being given a visual and mechanical direction after the first code proof existed. This is one of the first clear memory-reconstruction days: git proves AI style draft assets were stored, but not which image system produced them or how much iteration happened outside the repo.

Evidence: `ffc8286 store AI style drafts`; `00353f4 rough-in design concept`; `870c23c docs: add README and CONTRIBUTING`; `4c3ec1a docs: add world deck and targeting design artifacts`; `.lore/work/notes/art-style.webp`; `.lore/work/notes/rough-mockup.webp`; `.lore/work/specs/world-deck-slice.html`; `.lore/work/design/targeting-interaction.html`. Tool attribution: unknown for image generation, git-visible AI asset note.

### 2026-06-04

This was the first very dense implementation day: the world-deck slice was planned, built, fixed, and merged, then visual identity was specified, planned, implemented, and retrospectively documented. The game moved from a core loop toward a more inspectable card experience, including self-describing card faces, discard behavior, targeting fixes, theme seams, and major visual polish. The day shows an early pattern that repeats later: specification and task breakdown, implementation, immediate bug repair, then visual/content polish.

Evidence: `50d7982 feat: implement world-deck-slice core and renderer (steps 1-9)`; `b922503 fix: send played player cards to discard so the deck reshuffles correctly`; `a48efaf feat: self-describing card faces in the world-deck renderer`; `41a6490 feat: implement visual identity & world-theme seam (REQ-VIS-1..18)`; `b7a27d9 Visual polish pass: art updates, card fronts, legibility (#3)`; `.lore/work/specs/visual-identity.html`; `.lore/reference/visual-direction.html`. Tool attribution: unknown.

### 2026-06-05

The work turned toward data shape, correctness, and readability. Card data was externalized into JSON, effects were unified, end-screen layering was fixed, targeting clarity improved, and rendering crispness under scaled display became important enough to receive a dedicated fix. This looks like the project learning where generated or rapidly-produced code needed stronger contracts: data catalogs, clearer effects, and display polish all became explicit.

Evidence: `63ac58c feat: externalize card data to JSON, thread explicit catalog (#4)`; `27431ee refactor: unify CardEffect and add onEndOfTurn to WorldCard (#6)`; `5484af8 feat: target clarity before commit and partial hazard progress (#8)`; `1d1e02c fix: render card/HUD text crisp under Scale.FIT upscaling (#9)`; `.lore/work/specs/card-data-externalization.html`; `.lore/work/brainstorm/player-feedback-selection-and-progress.html`. Tool attribution: unknown.

### 2026-06-06

Renderer complexity became a major theme: presentation logic was split out, card/HUD rendering was expanded, and the game started serving lore docs at `/lore/`. The asset set grew with theme images and card insets, while gameplay effects, HP handling, pile labels, and deployment behavior were refined. The JSON data URI deployment bug is a useful report example because it shows the kind of practical build/deploy issue that appears after local AI-assisted feature work looks complete.

Evidence: `a5b04a7 refactor(render): split presentation logic and shared components from render.ts (#11)`; `7e905aa feat: serve .lore design docs at /lore/ (#12)`; `12a79ff feat: implement card rendering and HUD for game view (#13)`; `0d8ec4b feat: refine gameplay effects, visuals, and HP handling (#17)`; `21f5a98 fix: JSON world files inlined as data URIs, breaking deployed site (#19)`; `src/game/assets/insets/*`; `src/game/assets/themes/*`. Tool attribution: unknown.

### 2026-06-07

The game expanded beyond a single theme and started building toward repeatable world authoring. Bird-building and highway-volcano themes arrived, the player energy resource system landed, and new effects such as player exhaust, world self-transform, and ForceDestroy broadened the rules engine. Several commits are explicitly marked `[codex]` for card inset additions, giving at least one git-visible indication of Codex involvement in asset/content integration, though the source of the actual images still needs confirmation.

Evidence: `04967b9 Add bird-building and highway-volcano themes + authoring rules (#24)`; `e913c3a feat: implement player energy resource system (#25)`; `2611234 [codex] Add highway volcano card insets (#26)`; `1c65d9b [codex] Add bird building card insets (#27)`; `069d417 feat: new card effects - player exhaust + world self-transform (+ ForceDestroy) (#28)`; `.lore/reference/theme-authoring.html`; `.lore/work/specs/player-energy-resource.html`. Tool attribution: inferred Codex for commits labeled `[codex]`; image provenance unknown.

### 2026-06-08

This day tightened the player-facing structure around the expanding game: zombie insets were refreshed, energy visuals were updated, world select and help overlay were implemented, and card effects/keywords were rebalanced. The presence of both UX shell work and balance changes suggests the game was moving from "can play a run" toward "can understand and choose a run." Codex is again visible in commit labels for inset and icon updates, but the broader design/tool split is not recorded in git.

Evidence: `d16526f [codex] Refresh zombie card insets (#30)`; `b38f37c [codex] Update energy icon (#32)`; `fc1a9d7 feat: world select screen and help overlay (#33)`; `7ebfd96 chore: update card effects and keywords for gameplay balance (#34)`; `.lore/work/specs/world-select.html`; `.lore/work/specs/help-screen.html`; `src/game/assets/energy.webp`. Tool attribution: inferred Codex for labeled commits; other tool use unknown.

### 2026-06-09

The codebase received a view-layer refactor while audio entered the project in a concrete way. Renderer constants were centralized, cards/HUD/modal/end/help UI were split into views, world-specific music playback was added, and branding assets appeared. This day is important for the report because it combines a maintainability pass with a new media pipeline, suggesting the project was becoming large enough that structure and ambience both mattered.

Evidence: `fc46061 [codex] Centralize renderer layout constants (#35)`; `a7bde10 Add world-specific music playback (#36)`; `3ddb36b [codex] Refactor cards into CardView (#38)`; `1d08f2f [codex] Refactor HUD into HUDView (#39)`; `81e3033 [codex] Refactor help overlay into view (#42)`; `2f500ec Refactor view layering and add branding assets (#43)`; `src/game/assets/audio/*-music.mp3`. Tool attribution: inferred Codex for labeled refactors; music source unknown.

### 2026-06-10

The day appears narrower and more architectural: end-screen cleanup and generalized selection targeting landed alongside brainstorm/planning material for meta-progression and shard response archetypes. That suggests the project paused from broad asset/content expansion to make interaction mechanics more reusable. The lore additions also hint that larger progression ideas were being explored before the later unlock and destiny systems arrived.

Evidence: `90f2ffe Refactor end screen interactions and scene cleanup (#46)`; `194bb9e Generalize selection targeting (#47)`; `.lore/work/brainstorm/shard-response-archetypes.html`; `.lore/work/brainstorm/shattered-worlds-meta-progression.html`; `.lore/work/notes/generalize-selection-targeting.html`; `CLAUDE.md`. Tool attribution: unknown.

### 2026-06-11

The project added power-up icons, regenerated themed inset artwork, and introduced the overgrown mall world with carousel selection. This was a content-and-presentation day, with enough asset churn to indicate image iteration was a significant part of the work. The `[codex]` labels point to Codex involvement in integrating or generating parts of the artwork/world work, but the actual image-generation model and amount of manual selection remain open questions.

Evidence: `c1440c7 [codex] Add HUD power-up icons (#48)`; `a940569 [codex] Regenerate themed inset artwork (#49)`; `6877bb9 [codex] Add overgrown mall world and carousel selection (#50)`; `7a99b71 [codex] Add overgrown mall inset artwork (#51)`; `.lore/work/specs/overgrown-mall.html`; `.lore/work/brainstorm/new-world-concepts.md`; `src/game/assets/themes/overgrown-mall/*`. Tool attribution: inferred Codex for labeled commits; image provenance unknown.

### 2026-06-12

Instrumentation and player history became first-class systems. Gameplay events, telemetry runtime, stats persistence, and stats views landed, with overgrown mall music and visual polish alongside test expectation fixes. This is a strong inflection point for the report because the project began collecting play data that could support balancing and evaluation rather than relying only on feel.

Evidence: `ac7850a Add gameplay event stream, telemetry runtime, and visual polish (#52)`; `17c2073 added overgrown-mall-music (#53)`; `0367a69 [codex] finish stats persistence and views (#54)`; `73fe3eb [codex] Fix destroyIds test expectations (#55)`; `.lore/work/specs/gameplay-event-stream.md`; `.lore/work/specs/stats-persistence-and-player-views.html`; `src/game/assets/audio/overgrown-mall-music.mp3`. Tool attribution: inferred Codex for labeled commits; music source unknown.

### 2026-06-13

Help and effect comprehension improved, then the internals were reorganized for scale. The help overlay gained an icons reference, effect presentation became more readable, effect handling moved into a registry, and world data was consolidated into one folder per world with derived manifests. This looks like a maintenance and authoring-efficiency day: the game had enough effects/worlds that both players and the codebase needed clearer organization.

Evidence: `5fa7b48 Add Icons reference page to the help overlay (#56)`; `c97e4c1 [codex] Improve help screen readability and effect presentation (#57)`; `06ea022 [codex] card-effect handler registry (#58)`; `3aefda0 [codex] world consolidation - one folder per world, derived manifests (#59)`; `.lore/work/design/card-effect-registry.md`; `.lore/work/design/world-consolidation.md`. Tool attribution: inferred Codex for labeled commits.

### 2026-06-14

Fog Beach Party introduced a new world mechanic around conceal, and the numeric-keyword engine broadened how card text could map to behavior. The same day included multi-pick highlighting, regenerated intrusion overlays, balance passes, starter-deck groundwork, extended run telemetry profiles, lore reference cleanup, and door positioning. This was a high-volume integration day: new content, engine expressiveness, telemetry, balance, assets, and documentation all moved at once.

Evidence: `354434e Fog Beach Party world (conceal) + numeric-keyword engine (#60)`; `56323fe picked highlight for in-progress multi-pick batch cards (#61)`; `4648416 [codex] Regenerate intrusion overlays (#62)`; `05a8de3 Various Balance passes and first steps to starter decks. (#63)`; `db06406 [codex] Add extended run telemetry profiles (#64)`; `4862add Lore reference refactor and cleanup (#65)`; `.lore/reference/fog-beach-party-world.html`; `.lore/work/specs/extended-run-telemetry.md`. Tool attribution: inferred Codex for labeled commits; image provenance unknown.

### 2026-06-15

Meta-progression arrived in earnest through feat evaluation, Memory Fragment rewards, unlock implementation, and tooltip support. The content set also jumped with three mythical worlds, fog beach music, screen backdrop art, and dialog UX cleanup. This day is likely one of the bigger "AI content production" candidates, but git can only prove the assets and systems landed; it cannot identify which external generators produced music or images.

Evidence: `3402325 added actual music for fog-beach-party (#68)`; `5fc51eb Feat evaluation and Memory Fragment rewards (#69)`; `1ea8b20 added 3 new mythical worlds. (#70)`; `22f7a7e [codex] Implement unlock system (#71)`; `9b8dd34 [codex] Add card icon tooltips (#72)`; `b8180c4 Add screen backdrop art and fixed a tooltip crash (#73)`; `.lore/work/specs/unlock-system.md`; `.lore/work/brainstorm/feat-definitions.md`. Tool attribution: inferred Codex for labeled commits; music/image provenance unknown.

### 2026-06-16

The Chronicle and feat systems were expanded, mobile scroll was fixed, and Whiteout Parking Garage was implemented as another world. The day mixed retention/progression work with new content and mobile usability, which suggests the project was becoming more complete as an actual game rather than a desktop-only prototype. The new world's freeze/heat-adjacent assets and docs make it another place to ask about image-generation workflow.

Evidence: `900ccdd Added tabbing to the Chronicle page with a feats list on the second tab (#75)`; `d632346 Added more feats, and balance pass (#76)`; `03577e0 Fixed mobile scroll (#77)`; `10db361 Whiteout Parking Garage world impl v1 (#78)`; `.lore/work/specs/whiteout-parking-garage.md`; `src/game/assets/themes/whiteout-parking-garage/*`. Tool attribution: unknown.

### 2026-06-17

Fortune boon cards and act rewards were added, introducing a more explicit reward layer between worlds or acts. The changed files include new card insets and a spec/plan/notes trail, so this was not just a small tuning change; it created a new reward vocabulary for progression. This work set up later boon-choice fixes and card-view reuse.

Evidence: `2753a08 feat/act reward (#79)`; `.lore/work/specs/fortune-boon-cards.md`; `.lore/work/plans/fortune-boon-cards.md`; `.lore/work/notes/fortune-boon-cards.md`; `src/game/assets/insets/inset-fortune-*.webp`. Tool attribution: unknown.

### 2026-06-18

The progression system became more dynamic: effective card modifiers, world access locks behind Destiny unlocks, unlock art, and boon-as-world-reward support all landed. The day also included balance repair for Strong Barricade and new freeze/thaw icons, tying mechanical changes back into player-readable UI. Codex is visible for the effective card modifiers commit, while the unlock art and icon provenance still needs user confirmation.

Evidence: `df264be [codex] Implement effective card modifiers (#80)`; `2da397e Rebalanced and fixed the Strong Barricade ability. (#81)`; `3b7dc56 Added system for locking worlds behind Destiny unlocks (#82)`; `1879c97 Visual Cleanup of destiny and world select scenes AND lock bird-building map (#83)`; `44df6c3 Added icons for freeze + thaw.`; `8c07f48 Added the ability for a world reward to be a boon (#84)`; `.lore/work/specs/effective-card-modifiers.md`; `.lore/work/specs/world-access-unlocks.md`. Tool attribution: inferred Codex for labeled commit; image provenance unknown.

### 2026-06-19

Boon choice behavior was hardened, main theme music was added, and boon UI was moved toward the shared card view. The action-preview system then landed, giving players a clearer look at consequences before committing to a card action. This is a strong UX maturation day: fewer edge-case surprises, more consistent presentation, and a new confirmation/readability layer.

Evidence: `dcfe277 Fixed boon choice edge cases for multiples (#85)`; `3446b40 Added main theme music (#86)`; `26eee8f Fixed boon choice so it shows the exhaust keyword. (#87)`; `36bcc89 Switched boon to use card view (#88)`; `5044f43 Implemented card action preview (#89)`; `.lore/work/specs/action-impact-preview-and-confirmation.md`; `src/game/assets/audio/main-theme.mp3`. Tool attribution: music source unknown.

### 2026-06-20

The rarity system landed, followed by cleanup, rebalance, and comment cleanup in TableScene. Compared with the previous content-heavy days, this was more about reward distribution and maintainability. The rarity work matters for the report because it shows the design moving from hand-authored content volume toward systems for pacing and replayability.

Evidence: `0881e64 Card rarity system (#90)`; `a7a762d Numerous cleanup and rebalance (#91)`; `9ca2223 Cleanup comments on TableScene (#92)`; `.lore/work/specs/rarity-system.md`; `.lore/work/brainstorm/rarity-system.md`; `.lore/work/issues/rarity.md`. Tool attribution: unknown.

### 2026-06-21

Three more worlds were implemented, then bug fixes, unit test fixes, feature copy updates, and visual/audio updates followed immediately. The asset mix included multiple world music files, sound FX, new effect icons, and many themed card insets, making this one of the clearest "content scale-up" days. This day will need user memory for the findings report because the repo shows rapid multi-world production but not the prompting, selection, rejection, or editing process behind the assets.

Evidence: `6194839 Implemented 3 new worlds (#93)`; `879d9ec Fixed some bugs with cards in the new worlds (#94)`; `aad0d51 Fixed some unit tests (#95)`; `3b7e088 Fixed feature copy (#96)`; `040df67 Several visual and audio updates. (#97)`; `.lore/work/specs/city-of-sleeping-giants.md`; `.lore/work/specs/the-ember-orchard.md`; `.lore/work/specs/the-tidal-archive.md`; `src/game/assets/audio/*`; `src/game/assets/themes/city-of-sleeping-giants/*`. Tool attribution: music/image/FX provenance unknown.

### 2026-06-22

The project tightened data and card infrastructure. Discard chooser scrolling was added, a contractor deck asset link was fixed, signature rarity landed, and all cards were converted into a single JSON catalog. This is another maintainability inflection point: after rapid content growth, the data model was consolidated to make future card work easier and less fragmented.

Evidence: `5ed7423 Added scrolling to discard chooser. (#98)`; `72a9134 fixed contractor deck asset linkage (#99)`; `1790aac Added signature rarity. (#100)`; `fa934bc Converted all cards into a single json (#101)`; `.lore/work/plans/plan-unified-card-catalog.md`; `src/data/*`. Tool attribution: unknown.

### 2026-06-23

Audio controls and sound effects became more complete, while rarity, starter decks, and boon balance were adjusted. Sound volume settings, several FX files, and more starter deck work suggest the game was moving into a polish/balance phase where repeated play and sensory feedback mattered. The FX files are visible in git, but whether they came from ElevenLabs, another source, or manual editing needs confirmation.

Evidence: `9d80665 Added sound volume settings (#102)`; `e563cec Rebalanced Rarity + added FX (#103)`; `0c61d29 Added more starter decks + rebalance boons (#104)`; `.lore/work/plans/sound-volume-settings.md`; `src/game/assets/audio/fx/baseball-bat.mp3`; `src/game/assets/audio/fx/floor-it.mp3`; `src/game/assets/audio/fx/push-through.mp3`; `src/game/assets/audio/fx/shotgun.mp3`; `src/game/assets/audio/fx/zombie-moan.mp3`. Tool attribution: FX provenance unknown.

### 2026-06-24

The day combined final-feeling polish with documentation cleanup: two more FX were added, act boon timing changed, destiny images were updated, an asset bug was fixed, and lore docs received a first broad update pass. The large markdown/reference churn suggests attention shifted toward making the repo explain itself after the main implementation push. This is likely the start of preparing the project for review and report-writing rather than pure feature expansion.

Evidence: `2201868 added 2 more FX (#105)`; `6cf9a18 Changed actboon to trigger mid reduction. (#107)`; `e2567ca updated destiny images. (#108)`; `96918a2 Fixed an asset bug and updated lore docs (first pass) (#109)`; `.lore/reference/*.md`; `src/game/assets/audio/fx/bonfire.mp3`; `src/game/assets/audio/fx/grinding-girders.mp3`; `src/game/assets/unlocks/*.webp`. Tool attribution: FX/image provenance unknown.

### 2026-06-25

The latest git-visible day focused on reference drift and root documentation. Reference docs were reconciled against source, and root markdown files were updated based on that drift work. This is a natural handoff point into the findings report: implementation evidence has been consolidated, but tool/process memory still needs to be reconstructed from the user and any non-git artifacts.

Evidence: `82d1b30 Resolved reference drift against source. (#110)`; `996caf5 Updated the root MD files based on source drift. (#111)`; `.lore/reference/*.md`; `README.md`; `CONTRIBUTING.md`; `CLAUDE.md`. Tool attribution: unknown.

## Classification Summary

- Planning/docs were present from the first day and returned heavily on 2026-06-14, 2026-06-24, and 2026-06-25.
- Core gameplay moved fastest from 2026-06-02 through 2026-06-08, then continued through targeting, rewards, boons, rarity, and card modifiers.
- Renderer/UI/UX work was sustained across most of the project, with especially large pushes on 2026-06-05, 2026-06-06, 2026-06-09, 2026-06-13, 2026-06-19, and 2026-06-23.
- World/content authoring accelerated after 2026-06-07, with major world additions on 2026-06-11, 2026-06-14, 2026-06-15, 2026-06-16, and 2026-06-21.
- Audio/music entered on 2026-06-09 and became a recurring polish layer through 2026-06-23 and 2026-06-24.
- Meta-progression became visible around 2026-06-10 as brainstorm material, then landed materially from 2026-06-15 through 2026-06-18.
- Data consolidation happened in waves: card JSON externalization on 2026-06-05, world consolidation on 2026-06-13, and unified card catalog work on 2026-06-22.

## Open Provenance Questions

- Which days or phases used Copilot, qwen3.6, Codex, and Claude Code respectively? Git only exposes `[codex]` labels for some commits.
- Which images came from Flux versus ChatGPT image generation, and which were manually edited after generation?
- Which music files came from Suno, and were any tracks edited or converted manually before commit?
- Which FX files came from ElevenLabs, and were there discarded generations that affected workflow time?
- Were the early AI style drafts on 2026-06-03 generated in ChatGPT, Flux, or another tool?
- Which parts of the lore/spec/plan workflow were generated directly by assistants versus written or heavily directed by the user?
- Where did AI output require the most repair: TypeScript correctness, Phaser rendering, game balance, asset linkage, mobile layout, deployment, or docs?
- Which days had substantial non-git work, such as prompting, image selection, music generation, or desktop app comparison?

## Answered Provenance Notes

Tool use was not cleanly separated by day. The user moved between tools frequently, and model choice was often based on task feel rather than a fixed schedule. Git-visible `[codex]` labels remain useful evidence for specific commits, but the timeline should avoid assigning exact tool ownership where the repo does not preserve it.

Copilot was used mostly early on for writing pull requests, not as the main implementation partner. Its harness felt too limited for the user's workflow because it ultimately routed to Anthropic or OpenAI models anyway, making it preferable to use a harness built around the desired model directly. qwen3.6 was used through pi.dev and worked best for small, well-defined tasks; it tended to drift, get confused, or lose the thread on longer-running work.

Claude model choice depended on task shape. Sonnet was useful for brainstorming, where slightly wrong questions could still be productive, and for research-style lookup/report work. Opus was generally used for specs and planning. Sonnet was also used for implementation when the work was already scoped. ChatGPT could handle the whole workflow, especially implementation from a clear plan, but its more holistic planning tendency could make plans too expansive.

ChatGPT web app was used for broader concept art and reality/world images. It was useful because it behaved creatively and somewhat randomly, which was acceptable when generating multiple candidates and selecting a direction. The early AI style drafts from 2026-06-03 were also generated in ChatGPT as part of the first design exploration; they produced detailed-looking mockups, but those mockups were not directly usable because many practical game UX details were missing.

Codex's imagegen skill behaved differently from ChatGPT image generation: it was more prescriptive, repeatable, and consistent, which made it better for constrained generation where consistency mattered more than broad ideation. Flux 2.0 Pro was used for the card insets for Ember Orchard, Tidal Archive, and City of Sleeping Giants. Those images skewed more cartoony, which fit the otherworldly tone of those worlds, though this may have come partly from Claude-generated prompts rather than Flux alone. The intended general inset direction was graphic novel style, but ChatGPT did not reliably adhere to that; Whiteout Parking Garage insets came out especially realistic and may be regenerated.

All committed music files came from Suno. The workflow used custom skill files with Claude to build lyrics and production prompts, then those prompts were given to Suno. No manual audio editing was done before commit. Some later songs used Opus for prompt generation and came out less creative and more corporate-sounding, so the prompt-generation model materially shaped the final music.

All committed FX files were generated with ElevenLabs. Some outputs did not sound right as generated, so Audacity was used for manual cleanup and composition. The edits typically involved combining multiple ElevenLabs generations, adding fades, applying effects, and producing a slightly longer sound that felt better in game. There were discarded or partially used generations, and that affected workflow time because the useful result sometimes came from assembling fragments rather than accepting a single generation. The current FX quality is considered a weak point, possibly due to the difficulty of sound-design prompting; a future sound-design prompt-generation skill may help.

The lore, spec, and plan files were not written directly by a human. They were assistant-generated project memory, with the human role focused on direction, review, and correction. At most, the user would comment on a lore file and have an assistant integrate those comments into the document.

The largest area of direct human repair was game balance. Some Phaser rendering issues also needed manual correction, especially when the desired interaction or visual behavior was hard to explain precisely. Manual implementation happened when explaining the change to an AI would take more effort than making the change directly, when the user simply wanted to add a feature quickly, or when the existing lore/spec/plan artifacts would make the assistant resist the needed change.

The sound FX implementation is one example of a manually added feature. The ActBoon timing change is another: the original behavior only drew the ActBoon at the start of a turn, but that design was wrong because mid-turn reductions could matter. Rather than revise the spec, make a new plan, and convince the assistant to update the implementation against the corrected design, the user changed it directly.

A key workflow finding is that AI assistants sometimes treated specs as authoritative law rather than provisional project memory. That became a problem when yesterday's design needed to change. Assistants could also over-prioritize the quickest route to implementation or adherence to existing patterns, which made them less helpful when the real goal was correctness or a meaningful refactor.

Substantial non-git work cannot be reconstructed reliably. If logs or committed artifacts do not show prompting, image selection, music generation, or desktop app comparison time, then that evidence does not exist for the report. The timeline should mark this as an explicit provenance gap rather than inferring daily effort where logs do not exist.

## Report-Readiness Notes

- The timeline is strong enough to support sections on speed, content scale, refactor pressure, documentation-as-memory, and provenance gaps.
- The repo shows many cases where rapid feature/content generation was followed by consolidation: renderer splitting, effect registry, world consolidation, unified card JSON, and reference drift cleanup.
- The main missing evidence is not what changed, but how the work felt and which tool produced which kind of output. Those questions should be answered by short user annotations before drafting final findings.
