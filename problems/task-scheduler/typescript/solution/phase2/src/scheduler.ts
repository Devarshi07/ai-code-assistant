// Turns a dependency graph into a Schedule of runner assignments.
import type { DependencyGraph } from './graph.ts';
import { Schedule, slot } from './timeline.ts';
import type { Slot } from './timeline.ts';

/** Today's behaviour: one runner, tasks back to back in topological order. */
export function serialSchedule(graph: DependencyGraph): Schedule {
  const slots: Slot[] = [];
  let clock = 0;
  for (const name of graph.topologicalOrder()) {
    const duration = graph.get(name).duration;
    slots.push(slot(name, 0, clock, clock + duration));
    clock += duration;
  }
  return new Schedule(1, slots);
}

/**
 * Each task's priority: its duration plus the longest remaining path of any
 * task that depends on it. Dependents come first in reverse topological
 * order, so one backward pass is enough.
 */
export function remainingPaths(graph: DependencyGraph): Map<string, number> {
  const longest = new Map<string, number>();
  const order = graph.topologicalOrder();
  for (let i = order.length - 1; i >= 0; i--) {
    const name = order[i];
    let tail = 0;
    for (const child of graph.dependents(name)) tail = Math.max(tail, longest.get(child)!);
    longest.set(name, graph.get(name).duration + tail);
  }
  return longest;
}

/**
 * Plan the pipeline on `workers` identical runners.
 *
 * Uses the list-scheduling policy described under "Parallel runners" in
 * README.md: whenever a runner is idle, it starts the ready task with the
 * highest priority. Returns a Schedule with one slot per task.
 *
 * Event by event: finish everything ending now, rescan the waiting tasks for
 * ready ones, hand them out by priority, then jump to the next finish.
 */
export function schedule(graph: DependencyGraph, workers: number): Schedule {
  if (!(workers >= 1)) throw new RangeError('schedule needs at least one runner');
  const priority = remainingPaths(graph);
  const byPriority = (a: string, b: string) => priority.get(b)! - priority.get(a)! || (a < b ? -1 : a > b ? 1 : 0);
  let waiting = graph.names;           // tasks that have not started yet
  const finished = new Set<string>();
  let running: Slot[] = [];            // slots in progress
  let idle: number[] = [];
  for (let w = 0; w < workers; w++) idle.push(w);
  const slots: Slot[] = [];
  let clock = 0;
  while (waiting.length || running.length) {
    const stillRunning: Slot[] = [];
    for (const s of running) {
      if (s.end === clock) {
        finished.add(s.task);
        idle.push(s.worker);
      } else {
        stillRunning.push(s);
      }
    }
    running = stillRunning;
    const ready = waiting.filter(name => graph.get(name).deps.every(dep => finished.has(dep)));
    ready.sort(byPriority);
    idle.sort((a, b) => a - b);
    const count = Math.min(ready.length, idle.length);
    const started = new Set<string>();
    for (let i = 0; i < count; i++) {
      const s = slot(ready[i], idle[i], clock, clock + graph.get(ready[i]).duration);
      slots.push(s);
      running.push(s);
      started.add(ready[i]);
    }
    idle = idle.slice(count);
    if (count) waiting = waiting.filter(name => !started.has(name));
    if (running.length) {
      clock = Infinity;
      for (const s of running) clock = Math.min(clock, s.end);
    }
  }
  return new Schedule(workers, slots);
}
