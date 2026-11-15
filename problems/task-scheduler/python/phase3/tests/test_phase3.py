import time
import unittest

from foundry.graph import DependencyGraph, load_pipeline
from foundry.scheduler import schedule
from tests.generator import fingerprint, generate_pipeline

# Test shards fan out from build and fan back in to report.
SHARDS = """
build:
  duration: 3
docs:
  duration: 5
lint:
  duration: 2
test-api:
  duration: 4
  after: build
test-ui:
  duration: 4
  after: build
test-db:
  duration: 2
  after: build
test-cli:
  duration: 1
  after: build
test-e2e:
  duration: 6
  after: build, lint
report:
  duration: 1
  after: [test-api, test-ui, test-db, test-cli, test-e2e]
publish:
  duration: 2
  after: report, docs
"""


def assert_valid_schedule(test, graph, plan, workers):
    """One slot per task, right lengths, dependencies first, no runner double-booked."""
    test.assertEqual(plan.workers, workers)
    test.assertEqual(len(plan.slots), len(graph), "every task must be scheduled exactly once")
    test.assertEqual({slot.task for slot in plan.slots}, set(graph.names))
    by_worker = {}
    for slot in plan.slots:
        task = graph[slot.task]
        test.assertTrue(0 <= slot.worker < workers, f"{slot.task} is on runner {slot.worker}")
        test.assertEqual(slot.end - slot.start, task.duration, f"{slot.task} has the wrong length")
        for dep in task.deps:
            test.assertGreaterEqual(slot.start, plan.slot_for(dep).end,
                                    f"{slot.task} started before {dep} finished")
        by_worker.setdefault(slot.worker, []).append(slot)
    for worker, slots in by_worker.items():
        slots.sort(key=lambda s: s.start)
        for a, b in zip(slots, slots[1:]):
            test.assertLessEqual(a.end, b.start, f"runner {worker} runs {a.task} and {b.task} at once")


class ScaleTests(unittest.TestCase):
    def test_test_shards_fan_out_and_back_in(self):
        graph = load_pipeline(SHARDS)
        plan = schedule(graph, 3)
        assert_valid_schedule(self, graph, plan, 3)
        self.assertEqual({s.task: (s.worker, s.start, s.end) for s in plan.slots}, {
            "build": (0, 0, 3), "lint": (1, 0, 2), "docs": (2, 0, 5), "test-e2e": (0, 3, 9),
            "test-api": (1, 3, 7), "test-ui": (2, 5, 9), "test-db": (1, 7, 9), "test-cli": (0, 9, 10),
            "report": (0, 10, 11), "publish": (0, 11, 13)})

    def test_generated_pipeline_matches_reference(self):
        tasks = generate_pipeline(11, 600, window=30)
        graph = DependencyGraph(tasks)
        plan = schedule(graph, 5)
        assert_valid_schedule(self, graph, plan, 5)
        self.assertEqual(plan.makespan, 1289)
        self.assertEqual(tuple(plan.slot_for("lint-7")), ("lint-7", 1, 31, 41))
        self.assertEqual(fingerprint(tasks, plan), 143128735, "the schedule differs from the reference")

    def test_wide_pipeline_matches_reference(self):
        tasks = generate_pipeline(23, 2000, window=400)
        graph = DependencyGraph(tasks)
        plan = schedule(graph, 12)
        assert_valid_schedule(self, graph, plan, 12)
        self.assertEqual(plan.makespan, 1745)
        self.assertEqual(tuple(plan.slot_for("scan-1999")), ("scan-1999", 4, 1654, 1663))
        self.assertEqual(fingerprint(tasks, plan), 829942898, "the schedule differs from the reference")

    def test_monorepo_pipeline_is_fast(self):
        tasks = generate_pipeline(2026, 4000, window=48)
        graph = DependencyGraph(tasks)
        start = time.perf_counter()
        plan = schedule(graph, 16)
        elapsed = time.perf_counter() - start
        assert_valid_schedule(self, graph, plan, 16)
        self.assertEqual(plan.makespan, 2701)
        self.assertEqual(fingerprint(tasks, plan), 1728189514, "the schedule differs from the reference")
        self.assertLess(elapsed, 0.4, f"took {elapsed:.2f}s; 4,000 tasks on 16 runners must schedule in under 0.4s")


if __name__ == "__main__":
    unittest.main()
