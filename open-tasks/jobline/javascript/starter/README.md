# JobLine

The product team sends welcome emails and builds nightly reports in the background. Today that work runs inside web requests, and a slow mail server makes sign-up hang. They want a small **in-process job queue**: the web app enqueues jobs, worker loops lease them, and jobs that fail are retried later instead of being lost.

You'll build `JobQueue` in `src/queue.js`. The errors (`src/errors.js`) and the state names (`src/job.js`) are already written. `src/index.js` re-exports everything.

Everything is in memory and single-threaded. There is no real clock: every method that depends on time takes `now`, a number of seconds. Callers never pass a smaller `now` than in an earlier call.

## Job states

| State | Meaning |
| --- | --- |
| `queued` | Waiting for a worker. It can be leased once `now >= availableAt`. |
| `leased` | A worker holds it. The lease is valid while `now < leaseExpiresAt`. |
| `succeeded` | The holder acked it. Final. |
| `retry_wait` | Its last attempt failed. It waits until `availableAt`, then becomes `queued`. |
| `dead` | Out of attempts. It is in the dead-letter list. |

| From | Event | To |
| --- | --- | --- |
| (new) | `enqueue` | `queued` |
| `queued` | `lease` picks it | `leased`, `attempts` + 1 |
| `leased` | `ack` by the holder | `succeeded` |
| `leased` | `fail` by the holder, `attempts < maxAttempts` | `retry_wait` |
| `leased` | `fail` by the holder, `attempts >= maxAttempts` | `dead` |
| `leased` | lease expires, `attempts < maxAttempts` | `queued` |
| `leased` | lease expires, `attempts >= maxAttempts` | `dead` |
| `retry_wait` | `now` reaches `availableAt` | `queued` |
| `dead` | `requeueDead` (Part 3) | `queued` |

Time-based transitions happen lazily: **every method that takes `now` first applies every transition due at or before `now`**, then does its work. A lease expires at `leaseExpiresAt` exactly, so at `now === leaseExpiresAt` the worker no longer holds it.

## Errors

Every error extends `JobLineError`. Throw the most specific one:

| Error | When |
| --- | --- |
| `ValidationError` | An argument is invalid (listed with each method). Nothing changes. |
| `JobNotFoundError` | No job has that id. |
| `LeaseError` | The caller doesn't hold a live lease on the job: it isn't leased, another worker holds it, or the caller's lease expired. |
| `InvalidStateError` | The job's state doesn't allow the operation: `ack` or `fail` on a `succeeded` or `dead` job (for example a second `ack`), or `requeueDead` on a job that isn't dead. |

## Part 1 · Core

`new JobQueue({ visibilityTimeout = 30, maxAttempts = 3, backoffBase = 10, backoffMax = 300 } = {})` is written for you. All options are seconds except `maxAttempts`. You may assume they are valid.

**`enqueue(type, payload, now, { priority = 0, idempotencyKey = null, runAt = null } = {})` → string**
- Creates a `queued` job and returns its id. Ids are `"job-1"`, `"job-2"`, … in the order jobs are created.
- `type` must be a non-empty string and `priority` an integer (`Number.isInteger`), otherwise throw `ValidationError`. `payload` is stored as given.
- A new job has `attempts === 0` and `availableAt === now`, and `workerId`, `leaseExpiresAt` and `lastError` are `null`.

**`lease(workerId, now)` → Job or `null`**
- `workerId` must be a non-empty string, otherwise throw `ValidationError`.
- Picks one `queued` job with `availableAt <= now`. The **highest priority** wins (any integer, negatives allowed). Ties go to the job **created first**. A job keeps that place in line for its whole life, including after retries.
- The job becomes `leased`: `workerId` is set, `attempts` goes up by 1, and `leaseExpiresAt = now + visibilityTimeout`. Return its snapshot, or `null` if nothing can be leased.
- One worker may hold several leases at once.

**`ack(jobId, workerId, now)`** marks the job `succeeded`.

**`fail(jobId, workerId, error, now)`** records the failure: `lastError = error` (a string) and the lease ends. Part 2 decides where the job goes next.

`ack` and `fail` check, in this order: unknown id → `JobNotFoundError`; job is `succeeded` or `dead` → `InvalidStateError`; job is not leased by `workerId` → `LeaseError`.

**Lease expiry.** When a lease expires, the job goes back to `queued` with `availableAt` set to the expiry time (no backoff), `lastError = 'lease expired'`, and `workerId` and `leaseExpiresAt` back to `null`. Any worker can then lease it. (If it was the job's last allowed attempt, it becomes `dead` instead; see Part 2.) After `ack` or `fail`, `workerId` and `leaseExpiresAt` are `null` too.

**`get(jobId, now)` → Job** returns a snapshot. Unknown id → `JobNotFoundError`.

A Job snapshot is a plain object with the fields `id, type, payload, priority, state, attempts, availableAt, workerId, leaseExpiresAt, lastError, idempotencyKey`. Absent values are `null`, never `undefined`. `lease` and `get` return a new snapshot each time.

## Part 2 · Retries, dead letters, idempotency, stats

- **Backoff.** When the holder calls `fail` and `attempts < maxAttempts`, the job goes to `retry_wait` with `availableAt = now + Math.min(backoffBase * 2 ** (attempts - 1), backoffMax)`. Here `attempts` includes the lease that just failed, so it is 1 for the first failure. With `backoffBase: 10, backoffMax: 60` the delays are 10, 20, 40, 60, 60, … The job becomes `queued` once `now >= availableAt`.
- **Dead letters.** When the holder calls `fail` and `attempts >= maxAttempts`, the job becomes `dead`. A lease that **expires** on the job's last allowed attempt also makes it `dead`, with `lastError === 'lease expired'`. A late `ack` for that job therefore throws `InvalidStateError`.
- **`deadLetters(now)` → Job[]** returns every `dead` job, in creation order.
- **Idempotency.** If `idempotencyKey` (a string) is given and a job holding that key is `queued`, `leased` or `retry_wait`, `enqueue` returns that job's id and changes nothing: the new payload and priority are ignored and no id number is used up. Once that job is `succeeded` or `dead`, the key is free and the next `enqueue` with it creates a new job, which then holds the key. Keys are global across job types. `null` means no key. A job's key is shown in its `idempotencyKey` field.
- **`stats(now)` → object** returns a plain object with exactly the five state names as keys and counts as values, zeros included. For example `{ queued: 2, leased: 1, succeeded: 0, retry_wait: 0, dead: 0 }`.

## Part 3 · Stretch

- **Delayed jobs.** `enqueue(..., { runAt: t })` sets `availableAt = t` instead of `now`. The job is `queued` (and counted as queued), but it can't be leased until `now >= t`. A `runAt` in the past is available at once. The order among available jobs doesn't change: priority, then creation order.
- **Per-type concurrency.** `setTypeLimit(type, limit)` allows at most `limit` jobs of that type to be `leased` at once. `lease` skips jobs whose type is full and takes the best job it may lease. `limit = null` removes the limit. Otherwise `limit` must be an integer `>= 1`, else `ValidationError`. Lowering a limit never revokes existing leases. A job that leaves `leased` (ack, fail or expiry) frees its slot.
- **Requeue.** `requeueDead(jobId, now)` moves a `dead` job back to `queued` with `attempts = 0` and `availableAt = now`. It keeps its `lastError` and its original place in line, and it leaves the dead-letter list. Unknown id → `JobNotFoundError`. Not `dead` → `InvalidStateError`. If another `queued`, `leased` or `retry_wait` job holds the same idempotency key, throw `InvalidStateError` and change nothing. Otherwise the requeued job holds its key again.

## Project layout

| File | Contents |
| --- | --- |
| `src/queue.js` | `JobQueue`: the stubs you implement |
| `src/job.js` | `JobState` names, `LEASE_EXPIRED` and the Job snapshot shape |
| `src/errors.js` | `JobLineError` and its subclasses |
| `src/index.js` | Re-exports everything (`require('../src')`) |
| `tests/public.test.js` | A few happy-path tests to get you started |

Add your own tests as `tests/*.test.js`. Hidden acceptance tests run when you submit. Use only the standard library.

## Running the tests

```
node --test "tests/*.test.js"
```
