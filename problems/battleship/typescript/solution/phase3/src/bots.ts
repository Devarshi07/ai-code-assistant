// Bots that play matches. See "Writing a bot" in README.md for the contract.
import { ShotResult } from './battle.ts';
import { Ocean, coord, key, toCoord } from './ocean.ts';
import { DEFAULT_FLEET } from './ships.ts';
import type { Coord, CoordLike } from './ocean.ts';

/** Thrown when a bot has no legal shot left to offer. */
export class BotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotError';
  }
}

/**
 * Base class for match bots.
 *
 * A fresh bot is created for every match with the board size and the ship
 * lengths in the fleet: the fleet's make-up is public, its positions are not.
 * The match runner then calls nextShot() and observe(coord, result) in turn
 * until the fleet is sunk or the shot budget is spent.
 */
export class Bot {
  readonly size: number;
  readonly shipSizes: number[];

  constructor(size: number, shipSizes: readonly number[] = DEFAULT_FLEET) {
    this.size = size;
    this.shipSizes = [...shipSizes];
  }

  nextShot(): Coord {
    throw new Error('Not implemented: nextShot');
  }

  /** Called once after every shot with the cell and its ShotResult. */
  observe(coord: Coord, result: ShotResult): void {}
}

/** Fires a fixed list of shots in order. QA uses it to replay bug reports. */
export class ScriptedBot extends Bot {
  private readonly script: Coord[];
  private cursor = 0;

  constructor(size: number, shots: readonly CoordLike[], shipSizes: readonly number[] = DEFAULT_FLEET) {
    super(size, shipSizes);
    this.script = shots.map(toCoord);
  }

  nextShot(): Coord {
    if (this.cursor >= this.script.length) throw new BotError(`script exhausted after ${this.script.length} shots`);
    this.cursor += 1;
    return this.script[this.cursor - 1];
  }
}

/**
 * The studio's reference opponent: hunt/target with checkerboard parity.
 *
 * Hunt: fire at cells where row + col is even. A ship two or more cells long
 * always covers one of them, so the hunt finds every such ship with at most
 * half the board. The odd cells stay queued behind them as a fallback, which
 * covers 1-cell ships and guarantees the bot can always finish.
 *
 * Target: a HIT queues the cell's untried neighbours. They are fired at, most
 * recent first, before hunting resumes, so a ship is finished off as soon as
 * it is found. Leftover neighbours after a SUNK are simply tried too: a sunk
 * report doesn't say which hits belonged to the ship, and a touching ship may
 * still be hiding behind them.
 */
export class SeekerBot extends Bot {
  private readonly ocean: Ocean;
  private readonly fired = new Set<string>(); // keys of cells already fired at
  private readonly targets: Coord[] = []; // stack of cells next to hits
  private readonly hunt: Coord[];
  private cursor = 0;

  constructor(size: number, shipSizes: readonly number[] = DEFAULT_FLEET) {
    super(size, shipSizes);
    this.ocean = new Ocean(size);
    const cells = this.ocean.cells();
    this.hunt = [...cells.filter(c => (c.row + c.col) % 2 === 0), ...cells.filter(c => (c.row + c.col) % 2 === 1)];
  }

  nextShot(): Coord {
    while (this.targets.length) {
      const c = this.targets.pop() as Coord;
      if (!this.fired.has(key(c))) return c;
    }
    while (this.cursor < this.hunt.length && this.fired.has(key(this.hunt[this.cursor]))) this.cursor += 1;
    if (this.cursor === this.hunt.length) throw new BotError('every cell has already been fired at');
    return this.hunt[this.cursor];
  }

  observe(shot: Coord, result: ShotResult): void {
    const c = coord(shot.row, shot.col);
    this.fired.add(key(c));
    if (result === ShotResult.HIT) {
      for (const n of this.ocean.neighbours(c)) if (!this.fired.has(key(n))) this.targets.push(n);
    }
  }
}
