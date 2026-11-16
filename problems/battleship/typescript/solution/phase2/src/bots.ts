// Bots that play matches. See "Writing a bot" in README.md for the contract.
import { Ocean, toCoord } from './ocean.ts';
import { DEFAULT_FLEET } from './ships.ts';
import type { ShotResult } from './battle.ts';
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
 * The studio's reference opponent: finds and sinks a hidden fleet.
 *
 * Sweeps the board row by row from A1. Every cell is tried exactly once, so
 * the fleet is always sunk within size * size shots and nothing repeats.
 */
export class SeekerBot extends Bot {
  private readonly queue: Coord[];
  private cursor = 0;

  constructor(size: number, shipSizes: readonly number[] = DEFAULT_FLEET) {
    super(size, shipSizes);
    this.queue = new Ocean(size).cells();
  }

  nextShot(): Coord {
    if (this.cursor >= this.queue.length) throw new BotError('every cell has already been fired at');
    this.cursor += 1;
    return this.queue[this.cursor - 1];
  }

  observe(coord: Coord, result: ShotResult): void {
    // a sweep does not need the outcome
  }
}
