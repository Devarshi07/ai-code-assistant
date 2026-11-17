import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CycleError, loadPipeline } from '../src/graph.ts';
import type { DependencyGraph } from '../src/graph.ts';
import { PipelineSyntaxError, parsePipeline } from '../src/parser.ts';
import { MOBILE_RELEASE, WEB_APP } from '../src/samples.ts';
import { serialSchedule } from '../src/scheduler.ts';
import { PipelineError } from '../src/task.ts';
import type { Task } from '../src/task.ts';
import { renderGantt } from '../src/timeline.ts';
import type { Schedule } from '../src/timeline.ts';

const RELEASE = `
build:
  duration: 4
  resource: linux
test:
  duration: 3
  after: build
release:
  duration: 1
  after: [build, test]
`;

const NIGHTLY = `
# nightly docs job
lint:              # fast
  duration: 1      # minutes

docs:
  duration: 2
  after:
    - lint
  resource: docs-runner

archive:
  duration: 1
  after: docs
`;

const DIAMOND = `
checkout:
  duration: 1
build:
  duration: 3
  after: checkout
docs:
  duration: 2
  after: checkout
bundle:
  duration: 1
  after: build, docs
`;

const LOOP = `
a:
  duration: 1
  after: c
b:
  duration: 1
  after: a
c:
  duration: 1
  after: b
`;

const summary = (tasks: Task[]) => tasks.map(t => [t.name, t.duration, [...t.deps], t.resource]);

function assertRespectsDependencies(graph: DependencyGraph, plan: Schedule): void {
  for (const task of graph) {
    const slot = plan.slotFor(task.name)!;
    assert.equal(slot.end - slot.start, task.duration, `${task.name} has the wrong length`);
    for (const dep of task.deps) {
      assert.ok(slot.start >= plan.slotFor(dep)!.end, `${task.name} started at ${slot.start}, before ${dep} finished`);
    }
  }
}

describe('parser', () => {
  test('settings and inline lists', () => {
    assert.deepEqual(summary(parsePipeline(RELEASE)), [
      ['build', 4, [], 'linux'],
      ['test', 3, ['build'], null],
      ['release', 1, ['build', 'test'], null],
    ]);
  });

  test('comments, blank lines and block lists', () => {
    assert.deepEqual(summary(parsePipeline(NIGHTLY)), [
      ['lint', 1, [], null],
      ['docs', 2, ['lint'], 'docs-runner'],
      ['archive', 1, ['docs'], null],
    ]);
  });

  test('web app is read as written', () => {
    const tasks = new Map(parsePipeline(WEB_APP).map(t => [t.name, t]));
    assert.equal(tasks.size, 8);
    assert.deepEqual(summary([tasks.get('e2e-tests')!]), [['e2e-tests', 6, ['compile', 'seed-db'], 'chrome']]);
    assert.deepEqual([...tasks.get('deploy')!.deps], ['package', 'e2e-tests']);
  });

  test('mobile release is read as written', () => {
    assert.deepEqual(summary(parsePipeline(MOBILE_RELEASE)), [
      ['fetch-deps', 2, [], null],
      ['build-android', 6, ['fetch-deps'], 'linux'],
      ['build-ios', 8, ['fetch-deps'], 'macos'],
      ['unit-tests', 4, ['fetch-deps'], null],
      ['ui-tests', 9, ['build-android', 'build-ios'], 'macos'],
      ['sign-apk', 1, ['build-android'], null],
      ['sign-ipa', 2, ['build-ios'], 'macos'],
      ['publish', 2, ['sign-apk', 'sign-ipa', 'ui-tests', 'unit-tests'], null],
    ]);
  });

  test('syntax errors report the line', () => {
    const cases: [string, number][] = [
      ['build:\n  duraton: 4\n', 2],
      ['  duration: 4\n', 1],
      ['build:\n  duration: 4\n  - lint\n', 3],
      ['lint:\n  duration: 1\nbuild:\n  duration: four\n', 3],
    ];
    for (const [text, line] of cases) {
      assert.throws(() => parsePipeline(text), error => error instanceof PipelineSyntaxError && error.lineno === line,
        `expected a syntax error on line ${line} for ${JSON.stringify(text)}`);
    }
  });
});

describe('graph', () => {
  test('unknown dependency is rejected', () => {
    assert.throws(() => loadPipeline('build:\n  duration: 1\n  after: compile\n'),
      error => error instanceof PipelineError && error.message.includes('compile'));
  });

  test('cycle error shows the loop', () => {
    let caught: unknown = null;
    try { loadPipeline(LOOP); } catch (error) { caught = error; }
    assert.ok(caught instanceof CycleError, 'expected a CycleError');
    const cycle = caught.cycle;
    assert.equal(cycle[0], cycle[cycle.length - 1], 'a cycle ends where it starts');
    assert.deepEqual(cycle.slice(0, -1).sort(), ['a', 'b', 'c']);
    assert.ok(caught.message.includes(cycle.join(' -> ')));
  });

  test('diamond is not a cycle', () => {
    const order = loadPipeline(DIAMOND).topologicalOrder();
    assert.equal(order[0], 'checkout');
    assert.equal(order[order.length - 1], 'bundle');
  });

  test('dependencies may be defined later', () => {
    const graph = loadPipeline('ship:\n  duration: 1\n  after: build\nbuild:\n  duration: 2\n');
    assert.deepEqual(graph.topologicalOrder(), ['build', 'ship']);
  });

  test('web app topological order', () => {
    assert.deepEqual(loadPipeline(WEB_APP).topologicalOrder(), [
      'install', 'seed-db', 'compile', 'lint', 'unit-tests', 'e2e-tests', 'package', 'deploy']);
  });
});

describe('plans', () => {
  test('web app serial plan respects dependencies', () => {
    const graph = loadPipeline(WEB_APP);
    const plan = serialSchedule(graph);
    assertRespectsDependencies(graph, plan);
    assert.equal(plan.makespan, 26);
  });

  test('mobile release serial plan respects dependencies', () => {
    const graph = loadPipeline(MOBILE_RELEASE);
    const plan = serialSchedule(graph);
    assertRespectsDependencies(graph, plan);
    const publish = plan.slotFor('publish')!;
    for (const dep of ['sign-apk', 'sign-ipa', 'ui-tests', 'unit-tests']) {
      assert.ok(publish.start >= plan.slotFor(dep)!.end, `publish started at ${publish.start}, before ${dep} finished`);
    }
    assert.equal(publish.end, 34, 'publish must be the last step');
  });

  test('web app critical path', () => {
    assert.deepEqual(loadPipeline(WEB_APP).criticalPath(),
      { minutes: 16, path: ['install', 'compile', 'unit-tests', 'package', 'deploy'] });
  });

  test('mobile release critical path', () => {
    assert.deepEqual(loadPipeline(MOBILE_RELEASE).criticalPath(),
      { minutes: 21, path: ['fetch-deps', 'build-ios', 'ui-tests', 'publish'] });
  });

  test('gantt chart rows', () => {
    const graph = loadPipeline(RELEASE);
    const chart = renderGantt(serialSchedule(graph), { graph }).split('\n');
    assert.equal(chart.length, 5, 'axis, one row per task, summary');
    assert.equal(chart[1], 'build    r0   |====    | 0-4  [linux]');
    assert.equal(chart[3], 'release  r0   |       =| 7-8');
    assert.ok(chart[chart.length - 1].includes('makespan 8 min'));
  });
});
