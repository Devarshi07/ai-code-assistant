// Level model: turns a designer's text layout into a queryable grid.
//
// Symbols
//   #   wall
//   .   floor
//   S   start tile (exactly one)
//   E   exit tile (exactly one)
//   $   gem
//   > < ^ v   one-way gates (see Level#movesFrom)
import { DIRECTIONS, GATES, position, step } from './geometry.ts';
import type { Direction, Position } from './geometry.ts';

export const WALL = '#';
export const FLOOR = '.';
export const START = 'S';
export const EXIT = 'E';
export const GEM = '$';
const SYMBOLS = new Set([WALL, FLOOR, START, EXIT, GEM, ...Object.keys(GATES)]);

export class LevelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LevelError';
  }
}

export class Level {
  readonly name: string;
  readonly rows: readonly string[];
  readonly height: number;
  readonly width: number;
  readonly start: Position;
  readonly exit: Position;
  readonly gems: Position[];

  constructor(name: string, rows: readonly string[]) {
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
  static parse(text: string, name = 'level'): Level {
    const rows = text.split('\n').map(line => line.trim()).filter(Boolean);
    return new Level(name, rows);
  }

  findAll(symbol: string): Position[] {
    const found: Position[] = [];
    this.rows.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) if (line[c] === symbol) found.push(position(r, c));
    });
    return found;
  }

  findOne(symbol: string): Position {
    const found = this.findAll(symbol);
    if (found.length !== 1) throw new LevelError(`${this.name}: expected exactly one '${symbol}', found ${found.length}`);
    return found[0];
  }

  inBounds(pos: Position): boolean {
    return pos.row >= 0 && pos.row < this.height && pos.col >= 0 && pos.col < this.height;
  }

  cell(pos: Position): string {
    return this.rows[pos.row][pos.col];
  }

  isWalkable(pos: Position): boolean {
    return this.inBounds(pos) && this.cell(pos) !== WALL;
  }

  /**
   * Every position reachable in a single step from pos.
   *
   * Gates are one-way doors: a gate can only be entered while moving in its
   * arrow's direction, and the next step must continue that way.
   */
  movesFrom(pos: Position): Position[] {
    const here = this.cell(pos);
    const allowed = here in GATES ? [GATES[here]] : (Object.keys(DIRECTIONS) as Direction[]);
    const moves: Position[] = [];
    for (const direction of allowed) {
      const next = step(pos, direction);
      if (!this.isWalkable(next)) continue;
      const there = this.cell(next);
      if (there in GATES && GATES[there] !== direction) continue;
      moves.push(next);
    }
    return moves;
  }

  toString(): string {
    return `Level(${this.name}, ${this.width}x${this.height}, gems=${this.gems.length})`;
  }
}
