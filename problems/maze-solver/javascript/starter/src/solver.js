// Route finding over Level grids.
const { key } = require('./geometry');

/**
 * A complete route through a level.
 * @typedef {{ path: {row: number, col: number}[], moves: number }} Run
 * path lists every tile visited, start and exit inclusive; moves is path.length - 1.
 */

/**
 * Breadth-first search from source to target.
 * Returns the positions from source to target inclusive, or null when the
 * target cannot be reached.
 */
function shortestPath(level, source, target) {
  if (key(source) === key(target)) return [source];
  const cameFrom = new Map([[key(source), null]]);
  const queue = [source];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const next of level.movesFrom(current)) {
      const id = key(next);
      if (cameFrom.has(id)) continue;
      cameFrom.set(id, current);
      if (id === key(target)) return rebuild(cameFrom, next);
      queue.push(next);
    }
  }
  return null;
}

function rebuild(cameFrom, target) {
  const path = [target];
  for (let previous = cameFrom.get(key(target)); previous; previous = cameFrom.get(key(previous))) {
    path.push(previous);
  }
  return path.reverse();
}

/** Shortest route from the start tile to the exit, ignoring gems. */
function solve(level) {
  const path = shortestPath(level, level.start, level.exit);
  return path ? { path, moves: path.length - 1 } : null;
}

/** Shortest route from the start tile to the exit that steps on every gem. */
function collectAllGems(level) {
  throw new Error('Not implemented: collectAllGems (Phase 2)');
}

module.exports = { shortestPath, solve, collectAllGems };
