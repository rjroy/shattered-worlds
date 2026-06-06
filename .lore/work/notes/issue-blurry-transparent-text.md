# Issue: card/HUD text renders semi-transparent and blurry

- **Status:** fixed (pending HiDPI visual confirmation)
- **Date filed:** 2026-06-05
- **Date fixed:** 2026-06-05
- **Area:** Phaser rendering (`src/game/render.ts`, `src/game/main.ts`)
- **Blocked on:** ~~in-flight render.ts refactor~~ — landed; fix applied after.

## Resolution

Implemented the proposed fix:

1. Added a shared `textStyle()` factory in `render.ts` that injects
   `resolution: window.devicePixelRatio || 1` (guarded for non-DOM test envs).
   All ~20 text call sites across `render.ts`, `TableScene.ts`, and `piles.ts`
   now route through it, so DPI is set in one place.
2. Added `render: { roundPixels: true }` to the game config in `main.ts`.
3. Antialias left on, `pixelArt` left off (per the plan).

Confirmed: no game-level `resolution` exists in Phaser 3.90 config (checked
`node_modules/phaser/src/core/Config.js`), so per-object resolution is the only
path. typecheck, lint, and all 240 tests pass. Still needs a visual check on a
HiDPI display, which automated tests cannot cover.

## Symptom

The glyphs themselves look faded (semi-transparent) and soft (blurry), most
visible on the small text: 11px effect block, 9px keyword/penalty/reward/held
lines, 8px labels.

## Root cause

Not an opacity setting. Nothing in `render.ts` sets alpha on text objects (the
only `setAlpha` is `dimCard`, which dims a whole card container for unplayable
state, not the characters). Transparency and blur are the same root cause:
text rasterized at base resolution and then upscaled.

Two compounding factors:

1. **FIT upscaling.** Canvas is fixed at 900x600 (`main.ts:6-7`) and
   `Phaser.Scale.FIT` (`main.ts:11`) stretches it to the window. Unless it
   displays at exactly 900x600, every pixel is bilinearly resampled.
2. **Text resolution = 1.** Phaser Text rasterizes glyphs at 1 device-pixel per
   game-pixel. On a HiDPI/Retina display (devicePixelRatio 2) that is already
   half the physical resolution before FIT scaling applies.

Anti-aliased edges of small fonts get smeared across more physical pixels. The
dark ink averages with the background, which *is* partial transparency, hence
both the haze and the softness from one cause.

## Proposed fix

1. Set a per-object `resolution: window.devicePixelRatio || 1` on text styles.
   The game-level `resolution` config was removed in Phaser 3.50+, so per-object
   is the supported path. Best done via a shared text-style factory so DPI is
   set in one place instead of on the ~10 `scene.add.text(...)` call sites in
   `render.ts`.
2. Add `render: { roundPixels: true }` to the game config (`main.ts`) to snap
   draws to whole pixels and remove sub-pixel smear. `setOrigin(0.5, ...)` on
   odd-width text (`CARD_W = 150`) currently produces fractional x positions.
3. Keep antialias on (default for WebGL with `type: AUTO`); do **not** set
   `pixelArt: true`.

## Notes

- A shared text-style factory is a good incidental cleanup: it centralizes DPI,
  the `TEXT` color palette, and the repeated `fontSize`/`wordWrap`/`align`
  patterns. Worth aligning with whatever shape the current refactor leaves.
- Verify on a HiDPI display; the effect is far stronger there than at 1x.
