// Shot resolution: the referee between a shooter and a hidden fleet.
//
// House rules (also in README.md):
//
// * Every call to fire() is a shot and counts toward shotsFired.
// * A shot at a cell that has already been fired at is wasted. It always comes
//   back MISS, it is flagged as a repeat in the log, and nothing on the board changes.
// * SUNK is reported by the shot that hits the last undamaged cell of a ship.
// * Shots off the board throw OffBoardError and are not counted.
const { key } = require('./ocean');

const ShotResult = Object.freeze({ MISS: 'MISS', HIT: 'HIT', SUNK: 'SUNK' });

/** One fleet under fire. A battle always starts from an undamaged fleet. */
class Battle {
  constructor(fleet) {
    this.fleet = fleet;
    this.ocean = fleet.ocean;
    this.shotsFired = 0;
    this.log = []; // {coord, result, ship, repeat} per shot
    this.misses = new Set(); // keys of water cells that have been fired at
    this.hits = new Set(); // keys of ship cells that have been fired at
    fleet.resetDamage();
  }

  get fleetSunk() {
    return this.fleet.ships.every(ship => ship.isSunk);
  }

  get repeats() {
    return this.log.filter(record => record.repeat).length;
  }

  /** Resolve one shot at target (a {row, col} object, a [row, col] pair or a label like 'B7'). */
  fire(target) {
    const c = this.ocean.require(target);
    this.shotsFired += 1;
    if (this.misses.has(key(c)) || this.hits.has(key(c))) return this.record(c, ShotResult.MISS, null, true);

    const ship = this.fleet.shipAt(c);
    if (!ship) {
      this.misses.add(key(c));
      return this.record(c, ShotResult.MISS);
    }

    this.hits.add(key(c));
    ship.takeHit();
    return this.record(c, ship.isSunk ? ShotResult.SUNK : ShotResult.HIT, ship.name);
  }

  record(c, result, ship = null, repeat = false) {
    this.log.push({ coord: c, result, ship, repeat });
    return result;
  }

  /** The shooter's view: '.' unknown, 'o' miss, 'X' hit, '#' part of a sunk ship. */
  chart() {
    return this.ocean.render(c => {
      if (this.misses.has(key(c))) return 'o';
      if (this.hits.has(key(c))) return this.fleet.shipAt(c).isSunk ? '#' : 'X';
      return '.';
    });
  }
}

module.exports = { ShotResult, Battle };
