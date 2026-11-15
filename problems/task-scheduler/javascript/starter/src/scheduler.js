// Turns a dependency graph into a Schedule of runner assignments.
const { Schedule, slot } = require('./timeline');

/** Today's behaviour: one runner, tasks back to back in topological order. */
function serialSchedule(graph) {
  const slots = [];
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
function schedule(graph, workers) {
  throw new Error('Not implemented: schedule (Phase 2)');
}

module.exports = { serialSchedule, schedule };
