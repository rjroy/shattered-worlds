/**
 * Unit tests for the pure statistical helpers (`src/sim/statistics.ts`) used by
 * the completeness report: nearest-rank percentiles and the 95% Wilson score
 * interval. These are plain-array/plain-count tests with no world/play-out
 * fixtures involved, since the helpers themselves know nothing about the sim
 * domain.
 */
import { describe, expect, test } from "bun:test";
import { median, nearestRankPercentile, p90, wilsonInterval } from "../statistics";

describe("nearestRankPercentile / median / p90 — empty and singleton", () => {
  test("n=0 returns undefined for any p (caller renders '(none)')", () => {
    expect(nearestRankPercentile([], 50)).toBeUndefined();
    expect(nearestRankPercentile([], 90)).toBeUndefined();
    expect(median([])).toBeUndefined();
    expect(p90([])).toBeUndefined();
  });

  test("n=1 returns the single value for any p", () => {
    expect(nearestRankPercentile([7], 1)).toBe(7);
    expect(nearestRankPercentile([7], 50)).toBe(7);
    expect(nearestRankPercentile([7], 100)).toBe(7);
    expect(median([7])).toBe(7);
    expect(p90([7])).toBe(7);
  });
});

describe("nearestRankPercentile — exact nearest-rank index behavior", () => {
  test("median([1,2,3,4]) picks index ceil(0.5*4)=2 -> sortedAscending[1]", () => {
    // Nearest-rank, NOT interpolated: this is 2, not the interpolated 2.5.
    expect(median([1, 2, 3, 4])).toBe(2);
  });

  test("median of an odd-sized array picks the exact middle element", () => {
    // ceil(0.5*5)=3 -> sortedAscending[2]
    expect(median([5, 3, 1, 4, 2])).toBe(3);
  });

  test("p90([1..10]) picks index ceil(0.9*10)=9 -> sortedAscending[8]", () => {
    expect(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(9);
  });

  test("p90 of a small even-sized array", () => {
    // n=4, ceil(0.9*4)=4 (already clamped to n) -> sortedAscending[3]
    expect(p90([10, 20, 30, 40])).toBe(40);
  });

  test("does not mutate the caller's array", () => {
    const values = [4, 1, 3, 2];
    const copy = [...values];
    median(values);
    p90(values);
    expect(values).toEqual(copy);
  });
});

describe("nearestRankPercentile — direct empty-bucket case at the caller level", () => {
  test("an empty 'wins' bucket when computing win-turn percentiles is n=0", () => {
    const winTurns: number[] = [];
    expect(median(winTurns)).toBeUndefined();
    expect(p90(winTurns)).toBeUndefined();
  });
});

describe("wilsonInterval", () => {
  test("n=0 returns undefined (caller renders '(none)')", () => {
    expect(wilsonInterval(0, 0)).toBeUndefined();
  });

  test("successes=1, n=50 matches the hand-verified closed-form bounds", () => {
    // phat=0.02; z=1.959964. Verified independently against the same formula
    // in the spec (center +/- halfWidth, both over 1 + z^2/n) to ~4 decimals.
    const interval = wilsonInterval(1, 50);
    expect(interval).toBeDefined();
    expect(interval!.lower).toBeCloseTo(0.003539, 4);
    expect(interval!.upper).toBeCloseTo(0.104954, 4);
  });

  test("successes=0 clamps the lower bound to 0 (never negative)", () => {
    const interval = wilsonInterval(0, 10);
    expect(interval).toBeDefined();
    expect(interval!.lower).toBe(0);
    expect(interval!.upper).toBeGreaterThan(0);
    expect(interval!.upper).toBeLessThanOrEqual(1);
  });

  test("successes=n clamps the upper bound to 1 (never above 1)", () => {
    // At n=100 the unclamped closed-form arithmetic lands at
    // 1.0000000000000002 (verified independently) — over the [0,1] range the
    // clamp exists to enforce.
    const interval = wilsonInterval(100, 100);
    expect(interval).toBeDefined();
    expect(interval!.upper).toBe(1);
    expect(interval!.lower).toBeGreaterThan(0);
    expect(interval!.lower).toBeLessThan(1);
  });

  test("interval is symmetric around 0.5 for successes=n/2", () => {
    const interval = wilsonInterval(25, 50);
    expect(interval).toBeDefined();
    expect(interval!.lower).toBeCloseTo(1 - interval!.upper, 9);
  });
});
