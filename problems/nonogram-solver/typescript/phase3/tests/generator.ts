// Deterministic random pictures for the large-puzzle tests.
//
// Uses the Park-Miller "minimal standard" generator, so every language's
// tests reproduce exactly the same pictures. The seeds used in phase3.test.ts
// were checked offline: each picture is the *only* grid that fits its clues.
const MODULUS = 2147483647;

export function parkMiller(seed: number): () => number {
  let state = seed % MODULUS || 1;
  return () => {
    state = (state * 48271) % MODULUS; // stays below 2^53, so the arithmetic is exact
    return state / MODULUS;
  };
}

/** A width x height grid where each cell is filled with probability density. */
export function randomPicture(seed: number, width: number, height: number, density: number): number[][] {
  const random = parkMiller(seed);
  return Array.from({ length: height }, () => Array.from({ length: width }, () => (random() < density ? 1 : 0)));
}
