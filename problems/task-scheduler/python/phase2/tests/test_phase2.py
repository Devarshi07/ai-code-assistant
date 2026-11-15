import unittest

from foundry.graph import load_pipeline
from foundry.samples import MOBILE_RELEASE, WEB_APP
from foundry.scheduler import schedule

# Duration-first would start lint and docs; the setup -> build -> bundle chain
# is longer, so it must start first.
CHAIN_FIRST = """
setup:
  duration: 1
build:
  duration: 2
  after: setup
bundle:
  duration: 6
  after: build
lint:
  duration: 5
docs:
  duration: 4
"""

# alpha, bravo and charlie all have a remaining path of 4 minutes.
TIES = """
charlie:
  duration: 4
bravo:
  duration: 4
zulu:
  duration: 2
  after: alpha
alpha:
  duration: 2
"""

# api and web finish at the same minute.
SIMULTANEOUS = """
notify:
  duration: 1
web:
  duration: 2
api:
  duration: 2
integration:
  duration: 5
  after: api, web
"""

# Runners free up in different orders; the lowest-numbered idle one is used.
RUNNER_CHOICE = """
build:
  duration: 3
test:
  duration: 7
  after: build
ship:
  duration: 2
  after: test
lint:
  duration: 1
docs:
  duration: 9
report:
  duration: 12
  after: docs, lint
"""


def table(plan):
    return {slot.task: (slot.worker, slot.start, slot.end) for slot in plan.slots}


def assert_valid_schedule(test, graph, plan, workers):
    """One slot per task, right lengths, dependencies first, no runner double-booked."""
    test.assertEqual(plan.workers, workers)
    test.assertEqual(sorted(slot.task for slot in plan.slots), sorted(graph.names),
                     "every task must be scheduled exactly once")
    by_worker = {}
    for slot in plan.slots:
        task = graph[slot.task]
        test.assertTrue(0 <= slot.worker < workers, f"{slot.task} is on runner {slot.worker}")
        test.assertGreaterEqual(slot.start, 0)
        test.assertEqual(slot.end - slot.start, task.duration, f"{slot.task} has the wrong length")
        for dep in task.deps:
            test.assertGreaterEqual(slot.start, plan.slot_for(dep).end,
                                    f"{slot.task} started before {dep} finished")
        by_worker.setdefault(slot.worker, []).append(slot)
    for worker, slots in by_worker.items():
        slots.sort(key=lambda s: s.start)
        for a, b in zip(slots, slots[1:]):
            test.assertLessEqual(a.end, b.start, f"runner {worker} runs {a.task} and {b.task} at once")
    test.assertEqual(plan.makespan, max((slot.end for slot in plan.slots), default=0))


class ScheduleTests(unittest.TestCase):
    def check(self, text, workers, expected):
        graph = load_pipeline(text)
        plan = schedule(graph, workers)
        assert_valid_schedule(self, graph, plan, workers)
        self.assertEqual(table(plan), expected)
        return plan

    def test_single_runner_follows_priority(self):
        plan = self.check(WEB_APP, 1, {
            "install": (0, 0, 2), "compile": (0, 2, 6), "seed-db": (0, 6, 9), "unit-tests": (0, 9, 14),
            "e2e-tests": (0, 14, 20), "lint": (0, 20, 21), "package": (0, 21, 23), "deploy": (0, 23, 26)})
        self.assertEqual(plan.makespan, 26)

    def test_long_chains_start_first(self):
        plan = self.check(CHAIN_FIRST, 2, {
            "setup": (0, 0, 1), "lint": (1, 0, 5), "build": (0, 1, 3), "bundle": (0, 3, 9), "docs": (1, 5, 9)})
        self.assertEqual(plan.makespan, 9)

    def test_ties_go_to_the_alphabetically_first_name(self):
        self.check(TIES, 2, {"alpha": (0, 0, 2), "bravo": (1, 0, 4), "charlie": (0, 2, 6), "zulu": (1, 4, 6)})

    def test_everything_finishing_together_is_released_first(self):
        self.check(SIMULTANEOUS, 2, {
            "api": (0, 0, 2), "web": (1, 0, 2), "integration": (0, 2, 7), "notify": (1, 2, 3)})

    def test_lowest_numbered_idle_runner_is_used(self):
        self.check(RUNNER_CHOICE, 3, {
            "docs": (0, 0, 9), "lint": (1, 0, 1), "build": (2, 0, 3), "test": (1, 3, 10),
            "report": (0, 9, 21), "ship": (1, 10, 12)})

    def test_web_app_on_three_runners(self):
        plan = self.check(WEB_APP, 3, {
            "install": (0, 0, 2), "seed-db": (1, 0, 3), "compile": (0, 2, 6), "lint": (2, 2, 3),
            "unit-tests": (0, 6, 11), "e2e-tests": (1, 6, 12), "package": (0, 11, 13), "deploy": (0, 13, 16)})
        self.assertEqual(plan.makespan, 16)

    def test_mobile_release_on_two_runners(self):
        plan = self.check(MOBILE_RELEASE, 2, {
            "fetch-deps": (0, 0, 2), "build-ios": (0, 2, 10), "build-android": (1, 2, 8),
            "unit-tests": (1, 8, 12), "ui-tests": (0, 10, 19), "sign-ipa": (1, 12, 14),
            "sign-apk": (1, 14, 15), "publish": (0, 19, 21)})
        self.assertEqual(plan.makespan, 21)

    def test_plenty_of_runners_reaches_the_critical_path(self):
        for text in (WEB_APP, MOBILE_RELEASE):
            graph = load_pipeline(text)
            plan = schedule(graph, 20)
            assert_valid_schedule(self, graph, plan, 20)
            self.assertEqual(plan.makespan, graph.critical_path()[0])

    def test_empty_pipeline(self):
        plan = schedule(load_pipeline("# nothing here yet\n"), 4)
        self.assertEqual(len(plan.slots), 0)
        self.assertEqual(plan.makespan, 0)

    def test_needs_at_least_one_runner(self):
        with self.assertRaises(ValueError):
            schedule(load_pipeline(WEB_APP), 0)


if __name__ == "__main__":
    unittest.main()
