// Grid geometry shared by the level model, the solver and the renderer.
// Positions are {row, col} with row 0 at the top of the map, matching the way
// level files are written.

/** Compass directions as [row delta, col delta]. */
const DIRECTIONS = {
  N: [-1, 0],
  E: [0, 1],
  S: [1, 0],
  W: [0, -1],
};

/** One-way gate symbols and the single direction each one allows. */
const GATES = { '>': 'E', '<': 'W', '^': 'N', v: 'S' };

function position(row, col) {
  return { row, col };
}

/** Stable string key, so positions can be used in Maps and Sets. */
function key(pos) {
  return `${pos.row},${pos.col}`;
}

function samePosition(a, b) {
  return a.row === b.row && a.col === b.col;
}

/** The neighbouring position one step from pos in direction. */
function step(pos, direction) {
  const [dr, dc] = DIRECTIONS[direction];
  return position(pos.row + dr, pos.col + dc);
}

/** The compass direction of a single step from a to b. */
function directionBetween(a, b) {
  const dr = b.row - a.row;
  const dc = b.col - a.col;
  for (const [name, [r, c]] of Object.entries(DIRECTIONS)) {
    if (r === dr && c === dc) return name;
  }
  throw new Error(`(${a.row}, ${a.col}) and (${b.row}, ${b.col}) are not adjacent`);
}

function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

module.exports = { DIRECTIONS, GATES, position, key, samePosition, step, directionBetween, manhattan };
