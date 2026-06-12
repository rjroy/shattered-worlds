import type { WorldStats } from '../runtime/runStats'

export function worldBadgeLabel(stats: WorldStats | undefined): string | null {
  if (stats === undefined || stats.runs === 0) return null
  return `${stats.wins} / ${stats.runs}`
}
