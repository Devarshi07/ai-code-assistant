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

/**
 * Shortest route from the start tile to the exit that steps on every gem.
 *
 * Computes the shortest leg between every pair of stops, then tries every
 * order of gems. Legs are directional because gates are one-way.
 */
function collectAllGems(level) {
  const stops = [level.start, ...level.gems, level.exit];
  const legs = stops.map(a => stops.map(b => shortestPath(level, a, b)));
  const exit = stops.length - 1;
  const gemCount = level.gems.length;
  const used = new Array(gemCount + 1).fill(false);
  const order = [];
  let bestTotal = Infinity;
  let bestOrder = null;

  function visit(last, total) {
    if (order.length === gemCount) {
      const tail = legs[last][exit];
      if (tail && total + tail.length - 1 < bestTotal) {
        bestTotal = total + tail.length - 1;
        bestOrder = [...order];
      }
      return;
    }
    for (let gem = 1; gem <= gemCount; gem++) {
      if (used[gem] || !legs[last][gem]) continue;
      used[gem] = true;
      order.push(gem);
      visit(gem, total + legs[last][gem].length - 1);
      order.pop();
      used[gem] = false;
    }
  }

  visit(0, 0);
  if (!bestOrder) return null;
  const route = [0, ...bestOrder, exit];
  const path = [level.start];
  for (let i = 1; i < route.length; i++) path.push(...legs[route[i - 1]][route[i]].slice(1));
  return { path, moves: path.length - 1 };
}

module.exports = { shortestPath, solve, collectAllGems };
