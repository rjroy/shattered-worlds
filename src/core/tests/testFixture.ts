/**
 * Shared test fixture: assembles catalog and worldData once for use across
 * all core test files. Import from here instead of duplicating setup.
 */
import { buildZombieWorld } from '../../data/zombieWorld'

export const { catalog, worldData } = buildZombieWorld()
