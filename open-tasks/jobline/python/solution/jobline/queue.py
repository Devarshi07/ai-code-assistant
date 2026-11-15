"""JobQueue: an in-process job queue with leases, retries and a dead-letter list.

Time is never read from a real clock. Every method that takes ``now`` first
calls ``_advance(now)``, which applies every time-based transition due at or
before ``now`` (expired leases, finished backoffs), and only then does its work.
"""
from collections import Counter

from .errors import InvalidStateError, JobNotFoundError, LeaseError, ValidationError
from .job import DEAD, LEASE_EXPIRED, LEASED, QUEUED, RETRY_WAIT, STATES, SUCCEEDED, Job


def _is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _require_text(value, name):
    if not isinstance(value, str) or not value:
        raise ValidationError(f"{name} must be a non-empty string")


class _Record:
    """Mutable internal state for one job. Callers only ever see Job snapshots."""

    __slots__ = ("id", "type", "payload", "priority", "state", "attempts", "available_at",
                 "worker_id", "lease_expires_at", "last_error", "idempotency_key")

    def __init__(self, job_id, job_type, payload, priority, available_at, idempotency_key):
        self.id = job_id
        self.type = job_type
        self.payload = payload
        self.priority = priority
        self.state = QUEUED
        self.attempts = 0
        self.available_at = available_at
        self.worker_id = None
        self.lease_expires_at = None
        self.last_error = None
        self.idempotency_key = idempotency_key

    def snapshot(self):
        return Job(id=self.id, type=self.type, payload=self.payload, priority=self.priority,
                   state=self.state, attempts=self.attempts, available_at=self.available_at,
                   worker_id=self.worker_id, lease_expires_at=self.lease_expires_at,
                   last_error=self.last_error, idempotency_key=self.idempotency_key)


class JobQueue:
    """An in-memory job queue with leases, retries and a dead-letter list."""

    def __init__(self, *, visibility_timeout=30, max_attempts=3, backoff_base=10, backoff_max=300):
        self.visibility_timeout = visibility_timeout
        self.max_attempts = max_attempts
        self.backoff_base = backoff_base
        self.backoff_max = backoff_max
        self._jobs = {}        # id -> _Record; dict order is creation order, i.e. place in line
        self._next_number = 1
        self._keys = {}        # idempotency key -> id of the active job holding it
        self._limits = {}      # job type -> max leased at once

    # ------------------------------------------------------------------ Part 1 · Core

    def enqueue(self, job_type, payload, now, *, priority=0, idempotency_key=None, run_at=None):
        _require_text(job_type, "job_type")
        if not _is_int(priority):
            raise ValidationError("priority must be an integer")
        self._advance(now)
        if idempotency_key is not None and idempotency_key in self._keys:
            return self._keys[idempotency_key]
        job_id = f"job-{self._next_number}"
        self._next_number += 1
        available_at = now if run_at is None else run_at
        self._jobs[job_id] = _Record(job_id, job_type, payload, priority, available_at, idempotency_key)
        if idempotency_key is not None:
            self._keys[idempotency_key] = job_id
        return job_id

    def lease(self, worker_id, now):
        _require_text(worker_id, "worker_id")
        self._advance(now)
        leased = Counter(r.type for r in self._jobs.values() if r.state == LEASED)
        best = None
        for record in self._jobs.values():  # creation order, so ">" keeps the oldest on ties
            if record.state != QUEUED or record.available_at > now:
                continue
            limit = self._limits.get(record.type)
            if limit is not None and leased[record.type] >= limit:
                continue
            if best is None or record.priority > best.priority:
                best = record
        if best is None:
            return None
        best.state = LEASED
        best.worker_id = worker_id
        best.attempts += 1
        best.lease_expires_at = now + self.visibility_timeout
        return best.snapshot()

    def ack(self, job_id, worker_id, now):
        record = self._held(job_id, worker_id, now)
        self._end_lease(record)
        self._finish(record, SUCCEEDED)

    def fail(self, job_id, worker_id, error, now):
        record = self._held(job_id, worker_id, now)
        self._end_lease(record)
        record.last_error = error
        if record.attempts >= self.max_attempts:
            self._finish(record, DEAD)
            return
        delay = min(self.backoff_base * 2 ** (record.attempts - 1), self.backoff_max)
        record.state = RETRY_WAIT
        record.available_at = now + delay

    def get(self, job_id, now):
        record = self._record(job_id)
        self._advance(now)
        return record.snapshot()

    # ------------------------------------------------------------------ Part 2

    def stats(self, now):
        self._advance(now)
        counts = dict.fromkeys(STATES, 0)
        for record in self._jobs.values():
            counts[record.state] += 1
        return counts

    def dead_letters(self, now):
        self._advance(now)
        return [r.snapshot() for r in self._jobs.values() if r.state == DEAD]

    # ------------------------------------------------------------------ Part 3 · Stretch

    def set_type_limit(self, job_type, limit):
        _require_text(job_type, "job_type")
        if limit is None:
            self._limits.pop(job_type, None)
            return
        if not _is_int(limit) or limit < 1:
            raise ValidationError("limit must be an integer >= 1, or None")
        self._limits[job_type] = limit

    def requeue_dead(self, job_id, now):
        record = self._record(job_id)
        self._advance(now)
        if record.state != DEAD:
            raise InvalidStateError(f"{job_id} is {record.state}, not dead")
        key = record.idempotency_key
        if key is not None and key in self._keys:
            raise InvalidStateError(f"{self._keys[key]} already holds idempotency key {key!r}")
        record.state = QUEUED
        record.attempts = 0
        record.available_at = now
        if key is not None:
            self._keys[key] = record.id

    # ------------------------------------------------------------------ helpers

    def _record(self, job_id):
        record = self._jobs.get(job_id)
        if record is None:
            raise JobNotFoundError(f"no job {job_id!r}")
        return record

    def _held(self, job_id, worker_id, now):
        """Return the record if ``worker_id`` holds a live lease on it, else raise."""
        record = self._record(job_id)
        self._advance(now)
        if record.state in (SUCCEEDED, DEAD):
            raise InvalidStateError(f"{job_id} is already {record.state}")
        if record.state != LEASED or record.worker_id != worker_id:
            raise LeaseError(f"{worker_id!r} does not hold a lease on {job_id}")
        return record

    def _advance(self, now):
        for record in self._jobs.values():
            if record.state == LEASED and record.lease_expires_at <= now:
                expired_at = record.lease_expires_at
                self._end_lease(record)
                record.last_error = LEASE_EXPIRED
                if record.attempts >= self.max_attempts:
                    self._finish(record, DEAD)
                else:
                    record.state = QUEUED
                    record.available_at = expired_at
            elif record.state == RETRY_WAIT and record.available_at <= now:
                record.state = QUEUED

    @staticmethod
    def _end_lease(record):
        record.worker_id = None
        record.lease_expires_at = None

    def _finish(self, record, state):
        """Move a job to a final state (succeeded or dead) and release its key."""
        record.state = state
        key = record.idempotency_key
        if key is not None and self._keys.get(key) == record.id:
            del self._keys[key]
