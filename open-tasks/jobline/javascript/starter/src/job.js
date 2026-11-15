// Job states and the shape of the Job snapshots that JobQueue hands out.

const JobState = Object.freeze({
  QUEUED: 'queued',          // waiting; can be leased once now >= availableAt
  LEASED: 'leased',          // a worker holds it until leaseExpiresAt
  SUCCEEDED: 'succeeded',    // the holder acked it (final)
  RETRY_WAIT: 'retry_wait',  // the last attempt failed; waits until availableAt
  DEAD: 'dead',              // out of attempts; listed by deadLetters()
});

const STATES = Object.freeze(Object.values(JobState));

/** lastError after a lease times out. */
const LEASE_EXPIRED = 'lease expired';

/**
 * A point-in-time copy of one job, as a plain object. JobQueue returns a new
 * snapshot from lease() and get(). Absent values are `null`, never `undefined`.
 *
 * @typedef {Object} Job
 * @property {string} id              "job-1", "job-2", ... in creation order
 * @property {string} type            e.g. "email" or "report"
 * @property {*} payload              whatever was passed to enqueue, stored as given
 * @property {number} priority        higher runs first
 * @property {string} state           one of STATES
 * @property {number} attempts        how many times the job has been leased
 * @property {number} availableAt     when the job can next be leased (meaningful while queued or retry_wait)
 * @property {string|null} workerId   the holder while leased, otherwise null
 * @property {number|null} leaseExpiresAt  when the lease ends while leased, otherwise null
 * @property {string|null} lastError  the most recent failure message, or null
 * @property {string|null} idempotencyKey  the key given to enqueue, or null
 */

module.exports = { JobState, STATES, LEASE_EXPIRED };
