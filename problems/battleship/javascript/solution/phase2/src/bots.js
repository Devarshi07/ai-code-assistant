// Bots that play matches. See "Writing a bot" in README.md for the contract.
const { Ocean, toCoord } = require('./ocean');
const { DEFAULT_FLEET } = require('./ships');

/** Thrown when a bot has no legal shot left to offer. */
class BotError extends Error {
  constructor(message) {
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
class Bot {
  constructor(size, shipSizes = DEFAULT_FLEET) {
    this.size = size;
    this.shipSizes = [...shipSizes];
  }

  /** @returns {{row: number, col: number}} */
  nextShot() {
    throw new Error('Not implemented: nextShot');
  }

  /** Called once after every shot with the cell and its ShotResult. */
  observe(coord, result) {}
}

/** Fires a fixed list of shots in order. QA uses it to replay bug reports. */
class ScriptedBot extends Bot {
  constructor(size, shots, shipSizes = DEFAULT_FLEET) {
    super(size, shipSizes);
    this.script = shots.map(toCoord);
    this.cursor = 0;
  }

  nextShot() {
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
class SeekerBot extends Bot {
  constructor(size, shipSizes = DEFAULT_FLEET) {
    super(size, shipSizes);
    this.queue = new Ocean(size).cells();
    this.cursor = 0;
  }

  nextShot() {
    if (this.cursor >= this.queue.length) throw new BotError('every cell has already been fired at');
    this.cursor += 1;
    return this.queue[this.cursor - 1];
  }

  observe(coord, result) {
    // a sweep does not need the outcome
  }
}

module.exports = { BotError, Bot, ScriptedBot, SeekerBot };
