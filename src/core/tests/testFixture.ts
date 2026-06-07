/**
 * Shared test fixture: assembles catalog and worldData once for use across
 * all core test files. Import from here instead of duplicating setup.
 */
import { worldManifest } from '../../data/worldManifest'

export const { catalog, worldData } = function () {
    const worldBuilder = worldManifest['zombie-big-box']
    if (typeof worldBuilder !== 'function') {
      throw new Error('World builder for "zombie-big-box" is not a function')
    }
    return worldBuilder()
}()
