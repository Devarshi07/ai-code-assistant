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

/** Shortest route from the start tile to the exit, ignoring gems. */
export function solve(level: Level): Run | null {
  const path = shortestPath(level, level.start, level.exit);
  return path ? { path, moves: path.length - 1 } : null;
}

/**
 * Shortest route from the start tile to the exit that steps on every gem.
 *
 * Computes the shortest leg between every pair of stops, then tries every
 * order of gems. Legs are directional because gates are one-way.
 */
export function collectAllGems(level: Level): Run | null {
  const stops = [level.start, ...level.gems, level.exit];
  const legs = stops.map(a => stops.map(b => shortestPath(level, a, b)));
  const exit = stops.length - 1;
  const gemCount = level.gems.length;
  const used = new Array<boolean>(gemCount + 1).fill(false);
  const order: number[] = [];
  let bestTotal = Infinity;
  let bestOrder: number[] | null = null;

  function visit(last: number, total: number): void {
    if (order.length === gemCount) {
      const tail = legs[last][exit];
      if (tail && total + tail.length - 1 < bestTotal) {
        bestTotal = total + tail.length - 1;
        bestOrder = [...order];
      }
      return;
    }
    for (let gem = 1; gem <= gemCount; gem++) {
      const leg = legs[last][gem];
      if (used[gem] || !leg) continue;
      used[gem] = true;
      order.push(gem);
      visit(gem, total + leg.length - 1);
      order.pop();
      used[gem] = false;
    }
  }

  visit(0, 0);
  if (!bestOrder) return null;
  const route = [0, ...(bestOrder as number[]), exit];
  const path = [level.start];
  for (let i = 1; i < route.length; i++) path.push(...legs[route[i - 1]][route[i]]!.slice(1));
  return { path, moves: path.length - 1 };
}
