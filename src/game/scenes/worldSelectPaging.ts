/**
 * Pure paging model for the world-select carousel.
 *
 * `WorldSelectScene` paints a sliding window of `visibleCount` cards and pages
 * through the rest with left/right arrows. The arrow logic is a pure function
 * of `(worldCount, visibleStartIndex)`, so it is extracted here to be driven
 * and asserted without booting a Phaser scene. The scene imports these helpers
 * so the test exercises the SAME logic the scene runs at runtime, rather than a
 * test-local mirror that could drift from it.
 */

/** Can the left ("<") arrow advance from this start index? */
export function canPageLeft(visibleStartIndex: number): boolean {
  return visibleStartIndex > 0;
}

/** Can the right (">") arrow advance, given the total worlds and window size? */
export function canPageRight(
  visibleStartIndex: number,
  worldCount: number,
  visibleCount: number,
): boolean {
  return visibleStartIndex + visibleCount < worldCount;
}

/** Clamp the start index after a left-arrow step (mirrors the scene guard). */
export function pageLeft(visibleStartIndex: number, visibleCount: number): number {
  return canPageLeft(visibleStartIndex)
    ? Math.max(visibleStartIndex - visibleCount, 0)
    : visibleStartIndex;
}

/** Clamp the start index after a right-arrow step (mirrors the scene guard). */
export function pageRight(
  visibleStartIndex: number,
  worldCount: number,
  visibleCount: number,
): number {
  return canPageRight(visibleStartIndex, worldCount, visibleCount)
    ? Math.min(visibleStartIndex + visibleCount, worldCount - visibleCount)
    : visibleStartIndex;
}

/** The world indices visible at a given start index (a single window). */
export function visibleWindow(
  visibleStartIndex: number,
  worldCount: number,
  visibleCount: number,
): number[] {
  const ids = Array.from({ length: worldCount }, (_, i) => i);
  return ids.slice(visibleStartIndex, visibleStartIndex + visibleCount);
}

/**
 * The union of every world index reachable by paging from start 0 using only
 * the real `canPageRight`/`pageRight` steppers. Walking the actual steppers
 * (rather than computing a closed-form range) is what makes a reachability
 * assertion over this result a genuine test of the scene's paging logic.
 */
export function reachableWorldIndices(worldCount: number, visibleCount: number): Set<number> {
  const seen = new Set<number>();
  let start = 0;
  const guard = worldCount + 1; // bound the walk; one step per possible start
  for (let i = 0; i <= guard; i++) {
    for (const idx of visibleWindow(start, worldCount, visibleCount)) seen.add(idx);
    const next = pageRight(start, worldCount, visibleCount);
    if (next === start) break;
    start = next;
  }
  return seen;
}
