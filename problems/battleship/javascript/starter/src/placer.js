// Seeded random fleets for bot benchmarks.
//
// QA replays the same matches in the Python and JavaScript harnesses, so a seed
// must produce the identical fleet in both. Neither language's built-in random
// generator can promise that, so we use mulberry32: a tiny 32-bit generator
// that ports bit-for-bit.
const { Ocean, coord } = require('./ocean');
const { DEFAULT_FLEET, Fleet, PlacementError } = require('./ships');

const MAX_ATTEMPTS = 1000;

/** mulberry32. Same seed, same sequence, in every harness. */
class Rng {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  nextU32() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** An integer in [0, n). The modulo bias is negligible for board-sized n. */
  below(n) {
    return this.nextU32() % n;
  }
}

/**
 * Place ships largest first, each at a random spot where it fits.
 * For each attempt the generator draws the orientation, then the row, then
 * the column. The Python placer draws in the same order.
 */
function randomFleet(seed, size = 10, shipSizes = DEFAULT_FLEET) {
  const rng = new Rng(seed);
  const fleet = new Fleet(new Ocean(size));
  for (const length of [...shipSizes].sort((a, b) => b - a)) {
    if (length > size) throw new PlacementError(`a ${length}-cell ship cannot fit on a ${size}x${size} board`);
    const span = size - length + 1;
    let placed = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !placed; attempt++) {
      const vertical = rng.below(2) === 1;
      const row = rng.below(vertical ? span : size);
      const col = rng.below(vertical ? size : span);
      if (fleet.fits(length, coord(row, col), vertical)) {
        fleet.place(length, coord(row, col), vertical);
        placed = true;
      }
    }
    if (!placed) throw new PlacementError(`seed ${seed}: no room for a ${length}-cell ship after ${MAX_ATTEMPTS} attempts`);
  }
  return fleet;
}

module.exports = { Rng, randomFleet };
