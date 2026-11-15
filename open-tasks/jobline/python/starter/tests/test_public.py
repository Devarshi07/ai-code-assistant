import unittest

from jobline import JobQueue


class PublicTests(unittest.TestCase):
    def test_enqueue_returns_sequential_ids(self):
        q = JobQueue()
        self.assertEqual(q.enqueue("email", {"to": "ana@example.com"}, now=0), "job-1")
        self.assertEqual(q.enqueue("report", {"day": "2026-10-12"}, now=0), "job-2")

    def test_new_job_is_queued(self):
        q = JobQueue()
        job_id = q.enqueue("email", {"to": "ana@example.com"}, now=5, priority=2)
        job = q.get(job_id, now=5)
        self.assertEqual(job.state, "queued")
        self.assertEqual(job.type, "email")
        self.assertEqual(job.payload, {"to": "ana@example.com"})
        self.assertEqual(job.priority, 2)
        self.assertEqual(job.attempts, 0)

    def test_higher_priority_is_leased_first(self):
        q = JobQueue()
        low = q.enqueue("report", {}, now=0, priority=1)
        high = q.enqueue("email", {}, now=0, priority=5)
        self.assertEqual(q.lease("w1", now=1).id, high)
        self.assertEqual(q.lease("w1", now=1).id, low)

    def test_same_priority_is_first_in_first_out(self):
        q = JobQueue()
        first = q.enqueue("email", {"n": 1}, now=0)
        second = q.enqueue("email", {"n": 2}, now=1)
        self.assertEqual(q.lease("w1", now=2).id, first)
        self.assertEqual(q.lease("w2", now=2).id, second)

    def test_lease_sets_holder_and_expiry(self):
        q = JobQueue(visibility_timeout=30)
        job_id = q.enqueue("email", {}, now=0)
        job = q.lease("w1", now=10)
        self.assertEqual(job.id, job_id)
        self.assertEqual(job.state, "leased")
        self.assertEqual(job.worker_id, "w1")
        self.assertEqual(job.lease_expires_at, 40)
        self.assertEqual(job.attempts, 1)

    def test_lease_returns_none_when_nothing_is_queued(self):
        q = JobQueue()
        self.assertIsNone(q.lease("w1", now=0))

    def test_ack_marks_job_succeeded(self):
        q = JobQueue()
        job_id = q.enqueue("email", {}, now=0)
        q.lease("w1", now=1)
        q.ack(job_id, "w1", now=2)
        self.assertEqual(q.get(job_id, now=2).state, "succeeded")


if __name__ == "__main__":
    unittest.main()
