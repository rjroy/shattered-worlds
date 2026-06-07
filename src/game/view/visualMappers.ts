export interface WalkerProximity {
  size: number       // sprite size absolute based on 600 height
  alpha: number      // 0-1 opacity
}

export const VISUAL_CONSTS = {
  walker: {
    proximity: {
      far: { size: 75, alpha: 0.35 },
      mid: { size: 175, alpha: 0.60 },
      looming: { size: 300, alpha: 0.85 },
      present: { size: 400, alpha: 1.0 },
    },
  },
  door: {
    proximity: {
      far: { alpha: 0.15 },
      mid: { alpha: 0.45 },
      looming: { alpha: 0.75 },
      present: { alpha: 1.0 },
    },
    size: 540,
    glowAlpha: 0.4, // max alpha for door glow at each tier (multiplied by walker proximity alpha)
  },
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

  const MID_POINT = 0.4
  const MID_RESULT = 0.25
  const SCALE_BELOW_MID = MID_RESULT / MID_POINT // linear scale to reach mid result at mid point

  return clamped < MID_POINT
    ? clamped * SCALE_BELOW_MID
    : MID_RESULT + (clamped - MID_POINT)
}

/**
 * Maps act index (0, 1, 2) to Walker position/scale/alpha.
 * Three tiers: far (act 0), mid (act 1), looming (act 2).
 * Act indices beyond 2 clamp to looming.
 */
export function walkerProximityForAct(actIndex: number): WalkerProximity {
  const tiers: WalkerProximity[] = [
    // far — distant, small, barely visible
    { size: VISUAL_CONSTS.walker.proximity.far.size, alpha: VISUAL_CONSTS.walker.proximity.far.alpha },
    // mid — closer, more visible
    { size: VISUAL_CONSTS.walker.proximity.mid.size, alpha: VISUAL_CONSTS.walker.proximity.mid.alpha },
    // looming — large, dominant
    { size: VISUAL_CONSTS.walker.proximity.looming.size, alpha: VISUAL_CONSTS.walker.proximity.looming.alpha }
  ]
  const idx = Math.max(0, Math.min(2, actIndex))
  return tiers[idx]!
}

/**
 * Maps act index (0, 1, 2) to Walker position/scale/alpha.
 * Three tiers: far (act 0), mid (act 1), looming (act 2).
 * Act indices beyond 2 clamp to looming.
 */
export function doorProximityForAct(actIndex: number): WalkerProximity {
  const tiers: WalkerProximity[] = [
    // far — distant, small, barely visible
    { size: VISUAL_CONSTS.door.size, alpha: VISUAL_CONSTS.door.proximity.far.alpha },
    // mid — closer, more visible
    { size: VISUAL_CONSTS.door.size, alpha: VISUAL_CONSTS.door.proximity.mid.alpha },
    // looming — large, dominant
    { size: VISUAL_CONSTS.door.size, alpha: VISUAL_CONSTS.door.proximity.looming.alpha }
  ]
  const idx = Math.max(0, Math.min(2, actIndex))
  return tiers[idx]!
}
