export interface WalkerProximity {
  size: number; // sprite size absolute based on 600 height
  alpha: number; // 0-1 opacity
}

export const VISUAL_CONSTS = {
  walker: {
    proximity: {
      far: { size: 75, alpha: 0.5 },
      mid: { size: 175, alpha: 0.65 },
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
    size: 175,
    glowAlpha: 0.4, // max alpha for door glow at each tier (multiplied by walker proximity alpha)
  },
};

/**
 * Maps intensity [0,1] to overlay alpha [0,1].
 * Monotonically non-decreasing. Clamped at both ends.
 * Used to drive the intrusion overlay alpha.
 */
export function intrusionForIntensity(intensity: number): number {
  const clamped = Math.max(0, Math.min(1, intensity));
  // Ramp: stays near-zero at low intensity, rises steeply after 0.4
  // At 0.0 → 0.0, at 0.4 → 0.25, at 0.7 → 0.4, at 1.0 → 0.85

  const MID_POINT = 0.4;
  const MID_RESULT = 0.25;
  const SCALE_BELOW_MID = MID_RESULT / MID_POINT; // linear scale to reach mid result at mid point

  return clamped < MID_POINT ? clamped * SCALE_BELOW_MID : MID_RESULT + (clamped - MID_POINT);
}

function calculateScaledTier(
  actIndex: number,
  totalActs: number,
  tiers: WalkerProximity[],
): WalkerProximity {
  if (totalActs == tiers.length) {
    // If total acts matches tiers, use act index directly
    return tiers[Math.max(0, Math.min(tiers.length - 1, actIndex))]!;
  } else {
    // Otherwise, scale act index to tiers range
    const midIndex = (actIndex / (totalActs - 1)) * (tiers.length - 1);
    const minIndex = Math.floor(midIndex);
    const maxIndex = Math.ceil(midIndex);
    if (minIndex === maxIndex) {
      return tiers[minIndex]!;
    }
    // midIndex is between minIndex and maxIndex
    const ratio = midIndex - minIndex;
    // Calculate scaled size and alpha based on scaled index
    const minTier = tiers[minIndex]!;
    const maxTier = tiers[maxIndex]!;
    const scaledSize = minTier.size + ratio * (maxTier.size - minTier.size);
    const scaledAlpha = minTier.alpha + ratio * (maxTier.alpha - minTier.alpha);
    return { size: scaledSize, alpha: scaledAlpha };
  }
}

/**
 * Maps act index (0, 1, 2) to Walker position/scale/alpha.
 * Three tiers: far (act 0), mid (act 1), looming (act 2).
 * Act indices beyond 2 clamp to looming.
 */
export function walkerProximityForAct(actIndex: number, totalActs: number): WalkerProximity {
  return calculateScaledTier(actIndex, totalActs, [
    // far — distant, small, barely visible
    {
      size: VISUAL_CONSTS.walker.proximity.far.size,
      alpha: VISUAL_CONSTS.walker.proximity.far.alpha,
    },
    // mid — closer, more visible
    {
      size: VISUAL_CONSTS.walker.proximity.mid.size,
      alpha: VISUAL_CONSTS.walker.proximity.mid.alpha,
    },
    // looming — large, dominant
    {
      size: VISUAL_CONSTS.walker.proximity.looming.size,
      alpha: VISUAL_CONSTS.walker.proximity.looming.alpha,
    },
  ]);
}

/**
 * Maps act index (0, 1, 2) to Walker position/scale/alpha.
 * Three tiers: far (act 0), mid (act 1), looming (act 2).
 * Act indices beyond 2 clamp to looming.
 */
export function doorProximityForAct(actIndex: number, totalActs: number): WalkerProximity {
  return calculateScaledTier(actIndex, totalActs, [
    // far — distant, small, barely visible
    { size: VISUAL_CONSTS.door.size, alpha: VISUAL_CONSTS.door.proximity.far.alpha },
    // mid — closer, more visible
    { size: VISUAL_CONSTS.door.size, alpha: VISUAL_CONSTS.door.proximity.mid.alpha },
    // looming — large, dominant
    { size: VISUAL_CONSTS.door.size, alpha: VISUAL_CONSTS.door.proximity.looming.alpha },
  ]);
}
