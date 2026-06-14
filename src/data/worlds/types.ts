/**
 * Shared type layer for the world registry.
 *
 * Pure TypeScript — no asset imports, no Phaser references, no runtime
 * side-effects. Importable by headless Bun tests, the sim, and Phaser scenes
 * alike.
 *
 * Note on the VisualTheme import: theme.ts contains only interface
 * declarations (FrameStyle, VisualTheme) with zero runtime content. The
 * `import type` erases at compile time and pulls no Phaser or asset code.
 */

import type { RawCardSource } from "../../core/model/catalog";
import type { VisualTheme } from "../../game/view/themes/theme";

// ---------------------------------------------------------------------------
// Re-exported interfaces (sources of truth; moved here from per-manifest files)
// ---------------------------------------------------------------------------

/** Display-only metadata for a world — shown on the world-select screen. */
export interface WorldDisplayData {
  name: string;
  tagline: string;
  story: string;
  backgroundKey?: string;
}

/** A single mechanic callout shown in the in-game help overlay. */
export interface WorldMechanicNote {
  title: string;
  detail: string;
}

/** Help overlay content for a world. */
export interface WorldHelpData {
  mechanics: readonly WorldMechanicNote[];
}

// ---------------------------------------------------------------------------
// WorldDataBundle — the canonical world record
// ---------------------------------------------------------------------------

/**
 * Everything the engine needs to know about a world in one place.
 * Core-safe: the only cross-layer import is `VisualTheme`, which is an
 * interface-only declaration that erases at compile time.
 */
export interface WorldDataBundle {
  readonly id: string;
  readonly source: RawCardSource;
  readonly theme: VisualTheme;
  readonly display: WorldDisplayData;
  readonly help: WorldHelpData;
  readonly musicKey: string;
  /**
   * Whether this world runs on the Light economy (a Light HUD readout, fog
   * concealment). Default-absent = false; only a light-world (Fog) sets it
   * true. Surfaced as the `worldUsesLight` manifest so the HUD can decide
   * whether to show the Light indicator from `worldId` alone.
   */
  readonly usesLight?: boolean;
}

// ---------------------------------------------------------------------------
// Helper: referencedAssetKeys
// ---------------------------------------------------------------------------

/**
 * Computes the set of all asset keys a bundle references, drawn from the card
 * templates, theme backdrop, and display background.
 *
 * Useful for preload validation and asset-loading manifests — callers can
 * confirm every key in this set is registered before a scene starts.
 */
export function referencedAssetKeys(bundle: WorldDataBundle): ReadonlySet<string> {
  const keys = new Set<string>();

  // Every card template's insetKey (if present)
  for (const card of Object.values(bundle.source.cardTemplates)) {
    if (card.insetKey !== undefined) keys.add(card.insetKey);
  }

  // Theme backdrop keys
  keys.add(bundle.theme.backdrop.realityKey);
  keys.add(bundle.theme.backdrop.intrusionKey);
  if (bundle.theme.worldCardfrontKey !== undefined) {
    keys.add(bundle.theme.worldCardfrontKey);
  }

  // Display background key
  if (bundle.display.backgroundKey !== undefined) {
    keys.add(bundle.display.backgroundKey);
  }

  return keys;
}

// ---------------------------------------------------------------------------
// Helper: derive
// ---------------------------------------------------------------------------

/**
 * Projects a registry of bundles into a `Record<worldId, T>` using `selector`.
 *
 * Throws if the same `id` appears more than once — duplicate ids indicate a
 * data authoring mistake and must not be silently resolved by last-writer-wins.
 */
export function derive<T>(
  registry: readonly WorldDataBundle[],
  selector: (bundle: WorldDataBundle) => T,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const bundle of registry) {
    if (bundle.id in result) {
      throw new Error(`Duplicate world id in registry: "${bundle.id}"`);
    }
    result[bundle.id] = selector(bundle);
  }
  return result;
}
