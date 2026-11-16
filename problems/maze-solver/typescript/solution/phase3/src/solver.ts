// Route finding over Level grids.
import { key } from './geometry.ts';
import type { Position } from './geometry.ts';
import type { Level } from './level.ts';

/**
 * A complete route through a level.
 * path lists every tile visited, start and exit inclusive; moves is path.length - 1.
 */
export interface Run {
  path: Position[];
  moves: number;
}

/**
 * Breadth-first search from source to target.
 * Returns the positions from source to target inclusive, or null when the
 * target cannot be reached.
 */
export function shortestPath(level: Level, source: Position, target: Position): Position[] | null {
  if (key(source) === key(target)) return [source];
  const cameFrom = new Map<string, Position | null>([[key(source), null]]);
  const queue: Position[] = [source];
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

function rebuild(cameFrom: Map<string, Position | null>, target: Position): Position[] {
  const path = [target];
  for (let previous = cameFrom.get(key(target)); previous; previous = cameFrom.get(key(previous))) {
    path.push(previous);
  }
  return path.reverse();
}

/** BFS over the whole level from source; maps each reachable tile key to its parent. */
function searchFrom(level: Level, source: Position): Map<string, Position | null> {
  const cameFrom = new Map<string, Position | null>([[key(source), null]]);
  const queue: Position[] = [source];
  for (let head = 0; head < queue.length; head++) {
    for (const next of level.movesFrom(queue[head])) {
      const id = key(next);
      if (cameFrom.has(id)) continue;
      cameFrom.set(id, queue[head]);
      queue.push(next);
    }
  }
  return cameFrom;
}

/** Shortest route from the start tile to the exit, ignoring gems. */
export function solve(level: Level): Run | null {
  const path = shortestPath(level, level.start, level.exit);
  return path ? { path, moves: path.length - 1 } : null;
}

/**
 * Shortest route from the start tile to the exit that steps on every gem.
 *
 * One BFS per stop gives every directional leg. A Held-Karp dynamic program
 * over subsets of gems then finds the best order in O(2^k * k^2).
 */
export function collectAllGems(level: Level): Run | null {
  const gems = level.gems;
  const k = gems.length;
  if (k === 0) return solve(level);
  const trees = [level.start, ...gems].map(source => searchFrom(level, source));
  const legPath = (from: number, target: Position): Position[] | null => {
    const tree = trees[from];
    if (!tree.has(key(target))) return null;
    return rebuild(tree, target);
  };
  const legLength = (from: number, target: Position): number => {
    const path = legPath(from, target);
    return path ? path.length - 1 : Infinity;
  };
  // toGem[i][j]: source i (0 = start, 1..k = gems) to gem j (0-based).
  const toGem = trees.map((_, i) => gems.map(gem => legLength(i, gem)));
  const toExit = trees.map((_, i) => legLength(i, level.exit));

  const full = (1 << k) - 1;
  const best = Array.from({ length: 1 << k }, () => new Float64Array(k).fill(Infinity));
  const parent = Array.from({ length: 1 << k }, () => new Int8Array(k).fill(-1));
  for (let j = 0; j < k; j++) best[1 << j][j] = toGem[0][j];
  for (let mask = 1; mask <= full; mask++) {
    const row = best[mask];
    for (let last = 0; last < k; last++) {
      const here = row[last];
      if (here === Infinity) continue;
      const legs = toGem[last + 1];
      for (let next = 0; next < k; next++) {
        const bit = 1 << next;
        if (mask & bit) continue;
        const cost = here + legs[next];
        if (cost < best[mask | bit][next]) {
          best[mask | bit][next] = cost;
          parent[mask | bit][next] = last;
        }
      }
    }
  }

  let bestTotal = Infinity;
  let bestLast = -1;
  for (let last = 0; last < k; last++) {
    const total = best[full][last] + toExit[last + 1];
    if (total < bestTotal) {
      bestTotal = total;
      bestLast = last;
    }
  }
  if (bestLast < 0) return null;

  const order: number[] = [];
  for (let mask = full, last = bestLast; last >= 0;) {
    order.push(last);
    const previous = parent[mask][last];
    mask ^= 1 << last;
    last = previous;
  }
  order.reverse();

  const path = [level.start];
  let from = 0;
  for (const gem of order) {
    path.push(...legPath(from, gems[gem])!.slice(1));
    from = gem + 1;
  }
  path.push(...legPath(from, level.exit)!.slice(1));
  return { path, moves: path.length - 1 };
}
