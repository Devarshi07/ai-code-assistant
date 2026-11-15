# JobLine

The product team sends welcome emails and builds nightly reports in the background. Today that work runs inside web requests, and a slow mail server makes sign-up hang. They want a small **in-process job queue**: the web app enqueues jobs, worker loops lease them, and jobs that fail are retried later instead of being lost.

You'll build `JobQueue` in `jobline/queue.py`. The errors (`jobline/errors.py`) and the `Job` snapshot (`jobline/job.py`) are already written.

Everything is in memory and single-threaded. There is no real clock: every method that depends on time takes `now`, a number of seconds. Callers never pass a smaller `now` than in an earlier call.

## Job states

| State | Meaning |
| --- | --- |
| `queued` | Waiting for a worker. It can be leased once `now >= available_at`. |
| `leased` | A worker holds it. The lease is valid while `now < lease_expires_at`. |
| `succeeded` | The holder acked it. Final. |
| `retry_wait` | Its last attempt failed. It waits until `available_at`, then becomes `queued`. |
| `dead` | Out of attempts. It is in the dead-letter list. |

| From | Event | To |
| --- | --- | --- |
| (new) | `enqueue` | `queued` |
| `queued` | `lease` picks it | `leased`, `attempts` + 1 |
| `leased` | `ack` by the holder | `succeeded` |
| `leased` | `fail` by the holder, `attempts < max_attempts` | `retry_wait` |
| `leased` | `fail` by the holder, `attempts >= max_attempts` | `dead` |
| `leased` | lease expires, `attempts < max_attempts` | `queued` |
| `leased` | lease expires, `attempts >= max_attempts` | `dead` |
| `retry_wait` | `now` reaches `available_at` | `queued` |
| `dead` | `requeue_dead` (Part 3) | `queued` |

Time-based transitions happen lazily: **every method that takes `now` first applies every transition due at or before `now`**, then does its work. A lease expires at `lease_expires_at` exactly, so at `now == lease_expires_at` the worker no longer holds it.

## Errors

Every error subclasses `JobLineError`. Raise the most specific one:

| Error | When |
| --- | --- |
| `ValidationError` | An argument is invalid (listed with each method). Nothing changes. |
| `JobNotFoundError` | No job has that id. |
| `LeaseError` | The caller doesn't hold a live lease on the job: it isn't leased, another worker holds it, or the caller's lease expired. |
| `InvalidStateError` | The job's state doesn't allow the operation: `ack` or `fail` on a `succeeded` or `dead` job (for example a second `ack`), or `requeue_dead` on a job that isn't dead. |

## Part 1 · Core

`JobQueue(*, visibility_timeout=30, max_attempts=3, backoff_base=10, backoff_max=300)` is written for you. All options are seconds except `max_attempts`. You may assume they are valid.

**`enqueue(job_type, payload, now, *, priority=0, idempotency_key=None, run_at=None) -> str`**
- Creates a `queued` job and returns its id. Ids are `"job-1"`, `"job-2"`, … in the order jobs are created.
- `job_type` must be a non-empty `str` and `priority` an `int` (not a `bool`), otherwise raise `ValidationError`. `payload` is stored as given.
- A new job has `attempts == 0` and `available_at == now`, and `worker_id`, `lease_expires_at` and `last_error` are `None`.

**`lease(worker_id, now) -> Job | None`**
- `worker_id` must be a non-empty `str`, otherwise raise `ValidationError`.
- Picks one `queued` job with `available_at <= now`. The **highest priority** wins (any `int`, negatives allowed). Ties go to the job **created first**. A job keeps that place in line for its whole life, including after retries.
- The job becomes `leased`: `worker_id` is set, `attempts` goes up by 1, and `lease_expires_at = now + visibility_timeout`. Return its snapshot, or `None` if nothing can be leased.
- One worker may hold several leases at once.

**`ack(job_id, worker_id, now)`** marks the job `succeeded`.

**`fail(job_id, worker_id, error, now)`** records the failure: `last_error = error` (a string) and the lease ends. Part 2 decides where the job goes next.

`ack` and `fail` check, in this order: unknown id → `JobNotFoundError`; job is `succeeded` or `dead` → `InvalidStateError`; job is not leased by `worker_id` → `LeaseError`.

**Lease expiry.** When a lease expires, the job goes back to `queued` with `available_at` set to the expiry time (no backoff), `last_error = "lease expired"`, and `worker_id` and `lease_expires_at` back to `None`. Any worker can then lease it. (If it was the job's last allowed attempt, it becomes `dead` instead; see Part 2.) After `ack` or `fail`, `worker_id` and `lease_expires_at` are `None` too.

**`get(job_id, now) -> Job`** returns a snapshot. Unknown id → `JobNotFoundError`.

`Job` is a frozen dataclass with the fields `id, type, payload, priority, state, attempts, available_at, worker_id, lease_expires_at, last_error, idempotency_key`. `lease` and `get` return a new snapshot each time.

## Part 2 · Retries, dead letters, idempotency, stats

- **Backoff.** When the holder calls `fail` and `attempts < max_attempts`, the job goes to `retry_wait` with `available_at = now + min(backoff_base * 2 ** (attempts - 1), backoff_max)`. Here `attempts` includes the lease that just failed, so it is 1 for the first failure. With `backoff_base=10, backoff_max=60` the delays are 10, 20, 40, 60, 60, … The job becomes `queued` once `now >= available_at`.
- **Dead letters.** When the holder calls `fail` and `attempts >= max_attempts`, the job becomes `dead`. A lease that **expires** on the job's last allowed attempt also makes it `dead`, with `last_error == "lease expired"`. A late `ack` for that job therefore raises `InvalidStateError`.
- **`dead_letters(now) -> list[Job]`** returns every `dead` job, in creation order.
- **Idempotency.** If `idempotency_key` (a `str`) is given and a job holding that key is `queued`, `leased` or `retry_wait`, `enqueue` returns that job's id and changes nothing: the new payload and priority are ignored and no id number is used up. Once that job is `succeeded` or `dead`, the key is free and the next `enqueue` with it creates a new job, which then holds the key. Keys are global across job types. `None` means no key. A job's key is shown in its `idempotency_key` field.
- **`stats(now) -> dict`** returns a plain dict with exactly the five state names as keys and counts as values, zeros included. For example `{"queued": 2, "leased": 1, "succeeded": 0, "retry_wait": 0, "dead": 0}`.

## Part 3 · Stretch

- **Delayed jobs.** `enqueue(..., run_at=t)` sets `available_at = t` instead of `now`. The job is `queued` (and counted as queued), but it can't be leased until `now >= t`. A `run_at` in the past is available at once. The order among available jobs doesn't change: priority, then creation order.
- **Per-type concurrency.** `set_type_limit(job_type, limit)` allows at most `limit` jobs of that type to be `leased` at once. `lease` skips jobs whose type is full and takes the best job it may lease. `limit=None` removes the limit. Otherwise `limit` must be an `int >= 1`, else `ValidationError`. Lowering a limit never revokes existing leases. A job that leaves `leased` (ack, fail or expiry) frees its slot.
- **Requeue.** `requeue_dead(job_id, now)` moves a `dead` job back to `queued` with `attempts = 0` and `available_at = now`. It keeps its `last_error` and its original place in line, and it leaves the dead-letter list. Unknown id → `JobNotFoundError`. Not `dead` → `InvalidStateError`. If another `queued`, `leased` or `retry_wait` job holds the same idempotency key, raise `InvalidStateError` and change nothing. Otherwise the requeued job holds its key again.

## Project layout

| File | Contents |
| --- | --- |
| `jobline/queue.py` | `JobQueue`: the stubs you implement |
| `jobline/job.py` | State names (`QUEUED`, `LEASED`, …), `LEASE_EXPIRED` and the `Job` snapshot |
| `jobline/errors.py` | `JobLineError` and its subclasses |
| `tests/test_public.py` | A few happy-path tests to get you started |

Add your own tests as `tests/test_*.py`. Hidden acceptance tests run when you submit. Use only the standard library.

## Running the tests

```
python -m unittest discover -s tests -v
```
