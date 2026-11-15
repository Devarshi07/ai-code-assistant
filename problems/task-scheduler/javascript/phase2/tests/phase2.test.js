const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadPipeline } = require('../src/graph');
const { MOBILE_RELEASE, WEB_APP } = require('../src/samples');
const { schedule } = require('../src/scheduler');

// Duration-first would start lint and docs; the setup -> build -> bundle chain
// is longer, so it must start first.
const CHAIN_FIRST = `
setup:
  duration: 1
build:
  duration: 2
  after: setup
bundle:
  duration: 6
  after: build
lint:
  duration: 5
docs:
  duration: 4
`;

// alpha, bravo and charlie all have a remaining path of 4 minutes.
const TIES = `
charlie:
  duration: 4
bravo:
  duration: 4
zulu:
  duration: 2
  after: alpha
alpha:
  duration: 2
`;

// api and web finish at the same minute.
const SIMULTANEOUS = `
notify:
  duration: 1
web:
  duration: 2
api:
  duration: 2
integration:
  duration: 5
  after: api, web
`;

// Runners free up in different orders; the lowest-numbered idle one is used.
const RUNNER_CHOICE = `
build:
  duration: 3
test:
  duration: 7
  after: build
ship:
  duration: 2
  after: test
lint:
  duration: 1
docs:
  duration: 9
report:
  duration: 12
  after: docs, lint
`;

function table(plan) {
  const out = {};
  for (const s of plan.slots) out[s.task] = [s.worker, s.start, s.end];
  return out;
}

/** One slot per task, right lengths, dependencies first, no runner double-booked. */
function assertValidSchedule(graph, plan, workers) {
  assert.equal(plan.workers, workers);
  assert.deepEqual(plan.slots.map(s => s.task).sort(), graph.names.sort(), 'every task must be scheduled exactly once');
  const byWorker = new Map();
  for (const s of plan.slots) {
    const task = graph.get(s.task);
    assert.ok(Number.isInteger(s.worker) && s.worker >= 0 && s.worker < workers, `${s.task} is on runner ${s.worker}`);
    assert.ok(s.start >= 0, `${s.task} starts before minute 0`);
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
  assert.equal(plan.makespan, plan.slots.reduce((m, s) => Math.max(m, s.end), 0));
}

function check(text, workers, expected) {
  const graph = loadPipeline(text);
  const plan = schedule(graph, workers);
  assertValidSchedule(graph, plan, workers);
  assert.deepEqual(table(plan), expected);
  return plan;
}

describe('schedule', () => {
  test('single runner follows priority', () => {
    const plan = check(WEB_APP, 1, {
      install: [0, 0, 2], compile: [0, 2, 6], 'seed-db': [0, 6, 9], 'unit-tests': [0, 9, 14],
      'e2e-tests': [0, 14, 20], lint: [0, 20, 21], package: [0, 21, 23], deploy: [0, 23, 26],
    });
    assert.equal(plan.makespan, 26);
  });

  test('long chains start first', () => {
    const plan = check(CHAIN_FIRST, 2, {
      setup: [0, 0, 1], lint: [1, 0, 5], build: [0, 1, 3], bundle: [0, 3, 9], docs: [1, 5, 9],
    });
    assert.equal(plan.makespan, 9);
  });

  test('ties go to the alphabetically first name', () => {
    check(TIES, 2, { alpha: [0, 0, 2], bravo: [1, 0, 4], charlie: [0, 2, 6], zulu: [1, 4, 6] });
  });

  test('everything finishing together is released first', () => {
    check(SIMULTANEOUS, 2, { api: [0, 0, 2], web: [1, 0, 2], integration: [0, 2, 7], notify: [1, 2, 3] });
  });

  test('lowest-numbered idle runner is used', () => {
    check(RUNNER_CHOICE, 3, {
      docs: [0, 0, 9], lint: [1, 0, 1], build: [2, 0, 3], test: [1, 3, 10], report: [0, 9, 21], ship: [1, 10, 12],
    });
  });

  test('web app on three runners', () => {
    const plan = check(WEB_APP, 3, {
      install: [0, 0, 2], 'seed-db': [1, 0, 3], compile: [0, 2, 6], lint: [2, 2, 3],
      'unit-tests': [0, 6, 11], 'e2e-tests': [1, 6, 12], package: [0, 11, 13], deploy: [0, 13, 16],
    });
    assert.equal(plan.makespan, 16);
  });

  test('mobile release on two runners', () => {
    const plan = check(MOBILE_RELEASE, 2, {
      'fetch-deps': [0, 0, 2], 'build-ios': [0, 2, 10], 'build-android': [1, 2, 8], 'unit-tests': [1, 8, 12],
      'ui-tests': [0, 10, 19], 'sign-ipa': [1, 12, 14], 'sign-apk': [1, 14, 15], publish: [0, 19, 21],
    });
    assert.equal(plan.makespan, 21);
  });

  test('plenty of runners reaches the critical path', () => {
    for (const text of [WEB_APP, MOBILE_RELEASE]) {
      const graph = loadPipeline(text);
      const plan = schedule(graph, 20);
      assertValidSchedule(graph, plan, 20);
      assert.equal(plan.makespan, graph.criticalPath().minutes);
    }
  });

  test('empty pipeline', () => {
    const plan = schedule(loadPipeline('# nothing here yet\n'), 4);
    assert.equal(plan.slots.length, 0);
    assert.equal(plan.makespan, 0);
  });

  test('needs at least one runner', () => {
    assert.throws(() => schedule(loadPipeline(WEB_APP), 0));
  });
});
