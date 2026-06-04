export interface WalkerProximity {
  scale: number       // sprite scale multiplier
  x: number          // x position (0-900 canvas)
  y: number          // y position (0-600 canvas)
  alpha: number      // 0-1 opacity
}

/**
 * Maps intensity [0,1] to overlay alpha [0,1].
 * Monotonically non-decreasing. Clamped at both ends.
 * Used to drive the intrusion overlay alpha.
 */
export function intrusionForIntensity(intensity: number): number {
  const clamped = Math.max(0, Math.min(1, intensity))
  // Ramp: stays near-zero at low intensity, rises steeply after 0.4
  // At 0.0 → 0.0, at 0.4 → 0.1, at 0.7 → 0.4, at 1.0 → 0.85
  return clamped < 0.4
    ? clamped * 0.25
    : 0.1 + (clamped - 0.4) * 1.25
}

/**
 * Maps act index (0, 1, 2) to Walker position/scale/alpha.
 * Three tiers: far (act 0), mid (act 1), looming (act 2).
 * Act indices beyond 2 clamp to looming.
 */
export function walkerProximityForAct(actIndex: number): WalkerProximity {
  const tiers: WalkerProximity[] = [
    // far — distant, small, barely visible
    { scale: 0.18, x: 820, y: 480, alpha: 0.35 },
    // mid — closer, more visible
    { scale: 0.32, x: 800, y: 440, alpha: 0.60 },
    // looming — large, dominant
    { scale: 0.55, x: 750, y: 380, alpha: 0.85 },
  ]
  const idx = Math.max(0, Math.min(2, actIndex))
  return tiers[idx]!
}
