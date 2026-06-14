import type { RngState } from "../model/types";

// splitmix32: used only for seed expansion. Each call advances the state by
// one step and returns a pseudo-random 32-bit unsigned integer.
function splitmix32(x: number): number {
  x = (x + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * Expand a numeric seed into a full sfc32 RngState.
 * Calls splitmix32 four times, carrying output into the next call.
 */
export function createRng(seed: number): RngState {
  const a = splitmix32(seed);
  const b = splitmix32(a);
  const c = splitmix32(b);
  const d = splitmix32(c);
  return { a, b, c, d };
}

/**
 * Advance the sfc32 state by one step.
 * Returns [value, nextState] where value is in [0, 1).
 * Never mutates the input rng.
 */
export function nextFloat(rng: RngState): [value: number, next: RngState] {
  let { a, b, c, d } = rng;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  const value = (t >>> 0) / 4294967296;
  return [value, { a, b, c, d }];
}

/**
 * Returns a stateful () => number closure backed by a seeded sfc32 RNG.
 * Useful when calling code that expects a Math.random()-style function but
 * requires determinism (e.g. policy logic in tests).
 */
export function rngFromSeed(seed: number): () => number {
  let state = createRng(seed);
  return () => {
    const [value, next] = nextFloat(state);
    state = next;
    return value;
  };
}

/**
 * Fisher-Yates shuffle using the provided rng state.
 * Returns a new array and the advanced rng state. Neither the input array
 * nor the input rng are mutated.
 */
export function shuffle<T>(items: readonly T[], rng: RngState): [shuffled: T[], next: RngState] {
  const result = [...items];
  let state = rng;

  for (let i = result.length - 1; i > 0; i--) {
    const [raw, next] = nextFloat(state);
    state = next;

    // Scale raw [0,1) to [0, i+1) and floor to get a swap index in [0, i].
    const j = Math.floor(raw * (i + 1));

    // i and j are always valid indices (loop bounds + floor above); the `!`
    // satisfies noUncheckedIndexedAccess without a branch that can never run.
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }

  return [result, state];
}
