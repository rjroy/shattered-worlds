export interface WalkerProximity {
  size: number       // sprite size absolute based on 600 height
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
  // At 0.0 → 0.0, at 0.4 → 0.25, at 0.7 → 0.4, at 1.0 → 0.85
  return clamped < 0.4
    ? clamped * 0.625
    : 0.25 + (clamped - 0.4)
}

/**
 * Maps act index (0, 1, 2) to Walker position/scale/alpha.
 * Three tiers: far (act 0), mid (act 1), looming (act 2).
 * Act indices beyond 2 clamp to looming.
 */
export function walkerProximityForAct(actIndex: number): WalkerProximity {
  const tiers: WalkerProximity[] = [
    // far — distant, small, barely visible
    { size:  75, alpha: 0.35 },
    // mid — closer, more visible
    { size: 175, alpha: 0.60 },
    // looming — large, dominant
    { size: 300, alpha: 0.85 }
  ]
  const idx = Math.max(0, Math.min(2, actIndex))
  return tiers[idx]!
}
