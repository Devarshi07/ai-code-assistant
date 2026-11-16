// Grid geometry shared by the level model, the solver and the renderer.
// Positions are {row, col} with row 0 at the top of the map, matching the way
// level files are written.

export interface Position {
  row: number;
  col: number;
}

export type Direction = 'N' | 'E' | 'S' | 'W';

/** Compass directions as [row delta, col delta]. */
export const DIRECTIONS: Record<Direction, readonly [number, number]> = {
  N: [-1, 0],
  E: [0, 1],
  S: [1, 0],
  W: [0, -1],
};

/** One-way gate symbols and the single direction each one allows. */
export const GATES: Record<string, Direction> = { '>': 'E', '<': 'W', '^': 'N', v: 'S' };

export function position(row: number, col: number): Position {
  return { row, col };
}

/** Stable string key, so positions can be used in Maps and Sets. */
export function key(pos: Position): string {
  return `${pos.row},${pos.col}`;
}

export function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

/** The neighbouring position one step from pos in direction. */
export function step(pos: Position, direction: Direction): Position {
  const [dr, dc] = DIRECTIONS[direction];
  return position(pos.row + dr, pos.col + dc);
}

/** The compass direction of a single step from a to b. */
export function directionBetween(a: Position, b: Position): Direction {
  const dr = b.row - a.row;
  const dc = b.col - a.col;
  for (const name of Object.keys(DIRECTIONS) as Direction[]) {
    const [r, c] = DIRECTIONS[name];
    if (r === dr && c === dc) return name;
  }
  throw new Error(`(${a.row}, ${a.col}) and (${b.row}, ${b.col}) are not adjacent`);
}

export function manhattan(a: Position, b: Position): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}
