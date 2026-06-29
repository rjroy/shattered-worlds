import type { WorldStats } from "../runtime/runStats";

export function worldBadgeLabel(stats: WorldStats | undefined): string | null {
  if (stats === undefined || stats.runs === 0) return null;
  return `${stats.wins} / ${stats.runs}`;
}

/**
 * Renders a world's difficulty (1-5) as filled/empty pip glyphs, e.g. 3 -> "●●●○○".
 * Difficulty is clamped into [0, max] and rounded so malformed data still yields
 * exactly `max` pips. Matches the pip idiom used on the Destiny screen.
 */
export function difficultyPips(difficulty: number, max = 5): string {
  const filled = Math.max(0, Math.min(max, Math.round(difficulty)));
  return "●".repeat(filled) + "○".repeat(max - filled);
}

const CYCLE_LABELS = ["choices", "no choice", "not home"];
export function cycleLabel(cycle: number): string {
  const index = Math.max(0, Math.min(cycle - 1, CYCLE_LABELS.length - 1));
  return CYCLE_LABELS[index] ?? "(impossible)";
}
