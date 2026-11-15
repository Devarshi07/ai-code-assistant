// Ship models and fleet placement.
//
// A Fleet owns the ships on one ocean and enforces the placement rules: every
// ship is a straight horizontal or vertical line, stays on the board and never
// shares a cell with another ship. Ships may touch side by side (studio rules).
const { coord, key, label, toCoord } = require('./ocean');

/** Ship lengths of the standard fleet: carrier, battleship, cruiser, submarine, destroyer. */
const DEFAULT_FLEET = Object.freeze([5, 4, 3, 3, 2]);

/** Class names by length. A repeated length takes the next name on its list. */
const CLASS_NAMES = {
  5: ['Carrier'], 4: ['Battleship'], 3: ['Cruiser', 'Submarine'], 2: ['Destroyer'], 1: ['Patrol boat'],
};

class PlacementError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlacementError';
  }
}

class Ship {
  constructor(name, cells) {
    this.name = name;
    this.cells = cells;
    this.damage = 0; // hits taken so far in the current battle
  }

  get size() {
    return this.cells.length;
  }

  get isSunk() {
    return this.damage >= this.size;
  }

  takeHit() {
    this.damage += 1;
  }
}

/** The ships hidden on one ocean. */
class Fleet {
  constructor(ocean) {
    this.ocean = ocean;
    this.ships = [];
    this.byCell = new Map(); // key(cell) -> Ship
  }

  /** The cells a ship of this length covers, starting at origin. */
  static span(length, origin, vertical) {
    const cells = [];
    for (let i = 0; i < length; i++) {
      cells.push(vertical ? coord(origin.row + i, origin.col) : coord(origin.row, origin.col + i));
    }
    return cells;
  }

  fits(length, origin, vertical = false) {
    return Fleet.span(length, toCoord(origin), vertical).every(c => this.ocean.inBounds(c) && !this.byCell.has(key(c)));
  }

  /** Add a ship whose bow is at origin, running east (or south if vertical). */
  place(length, origin, vertical = false, name = null) {
    if (!(length >= 1)) throw new PlacementError(`a ship needs at least one cell, got ${length}`);
    origin = toCoord(origin);
    if (name === null) {
      const names = CLASS_NAMES[length] || [`${length}-cell ship`];
      const taken = this.ships.filter(ship => ship.size === length).length;
      name = taken < names.length ? names[taken] : `${names[names.length - 1]} ${taken + 1}`;
    }
    const cells = Fleet.span(length, origin, vertical);
    for (const cell of cells) {
      if (!this.ocean.inBounds(cell)) throw new PlacementError(`${name} at ${label(origin)} runs off the board`);
      const other = this.byCell.get(key(cell));
      if (other) throw new PlacementError(`${name} at ${label(origin)} overlaps the ${other.name} at ${label(cell)}`);
    }
    const ship = new Ship(name, cells);
    this.ships.push(ship);
    for (const cell of cells) this.byCell.set(key(cell), ship);
    return ship;
  }

  shipAt(value) {
    return this.byCell.get(key(toCoord(value))) || null;
  }

  get shipSizes() {
    return this.ships.map(ship => ship.size);
  }

  resetDamage() {
    for (const ship of this.ships) ship.damage = 0;
  }

  /** The fleet as a chart: ships are lettered A, B, C... in placement order. */
  render() {
    return this.ocean.render(c => {
      const ship = this.byCell.get(key(c));
      return ship ? String.fromCharCode(65 + this.ships.indexOf(ship)) : '.';
    });
  }
}

module.exports = { DEFAULT_FLEET, CLASS_NAMES, PlacementError, Ship, Fleet };
