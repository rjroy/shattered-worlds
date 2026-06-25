---
title: AI Development Timeline Plan
date: 2026-06-25
status: executed
tags: [plan, timeline, report, ai-development]
modules: [lore, project-history]
---

# AI Development Timeline Plan

## Goal

Generate a day-by-day timeline of the Shattered Worlds development process, starting from git history and enriching it with project artifacts. The target output is 2-4 sentences per work day that captures what changed, why it likely changed, how the work evolved, and where AI/tool involvement can be inferred or corroborated.

This plan intentionally stops before writing broad conclusions about AI-assisted development. The timeline should become evidence for the later findings report, not a retrospective argument written too early.

## Source Material

- `git log` grouped by author date, with commit hashes, subjects, bodies, and changed-file summaries.
- `git show --stat` / `git diff --stat` for daily change shape and asset/code/doc balance.
- `.lore/work/**` for contemporaneous specs, brainstorms, research, plans, and implementation notes.
- `.lore/reference/**` for later-refined explanations of systems that landed during each period.
- Root documentation such as `README.md`, `CONTRIBUTING.md`, and any process notes.
- Asset directories and metadata where useful for identifying music, FX, images, or generated art additions.
- User recall notes for tool attribution that git cannot prove, especially Copilot, qwen3.6, Codex, Claude Code, Suno, ElevenLabs, Flux, and ChatGPT image generation.

## Output Shape

Produce `.lore/work/notes/ai-development-timeline.md` with:

- One section per calendar day from 2026-06-02 through the latest development day represented in git.
- 2-4 concise narrative sentences per day.
- A short evidence line per day listing representative commits and relevant lore/docs.
- A separate uncertainty section for tool/source attribution that needs user confirmation.

The timeline should distinguish these kinds of work when evidence supports it:

- Gameplay systems and balance.
- Renderer/UI/UX work.
- World and content authoring.
- Audio, FX, and image asset production.
- Lore/documentation/planning work.
- Refactors and bug fixes.
- AI workflow/process observations.

## Step 1: Extract Daily Git Skeleton

Generate a machine-readable daily skeleton from git:

- Date.
- Commit count.
- Representative commit hashes and subjects.
- Files changed by extension and top-level area.
- Added/removed line counts where helpful.
- Merge/PR numbers when present.

Use author dates for the first pass because the question is about days of work. Preserve commit hashes so every sentence can be checked later.

Validation:

- Confirm the date range matches `git log --date=short --reverse`.
- Confirm every commit appears under exactly one day.
- Confirm merge commits are either summarized separately or folded into the day without double-counting their diff.

## Step 2: Classify Each Day's Work

For each day, classify the work into a small set of tags:

- `planning-docs`
- `core-gameplay`
- `card-data-content`
- `world-content`
- `rendering-ui`
- `assets-art`
- `audio-fx`
- `progression-unlocks`
- `telemetry-stats`
- `balance`
- `refactor`
- `bugfix`
- `deployment-build`

Use changed paths and lore doc titles as the main signals, not commit message wording alone. Keep classifications multi-label because most days mix code, content, and tuning.

Validation:

- Spot-check at least one representative diff per active day.
- Check days with broad commit messages such as "cleanup", "visual updates", or "rebalance" more carefully.
- Mark uncertain classifications instead of forcing precision.

## Step 3: Cross-Reference Lore Artifacts

Map `.lore/work` and `.lore/reference` documents to the nearest day by file history:

- Use `git log --follow -- <path>` for important docs.
- Prefer original work artifacts for intent and reference docs for final system descriptions.
- Note when reference docs were created after implementation so the timeline does not imply they existed earlier.

Validation:

- For each day, include only docs that existed by that date or explicitly label later docs as retrospective evidence.
- Confirm specs/plans marked implemented or executed line up with related commits.

## Step 4: Identify Asset and External-Tool Events

Build a daily list of asset additions and changes:

- Music files and music wiring.
- Sound FX files and volume/settings work.
- Image additions, regenerated art, world art, card insets, icon work, and destiny images.
- Any asset naming or metadata that suggests source/tool.

Separate what git proves from what requires memory. Git can prove that an asset changed; it usually cannot prove whether Suno, ElevenLabs, Flux, ChatGPT, or another tool produced it.

Validation:

- Include file paths for representative asset additions.
- Create an "ask user" list for days where asset provenance matters to the final report.

## Step 5: Draft Daily Narratives

Write the first timeline draft from the evidence:

- 2-4 sentences per day.
- Start with the day's main development arc, not a commit list.
- Mention important inflection points: first playable loop, visual identity, world proliferation, music/FX, unlocks, meta-progression, balance, refactors, and documentation cleanup.
- Preserve uncertainty with phrases like "the evidence suggests" only where needed.

Validation:

- No day should merely paraphrase commit subjects.
- Each day should answer at least two of: what changed, why it mattered, how the project direction shifted, what kind of AI-assisted work is visible.
- Avoid final report conclusions unless directly supported by the day's evidence.

## Step 6: Add Evidence and Open Questions

Append compact evidence under each day:

- Representative commits: `hash subject`.
- Relevant docs/assets: paths only.
- Tool attribution confidence: `confirmed`, `inferred`, or `unknown`.

Collect open questions for the user:

- Which tools were used on which phases?
- Which outputs were kept mostly as generated, heavily edited, or discarded?
- Where did each assistant/tool perform well or poorly?
- Which days had substantial work outside git, such as prompting, image iteration, music generation, or desktop app use?

Validation:

- Every direct tool attribution must be confirmed by user memory, file metadata, or written notes.
- Inferred attribution must be clearly labeled.

## Step 7: Review for Report Readiness

Review the timeline as source material for the later findings report:

- Check for missing days or implausibly thin days.
- Check whether the narrative captures both successes and friction.
- Check whether the timeline separates project outcome from workflow evaluation.
- Check whether it exposes enough prompts for memory reconstruction.

Validation:

- The final timeline should support later sections on speed, quality, failure modes, tool specialization, asset generation, code review burden, and memory/provenance gaps.
- Remaining unknowns should be explicit enough that the user can fill them in with short notes rather than rereading the whole repository.
