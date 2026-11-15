// Level model: turns a designer's text layout into a queryable grid.
//
// Symbols
//   #   wall
//   .   floor
//   S   start tile (exactly one)
//   E   exit tile (exactly one)
//   $   gem
//   > < ^ v   one-way gates (see Level#movesFrom)
const { DIRECTIONS, GATES, position, step } = require('./geometry');

const WALL = '#';
const FLOOR = '.';
const START = 'S';
const EXIT = 'E';
const GEM = '$';
const SYMBOLS = new Set([WALL, FLOOR, START, EXIT, GEM, ...Object.keys(GATES)]);

class LevelError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LevelError';
  }
}

class Level {
  constructor(name, rows) {
    if (!rows.length || !rows[0].length) throw new LevelError(`${name}: level is empty`);
    const width = rows[0].length;
    if (rows.some(row => row.length !== width)) throw new LevelError(`${name}: every row must have the same width`);
    const unknown = [...new Set(rows.join(''))].filter(ch => !SYMBOLS.has(ch));
    if (unknown.length) throw new LevelError(`${name}: unknown symbols '${unknown.sort().join('')}'`);
    this.name = name;
    this.rows = [...rows];
    this.height = rows.length;
    this.width = width;
    this.start = this.findOne(START);
    this.exit = this.findOne(EXIT);
    this.gems = this.findAll(GEM);
  }

  /** Build a Level from a block of text, ignoring blank lines. */
  static parse(text, name = 'level') {
    const rows = text.split('\n').map(line => line.trim()).filter(Boolean);
    return new Level(name, rows);
  }

  findAll(symbol) {
    const found = [];
    this.rows.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) if (line[c] === symbol) found.push(position(r, c));
    });
    return found;
  }

  findOne(symbol) {
    const found = this.findAll(symbol);
    if (found.length !== 1) throw new LevelError(`${this.name}: expected exactly one '${symbol}', found ${found.length}`);
    return found[0];
  }

  inBounds(pos) {
    return pos.row >= 0 && pos.row < this.height && pos.col >= 0 && pos.col < this.width;
  }

  cell(pos) {
    return this.rows[pos.row][pos.col];
  }

  isWalkable(pos) {
    return this.inBounds(pos) && this.cell(pos) !== WALL;
  }

  /**
   * Every position reachable in a single step from pos.
   *
   * Gates are one-way doors: a gate can only be entered while moving in its
   * arrow's direction, and the next step must continue that way.
   */
  movesFrom(pos) {
    const here = this.cell(pos);
    const allowed = here in GATES ? [GATES[here]] : Object.keys(DIRECTIONS);
    const moves = [];
    for (const direction of allowed) {
      const next = step(pos, direction);
      if (!this.isWalkable(next)) continue;
      const there = this.cell(next);
      if (there in GATES && GATES[there] !== direction) continue;
      moves.push(next);
    }
    return moves;
  }

  toString() {
    return `Level(${this.name}, ${this.width}x${this.height}, gems=${this.gems.length})`;
  }
}

module.exports = { Level, LevelError, WALL, FLOOR, START, EXIT, GEM };
