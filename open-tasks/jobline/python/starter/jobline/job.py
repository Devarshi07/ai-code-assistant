"""Job states and the read-only Job snapshot that JobQueue hands out."""
from dataclasses import dataclass
from typing import Any

QUEUED = "queued"          # waiting; can be leased once now >= available_at
LEASED = "leased"          # a worker holds it until lease_expires_at
SUCCEEDED = "succeeded"    # the holder acked it (final)
RETRY_WAIT = "retry_wait"  # the last attempt failed; waits until available_at
DEAD = "dead"              # out of attempts; listed by dead_letters()

STATES = (QUEUED, LEASED, SUCCEEDED, RETRY_WAIT, DEAD)

LEASE_EXPIRED = "lease expired"  # last_error after a lease times out


@dataclass(frozen=True)
class Job:
    """A point-in-time copy of one job.

    JobQueue returns a new snapshot from ``lease`` and ``get``; changing the
    queue afterwards never changes a snapshot you already hold.

    Fields:
        id: "job-1", "job-2", ... in creation order.
        type: the job type, e.g. "email" or "report".
        payload: whatever was passed to ``enqueue``, stored as given.
        priority: higher runs first.
        state: one of STATES.
        attempts: how many times the job has been leased.
        available_at: when the job can next be leased (meaningful while
            ``queued`` or ``retry_wait``).
        worker_id: the holder while ``leased``, otherwise None.
        lease_expires_at: when the lease ends while ``leased``, otherwise None.
        last_error: the most recent failure message, or None.
        idempotency_key: the key given to ``enqueue``, or None.
    """

    id: str
    type: str
    payload: Any
    priority: int
    state: str
    attempts: int
    available_at: float
    worker_id: str | None = None
    lease_expires_at: float | None = None
    last_error: str | None = None
    idempotency_key: str | None = None
