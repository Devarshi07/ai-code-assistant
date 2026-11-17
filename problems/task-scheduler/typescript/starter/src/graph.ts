// Dependency graph utilities: validation, cycle detection, ordering.
import { parsePipeline } from './parser.ts';
import { PipelineError } from './task.ts';
import type { Task } from './task.ts';

/** The pipeline's dependencies loop back on themselves. */
export class CycleError extends PipelineError {
  readonly cycle: string[];

  constructor(cycle: string[]) {
    super(`dependency cycle: ${cycle.join(' -> ')}`);
    this.name = 'CycleError';
    this.cycle = cycle;
  }
}

/** The longest chain of tasks and how long it takes. */
export interface CriticalPath {
  minutes: number;
  path: string[];
}

/**
 * A validated, acyclic set of tasks.
 *
 * graph.get('compile')         the Task named compile
 * graph.dependents('compile')  names of the tasks that list compile in `after`
 * Iterating a graph yields its tasks in definition order.
 */
export class DependencyGraph {
  private readonly tasks = new Map<string, Task>();
  private readonly children = new Map<string, readonly string[]>();

  constructor(tasks: Iterable<Task>) {
    for (const task of tasks) {
      if (this.tasks.has(task.name)) throw new PipelineError(`task '${task.name}' is defined twice`);
      this.tasks.set(task.name, task);
    }
    const dependents = new Map<string, string[]>();
    for (const name of this.tasks.keys()) dependents.set(name, []);
    for (const task of this.tasks.values()) {
      for (const dep of task.deps) {
        if (dep === task.name) throw new PipelineError(`task '${task.name}' depends on itself`);
        if (!this.tasks.has(dep)) throw new PipelineError(`task '${task.name}' depends on unknown task '${dep}'`);
        dependents.get(dep)!.push(task.name);
      }
    }
    for (const [name, names] of dependents) this.children.set(name, Object.freeze(names));
    const deps = new Map<string, readonly string[]>();
    for (const [name, task] of this.tasks) deps.set(name, task.deps);
    const cycle = findCycle(deps);
    if (cycle) throw new CycleError(cycle);
  }

  get size(): number { return this.tasks.size; }

  [Symbol.iterator](): Iterator<Task> { return this.tasks.values(); }

  has(name: string): boolean { return this.tasks.has(name); }

  get(name: string): Task { return this.tasks.get(name)!; }

  get names(): string[] { return [...this.tasks.keys()]; }

  dependents(name: string): readonly string[] { return this.children.get(name)!; }

  /**
   * Task names, each after all of its dependencies.
   * Kahn's algorithm with a FIFO queue seeded in definition order, so the
   * result is deterministic.
   */
  topologicalOrder(): string[] {
    const waiting = new Map<string, number>();
    const queue: string[] = [];
    for (const [name, task] of this.tasks) {
      waiting.set(name, task.deps.length);
      if (task.deps.length === 0) queue.push(name);
    }
    for (let head = 0; head < queue.length; head++) {
      for (const child of this.children.get(queue[head])!) {
        const left = waiting.get(child)! - 1;
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
  criticalPath(): CriticalPath {
    const finish = new Map<string, number>();
    const via = new Map<string, string | null>();
    for (const name of this.topologicalOrder()) {
      let start = 0;
      let before: string | null = null;
      for (const dep of this.tasks.get(name)!.deps) {
        if (finish.get(dep)! > start) {
          start = finish.get(dep)!;
          before = dep;
        }
      }
      finish.set(name, start + this.tasks.get(name)!.duration);
      via.set(name, before);
    }
    let last: string | null = null;
    for (const [name, end] of finish) if (last === null || end > finish.get(last)!) last = name;
    const path: string[] = [];
    for (let name = last; name !== null; name = via.get(name)!) path.push(name);
    path.reverse();
    return { minutes: path.length ? finish.get(path[path.length - 1])! : 0, path };
  }
}

/**
 * Return one cycle in a Map of name -> deps as [a, b, ..., a], or null.
 * Iterative depth-first search, so very deep pipelines can't overflow the
 * stack. A dependency still on the current trail closes a loop.
 */
export function findCycle(deps: Map<string, readonly string[]>): string[] | null {
  const done = new Set<string>();
  const onTrail = new Set<string>();
  for (const root of deps.keys()) {
    if (done.has(root)) continue;
    const trail = [root];
    const next = [0];        // next[i]: position of trail[i]'s next dependency
    onTrail.add(root);
    while (trail.length) {
      const top = trail.length - 1;
      const list = deps.get(trail[top])!;
      if (next[top] === list.length) {
        const finished = trail.pop()!;
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
export function loadPipeline(text: string): DependencyGraph {
  return new DependencyGraph(parsePipeline(text));
}
