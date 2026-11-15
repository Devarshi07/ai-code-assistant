const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  JobQueue,
  JobLineError,
  ValidationError,
  JobNotFoundError,
  LeaseError,
  InvalidStateError,
} = require('../src');

const ZERO = { queued: 0, leased: 0, succeeded: 0, retry_wait: 0, dead: 0 };

/** Lease everything that can be leased at `now`; return the ids in lease order. */
function drain(q, worker, now) {
  const ids = [];
  for (let job = q.lease(worker, now); job !== null; job = q.lease(worker, now)) ids.push(job.id);
  return ids;
}

/** Copy the named fields into a plain object, for deepEqual. */
function pick(job, keys) {
  return Object.fromEntries(keys.map(k => [k, job[k]]));
}

describe('Core', () => {
  test('new job snapshot has documented defaults', () => {
    const q = new JobQueue();
    const payload = { to: 'ana@example.com' };
    const jobId = q.enqueue('email', payload, 7);
    const job = q.get(jobId, 7);
    assert.equal(jobId, 'job-1');
    assert.deepEqual(
      pick(job, ['id', 'type', 'priority', 'state', 'attempts', 'availableAt']),
      { id: 'job-1', type: 'email', priority: 0, state: 'queued', attempts: 0, availableAt: 7 },
    );
    assert.equal(job.payload, payload);
    assert.equal(job.workerId, null);
    assert.equal(job.leaseExpiresAt, null);
    assert.equal(job.lastError, null);
    assert.equal(job.idempotencyKey, null);
  });

  test('priority then creation order including negative priorities', () => {
    const q = new JobQueue();
    const a = q.enqueue('email', {}, 0);
    const b = q.enqueue('report', {}, 1, { priority: 5 });
    const c = q.enqueue('email', {}, 2, { priority: -1 });
    const d = q.enqueue('email', {}, 3, { priority: 5 });
    const e = q.enqueue('report', {}, 4);
    assert.deepEqual(drain(q, 'w1', 5), [b, d, a, e, c]);
  });

  test('one worker can hold several leases and held jobs are skipped', () => {
    const q = new JobQueue({ visibilityTimeout: 60 });
    const ids = [0, 1, 2].map(n => q.enqueue('email', { n }, 0));
    assert.deepEqual([0, 1, 2].map(() => q.lease('w1', 1).id), ids);
    assert.equal(q.lease('w2', 2), null);
    for (const jobId of ids) q.ack(jobId, 'w1', 3);
    assert.deepEqual(ids.map(jobId => q.get(jobId, 3).state), ['succeeded', 'succeeded', 'succeeded']);
  });

  test('lease uses visibility timeout default and custom', () => {
    const defaults = new JobQueue();
    defaults.enqueue('email', {}, 0);
    assert.equal(defaults.lease('w1', 10).leaseExpiresAt, 40);

    const q = new JobQueue({ visibilityTimeout: 45 });
    const jobId = q.enqueue('report', { day: 1 }, 0);
    const job = q.lease('worker-a', 100);
    assert.deepEqual(pick(job, ['state', 'workerId', 'leaseExpiresAt', 'attempts']),
      { state: 'leased', workerId: 'worker-a', leaseExpiresAt: 145, attempts: 1 });
    const held = q.get(jobId, 101);
    assert.deepEqual(pick(held, ['state', 'workerId', 'leaseExpiresAt']),
      { state: 'leased', workerId: 'worker-a', leaseExpiresAt: 145 });
  });

  test('expired lease is available again exactly at expiry', () => {
    const q = new JobQueue({ visibilityTimeout: 30 });
    const jobId = q.enqueue('email', {}, 0);
    q.lease('w1', 0);
    assert.equal(q.lease('w2', 29), null);
    const job = q.lease('w2', 30);
    assert.notEqual(job, null);
    assert.deepEqual(pick(job, ['id', 'workerId', 'attempts', 'leaseExpiresAt']),
      { id: jobId, workerId: 'w2', attempts: 2, leaseExpiresAt: 60 });
  });

  test('expired lease clears holder and records reason', () => {
    const q = new JobQueue({ visibilityTimeout: 30 });
    const jobId = q.enqueue('email', {}, 0);
    q.lease('w1', 0);
    const job = q.get(jobId, 35);
    assert.equal(job.state, 'queued');
    assert.equal(job.availableAt, 30);
    assert.equal(job.attempts, 1);
    assert.equal(job.lastError, 'lease expired');
    assert.equal(job.workerId, null);
    assert.equal(job.leaseExpiresAt, null);
  });

  test('lease is valid until just before expiry', () => {
    const q = new JobQueue({ visibilityTimeout: 30 });
    const jobId = q.enqueue('email', {}, 0);
    q.lease('w1', 0);
    q.ack(jobId, 'w1', 29);
    assert.equal(q.get(jobId, 29).state, 'succeeded');

    const late = new JobQueue({ visibilityTimeout: 30 });
    const lateId = late.enqueue('email', {}, 0);
    late.lease('w1', 0);
    assert.throws(() => late.ack(lateId, 'w1', 30), LeaseError);
    assert.equal(late.lease('w2', 30).id, lateId);
  });

  test('only the current holder can ack or fail', () => {
    const q = new JobQueue({ visibilityTimeout: 10 });
    const jobId = q.enqueue('email', {}, 0);
    q.lease('w1', 0);
    assert.throws(() => q.ack(jobId, 'w2', 1), LeaseError);
    assert.throws(() => q.fail(jobId, 'w2', 'boom', 1), LeaseError);
    assert.equal(q.get(jobId, 1).workerId, 'w1');

    assert.equal(q.lease('w2', 12).id, jobId);
    assert.throws(() => q.ack(jobId, 'w1', 13), LeaseError);
    q.ack(jobId, 'w2', 13);
    assert.equal(q.get(jobId, 13).state, 'succeeded');
  });

  test('ack or fail on a job nobody holds throws LeaseError', () => {
    const q = new JobQueue({ backoffBase: 10 });
    const jobId = q.enqueue('email', {}, 0);
    assert.throws(() => q.ack(jobId, 'w1', 0), LeaseError);
    assert.throws(() => q.fail(jobId, 'w1', 'boom', 0), LeaseError);
    q.lease('w1', 1);
    q.fail(jobId, 'w1', 'boom', 1);
    assert.throws(() => q.fail(jobId, 'w1', 'again', 2), LeaseError);
    assert.throws(() => q.ack(jobId, 'w1', 2), LeaseError);
  });

  test('unknown job id throws JobNotFoundError', () => {
    const q = new JobQueue();
    q.enqueue('email', {}, 0);
    q.lease('w1', 0);
    assert.throws(() => q.get('job-99', 1), JobNotFoundError);
    assert.throws(() => q.ack('job-99', 'w1', 1), JobNotFoundError);
    assert.throws(() => q.fail('job-99', 'w1', 'boom', 1), JobNotFoundError);
  });

  test('double ack throws InvalidStateError', () => {
    const q = new JobQueue();
    const jobId = q.enqueue('email', {}, 0);
    q.lease('w1', 0);
    q.ack(jobId, 'w1', 1);
    assert.throws(() => q.ack(jobId, 'w1', 2), InvalidStateError);
    assert.throws(() => q.fail(jobId, 'w1', 'late', 2), InvalidStateError);
    assert.throws(() => q.ack(jobId, 'someone-else', 2), InvalidStateError);
    assert.equal(q.get(jobId, 2).state, 'succeeded');
  });

  test('fail records error and ends the lease', () => {
    const q = new JobQueue({ backoffBase: 10 });
    const jobId = q.enqueue('email', {}, 0);
    q.lease('w1', 0);
    q.fail(jobId, 'w1', 'SMTP timeout', 3);
    const job = q.get(jobId, 3);
    assert.equal(job.lastError, 'SMTP timeout');
    assert.equal(job.state, 'retry_wait');
    assert.equal(job.workerId, null);
    assert.equal(job.leaseExpiresAt, null);
  });

  test('invalid arguments throw ValidationError', () => {
    const q = new JobQueue();
    for (const badType of ['', null, 42]) assert.throws(() => q.enqueue(badType, {}, 0), ValidationError);
    for (const badPriority of [1.5, 'high']) assert.throws(() => q.enqueue('email', {}, 0, { priority: badPriority }), ValidationError);
    for (const badWorker of ['', null]) assert.throws(() => q.lease(badWorker, 0), ValidationError);
    assert.throws(() => q.enqueue('', {}, 0), JobLineError);
    assert.equal(q.enqueue('email', {}, 0), 'job-1');
  });
});

describe('Retries', () => {
  test('first failure waits backoffBase', () => {
    const q = new JobQueue({ backoffBase: 10, backoffMax: 300 });
    const jobId = q.enqueue('email', {}, 100);
    q.lease('w1', 100);
    q.fail(jobId, 'w1', 'boom', 100);
    const job = q.get(jobId, 100);
    assert.deepEqual(pick(job, ['state', 'availableAt']), { state: 'retry_wait', availableAt: 110 });
    assert.equal(q.lease('w1', 109), null);
    assert.equal(q.get(jobId, 110).state, 'queued');
    const again = q.lease('w2', 110);
    assert.deepEqual(pick(again, ['id', 'attempts']), { id: jobId, attempts: 2 });
  });

  test('backoff doubles and is capped', () => {
    const q = new JobQueue({ maxAttempts: 5, backoffBase: 10, backoffMax: 50 });
    const jobId = q.enqueue('email', {}, 0);
    let now = 0;
    for (const ready of [10, 30, 70, 120]) { // delays 10, 20, 40, then 80 capped to 50
      q.lease('w1', now);
      q.fail(jobId, 'w1', 'boom', now);
      assert.equal(q.get(jobId, now).availableAt, ready);
      assert.equal(q.lease('w1', ready - 1), null);
      now = ready;
    }
    assert.equal(q.lease('w1', 120).attempts, 5);
    q.fail(jobId, 'w1', 'boom', 120);
    assert.equal(q.get(jobId, 120).state, 'dead');
  });

  test('job is dead after maxAttempts failures', () => {
    const q = new JobQueue({ maxAttempts: 3, backoffBase: 1, backoffMax: 1 });
    const jobId = q.enqueue('report', {}, 0);
    [0, 1, 2].forEach((t, i) => {
      const job = q.lease('w1', t);
      assert.deepEqual(pick(job, ['id', 'attempts']), { id: jobId, attempts: i + 1 });
      q.fail(jobId, 'w1', `error ${i + 1}`, t);
    });
    const job = q.get(jobId, 2);
    assert.deepEqual(pick(job, ['state', 'attempts', 'lastError']), { state: 'dead', attempts: 3, lastError: 'error 3' });
    assert.equal(q.lease('w1', 100), null);
    assert.deepEqual(q.deadLetters(100).map(j => j.id), [jobId]);
  });

  test('lease expiring on last attempt makes job dead', () => {
    const q = new JobQueue({ visibilityTimeout: 30, maxAttempts: 2 });
    const jobId = q.enqueue('email', {}, 0);
    q.lease('w1', 0);
    assert.equal(q.lease('w2', 30).attempts, 2);
    const job = q.get(jobId, 60);
    assert.deepEqual(pick(job, ['state', 'lastError', 'attempts']), { state: 'dead', lastError: 'lease expired', attempts: 2 });
    assert.throws(() => q.ack(jobId, 'w2', 61), InvalidStateError);
    assert.deepEqual(q.deadLetters(61).map(j => j.id), [jobId]);
    assert.equal(q.lease('w3', 61), null);
  });

  test('retried job keeps its place in line', () => {
    const q = new JobQueue({ backoffBase: 5 });
    const first = q.enqueue('email', {}, 0);
    q.lease('w1', 0);
    q.fail(first, 'w1', 'boom', 0);
    const second = q.enqueue('email', {}, 1);
    assert.deepEqual(drain(q, 'w2', 5), [first, second]);
  });

  test('dead letters are listed in creation order', () => {
    const q = new JobQueue({ visibilityTimeout: 30, maxAttempts: 1 });
    const a = q.enqueue('email', {}, 0);
    const b = q.enqueue('report', {}, 0);
    const c = q.enqueue('email', {}, 0);
    assert.deepEqual(drain(q, 'w1', 0), [a, b, c]);
    q.fail(c, 'w1', 'c broke', 1);
    q.ack(b, 'w1', 2);
    const dead = q.deadLetters(40);
    assert.deepEqual(dead.map(j => j.id), [a, c]);
    assert.deepEqual(dead.map(j => j.lastError), ['lease expired', 'c broke']);
    assert.deepEqual(dead.map(j => j.state), ['dead', 'dead']);
  });
});

describe('Idempotency', () => {
  test('same key returns existing id while job is active', () => {
    const q = new JobQueue({ backoffBase: 10 });
    const key = 'welcome:42';
    const first = q.enqueue('email', { n: 1 }, 0, { idempotencyKey: key });
    assert.equal(q.enqueue('email', { n: 2 }, 1, { priority: 9, idempotencyKey: key }), first);
    q.lease('w1', 2);
    assert.equal(q.enqueue('email', { n: 3 }, 3, { idempotencyKey: key }), first);
    q.fail(first, 'w1', 'boom', 4);
    assert.equal(q.enqueue('email', { n: 4 }, 5, { idempotencyKey: key }), first);
    const job = q.get(first, 5);
    assert.deepEqual(pick(job, ['payload', 'priority', 'state', 'idempotencyKey']),
      { payload: { n: 1 }, priority: 0, state: 'retry_wait', idempotencyKey: key });
    assert.equal(q.enqueue('email', {}, 5), 'job-2');
  });

  test('key is free again after success or death', () => {
    const q = new JobQueue({ maxAttempts: 1 });
    const key = 'report:2026-10-12';
    const first = q.enqueue('report', {}, 0, { idempotencyKey: key });
    q.lease('w1', 0);
    q.ack(first, 'w1', 1);
    const second = q.enqueue('report', {}, 2, { idempotencyKey: key });
    assert.deepEqual([first, second], ['job-1', 'job-2']);
    assert.equal(q.get(second, 2).idempotencyKey, key);
    q.lease('w1', 2);
    q.fail(second, 'w1', 'boom', 3);
    const third = q.enqueue('report', {}, 4, { idempotencyKey: key });
    assert.equal(third, 'job-3');
    assert.equal(q.enqueue('report', {}, 5, { idempotencyKey: key }), third);
  });

  test('keys are global and null never deduplicates', () => {
    const q = new JobQueue();
    const a = q.enqueue('email', {}, 0, { idempotencyKey: 'k1' });
    assert.equal(q.enqueue('report', {}, 0, { idempotencyKey: 'k1' }), a);
    assert.equal(q.enqueue('email', {}, 0, { idempotencyKey: 'k2' }), 'job-2');
    assert.equal(q.enqueue('email', {}, 0), 'job-3');
    assert.equal(q.enqueue('email', {}, 0, { idempotencyKey: null }), 'job-4');
  });

  test('key is released when an expired lease kills the job', () => {
    const q = new JobQueue({ visibilityTimeout: 30, maxAttempts: 1 });
    const first = q.enqueue('email', {}, 0, { idempotencyKey: 'welcome:7' });
    q.lease('w1', 0);
    assert.equal(q.enqueue('email', {}, 29, { idempotencyKey: 'welcome:7' }), first);
    assert.equal(q.enqueue('email', {}, 30, { idempotencyKey: 'welcome:7' }), 'job-2');
    assert.equal(q.get(first, 30).state, 'dead');
  });
});

describe('Stats', () => {
  test('stats counts every state and applies due transitions', () => {
    const q = new JobQueue({ visibilityTimeout: 30, maxAttempts: 2, backoffBase: 10 });
    assert.deepEqual(q.stats(0), ZERO);
    const [j1, j2, j3, j4] = [0, 1, 2, 3, 4].map(n => q.enqueue('email', { n }, 0));
    assert.equal(q.lease('w1', 0).id, j1);
    q.ack(j1, 'w1', 0);
    assert.equal(q.lease('w1', 0).id, j2);
    q.fail(j2, 'w1', 'boom', 0);
    assert.equal(q.lease('w1', 0).id, j3);
    assert.equal(q.lease('w1', 10).id, j2);
    q.fail(j2, 'w1', 'boom', 10);
    assert.equal(q.lease('w1', 10).id, j4);
    q.fail(j4, 'w1', 'boom', 10);
    assert.deepEqual(q.stats(10), { queued: 1, leased: 1, succeeded: 1, retry_wait: 1, dead: 1 });
    assert.deepEqual(q.stats(20), { queued: 2, leased: 1, succeeded: 1, retry_wait: 0, dead: 1 });
    assert.deepEqual(q.stats(30), { queued: 3, leased: 0, succeeded: 1, retry_wait: 0, dead: 1 });
  });
});

describe('Delayed jobs', () => {
  test('delayed job waits for runAt', () => {
    const q = new JobQueue();
    const jobId = q.enqueue('report', {}, 0, { runAt: 100 });
    const job = q.get(jobId, 0);
    assert.deepEqual(pick(job, ['state', 'availableAt']), { state: 'queued', availableAt: 100 });
    assert.equal(q.stats(0).queued, 1);
    assert.equal(q.lease('w1', 99), null);
    assert.equal(q.lease('w1', 100).id, jobId);
  });

  test('delayed high priority job does not block others', () => {
    const q = new JobQueue({ visibilityTimeout: 1000 });
    const later = q.enqueue('report', {}, 0, { priority: 10, runAt: 50 });
    const first = q.enqueue('email', {}, 0);
    const second = q.enqueue('email', {}, 0);
    assert.equal(q.lease('w1', 10).id, first);
    assert.deepEqual(drain(q, 'w1', 50), [later, second]);
  });

  test('past runAt is available and order stays by creation', () => {
    const q = new JobQueue({ visibilityTimeout: 1000 });
    const past = q.enqueue('email', {}, 100, { runAt: 40 });
    assert.equal(q.lease('w1', 100).id, past);
    const x = q.enqueue('email', {}, 100, { runAt: 120 });
    const y = q.enqueue('email', {}, 100, { runAt: 110 });
    assert.deepEqual(drain(q, 'w1', 115), [y]);
    const z = q.enqueue('email', {}, 115, { runAt: 130 });
    const w = q.enqueue('email', {}, 115, { runAt: 125 });
    assert.deepEqual(drain(q, 'w1', 130), [x, z, w]);
  });
});

describe('Type limits', () => {
  test('full type is skipped for other types', () => {
    const q = new JobQueue();
    q.setTypeLimit('report', 2);
    const [r1, r2, r3] = [0, 1, 2].map(n => q.enqueue('report', { n }, 0, { priority: 5 }));
    const e1 = q.enqueue('email', {}, 0);
    assert.equal(q.lease('w1', 0).id, r1);
    assert.equal(q.lease('w2', 0).id, r2);
    assert.equal(q.lease('w3', 0).id, e1);
    assert.equal(q.lease('w4', 0), null);
    q.ack(r1, 'w1', 1);
    assert.equal(q.lease('w4', 1).id, r3);
  });

  test('expiry and fail free slots and null removes the limit', () => {
    const q = new JobQueue({ visibilityTimeout: 30, backoffBase: 10 });
    q.setTypeLimit('report', 1);
    const a = q.enqueue('report', {}, 0);
    const b = q.enqueue('report', {}, 0);
    assert.equal(q.lease('w1', 0).id, a);
    assert.equal(q.lease('w2', 29), null);
    assert.equal(q.lease('w2', 30).id, a);
    q.fail(a, 'w2', 'boom', 31);
    assert.equal(q.lease('w3', 31).id, b);
    q.setTypeLimit('report', null);
    const c = q.enqueue('report', {}, 31);
    assert.equal(q.lease('w4', 31).id, c);
  });

  test('lowering a limit keeps existing leases and bad limits are rejected', () => {
    const q = new JobQueue();
    const ids = [0, 1, 2].map(n => q.enqueue('email', { n }, 0));
    q.lease('w1', 0);
    q.lease('w2', 0);
    q.setTypeLimit('email', 1);
    assert.equal(q.lease('w3', 1), null);
    assert.deepEqual(ids.slice(0, 2).map(i => q.get(i, 1).state), ['leased', 'leased']);
    q.ack(ids[0], 'w1', 2);
    assert.equal(q.lease('w3', 2), null);
    q.ack(ids[1], 'w2', 3);
    assert.equal(q.lease('w3', 3).id, ids[2]);
    for (const bad of [0, -1, 1.5, '2']) assert.throws(() => q.setTypeLimit('email', bad), ValidationError);
  });
});

describe('Requeue', () => {
  test('requeued job gets fresh attempts and keeps its place', () => {
    const q = new JobQueue({ maxAttempts: 2, backoffBase: 10 });
    const jobId = q.enqueue('email', {}, 0);
    const other = q.enqueue('email', {}, 0);
    q.lease('w1', 0);
    q.fail(jobId, 'w1', 'e1', 0);
    assert.equal(q.lease('w1', 10).id, jobId);
    q.fail(jobId, 'w1', 'e2', 10);
    assert.equal(q.get(jobId, 10).state, 'dead');

    q.requeueDead(jobId, 20);
    let job = q.get(jobId, 20);
    assert.deepEqual(pick(job, ['state', 'attempts', 'lastError', 'availableAt']),
      { state: 'queued', attempts: 0, lastError: 'e2', availableAt: 20 });
    assert.deepEqual(q.deadLetters(20), []);
    assert.equal(q.lease('w1', 20).id, jobId);
    q.fail(jobId, 'w1', 'e3', 20);
    job = q.get(jobId, 20);
    assert.deepEqual(pick(job, ['state', 'availableAt']), { state: 'retry_wait', availableAt: 30 });
    assert.equal(q.lease('w1', 21).id, other);
  });

  test('requeue rejects unknown and non-dead jobs', () => {
    const q = new JobQueue({ maxAttempts: 1 });
    const jobId = q.enqueue('email', {}, 0);
    assert.throws(() => q.requeueDead('job-99', 0), JobNotFoundError);
    assert.throws(() => q.requeueDead(jobId, 0), InvalidStateError);
    q.lease('w1', 0);
    assert.throws(() => q.requeueDead(jobId, 1), InvalidStateError);
    q.ack(jobId, 'w1', 1);
    assert.throws(() => q.requeueDead(jobId, 2), InvalidStateError);
    assert.equal(q.get(jobId, 2).state, 'succeeded');
  });

  test('requeue respects idempotency keys', () => {
    const q = new JobQueue({ maxAttempts: 1 });
    const key = 'welcome:7';
    const dead = q.enqueue('email', {}, 0, { idempotencyKey: key });
    q.lease('w1', 0);
    q.fail(dead, 'w1', 'boom', 0);
    const replacement = q.enqueue('email', {}, 1, { idempotencyKey: key });
    assert.equal(replacement, 'job-2');
    assert.throws(() => q.requeueDead(dead, 2), InvalidStateError);
    assert.equal(q.get(dead, 2).state, 'dead');
    assert.deepEqual(q.deadLetters(2).map(j => j.id), [dead]);
    assert.equal(q.lease('w1', 2).id, replacement);
    q.ack(replacement, 'w1', 3);
    q.requeueDead(dead, 4);
    assert.equal(q.get(dead, 4).state, 'queued');
    assert.equal(q.enqueue('email', {}, 5, { idempotencyKey: key }), dead);
  });
});
