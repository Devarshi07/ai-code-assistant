const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { JobQueue } = require('../src');

describe('Public', () => {
  test('enqueue returns sequential ids', () => {
    const q = new JobQueue();
    assert.equal(q.enqueue('email', { to: 'ana@example.com' }, 0), 'job-1');
    assert.equal(q.enqueue('report', { day: '2026-10-12' }, 0), 'job-2');
  });

  test('new job is queued', () => {
    const q = new JobQueue();
    const jobId = q.enqueue('email', { to: 'ana@example.com' }, 5, { priority: 2 });
    const job = q.get(jobId, 5);
    assert.equal(job.state, 'queued');
    assert.equal(job.type, 'email');
    assert.deepEqual(job.payload, { to: 'ana@example.com' });
    assert.equal(job.priority, 2);
    assert.equal(job.attempts, 0);
  });

  test('higher priority is leased first', () => {
    const q = new JobQueue();
    const low = q.enqueue('report', {}, 0, { priority: 1 });
    const high = q.enqueue('email', {}, 0, { priority: 5 });
    assert.equal(q.lease('w1', 1).id, high);
    assert.equal(q.lease('w1', 1).id, low);
  });

  test('same priority is first in first out', () => {
    const q = new JobQueue();
    const first = q.enqueue('email', { n: 1 }, 0);
    const second = q.enqueue('email', { n: 2 }, 1);
    assert.equal(q.lease('w1', 2).id, first);
    assert.equal(q.lease('w2', 2).id, second);
  });

  test('lease sets holder and expiry', () => {
    const q = new JobQueue({ visibilityTimeout: 30 });
    const jobId = q.enqueue('email', {}, 0);
    const job = q.lease('w1', 10);
    assert.equal(job.id, jobId);
    assert.equal(job.state, 'leased');
    assert.equal(job.workerId, 'w1');
    assert.equal(job.leaseExpiresAt, 40);
    assert.equal(job.attempts, 1);
  });

  test('lease returns null when nothing is queued', () => {
    const q = new JobQueue();
    assert.equal(q.lease('w1', 0), null);
  });

  test('ack marks job succeeded', () => {
    const q = new JobQueue();
    const jobId = q.enqueue('email', {}, 0);
    q.lease('w1', 1);
    q.ack(jobId, 'w1', 2);
    assert.equal(q.get(jobId, 2).state, 'succeeded');
  });
});
