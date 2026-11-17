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
 * Plan the pipeline on `workers` identical runners.
 *
 * Uses the list-scheduling policy described under "Parallel runners" in
 * README.md: whenever a runner is idle, it starts the ready task with the
 * highest priority. Returns a Schedule with one slot per task.
 */
export function schedule(graph: DependencyGraph, workers: number): Schedule {
  throw new Error('Not implemented: schedule (Phase 2)');
}
