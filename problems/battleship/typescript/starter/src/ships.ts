// Ship models and fleet placement.
//
// A Fleet owns the ships on one ocean and enforces the placement rules: every
// ship is a straight horizontal or vertical line, stays on the board and never
// shares a cell with another ship. Ships may touch side by side (studio rules).
import { coord, key, label, toCoord } from './ocean.ts';
import type { Coord, CoordLike, Ocean } from './ocean.ts';

/** Ship lengths of the standard fleet: carrier, battleship, cruiser, submarine, destroyer. */
export const DEFAULT_FLEET: readonly number[] = Object.freeze([5, 4, 3, 3, 2]);

/** Class names by length. A repeated length takes the next name on its list. */
export const CLASS_NAMES: Readonly<Record<number, readonly string[]>> = {
  5: ['Carrier'], 4: ['Battleship'], 3: ['Cruiser', 'Submarine'], 2: ['Destroyer'], 1: ['Patrol boat'],
};

export class PlacementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlacementError';
  }
}

export class Ship {
  readonly name: string;
  readonly cells: Coord[];
  damage = 0; // hits taken so far in the current battle

  constructor(name: string, cells: Coord[]) {
    this.name = name;
    this.cells = cells;
  }

  get size(): number {
    return this.cells.length;
  }

  get isSunk(): boolean {
    return this.damage >= this.size;
  }

  takeHit(): void {
    this.damage += 1;
  }
}

/** The ships hidden on one ocean. */
export class Fleet {
  readonly ocean: Ocean;
  readonly ships: Ship[] = [];
  private readonly byCell = new Map<string, Ship>(); // key(cell) -> Ship

  constructor(ocean: Ocean) {
    this.ocean = ocean;
  }

  /** The cells a ship of this length covers, starting at origin. */
  static span(length: number, origin: Coord, vertical: boolean): Coord[] {
    const cells: Coord[] = [];
    for (let i = 0; i < length; i++) {
      cells.push(vertical ? coord(origin.row + i, origin.col) : coord(origin.row, origin.col + i));
    }
    return cells;
  }

  fits(length: number, origin: CoordLike, vertical = false): boolean {
    return Fleet.span(length, toCoord(origin), vertical).every(c => this.ocean.inBounds(c) && !this.byCell.has(key(c)));
  }

  /** Add a ship whose bow is at origin, running east (or south if vertical). */
  place(length: number, origin: CoordLike, vertical = false, name: string | null = null): Ship {
    if (!(length >= 1)) throw new PlacementError(`a ship needs at least one cell, got ${length}`);
    const bow = toCoord(origin);
    if (name === null) {
      const names = CLASS_NAMES[length] || [`${length}-cell ship`];
      const taken = this.ships.filter(ship => ship.size === length).length;
      name = taken < names.length ? names[taken] : `${names[names.length - 1]} ${taken + 1}`;
    }
    const cells = Fleet.span(length, bow, vertical);
    for (const cell of cells) {
      if (!this.ocean.inBounds(cell)) throw new PlacementError(`${name} at ${label(bow)} runs off the board`);
      const other = this.byCell.get(key(cell));
      if (other) throw new PlacementError(`${name} at ${label(bow)} overlaps the ${other.name} at ${label(cell)}`);
    }
    const ship = new Ship(name, cells);
    this.ships.push(ship);
    for (const cell of cells) this.byCell.set(key(cell), ship);
    return ship;
  }

  shipAt(value: CoordLike): Ship | null {
    return this.byCell.get(key(toCoord(value))) || null;
  }

  get shipSizes(): number[] {
    return this.ships.map(ship => ship.size);
  }

  resetDamage(): void {
    for (const ship of this.ships) ship.damage = 0;
  }

  /** The fleet as a chart: ships are lettered A, B, C... in placement order. */
  render(): string {
    return this.ocean.render(c => {
      const ship = this.byCell.get(key(c));
      return ship ? String.fromCharCode(65 + this.ships.indexOf(ship)) : '.';
    });
  }
}
