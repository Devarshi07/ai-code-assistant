import unittest

from jobline import (
    InvalidStateError,
    JobLineError,
    JobNotFoundError,
    JobQueue,
    LeaseError,
    ValidationError,
)

ZERO = {"queued": 0, "leased": 0, "succeeded": 0, "retry_wait": 0, "dead": 0}


def drain(q, worker, now):
    """Lease everything that can be leased at `now`; return the ids in lease order."""
    ids = []
    while (job := q.lease(worker, now=now)) is not None:
        ids.append(job.id)
    return ids


class CoreTests(unittest.TestCase):
    def test_new_job_snapshot_has_documented_defaults(self):
        q = JobQueue()
        payload = {"to": "ana@example.com"}
        job_id = q.enqueue("email", payload, now=7)
        job = q.get(job_id, now=7)
        self.assertEqual(job_id, "job-1")
        self.assertEqual(
            (job.id, job.type, job.payload, job.priority, job.state, job.attempts, job.available_at),
            ("job-1", "email", payload, 0, "queued", 0, 7),
        )
        self.assertIsNone(job.worker_id)
        self.assertIsNone(job.lease_expires_at)
        self.assertIsNone(job.last_error)
        self.assertIsNone(job.idempotency_key)

    def test_priority_then_creation_order_including_negative_priorities(self):
        q = JobQueue()
        a = q.enqueue("email", {}, now=0)
        b = q.enqueue("report", {}, now=1, priority=5)
        c = q.enqueue("email", {}, now=2, priority=-1)
        d = q.enqueue("email", {}, now=3, priority=5)
        e = q.enqueue("report", {}, now=4)
        self.assertEqual(drain(q, "w1", now=5), [b, d, a, e, c])

    def test_one_worker_can_hold_several_leases_and_held_jobs_are_skipped(self):
        q = JobQueue(visibility_timeout=60)
        ids = [q.enqueue("email", {"n": n}, now=0) for n in range(3)]
        self.assertEqual([q.lease("w1", now=1).id for _ in range(3)], ids)
        self.assertIsNone(q.lease("w2", now=2))
        for job_id in ids:
            q.ack(job_id, "w1", now=3)
        self.assertEqual([q.get(job_id, now=3).state for job_id in ids], ["succeeded"] * 3)

    def test_lease_uses_visibility_timeout_default_and_custom(self):
        default = JobQueue()
        default.enqueue("email", {}, now=0)
        self.assertEqual(default.lease("w1", now=10).lease_expires_at, 40)

        q = JobQueue(visibility_timeout=45)
        job_id = q.enqueue("report", {"day": 1}, now=0)
        job = q.lease("worker-a", now=100)
        self.assertEqual((job.state, job.worker_id, job.lease_expires_at, job.attempts), ("leased", "worker-a", 145, 1))
        held = q.get(job_id, now=101)
        self.assertEqual((held.state, held.worker_id, held.lease_expires_at), ("leased", "worker-a", 145))

    def test_expired_lease_is_available_again_exactly_at_expiry(self):
        q = JobQueue(visibility_timeout=30)
        job_id = q.enqueue("email", {}, now=0)
        q.lease("w1", now=0)
        self.assertIsNone(q.lease("w2", now=29))
        job = q.lease("w2", now=30)
        self.assertIsNotNone(job)
        self.assertEqual((job.id, job.worker_id, job.attempts, job.lease_expires_at), (job_id, "w2", 2, 60))

    def test_expired_lease_clears_holder_and_records_reason(self):
        q = JobQueue(visibility_timeout=30)
        job_id = q.enqueue("email", {}, now=0)
        q.lease("w1", now=0)
        job = q.get(job_id, now=35)
        self.assertEqual(job.state, "queued")
        self.assertEqual(job.available_at, 30)
        self.assertEqual(job.attempts, 1)
        self.assertEqual(job.last_error, "lease expired")
        self.assertIsNone(job.worker_id)
        self.assertIsNone(job.lease_expires_at)

    def test_lease_is_valid_until_just_before_expiry(self):
        q = JobQueue(visibility_timeout=30)
        job_id = q.enqueue("email", {}, now=0)
        q.lease("w1", now=0)
        q.ack(job_id, "w1", now=29)
        self.assertEqual(q.get(job_id, now=29).state, "succeeded")

        late = JobQueue(visibility_timeout=30)
        late_id = late.enqueue("email", {}, now=0)
        late.lease("w1", now=0)
        with self.assertRaises(LeaseError):
            late.ack(late_id, "w1", now=30)
        self.assertEqual(late.lease("w2", now=30).id, late_id)

    def test_only_the_current_holder_can_ack_or_fail(self):
        q = JobQueue(visibility_timeout=10)
        job_id = q.enqueue("email", {}, now=0)
        q.lease("w1", now=0)
        with self.assertRaises(LeaseError):
            q.ack(job_id, "w2", now=1)
        with self.assertRaises(LeaseError):
            q.fail(job_id, "w2", "boom", now=1)
        self.assertEqual(q.get(job_id, now=1).worker_id, "w1")

        self.assertEqual(q.lease("w2", now=12).id, job_id)
        with self.assertRaises(LeaseError):
            q.ack(job_id, "w1", now=13)
        q.ack(job_id, "w2", now=13)
        self.assertEqual(q.get(job_id, now=13).state, "succeeded")

    def test_ack_or_fail_on_a_job_nobody_holds_raises_lease_error(self):
        q = JobQueue(backoff_base=10)
        job_id = q.enqueue("email", {}, now=0)
        with self.assertRaises(LeaseError):
            q.ack(job_id, "w1", now=0)
        with self.assertRaises(LeaseError):
            q.fail(job_id, "w1", "boom", now=0)
        q.lease("w1", now=1)
        q.fail(job_id, "w1", "boom", now=1)
        with self.assertRaises(LeaseError):
            q.fail(job_id, "w1", "again", now=2)
        with self.assertRaises(LeaseError):
            q.ack(job_id, "w1", now=2)

    def test_unknown_job_id_raises_job_not_found(self):
        q = JobQueue()
        q.enqueue("email", {}, now=0)
        q.lease("w1", now=0)
        calls = [
            lambda: q.get("job-99", now=1),
            lambda: q.ack("job-99", "w1", now=1),
            lambda: q.fail("job-99", "w1", "boom", now=1),
        ]
        for call in calls:
            with self.assertRaises(JobNotFoundError):
                call()

    def test_double_ack_raises_invalid_state(self):
        q = JobQueue()
        job_id = q.enqueue("email", {}, now=0)
        q.lease("w1", now=0)
        q.ack(job_id, "w1", now=1)
        with self.assertRaises(InvalidStateError):
            q.ack(job_id, "w1", now=2)
        with self.assertRaises(InvalidStateError):
            q.fail(job_id, "w1", "late", now=2)
        with self.assertRaises(InvalidStateError):
            q.ack(job_id, "someone-else", now=2)
        self.assertEqual(q.get(job_id, now=2).state, "succeeded")

    def test_fail_records_error_and_ends_the_lease(self):
        q = JobQueue(backoff_base=10)
        job_id = q.enqueue("email", {}, now=0)
        q.lease("w1", now=0)
        q.fail(job_id, "w1", "SMTP timeout", now=3)
        job = q.get(job_id, now=3)
        self.assertEqual(job.last_error, "SMTP timeout")
        self.assertEqual(job.state, "retry_wait")
        self.assertIsNone(job.worker_id)
        self.assertIsNone(job.lease_expires_at)

    def test_invalid_arguments_raise_validation_error(self):
        q = JobQueue()
        for bad_type in ("", None, 42):
            with self.assertRaises(ValidationError):
                q.enqueue(bad_type, {}, now=0)
        for bad_priority in (1.5, "high"):
            with self.assertRaises(ValidationError):
                q.enqueue("email", {}, now=0, priority=bad_priority)
        for bad_worker in ("", None):
            with self.assertRaises(ValidationError):
                q.lease(bad_worker, now=0)
        with self.assertRaises(JobLineError):
            q.enqueue("", {}, now=0)
        self.assertEqual(q.enqueue("email", {}, now=0), "job-1")


class RetryTests(unittest.TestCase):
    def test_first_failure_waits_backoff_base(self):
        q = JobQueue(backoff_base=10, backoff_max=300)
        job_id = q.enqueue("email", {}, now=100)
        q.lease("w1", now=100)
        q.fail(job_id, "w1", "boom", now=100)
        job = q.get(job_id, now=100)
        self.assertEqual((job.state, job.available_at), ("retry_wait", 110))
        self.assertIsNone(q.lease("w1", now=109))
        self.assertEqual(q.get(job_id, now=110).state, "queued")
        again = q.lease("w2", now=110)
        self.assertEqual((again.id, again.attempts), (job_id, 2))

    def test_backoff_doubles_and_is_capped(self):
        q = JobQueue(max_attempts=5, backoff_base=10, backoff_max=50)
        job_id = q.enqueue("email", {}, now=0)
        now = 0
        for ready in (10, 30, 70, 120):  # delays 10, 20, 40, then 80 capped to 50
            q.lease("w1", now=now)
            q.fail(job_id, "w1", "boom", now=now)
            self.assertEqual(q.get(job_id, now=now).available_at, ready)
            self.assertIsNone(q.lease("w1", now=ready - 1))
            now = ready
        self.assertEqual(q.lease("w1", now=120).attempts, 5)
        q.fail(job_id, "w1", "boom", now=120)
        self.assertEqual(q.get(job_id, now=120).state, "dead")

    def test_job_is_dead_after_max_attempts_failures(self):
        q = JobQueue(max_attempts=3, backoff_base=1, backoff_max=1)
        job_id = q.enqueue("report", {}, now=0)
        for attempt, t in enumerate((0, 1, 2), start=1):
            job = q.lease("w1", now=t)
            self.assertEqual((job.id, job.attempts), (job_id, attempt))
            q.fail(job_id, "w1", f"error {attempt}", now=t)
        job = q.get(job_id, now=2)
        self.assertEqual((job.state, job.attempts, job.last_error), ("dead", 3, "error 3"))
        self.assertIsNone(q.lease("w1", now=100))
        self.assertEqual([j.id for j in q.dead_letters(now=100)], [job_id])

    def test_lease_expiring_on_last_attempt_makes_job_dead(self):
        q = JobQueue(visibility_timeout=30, max_attempts=2)
        job_id = q.enqueue("email", {}, now=0)
        q.lease("w1", now=0)
        self.assertEqual(q.lease("w2", now=30).attempts, 2)
        job = q.get(job_id, now=60)
        self.assertEqual((job.state, job.last_error, job.attempts), ("dead", "lease expired", 2))
        with self.assertRaises(InvalidStateError):
            q.ack(job_id, "w2", now=61)
        self.assertEqual([j.id for j in q.dead_letters(now=61)], [job_id])
        self.assertIsNone(q.lease("w3", now=61))

    def test_retried_job_keeps_its_place_in_line(self):
        q = JobQueue(backoff_base=5)
        first = q.enqueue("email", {}, now=0)
        q.lease("w1", now=0)
        q.fail(first, "w1", "boom", now=0)
        second = q.enqueue("email", {}, now=1)
        self.assertEqual(drain(q, "w2", now=5), [first, second])

    def test_dead_letters_are_listed_in_creation_order(self):
        q = JobQueue(visibility_timeout=30, max_attempts=1)
        a = q.enqueue("email", {}, now=0)
        b = q.enqueue("report", {}, now=0)
        c = q.enqueue("email", {}, now=0)
        self.assertEqual(drain(q, "w1", now=0), [a, b, c])
        q.fail(c, "w1", "c broke", now=1)
        q.ack(b, "w1", now=2)
        dead = q.dead_letters(now=40)
        self.assertEqual([j.id for j in dead], [a, c])
        self.assertEqual([j.last_error for j in dead], ["lease expired", "c broke"])
        self.assertEqual([j.state for j in dead], ["dead", "dead"])


class IdempotencyTests(unittest.TestCase):
    def test_same_key_returns_existing_id_while_job_is_active(self):
        q = JobQueue(backoff_base=10)
        key = "welcome:42"
        first = q.enqueue("email", {"n": 1}, now=0, idempotency_key=key)
        self.assertEqual(q.enqueue("email", {"n": 2}, now=1, priority=9, idempotency_key=key), first)
        q.lease("w1", now=2)
        self.assertEqual(q.enqueue("email", {"n": 3}, now=3, idempotency_key=key), first)
        q.fail(first, "w1", "boom", now=4)
        self.assertEqual(q.enqueue("email", {"n": 4}, now=5, idempotency_key=key), first)
        job = q.get(first, now=5)
        self.assertEqual((job.payload, job.priority, job.state, job.idempotency_key), ({"n": 1}, 0, "retry_wait", key))
        self.assertEqual(q.enqueue("email", {}, now=5), "job-2")

    def test_key_is_free_again_after_success_or_death(self):
        q = JobQueue(max_attempts=1)
        key = "report:2026-10-12"
        first = q.enqueue("report", {}, now=0, idempotency_key=key)
        q.lease("w1", now=0)
        q.ack(first, "w1", now=1)
        second = q.enqueue("report", {}, now=2, idempotency_key=key)
        self.assertEqual((first, second), ("job-1", "job-2"))
        self.assertEqual(q.get(second, now=2).idempotency_key, key)
        q.lease("w1", now=2)
        q.fail(second, "w1", "boom", now=3)
        third = q.enqueue("report", {}, now=4, idempotency_key=key)
        self.assertEqual(third, "job-3")
        self.assertEqual(q.enqueue("report", {}, now=5, idempotency_key=key), third)

    def test_keys_are_global_and_none_never_deduplicates(self):
        q = JobQueue()
        a = q.enqueue("email", {}, now=0, idempotency_key="k1")
        self.assertEqual(q.enqueue("report", {}, now=0, idempotency_key="k1"), a)
        self.assertEqual(q.enqueue("email", {}, now=0, idempotency_key="k2"), "job-2")
        self.assertEqual(q.enqueue("email", {}, now=0), "job-3")
        self.assertEqual(q.enqueue("email", {}, now=0, idempotency_key=None), "job-4")

    def test_key_is_released_when_an_expired_lease_kills_the_job(self):
        q = JobQueue(visibility_timeout=30, max_attempts=1)
        first = q.enqueue("email", {}, now=0, idempotency_key="welcome:7")
        q.lease("w1", now=0)
        self.assertEqual(q.enqueue("email", {}, now=29, idempotency_key="welcome:7"), first)
        self.assertEqual(q.enqueue("email", {}, now=30, idempotency_key="welcome:7"), "job-2")
        self.assertEqual(q.get(first, now=30).state, "dead")


class StatsTests(unittest.TestCase):
    def test_stats_counts_every_state_and_applies_due_transitions(self):
        q = JobQueue(visibility_timeout=30, max_attempts=2, backoff_base=10)
        self.assertEqual(q.stats(now=0), ZERO)
        j1, j2, j3, j4, j5 = (q.enqueue("email", {"n": n}, now=0) for n in range(5))
        self.assertEqual(q.lease("w1", now=0).id, j1)
        q.ack(j1, "w1", now=0)
        self.assertEqual(q.lease("w1", now=0).id, j2)
        q.fail(j2, "w1", "boom", now=0)
        self.assertEqual(q.lease("w1", now=0).id, j3)
        self.assertEqual(q.lease("w1", now=10).id, j2)
        q.fail(j2, "w1", "boom", now=10)
        self.assertEqual(q.lease("w1", now=10).id, j4)
        q.fail(j4, "w1", "boom", now=10)
        self.assertEqual(q.stats(now=10), {"queued": 1, "leased": 1, "succeeded": 1, "retry_wait": 1, "dead": 1})
        self.assertEqual(q.stats(now=20), {"queued": 2, "leased": 1, "succeeded": 1, "retry_wait": 0, "dead": 1})
        self.assertEqual(q.stats(now=30), {"queued": 3, "leased": 0, "succeeded": 1, "retry_wait": 0, "dead": 1})


class DelayedJobTests(unittest.TestCase):
    def test_delayed_job_waits_for_run_at(self):
        q = JobQueue()
        job_id = q.enqueue("report", {}, now=0, run_at=100)
        job = q.get(job_id, now=0)
        self.assertEqual((job.state, job.available_at), ("queued", 100))
        self.assertEqual(q.stats(now=0)["queued"], 1)
        self.assertIsNone(q.lease("w1", now=99))
        self.assertEqual(q.lease("w1", now=100).id, job_id)

    def test_delayed_high_priority_job_does_not_block_others(self):
        q = JobQueue(visibility_timeout=1000)
        later = q.enqueue("report", {}, now=0, priority=10, run_at=50)
        first = q.enqueue("email", {}, now=0)
        second = q.enqueue("email", {}, now=0)
        self.assertEqual(q.lease("w1", now=10).id, first)
        self.assertEqual(drain(q, "w1", now=50), [later, second])

    def test_past_run_at_is_available_and_order_stays_by_creation(self):
        q = JobQueue(visibility_timeout=1000)
        past = q.enqueue("email", {}, now=100, run_at=40)
        self.assertEqual(q.lease("w1", now=100).id, past)
        x = q.enqueue("email", {}, now=100, run_at=120)
        y = q.enqueue("email", {}, now=100, run_at=110)
        self.assertEqual(drain(q, "w1", now=115), [y])
        z = q.enqueue("email", {}, now=115, run_at=130)
        w = q.enqueue("email", {}, now=115, run_at=125)
        self.assertEqual(drain(q, "w1", now=130), [x, z, w])


class TypeLimitTests(unittest.TestCase):
    def test_full_type_is_skipped_for_other_types(self):
        q = JobQueue()
        q.set_type_limit("report", 2)
        r1, r2, r3 = (q.enqueue("report", {"n": n}, now=0, priority=5) for n in range(3))
        e1 = q.enqueue("email", {}, now=0)
        self.assertEqual(q.lease("w1", now=0).id, r1)
        self.assertEqual(q.lease("w2", now=0).id, r2)
        self.assertEqual(q.lease("w3", now=0).id, e1)
        self.assertIsNone(q.lease("w4", now=0))
        q.ack(r1, "w1", now=1)
        self.assertEqual(q.lease("w4", now=1).id, r3)

    def test_expiry_and_fail_free_slots_and_none_removes_the_limit(self):
        q = JobQueue(visibility_timeout=30, backoff_base=10)
        q.set_type_limit("report", 1)
        a = q.enqueue("report", {}, now=0)
        b = q.enqueue("report", {}, now=0)
        self.assertEqual(q.lease("w1", now=0).id, a)
        self.assertIsNone(q.lease("w2", now=29))
        self.assertEqual(q.lease("w2", now=30).id, a)
        q.fail(a, "w2", "boom", now=31)
        self.assertEqual(q.lease("w3", now=31).id, b)
        q.set_type_limit("report", None)
        c = q.enqueue("report", {}, now=31)
        self.assertEqual(q.lease("w4", now=31).id, c)

    def test_lowering_a_limit_keeps_existing_leases_and_bad_limits_are_rejected(self):
        q = JobQueue()
        ids = [q.enqueue("email", {"n": n}, now=0) for n in range(3)]
        q.lease("w1", now=0)
        q.lease("w2", now=0)
        q.set_type_limit("email", 1)
        self.assertIsNone(q.lease("w3", now=1))
        self.assertEqual([q.get(i, now=1).state for i in ids[:2]], ["leased", "leased"])
        q.ack(ids[0], "w1", now=2)
        self.assertIsNone(q.lease("w3", now=2))
        q.ack(ids[1], "w2", now=3)
        self.assertEqual(q.lease("w3", now=3).id, ids[2])
        for bad in (0, -1, 1.5, "2"):
            with self.assertRaises(ValidationError):
                q.set_type_limit("email", bad)


class RequeueTests(unittest.TestCase):
    def test_requeued_job_gets_fresh_attempts_and_keeps_its_place(self):
        q = JobQueue(max_attempts=2, backoff_base=10)
        job_id = q.enqueue("email", {}, now=0)
        other = q.enqueue("email", {}, now=0)
        q.lease("w1", now=0)
        q.fail(job_id, "w1", "e1", now=0)
        self.assertEqual(q.lease("w1", now=10).id, job_id)
        q.fail(job_id, "w1", "e2", now=10)
        self.assertEqual(q.get(job_id, now=10).state, "dead")

        q.requeue_dead(job_id, now=20)
        job = q.get(job_id, now=20)
        self.assertEqual((job.state, job.attempts, job.last_error, job.available_at), ("queued", 0, "e2", 20))
        self.assertEqual(q.dead_letters(now=20), [])
        self.assertEqual(q.lease("w1", now=20).id, job_id)
        q.fail(job_id, "w1", "e3", now=20)
        job = q.get(job_id, now=20)
        self.assertEqual((job.state, job.available_at), ("retry_wait", 30))
        self.assertEqual(q.lease("w1", now=21).id, other)

    def test_requeue_rejects_unknown_and_non_dead_jobs(self):
        q = JobQueue(max_attempts=1)
        job_id = q.enqueue("email", {}, now=0)
        with self.assertRaises(JobNotFoundError):
            q.requeue_dead("job-99", now=0)
        with self.assertRaises(InvalidStateError):
            q.requeue_dead(job_id, now=0)
        q.lease("w1", now=0)
        with self.assertRaises(InvalidStateError):
            q.requeue_dead(job_id, now=1)
        q.ack(job_id, "w1", now=1)
        with self.assertRaises(InvalidStateError):
            q.requeue_dead(job_id, now=2)
        self.assertEqual(q.get(job_id, now=2).state, "succeeded")

    def test_requeue_respects_idempotency_keys(self):
        q = JobQueue(max_attempts=1)
        key = "welcome:7"
        dead = q.enqueue("email", {}, now=0, idempotency_key=key)
        q.lease("w1", now=0)
        q.fail(dead, "w1", "boom", now=0)
        replacement = q.enqueue("email", {}, now=1, idempotency_key=key)
        self.assertEqual(replacement, "job-2")
        with self.assertRaises(InvalidStateError):
            q.requeue_dead(dead, now=2)
        self.assertEqual(q.get(dead, now=2).state, "dead")
        self.assertEqual([j.id for j in q.dead_letters(now=2)], [dead])
        self.assertEqual(q.lease("w1", now=2).id, replacement)
        q.ack(replacement, "w1", now=3)
        q.requeue_dead(dead, now=4)
        self.assertEqual(q.get(dead, now=4).state, "queued")
        self.assertEqual(q.enqueue("email", {}, now=5, idempotency_key=key), dead)


if __name__ == "__main__":
    unittest.main()
