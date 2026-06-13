---
title: "Simplify notes: card-effect handler registry"
date: 2026-06-13
status: complete
tags: [simplify, cleanup, notes, card-effect, registry]
source: .lore/work/notes/card-effect-registry.md
modules: [core-engine, core-effects]
related: [.lore/work/notes/card-effect-registry.md]
---

# Simplify notes: card-effect handler registry

## Scope

Cleanup phase for the card-effect handler registry implementation note. Work stayed inside the requested primary write scope and preserved behavior.

Changed files:

- `src/core/effects/composite.ts`
- `src/core/effects/registry.ts`
- `src/core/engine/available.ts`
- `src/core/engine/effects.ts`

## Simplifications

- Reused the shared `effects/tokens.ts` `main` and `text` helpers in `composite.ts` instead of keeping local duplicate token constructors.
- Removed stale transitional comments from `registry.ts` that still described the Step 5 fallback even though the registry is now exhaustive.
- Removed an obsolete recursion-entry comment in `available.ts` whose cycle description no longer matched the final import graph.
- Converted `engine/effects.ts` facade exports to direct re-exports so the module only imports what `applyEffect` itself uses.

## Verification

- `bun run typecheck` passed.
- `bun run test` passed: 627 pass, 0 fail.
- `bun run lint` passed.
- `bun run build` passed. Vite still reports the existing large-chunk warning.
