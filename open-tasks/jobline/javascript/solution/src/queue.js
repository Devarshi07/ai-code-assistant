// JobQueue: an in-process job queue with leases, retries and a dead-letter list.
//
// Time is never read from a real clock. Every method that takes `now` first
// calls #advance(now), which applies every time-based transition due at or
// before `now` (expired leases, finished backoffs), and only then does its work.
const { InvalidStateError, JobNotFoundError, LeaseError, ValidationError } = require('./errors');
const { JobState, STATES, LEASE_EXPIRED } = require('./job');

const { QUEUED, LEASED, SUCCEEDED, RETRY_WAIT, DEAD } = JobState;

function requireText(value, name) {
  if (typeof value !== 'string' || value === '') throw new ValidationError(`${name} must be a non-empty string`);
}

function snapshot(record) {
  return {
    id: record.id,
    type: record.type,
    payload: record.payload,
    priority: record.priority,
    state: record.state,
    attempts: record.attempts,
    availableAt: record.availableAt,
    workerId: record.workerId,
    leaseExpiresAt: record.leaseExpiresAt,
    lastError: record.lastError,
    idempotencyKey: record.idempotencyKey,
  };
}

class JobQueue {
  #jobs = new Map();   // id -> mutable record; Map order is creation order, i.e. place in line
  #nextNumber = 1;
  #keys = new Map();   // idempotency key -> id of the active job holding it
  #limits = new Map(); // job type -> max leased at once

  constructor({ visibilityTimeout = 30, maxAttempts = 3, backoffBase = 10, backoffMax = 300 } = {}) {
    this.visibilityTimeout = visibilityTimeout;
    this.maxAttempts = maxAttempts;
    this.backoffBase = backoffBase;
    this.backoffMax = backoffMax;
  }

  // ---------------------------------------------------------------- Part 1 · Core

  enqueue(type, payload, now, { priority = 0, idempotencyKey = null, runAt = null } = {}) {
    requireText(type, 'type');
    if (!Number.isInteger(priority)) throw new ValidationError('priority must be an integer');
    this.#advance(now);
    if (idempotencyKey !== null && this.#keys.has(idempotencyKey)) return this.#keys.get(idempotencyKey);
    const id = `job-${this.#nextNumber++}`;
    this.#jobs.set(id, {
      id, type, payload, priority,
      state: QUEUED,
      attempts: 0,
      availableAt: runAt === null ? now : runAt,
      workerId: null,
      leaseExpiresAt: null,
      lastError: null,
      idempotencyKey,
    });
    if (idempotencyKey !== null) this.#keys.set(idempotencyKey, id);
    return id;
  }

  lease(workerId, now) {
    requireText(workerId, 'workerId');
    this.#advance(now);
    const leased = new Map();
    for (const r of this.#jobs.values()) if (r.state === LEASED) leased.set(r.type, (leased.get(r.type) || 0) + 1);
    let best = null;
    for (const r of this.#jobs.values()) { // creation order, so ">" keeps the oldest on ties
      if (r.state !== QUEUED || r.availableAt > now) continue;
      const limit = this.#limits.get(r.type);
      if (limit !== undefined && (leased.get(r.type) || 0) >= limit) continue;
      if (best === null || r.priority > best.priority) best = r;
    }
    if (best === null) return null;
    best.state = LEASED;
    best.workerId = workerId;
    best.attempts += 1;
    best.leaseExpiresAt = now + this.visibilityTimeout;
    return snapshot(best);
  }

  ack(jobId, workerId, now) {
    const record = this.#held(jobId, workerId, now);
    this.#endLease(record);
    this.#finish(record, SUCCEEDED);
  }

  fail(jobId, workerId, error, now) {
    const record = this.#held(jobId, workerId, now);
    this.#endLease(record);
    record.lastError = error;
    if (record.attempts >= this.maxAttempts) {
      this.#finish(record, DEAD);
      return;
    }
    const delay = Math.min(this.backoffBase * 2 ** (record.attempts - 1), this.backoffMax);
    record.state = RETRY_WAIT;
    record.availableAt = now + delay;
  }

  get(jobId, now) {
    const record = this.#record(jobId);
    this.#advance(now);
    return snapshot(record);
  }

  // ---------------------------------------------------------------- Part 2

  stats(now) {
    this.#advance(now);
    const counts = {};
    for (const state of STATES) counts[state] = 0;
    for (const r of this.#jobs.values()) counts[r.state] += 1;
    return counts;
  }

  deadLetters(now) {
    this.#advance(now);
    return [...this.#jobs.values()].filter(r => r.state === DEAD).map(snapshot);
  }

  // ---------------------------------------------------------------- Part 3 · Stretch

  setTypeLimit(type, limit) {
    requireText(type, 'type');
    if (limit === null) {
      this.#limits.delete(type);
      return;
    }
    if (!Number.isInteger(limit) || limit < 1) throw new ValidationError('limit must be an integer >= 1, or null');
    this.#limits.set(type, limit);
  }

  requeueDead(jobId, now) {
    const record = this.#record(jobId);
    this.#advance(now);
    if (record.state !== DEAD) throw new InvalidStateError(`${jobId} is ${record.state}, not dead`);
    const key = record.idempotencyKey;
    if (key !== null && this.#keys.has(key)) throw new InvalidStateError(`${this.#keys.get(key)} already holds idempotency key ${key}`);
    record.state = QUEUED;
    record.attempts = 0;
    record.availableAt = now;
    if (key !== null) this.#keys.set(key, record.id);
  }

  // ---------------------------------------------------------------- helpers

  #record(jobId) {
    const record = this.#jobs.get(jobId);
    if (!record) throw new JobNotFoundError(`no job ${jobId}`);
    return record;
  }

  /** Return the record if `workerId` holds a live lease on it, else throw. */
  #held(jobId, workerId, now) {
    const record = this.#record(jobId);
    this.#advance(now);
    if (record.state === SUCCEEDED || record.state === DEAD) throw new InvalidStateError(`${jobId} is already ${record.state}`);
    if (record.state !== LEASED || record.workerId !== workerId) throw new LeaseError(`${workerId} does not hold a lease on ${jobId}`);
    return record;
  }

  #advance(now) {
    for (const r of this.#jobs.values()) {
      if (r.state === LEASED && r.leaseExpiresAt <= now) {
        const expiredAt = r.leaseExpiresAt;
        this.#endLease(r);
        r.lastError = LEASE_EXPIRED;
        if (r.attempts >= this.maxAttempts) {
          this.#finish(r, DEAD);
        } else {
          r.state = QUEUED;
          r.availableAt = expiredAt;
        }
      } else if (r.state === RETRY_WAIT && r.availableAt <= now) {
        r.state = QUEUED;
      }
    }
  }

  #endLease(record) {
    record.workerId = null;
    record.leaseExpiresAt = null;
  }

  /** Move a job to a final state (succeeded or dead) and release its key. */
  #finish(record, state) {
    record.state = state;
    const key = record.idempotencyKey;
    if (key !== null && this.#keys.get(key) === record.id) this.#keys.delete(key);
  }
}

module.exports = { JobQueue };
