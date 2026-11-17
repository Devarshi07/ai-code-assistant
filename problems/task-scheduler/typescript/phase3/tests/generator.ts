// Deterministic pipeline generator for the scale tests (xorshift32 PRNG).
// The other language versions use the same generator, so all of them produce
// identical tasks.
import { Task } from '../src/task.ts';
import type { Schedule } from '../src/timeline.ts';

const KINDS = ['build', 'test', 'lint', 'pack', 'scan', 'docs', 'bench', 'deploy'];

export function xorshift32(seed: number): { next: () => number; below: (n: number) => number } {
  let state = (seed >>> 0) || 0x9e3779b9;
  const next = (): number => {
    let x = state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state = x >>> 0;
    return state;
  };
  return { next, below: n => next() % n };
}

/** `count` tasks; each depends on up to `maxDeps` of the `window` tasks before it. */
export function generatePipeline(
  seed: number,
  count: number,
  { window = 48, maxDeps = 3, maxDuration = 20 }: { window?: number; maxDeps?: number; maxDuration?: number } = {},
): Task[] {
  const rng = xorshift32(seed);
  const names: string[] = [];
  const tasks: Task[] = [];
  for (let i = 0; i < count; i++) {
    const name = `${KINDS[rng.below(KINDS.length)]}-${i}`;
    const deps: string[] = [];
    if (i) {
      const low = Math.max(0, i - window);
      const k = rng.below(maxDeps + 1);
      for (let j = 0; j < k; j++) {
        const dep = names[low + rng.below(i - low)];
        if (!deps.includes(dep)) deps.push(dep);
      }
    }
    tasks.push(new Task(name, 1 + rng.below(maxDuration), deps));
    names.push(name);
  }
  return tasks;
}

/** Fold every task's (start, runner) into one number, in generation order. */
export function fingerprint(tasks: Task[], plan: Schedule): number {
  let acc = 0;
  for (const task of tasks) {
    const s = plan.slotFor(task.name)!;
    acc = (acc * 1000003 + s.start * 1024 + s.worker) % 2147483647;
  }
  return acc;
}
