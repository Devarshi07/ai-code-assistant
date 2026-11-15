const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { DependencyGraph, loadPipeline } = require('../src/graph');
const { schedule } = require('../src/scheduler');
const { fingerprint, generatePipeline } = require('./generator');

// Test shards fan out from build and fan back in to report.
const SHARDS = `
build:
  duration: 3
docs:
  duration: 5
lint:
  duration: 2
test-api:
  duration: 4
  after: build
test-ui:
  duration: 4
  after: build
test-db:
  duration: 2
  after: build
test-cli:
  duration: 1
  after: build
test-e2e:
  duration: 6
  after: build, lint
report:
  duration: 1
  after: [test-api, test-ui, test-db, test-cli, test-e2e]
publish:
  duration: 2
  after: report, docs
`;

/** One slot per task, right lengths, dependencies first, no runner double-booked. */
function assertValidSchedule(graph, plan, workers) {
  assert.equal(plan.workers, workers);
  assert.equal(plan.slots.length, graph.size, 'every task must be scheduled exactly once');
  assert.deepEqual(new Set(plan.slots.map(s => s.task)), new Set(graph.names));
  const byWorker = new Map();
  for (const s of plan.slots) {
    const task = graph.get(s.task);
    assert.ok(Number.isInteger(s.worker) && s.worker >= 0 && s.worker < workers, `${s.task} is on runner ${s.worker}`);
    assert.equal(s.end - s.start, task.duration, `${s.task} has the wrong length`);
    for (const dep of task.deps) assert.ok(s.start >= plan.slotFor(dep).end, `${s.task} started before ${dep} finished`);
    if (!byWorker.has(s.worker)) byWorker.set(s.worker, []);
    byWorker.get(s.worker).push(s);
  }
  for (const [worker, slots] of byWorker) {
    slots.sort((a, b) => a.start - b.start);
    for (let i = 1; i < slots.length; i++) {
      assert.ok(slots[i - 1].end <= slots[i].start, `runner ${worker} runs ${slots[i - 1].task} and ${slots[i].task} at once`);
    }
  }
}

const slotTuple = s => [s.task, s.worker, s.start, s.end];

describe('scale', () => {
  test('test shards fan out and back in', () => {
    const graph = loadPipeline(SHARDS);
    const plan = schedule(graph, 3);
    assertValidSchedule(graph, plan, 3);
    const got = {};
    for (const s of plan.slots) got[s.task] = [s.worker, s.start, s.end];
    assert.deepEqual(got, {
      build: [0, 0, 3], lint: [1, 0, 2], docs: [2, 0, 5], 'test-e2e': [0, 3, 9], 'test-api': [1, 3, 7],
      'test-ui': [2, 5, 9], 'test-db': [1, 7, 9], 'test-cli': [0, 9, 10], report: [0, 10, 11], publish: [0, 11, 13],
    });
  });

  test('generated pipeline matches reference', () => {
    const tasks = generatePipeline(11, 600, { window: 30 });
    const graph = new DependencyGraph(tasks);
    const plan = schedule(graph, 5);
    assertValidSchedule(graph, plan, 5);
    assert.equal(plan.makespan, 1289);
    assert.deepEqual(slotTuple(plan.slotFor('lint-7')), ['lint-7', 1, 31, 41]);
    assert.equal(fingerprint(tasks, plan), 143128735, 'the schedule differs from the reference');
  });

  test('wide pipeline matches reference', () => {
    const tasks = generatePipeline(23, 2000, { window: 400 });
    const graph = new DependencyGraph(tasks);
    const plan = schedule(graph, 12);
    assertValidSchedule(graph, plan, 12);
    assert.equal(plan.makespan, 1745);
    assert.deepEqual(slotTuple(plan.slotFor('scan-1999')), ['scan-1999', 4, 1654, 1663]);
    assert.equal(fingerprint(tasks, plan), 829942898, 'the schedule differs from the reference');
  });

  test('monorepo pipeline is fast', () => {
    const tasks = generatePipeline(2026, 12000, { window: 48 });
    const graph = new DependencyGraph(tasks);
    const start = performance.now();
    const plan = schedule(graph, 32);
    const elapsed = performance.now() - start;
    assertValidSchedule(graph, plan, 32);
    assert.equal(plan.makespan, 8249);
    assert.deepEqual(slotTuple(plan.slotFor('build-11999')), ['build-11999', 3, 8236, 8243]);
    assert.equal(fingerprint(tasks, plan), 1775225865, 'the schedule differs from the reference');
    assert.ok(elapsed < 300, `took ${elapsed.toFixed(0)}ms; 12,000 tasks on 32 runners must schedule in under 300ms`);
  });
});
