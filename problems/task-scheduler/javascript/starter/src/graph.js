// Dependency graph utilities: validation, cycle detection, ordering.
const { parsePipeline } = require('./parser');
const { PipelineError } = require('./task');

/** The pipeline's dependencies loop back on themselves. */
class CycleError extends PipelineError {
  constructor(cycle) {
    super(`dependency cycle: ${cycle.join(' -> ')}`);
    this.name = 'CycleError';
    this.cycle = cycle;
  }
}

/**
 * A validated, acyclic set of tasks.
 *
 * graph.get('compile')         the Task named compile
 * graph.dependents('compile')  names of the tasks that list compile in `after`
 * Iterating a graph yields its tasks in definition order.
 */
class DependencyGraph {
  constructor(tasks) {
    this._tasks = new Map();
    for (const task of tasks) {
      if (this._tasks.has(task.name)) throw new PipelineError(`task '${task.name}' is defined twice`);
      this._tasks.set(task.name, task);
    }
    this._dependents = new Map();
    for (const name of this._tasks.keys()) this._dependents.set(name, []);
    for (const task of this._tasks.values()) {
      for (const dep of task.deps) {
        if (dep === task.name) throw new PipelineError(`task '${task.name}' depends on itself`);
        if (!this._tasks.has(dep)) throw new PipelineError(`task '${task.name}' depends on unknown task '${dep}'`);
        this._dependents.get(dep).push(task.name);
      }
    }
    for (const names of this._dependents.values()) Object.freeze(names);
    const deps = new Map();
    for (const [name, task] of this._tasks) deps.set(name, task.deps);
    const cycle = findCycle(deps);
    if (cycle) throw new CycleError(cycle);
  }

  get size() { return this._tasks.size; }

  [Symbol.iterator]() { return this._tasks.values(); }

  has(name) { return this._tasks.has(name); }

  get(name) { return this._tasks.get(name); }

  get names() { return [...this._tasks.keys()]; }

  dependents(name) { return this._dependents.get(name); }

  /**
   * Task names, each after all of its dependencies.
   * Kahn's algorithm with a FIFO queue seeded in definition order, so the
   * result is deterministic.
   */
  topologicalOrder() {
    const waiting = new Map();
    const queue = [];
    for (const [name, task] of this._tasks) {
      waiting.set(name, task.deps.length);
      if (task.deps.length === 0) queue.push(name);
    }
    for (let head = 0; head < queue.length; head++) {
      for (const child of this._dependents.get(queue[head])) {
        const left = waiting.get(child) - 1;
        waiting.set(child, left);
        if (left === 0) queue.push(child);
      }
    }
    return queue;
  }

  /**
   * The longest chain of work: { minutes, path: [names from first to last] }.
   * No number of runners can finish the pipeline faster than this.
   */
  criticalPath() {
    const finish = new Map();
    const via = new Map();
    for (const name of this.topologicalOrder()) {
      let start = 0;
      let before = null;
      for (const dep of this._tasks.get(name).deps) {
        if (finish.get(dep) > start) {
          start = finish.get(dep);
          before = dep;
        }
      }
      finish.set(name, start + this._tasks.get(name).duration);
      via.set(name, before);
    }
    let last = null;
    for (const [name, end] of finish) if (last === null || end > finish.get(last)) last = name;
    const path = [];
    for (let name = last; name !== null; name = via.get(name)) path.push(name);
    path.reverse();
    return { minutes: path.length ? finish.get(path[path.length - 1]) : 0, path };
  }
}

/**
 * Return one cycle in a Map of name -> deps as [a, b, ..., a], or null.
 * Iterative depth-first search, so very deep pipelines can't overflow the
 * stack. A dependency still on the current trail closes a loop.
 */
function findCycle(deps) {
  const done = new Set();
  const onTrail = new Set();
  for (const root of deps.keys()) {
    if (done.has(root)) continue;
    const trail = [root];
    const next = [0];        // next[i]: position of trail[i]'s next dependency
    onTrail.add(root);
    while (trail.length) {
      const top = trail.length - 1;
      const list = deps.get(trail[top]);
      if (next[top] === list.length) {
        const finished = trail.pop();
        next.pop();
        onTrail.delete(finished);
        done.add(finished);
        continue;
      }
      const dep = list[next[top]++];
      if (onTrail.has(dep)) return [...trail.slice(trail.indexOf(dep)), dep];
      if (!done.has(dep)) {
        trail.push(dep);
        next.push(0);
        onTrail.add(dep);
      }
    }
  }
  return null;
}

/** Parse pipeline text and validate it into a DependencyGraph. */
function loadPipeline(text) {
  return new DependencyGraph(parsePipeline(text));
}

module.exports = { DependencyGraph, CycleError, findCycle, loadPipeline };
