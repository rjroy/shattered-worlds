export function formatDuration(ms: number): string {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0
  const totalSeconds = Math.floor(safeMs / 1_000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`
  if (totalMinutes > 0) return `${totalMinutes}m ${seconds.toString().padStart(2, '0')}s`
  return `${seconds}s`
}
