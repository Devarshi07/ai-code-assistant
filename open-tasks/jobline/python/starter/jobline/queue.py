"""JobQueue: the service you are building. See README.md for the full brief.

Time is never read from a real clock. Every method that takes ``now`` (a number
of seconds; callers never pass a smaller ``now`` than before) must first apply
every time-based transition due at or before ``now``, and only then do its work:

- a ``leased`` job whose ``lease_expires_at <= now`` has expired;
- a ``retry_wait`` job whose ``available_at <= now`` becomes ``queued``.
"""
from .job import Job


class JobQueue:
    """An in-memory job queue with leases, retries and a dead-letter list."""

    def __init__(self, *, visibility_timeout=30, max_attempts=3, backoff_base=10, backoff_max=300):
        """Create an empty queue.

        visibility_timeout: seconds a lease lasts.
        max_attempts: how many leases a job gets before it is dead.
        backoff_base, backoff_max: seconds; see ``fail``.
        You may assume the options are valid.
        """
        self.visibility_timeout = visibility_timeout
        self.max_attempts = max_attempts
        self.backoff_base = backoff_base
        self.backoff_max = backoff_max
        # TODO: add the state you need.

    # ------------------------------------------------------------------ Part 1 · Core

    def enqueue(self, job_type, payload, now, *, priority=0, idempotency_key=None, run_at=None) -> str:
        """Create a ``queued`` job and return its id: "job-1", "job-2", ... in creation order.

        ``job_type`` must be a non-empty str and ``priority`` an int (not a bool),
        otherwise raise ValidationError. ``payload`` is stored as given.
        A new job has attempts 0, available_at == now (or ``run_at``, Part 3),
        and worker_id, lease_expires_at and last_error all None.

        Part 2: if ``idempotency_key`` is held by a job that is queued, leased or
        retry_wait, return that job's id and change nothing (no id is used up).
        """
        raise NotImplementedError("Part 1: enqueue")

    def lease(self, worker_id, now) -> Job | None:
        """Lease the next job to ``worker_id`` and return its snapshot, or None.

        ``worker_id`` must be a non-empty str, otherwise raise ValidationError.
        Candidates are ``queued`` jobs with ``available_at <= now`` (and, in
        Part 3, whose type is below its limit). Highest priority wins; ties go
        to the job created first. The job becomes ``leased``: worker_id is set,
        attempts goes up by 1, lease_expires_at = now + visibility_timeout.
        """
        raise NotImplementedError("Part 1: lease")

    def ack(self, job_id, worker_id, now) -> None:
        """Mark a job the caller holds as ``succeeded``.

        Checks, in order: unknown id -> JobNotFoundError; job succeeded or
        dead -> InvalidStateError; not leased by ``worker_id`` (including an
        expired lease) -> LeaseError.
        """
        raise NotImplementedError("Part 1: ack")

    def fail(self, job_id, worker_id, error, now) -> None:
        """Record a failed attempt on a job the caller holds.

        Same checks as ``ack``. Stores ``error`` as last_error and ends the lease.
        Part 2: if attempts < max_attempts the job goes to ``retry_wait`` with
        available_at = now + min(backoff_base * 2 ** (attempts - 1), backoff_max);
        otherwise it becomes ``dead``.
        """
        raise NotImplementedError("Part 1: fail")

    def get(self, job_id, now) -> Job:
        """Return a snapshot of the job. Unknown id -> JobNotFoundError."""
        raise NotImplementedError("Part 1: get")

    # ------------------------------------------------------------------ Part 2

    def stats(self, now) -> dict:
        """Return {"queued": n, "leased": n, "succeeded": n, "retry_wait": n, "dead": n}.

        Always exactly these five keys, zeros included.
        """
        raise NotImplementedError("Part 2: stats")

    def dead_letters(self, now) -> list:
        """Return snapshots of every ``dead`` job, in creation order."""
        raise NotImplementedError("Part 2: dead_letters")

    # ------------------------------------------------------------------ Part 3 · Stretch

    def set_type_limit(self, job_type, limit) -> None:
        """Allow at most ``limit`` leased jobs of ``job_type`` at once.

        ``limit`` is an int >= 1, or None to remove the limit; anything else
        raises ValidationError. Existing leases are never revoked.
        """
        raise NotImplementedError("Part 3: set_type_limit")

    def requeue_dead(self, job_id, now) -> None:
        """Move a ``dead`` job back to ``queued`` with attempts reset to 0.

        Unknown id -> JobNotFoundError; not dead -> InvalidStateError; another
        queued, leased or retry_wait job holds its idempotency key ->
        InvalidStateError (nothing changes).
        """
        raise NotImplementedError("Part 3: requeue_dead")
