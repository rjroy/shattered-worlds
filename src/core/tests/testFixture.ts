/**
 * Shared test fixture: assembles catalog and worldData once for use across
 * all core test files. Import from here instead of duplicating setup.
 */
import { buildWorld } from '../../data/worldManifest'

export const { catalog, worldData } = buildWorld('zombie-big-box')
