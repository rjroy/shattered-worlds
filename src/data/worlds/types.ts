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

import type { CardCatalog } from "../../core/model/catalog";
import type { VisualTheme } from "../../game/view/themes/theme";

// ---------------------------------------------------------------------------
// Re-exported interfaces (sources of truth; moved here from per-manifest files)
// ---------------------------------------------------------------------------

/** Display-only metadata for a world — shown on the world-select screen. */
export interface WorldDisplayData {
  name: string;
  tagline: string;
  story: string;
  difficulty: number; // 1-5, 5 being the hardest
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
 * Per-world deck descriptor — everything that changed per-world after we
 * unified all card templates into allCards.json. Card template definitions
 * now live in the global catalog; only act composition and world-specific
 * settings remain local. Stored as an opaque reference to the JSON import
 * from each world's index.ts so TypeScript can catch shape mismatches.
 */
export interface WorldDeckDescriptor {
  readonly cardsImport: Record<string, unknown>;
}

/**
 * Everything the engine needs to know about a world in one place.
 * Core-safe: the only cross-layer import is VisualTheme, which is an
 * interface-only declaration that erases at compile time.
 */
export interface WorldDataBundle {
  readonly id: string;
  readonly deck: WorldDeckDescriptor;
  readonly theme: VisualTheme;
  readonly display: WorldDisplayData;
  readonly help: WorldHelpData;
  readonly musicKey: string;
}

// ---------------------------------------------------------------------------
// Helper: referencedAssetKeys
// ---------------------------------------------------------------------------

/**
 * After unifying card templates, this accepts the global catalog to collect
 * inset keys from all cards rather than per-world subsets. The asset preloader
 * still works correctly; the bundle's id gives display/background keys.
 */
export function referencedAssetKeys(
  bundle: WorldDataBundle,
  cardCatalog?: CardCatalog,
): ReadonlySet<string> {
  const keys = new Set<string>();

  if (cardCatalog) {
    for (const tpl of Object.values(cardCatalog)) {
      if ("insetKey" in tpl && tpl.insetKey !== undefined) {
        keys.add(tpl.insetKey);
      }
    }
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
