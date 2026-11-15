// JobQueue: the service you are building. See README.md for the full brief.
//
// Time is never read from a real clock. Every method that takes `now` (a number
// of seconds; callers never pass a smaller `now` than before) must first apply
// every time-based transition due at or before `now`, and only then do its work:
//   - a `leased` job whose leaseExpiresAt <= now has expired;
//   - a `retry_wait` job whose availableAt <= now becomes `queued`.

/** An in-memory job queue with leases, retries and a dead-letter list. */
class JobQueue {
  /**
   * Create an empty queue. All options are seconds except maxAttempts.
   * You may assume the options are valid.
   *
   * @param {object} [options]
   * @param {number} [options.visibilityTimeout=30] seconds a lease lasts
   * @param {number} [options.maxAttempts=3] how many leases a job gets before it is dead
   * @param {number} [options.backoffBase=10] see fail()
   * @param {number} [options.backoffMax=300] see fail()
   */
  constructor({ visibilityTimeout = 30, maxAttempts = 3, backoffBase = 10, backoffMax = 300 } = {}) {
    this.visibilityTimeout = visibilityTimeout;
    this.maxAttempts = maxAttempts;
    this.backoffBase = backoffBase;
    this.backoffMax = backoffMax;
    // TODO: add the state you need.
  }

  // ---------------------------------------------------------------- Part 1 · Core

  /**
   * Create a `queued` job and return its id: "job-1", "job-2", ... in creation order.
   *
   * `type` must be a non-empty string and `priority` an integer
   * (Number.isInteger), otherwise throw ValidationError. `payload` is stored as
   * given. A new job has attempts 0, availableAt === now (or `runAt`, Part 3),
   * and workerId, leaseExpiresAt and lastError all null.
   *
   * Part 2: if `idempotencyKey` is held by a job that is queued, leased or
   * retry_wait, return that job's id and change nothing (no id is used up).
   *
   * @returns {string}
   */
  enqueue(type, payload, now, { priority = 0, idempotencyKey = null, runAt = null } = {}) {
    throw new Error('Not implemented: enqueue (Part 1)');
  }

  /**
   * Lease the next job to `workerId` and return its snapshot, or null.
   *
   * `workerId` must be a non-empty string, otherwise throw ValidationError.
   * Candidates are `queued` jobs with availableAt <= now (and, in Part 3, whose
   * type is below its limit). Highest priority wins; ties go to the job created
   * first. The job becomes `leased`: workerId is set, attempts goes up by 1,
   * leaseExpiresAt = now + visibilityTimeout.
   *
   * @returns {import('./job').Job | null}
   */
  lease(workerId, now) {
    throw new Error('Not implemented: lease (Part 1)');
  }

  /**
   * Mark a job the caller holds as `succeeded`.
   *
   * Checks, in order: unknown id -> JobNotFoundError; job succeeded or dead ->
   * InvalidStateError; not leased by `workerId` (including an expired lease) ->
   * LeaseError.
   */
  ack(jobId, workerId, now) {
    throw new Error('Not implemented: ack (Part 1)');
  }

  /**
   * Record a failed attempt on a job the caller holds.
   *
   * Same checks as ack(). Stores `error` as lastError and ends the lease.
   * Part 2: if attempts < maxAttempts the job goes to `retry_wait` with
   * availableAt = now + Math.min(backoffBase * 2 ** (attempts - 1), backoffMax);
   * otherwise it becomes `dead`.
   */
  fail(jobId, workerId, error, now) {
    throw new Error('Not implemented: fail (Part 1)');
  }

  /**
   * Return a snapshot of the job. Unknown id -> JobNotFoundError.
   * @returns {import('./job').Job}
   */
  get(jobId, now) {
    throw new Error('Not implemented: get (Part 1)');
  }

  // ---------------------------------------------------------------- Part 2

  /**
   * Return a plain object { queued, leased, succeeded, retry_wait, dead } of
   * counts. Always exactly these five keys, zeros included.
   */
  stats(now) {
    throw new Error('Not implemented: stats (Part 2)');
  }

  /**
   * Return snapshots of every `dead` job, in creation order.
   * @returns {import('./job').Job[]}
   */
  deadLetters(now) {
    throw new Error('Not implemented: deadLetters (Part 2)');
  }

  // ---------------------------------------------------------------- Part 3 · Stretch

  /**
   * Allow at most `limit` leased jobs of `type` at once. `limit` is an integer
   * >= 1, or null to remove the limit; anything else throws ValidationError.
   * Existing leases are never revoked.
   */
  setTypeLimit(type, limit) {
    throw new Error('Not implemented: setTypeLimit (Part 3)');
  }

  /**
   * Move a `dead` job back to `queued` with attempts reset to 0.
   *
   * Unknown id -> JobNotFoundError; not dead -> InvalidStateError; another
   * queued, leased or retry_wait job holds its idempotency key ->
   * InvalidStateError (nothing changes).
   */
  requeueDead(jobId, now) {
    throw new Error('Not implemented: requeueDead (Part 3)');
  }
}

module.exports = { JobQueue };
