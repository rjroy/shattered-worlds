# Game Engine Choice: TypeScript Core with Phaser Renderer

<!--
date: 2026-06-15
status: current
tags: engine-choice, typescript, phaser, godot, ai-assisted-development, testing
fg-type: decision
fg-sources: .lore/work/research/game-engine-for-ai-development.html, .lore/work/design/core-render-architecture.html
fg-status: current
-->

The project settled on a TypeScript implementation with Phaser as a thin renderer over a pure TypeScript rules core. The research initially found Godot plus C# to be the default native-engine choice for a typed, testable 2D deckbuilder, but the web distribution and AI-assisted development loop made the TypeScript web stack the practical route for this project.

## Rationale

A deckbuilder is mostly state machine and text-heavy UI. The stack should optimize for typed game logic, deterministic tests, fast iteration, browser reach, and an API surface the AI can work with reliably. Three.js was rejected because it solves a 3D rendering problem the game does not have. Bevy/Rust offered strong compiler feedback but had too much framework churn for AI-assisted development.

Phaser is allowed to own presentation, input, animation, and canvas concerns. It is not allowed to own rules. That keeps the hard part of the game testable without browser, DOM, canvas, or animation timing.
