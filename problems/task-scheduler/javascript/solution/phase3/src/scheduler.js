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
 * Each task's priority: its duration plus the longest remaining path of any
 * task that depends on it. Dependents come first in reverse topological
 * order, so one backward pass is enough.
 */
function remainingPaths(graph) {
  const longest = new Map();
  const order = graph.topologicalOrder();
  for (let i = order.length - 1; i >= 0; i--) {
    const name = order[i];
    let tail = 0;
    for (const child of graph.dependents(name)) tail = Math.max(tail, longest.get(child));
    longest.set(name, graph.get(name).duration + tail);
  }
  return longest;
}

/** Binary min-heap; `less(a, b)` is true when a should come out first. */
class Heap {
  constructor(less, items = []) {
    this.less = less;
    this.items = items;
    for (let i = (items.length >> 1) - 1; i >= 0; i--) this.siftDown(i);
  }

  get size() { return this.items.length; }

  peek() { return this.items[0]; }

  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  siftDown(i) {
    const items = this.items;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let best = i;
      if (left < items.length && this.less(items[left], items[best])) best = left;
      if (right < items.length && this.less(items[right], items[best])) best = right;
      if (best === i) return;
      [items[i], items[best]] = [items[best], items[i]];
      i = best;
    }
  }
}

/**
 * Plan the pipeline on `workers` identical runners.
 *
 * Uses the list-scheduling policy described under "Parallel runners" in
 * README.md: whenever a runner is idle, it starts the ready task with the
 * highest priority. Returns a Schedule with one slot per task.
 *
 * Event-driven with three heaps, O((n + e) log n) overall:
 *   ready    tasks whose dependencies have all finished, best priority first
 *   idle     runner ids, lowest first
 *   running  slots in progress, soonest finish first
 * `blockers` counts each task's unfinished dependencies (Kahn's algorithm),
 * so a finish only touches the dependents of the task that finished.
 */
function schedule(graph, workers) {
  if (!(workers >= 1)) throw new RangeError('schedule needs at least one runner');
  const priority = remainingPaths(graph);
  const blockers = new Map();
  const roots = [];
  for (const task of graph) {
    blockers.set(task.name, task.deps.length);
    if (task.deps.length === 0) roots.push(task.name);
  }
  const ready = new Heap((a, b) => {
    const pa = priority.get(a);
    const pb = priority.get(b);
    return pa > pb || (pa === pb && a < b);
  }, roots);
  const idle = new Heap((a, b) => a < b, Array.from({ length: workers }, (_, w) => w));
  const running = new Heap((a, b) => a.end < b.end);
  const slots = [];
  let clock = 0;
  while (ready.size || running.size) {
    while (ready.size && idle.size) {
      const name = ready.pop();
      const s = slot(name, idle.pop(), clock, clock + graph.get(name).duration);
      slots.push(s);
      running.push(s);
    }
    clock = running.peek().end;
    // Finish everything that ends at this minute before starting anything new.
    while (running.size && running.peek().end === clock) {
      const done = running.pop();
      idle.push(done.worker);
      for (const child of graph.dependents(done.task)) {
        const left = blockers.get(child) - 1;
        blockers.set(child, left);
        if (left === 0) ready.push(child);
      }
    }
  }
  return new Schedule(workers, slots);
}

module.exports = { serialSchedule, remainingPaths, schedule };
