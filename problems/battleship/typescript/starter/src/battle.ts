// Shot resolution: the referee between a shooter and a hidden fleet.
//
// House rules (also in README.md):
//
// * Every call to fire() is a shot and counts toward shotsFired.
// * A shot at a cell that has already been fired at is wasted. It always comes
//   back MISS, it is flagged as a repeat in the log, and nothing on the board changes.
// * SUNK is reported by the shot that hits the last undamaged cell of a ship.
// * Shots off the board throw OffBoardError and are not counted.
import { key } from './ocean.ts';
import type { Coord, CoordLike, Ocean } from './ocean.ts';
import type { Fleet } from './ships.ts';

export const ShotResult = Object.freeze({ MISS: 'MISS', HIT: 'HIT', SUNK: 'SUNK' } as const);
export type ShotResult = (typeof ShotResult)[keyof typeof ShotResult];

export interface ShotRecord {
  coord: Coord;
  result: ShotResult;
  ship: string | null; // name of the ship that was struck, if any
  repeat: boolean; // true when the cell had already been fired at
}

/** One fleet under fire. A battle always starts from an undamaged fleet. */
export class Battle {
  readonly fleet: Fleet;
  readonly ocean: Ocean;
  shotsFired = 0;
  readonly log: ShotRecord[] = [];
  readonly misses = new Set<string>(); // keys of water cells that have been fired at
  readonly hits = new Set<string>(); // keys of ship cells that have been fired at

  constructor(fleet: Fleet) {
    this.fleet = fleet;
    this.ocean = fleet.ocean;
    fleet.resetDamage();
  }

  get fleetSunk(): boolean {
    return this.fleet.ships.every(ship => ship.isSunk);
  }

  get repeats(): number {
    return this.log.filter(record => record.repeat).length;
  }

  /** Resolve one shot at target (a {row, col} object, a [row, col] pair or a label like 'B7'). */
  fire(target: CoordLike): ShotResult {
    const c = this.ocean.require(target);
    this.shotsFired += 1;
    if (this.misses.has(key(c))) return this.record(c, ShotResult.MISS, null, true);

    const ship = this.fleet.shipAt(c);
    if (!ship) {
      this.misses.add(key(c));
      return this.record(c, ShotResult.MISS);
    }

    this.hits.add(key(c));
    ship.takeHit();
    return this.record(c, ship.isSunk ? ShotResult.SUNK : ShotResult.HIT, ship.name);
  }

  private record(c: Coord, result: ShotResult, ship: string | null = null, repeat = false): ShotResult {
    this.log.push({ coord: c, result, ship, repeat });
    return result;
  }

  /** The shooter's view: '.' unknown, 'o' miss, 'X' hit, '#' part of a sunk ship. */
  chart(): string {
    return this.ocean.render(c => {
      if (this.misses.has(key(c))) return 'o';
      if (this.hits.has(key(c))) return this.fleet.shipAt(c)?.isSunk ? '#' : 'X';
      return '.';
    });
  }
}
