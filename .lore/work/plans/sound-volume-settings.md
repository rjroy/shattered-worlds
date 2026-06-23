---
title: Music + FX volume controls implementation plan
date: 2026-06-21
status: draft
tags: [plan, audio, settings, volume, ui, implementation]
modules: [game-runtime, settings-ui, audio]
related: [.lore/work/issues/sound-fx.md]
---

# Music + FX volume controls implementation plan

## Source

No prior spec — this plan is the source artifact. Goal, as agreed with the user:

> Add user-controllable Music (BGM) and FX volume to the settings overlay and wire them into every place sound is played. Today all volumes are hardcoded; there is no user control.

Decisions confirmed up front (these constrain the plan):

- **Control type:** draggable sliders (continuous 0–100%), not stepped segments.
- **Slider semantics:** each slider scales the *existing per-sound base volume*. 100% = today's level for that base. Defaults: **Music 100%**, **FX 50%**.
- **Master mute:** a separate toggle that silences everything regardless of the sliders.
- **0% fully mutes** (falls out of the multiply naturally).
- **Live update:** moving the Music slider (or mute) changes currently-playing music immediately.

### Known consequence (accepted)

With FX defaulting to 50% and the model "scale the base," default FX lands at `0.5 base × 0.5 = 0.25` — quieter than today's hardcoded `0.5`. Music at default 100% is unchanged. The user accepted this when choosing the semantics.

## Current state (verified)

Single shared `UserSettingsStore` is created at the composition root (`gameplayRuntime.ts:81`) and injected into scenes. `UserSettings` is `version: 1` with `confirmationMode` + `detailedHoverPreviews`. `SettingsOverlayView` mutates the store through segmented-button controls; its click handlers are public for testability.

Phaser has **no separate music/FX volume bus** — `scene.sound.volume` is a single global. So each channel must be scaled per-sound (`effective = base × channelGain`), and live changes must be re-applied to the live sound object.

Four hardcoded playback sites:

| Site | File:line | Base | Channel | Notes |
|---|---|---|---|---|
| Main/menu theme | `audio/menuMusic.ts:15` | `0.42` | Music | looped; free function takes only `scene` |
| World music | `scenes/TableScene.ts:1167` | `0.45` | Music | looped; ref held as `this.worldMusic` |
| Card one-shot FX | `scenes/TableScene.ts:1147` | `0.5` | FX | fire-and-forget |
| Card looped FX | `view/CardView.ts:623` | `0.5` | FX | loops while card visible |

Two wiring gaps to close:

- `DestinyScene` (`:43`) and `ChronicleScene` (`:46`) start the main theme but are **not** given `userSettings` today.
- `CardView` (`:198`) has no settings access and would need an FX-gain accessor.

## Implementation Strategy

Keep the store dumb (no observer machinery). Live music updates flow through a **per-scene re-apply hook**: the overlay owns no sound objects, so when a volume control changes it persists to the store and then calls an injected `onAudioChange` callback. Each scene wires that callback to re-apply gain to the music it actually owns (`worldMusic`, or the main theme via a `menuMusic` setter). FX is read at play time (one-shots are too short to matter; looped card FX picks up the new gain on its next play).

### Live update is scoped to scenes that own a settings overlay (decided, not open)

Only `WorldSelectScene` and `TableScene` construct a `SettingsOverlayView` today — verified: `DestinyScene` and `ChronicleScene` neither import nor construct it. So the `onAudioChange` live-reapply path exists for exactly those two scenes. Destiny and Chronicle still play the main theme, but they pick up the current gain **fresh at `create()` time** (Step 3 reads `musicGain(settings.get())` when starting the theme); there is no slider reachable from inside them to adjust live, so there is nothing to re-apply live. This is in scope as stated: a user adjusting the slider is always in WorldSelect or Table, and the change is heard immediately there; navigating into Destiny/Chronicle afterward starts the theme at the already-updated gain. Bringing a settings overlay to Destiny/Chronicle is explicitly **out of scope** for this plan.

Compute gain through one tiny pure helper so mute + 0% + clamping live in a single tested place rather than being re-derived at four sites.

## Steps

### 1. Extend the settings data model (DONE)

Files:

- `src/game/runtime/userSettings.ts`
- `src/game/runtime/userSettings.test.ts`
- `src/game/tests/cardObjects.test.ts` — two `UserSettings` fixtures (`DEFAULT_HARNESS_SETTINGS` at `:374`, `settings()` helper at `:2467`) will fail to typecheck once the three new required fields exist; update both.

Changes:

- Add to `UserSettings`: `musicVolume: number`, `fxVolume: number` (both 0–1), `masterMute: boolean`.
- Bump the in-payload `version` `1 → 2`. Update the `version` literal type and all `version: 1` constructions. **Keep the storage key unchanged** at `'shattered-worlds/settings/v1'` (`userSettings.ts:19`): the `v1` in the key is opaque and changing it would orphan existing users' saved prefs. The payload's `version` field is what gates migration, not the key. This mirrors the existing precedent in `src/game/runtime/runStats.ts` (payload `version: 2` under a stable key). Leave a one-line comment at the key constant noting the intentional key/payload-version skew so a future reader doesn't "fix" it.
- `defaultUserSettings()`: `musicVolume: 1.0`, `fxVolume: 0.5`, `masterMute: false`.
- `isUserSettings`: accept `version === 2`; validate the three new keys (numbers finite and within [0,1] after clamping is a load concern — see below; the type guard should at minimum require `typeof number` / `typeof boolean`).
- `loadUserSettings` **migration**: accept stored `version` 1 *or* 2.
  - v1 → re-project `confirmationMode` + `detailedHoverPreviews`, fill the three new defaults, return as v2. Existing users keep their prefs.
  - v2 → re-project all fields, **clamping** `musicVolume`/`fxVolume` to [0,1] and coercing non-finite to the default.
- Keep the "tolerant of unknown future keys" behavior already documented in the file.

Validation gate:

- `bun run test` — `userSettings.test.ts` covers: defaults, v1→v2 migration preserving old prefs, v2 round-trip, out-of-range/NaN clamping, mute persistence.
- `bun run typecheck` reveals every `version: 1` / `UserSettings` construction site that needs updating.

#### Changed files:

1. src/game/runtime/userSettings.ts — Extended the data model:
    - Added musicVolume, fxVolume, masterMute to UserSettings type
     - Bumped version literal from 1 to 2
     - Updated defaultUserSettings() with musicVolume: 1.0, fxVolume: 0.5, masterMute:
       false
     - Added comment on storage key noting the intentional v1/v2 skew
     - Updated isUserSettings type guard for version 2 + new fields
     - Rewrote loadUserSettings with v1→v2 migration (preserving old prefs) and v2
       clamping/coercion
     - Added migrateFromV1() and clampV2() helpers

 2. src/game/runtime/userSettings.test.ts — Updated and expanded tests:
     - Updated all existing test fixtures to version 2 shape
     - Added v1→v2 migration tests (preserves old prefs, double-load no longer needs
       migration)
     - Added clamping/coercion tests (below 0, above 1, NaN/null → defaults)
     - Added mute persistence round-trip test

 3. src/game/tests/cardObjects.test.ts — Updated 3 UserSettings fixtures:
     - DEFAULT_HARNESS SETTINGS, inline construction, and settings() helper

 4. src/game/tests/settingsOverlayView.test.ts — Updated makeFakeStore constructor

### 2. Pure gain helper (DONE) 

Files:

- `src/game/audio/audioVolume.ts` (new)
- `src/game/audio/audioVolume.test.ts` (new)

Changes:

- Export named base constants: `MENU_MUSIC_BASE = 0.42`, `WORLD_MUSIC_BASE = 0.45`, `CARD_FX_BASE = 0.5` (so "100% reference" is explicit and centralized).
- `musicGain(s: UserSettings): number` → `s.masterMute ? 0 : s.musicVolume`.
- `fxGain(s: UserSettings): number` → `s.masterMute ? 0 : s.fxVolume`.
- `effectiveVolume(base, gain)` → `base * gain` (trivial, but keeps the multiply named at call sites).

Validation gate:

- `bun run test` — helper test covers mute (→0 regardless of slider), 0% slider (→0), 100% (→base), mid value, and that mute overrides a non-zero slider.

#### Changed files:

1. src/game/audio/audioVolume.ts — Pure gain helper (new file):
    - Exported base constants `MENU_MUSIC_BASE = 0.42`, `WORLD_MUSIC_BASE = 0.45`, `CARD_FX_BASE = 0.5`
    - `musicGain(s: UserSettings)` returns `s.masterMute ? 0 : s.musicVolume`
    - `fxGain(s: UserSettings)` returns `s.masterMute ? 0 : s.fxVolume`
    - `effectiveVolume(base, gain)` multiplies base × gain

2. src/game/audio/audioVolume.test.ts — Unit tests (new file):
    - Base constant values (3 tests)
    - musicGain: slider passthrough, 0% → zero, mute override regardless of slider (3 tests)
    - fxGain: slider passthrough, mute override, default 50% gain value (3 tests)
    - effectiveVolume: multiplication, zero cases, 100% reproduces base, default-settings roundtrip (4 tests)
    - **Validation:** 13 pass, 0 fail, 26 expect() calls; typecheck clean

### 3. Apply gain at the four playback sites

Files:

- `src/game/audio/menuMusic.ts`
- `src/game/scenes/TableScene.ts`
- `src/game/view/CardView.ts`
- `src/game/view/BoonChoiceView.ts` — also constructs `CardView` (`:148`); its constructor change ripples here.

Changes:

- `startMainTheme(scene, settings: UserSettingsStore)`: add the `settings` param; set `volume: effectiveVolume(MENU_MUSIC_BASE, musicGain(settings.get()))`. Add `setMainThemeVolume(scene, settings)` that looks up the live sound (`scene.sound.get(mainThemeMusic.key)`) and calls `setVolume(...)` for live re-apply.
- `TableScene.startWorldMusic`: scale `WORLD_MUSIC_BASE` by `musicGain` from `this.runtime_.userSettings`. Add a private `reapplyMusicVolume()` that, if `this.worldMusic` exists, calls `setVolume(...)`.
- `TableScene.playCardFx`: scale `CARD_FX_BASE` by `fxGain` at play time.
- `CardView.playWhileVisible`: scale `CARD_FX_BASE` by FX gain. CardView needs the gain — pass an **optional** `fxGain?: () => number` accessor through the `CardView` constructor (default to `() => 1` so untouched call sites stay valid and audible). Looped FX re-reads on next play; no live tracking. Call sites:
  - `TableScene.ts:645` — pass `() => fxGain(this.runtime_.userSettings.get())`.
  - `BoonChoiceView.ts:148` — boon-preview cards have no audible looped FX in practice; pass nothing (default) or an explicit `() => 0`. **Decision: pass nothing** (rely on the default), keeping BoonChoiceView ignorant of settings.
  - `createCardObject` (`CardView.ts:668`) — forwards constructor args; thread the optional param through. (Note: this free function currently has no `src/game` call sites but is type-checked, so its signature must still compile.)

Validation gate:

- `bun run test` — where a scene/sound stub allows, assert the volume passed to `sound.add`/`sound.play` reflects gain (e.g. mute → 0). Otherwise rely on the helper tests + manual check in step 7.
- `bun run typecheck` confirms every `startMainTheme`/`CardView` caller is updated.

### 4. Inject settings into the menu scenes (DEFERRED)

Files:

- `src/game/main.ts`
- `src/game/scenes/DestinyScene.ts`
- `src/game/scenes/ChronicleScene.ts`

Changes:

- Add an optional `userSettings?: UserSettingsStore` constructor param to `DestinyScene` and `ChronicleScene` (mirrors `WorldSelectScene`).
- In `main.ts`, pass `gameplayRuntime.userSettings` into both scene constructions.
- Update their `startMainTheme(this)` calls to `startMainTheme(this, this.userSettings)` (guard when undefined, matching the existing optional-store pattern).

Validation gate:

- `bun run typecheck` clean.
- `bun run test` — existing scene tests still pass; add a default-store fallback path if any test constructs these scenes without the arg.

### 5. Volume slider control + overlay UI (DEFERRED)

Files:

- `src/game/view/VolumeSlider.ts` (new) — or a private helper inside `SettingsOverlayView` if it stays small
- `src/game/view/SettingsOverlayView.ts`
- `src/game/view/VolumeSlider.test.ts` (new) or fold into the overlay test
- `src/game/tests/settingsOverlayView.test.ts`

Changes:

- Build a reusable draggable slider: track + fill + thumb + a `%` label. Pointer `down`/`move` on the track/thumb maps x → value. **Factor the x→value (and value→thumbX) math into a pure function** so it is unit-testable without Phaser pointer events. Clamp to [0,1]. **No snap** — continuous pixel-to-value mapping (the `%` label rounds for display only); this matches the agreed "continuous 0–100%" decision and avoids two implementers diverging on a step size.
- Add to the overlay: a **Music** slider, an **FX** slider, and a **Master mute** segmented toggle (reuse the existing `addSegment` / `ToggleOption` pattern; on/off).
- Reflow the `560×420` panel. Current y-slots: title `-185`, confirmation label `-120` (segments `-76`, hint `-50`), hover label `0` (segments `+44`, hint `+70`), close `175`. The two existing controls consume ~`-120 → +70`; adding three rows needs roughly 200px more vertical room. Concrete target: grow panel height `420 → 600`, and lay rows out top-to-bottom as — title `-265`, confirmation `-205`, hover `-95`, music slider `+15`, fx slider `+95`, master mute `+165`, close `+250`. Treat these as the starting layout; nudge during implementation only to remove overlap, and keep the close button clear of the mute row. Backdrop/blocker/panel `setPosition`/size must track the new height.
- Public handlers (keep the testable-handler convention): `setMusicVolume(v)`, `setFxVolume(v)`, `setMasterMute(b)` → each persists via `this.settings.update(...)`, calls `refreshFromStore()`, then invokes `this.onAudioChange?.()`.
- `refreshFromStore()`: also drive slider thumb/fill positions from `musicVolume`/`fxVolume` and the mute toggle highlight from `masterMute`.

Validation gate:

- `bun run test` — slider math pure-function tests (x→value, value→x, clamp, endpoints); overlay handler tests assert persist + clamp + `refreshFromStore` + `onAudioChange` fired; mute toggle flips store and highlight.

### 6. Wire the live re-apply hook (DEFERRED)

Files:

- `src/game/view/SettingsOverlayView.ts`
- `src/game/scenes/WorldSelectScene.ts`, `DestinyScene.ts`, `ChronicleScene.ts`, `TableScene.ts`

Changes:

- Add an optional `onAudioChange?: () => void` constructor arg to `SettingsOverlayView`.
- `WorldSelectScene` (`:240`) passes `() => setMainThemeVolume(this, this.userSettings)`.
- `TableScene` (`:300`) passes `() => this.reapplyMusicVolume()`.
- Only these two scenes own an overlay (confirmed in the Strategy section). `DestinyScene`/`ChronicleScene` get no `onAudioChange` because they have no overlay; their theme gain is set fresh at `create()` (Step 3) and needs no live path.

Validation gate:

- `bun run test` — overlay test asserts `onAudioChange` invoked on each volume/mute setter. For Destiny/Chronicle, the only meaningful automated coverage is that `startMainTheme` is invoked with current gain at `create()` (Step 3/4 coverage) — there is no live-update behavior to assert for them, so do not list them under a manual live-update check.

### 7. Verify (DEFERRED)

- `bun run lint`, `bun run typecheck`, `bun run build`, `bun run test` all green.
- Fresh-context sub-agent review of the diff (per the project's >2-file review rule).
- Manual browser check: open settings from **WorldSelect** and **in-run (Table)** — those are the only scenes with an overlay (do not look for one in Destiny/Chronicle). Drag Music slider → playing track volume changes live; drag FX → next card FX reflects it; Master mute silences both and un-mute restores; navigate WorldSelect → Destiny/Chronicle and confirm the main theme there honors the current gain at entry; reload page → settings persisted; seed a pre-existing `version: 1` entry under `'shattered-worlds/settings/v1'` and confirm it migrates to v2 without losing confirmation/hover prefs.

### Final validation against goal

- [ ] Music and FX each have a working draggable slider in the settings overlay.
- [ ] Sliders scale the existing base volumes; defaults Music 100% / FX 50%.
- [ ] Master mute toggle silences everything; 0% on either slider mutes that channel.
- [ ] Music volume / mute changes apply to currently-playing music live.
- [ ] All four playback sites honor the settings (menu theme, world music, one-shot FX, looped card FX).
- [ ] Settings persist across reload; v1 saves migrate to v2 without data loss.
- [ ] Lint, typecheck, build, and tests pass; new logic has tests.
