import unittest

from foundry.graph import CycleError, load_pipeline
from foundry.parser import PipelineSyntaxError, parse_pipeline
from foundry.samples import MOBILE_RELEASE, WEB_APP
from foundry.scheduler import serial_schedule
from foundry.task import PipelineError, Task
from foundry.timeline import render_gantt

RELEASE = """
build:
  duration: 4
  resource: linux
test:
  duration: 3
  after: build
release:
  duration: 1
  after: [build, test]
"""

NIGHTLY = """
# nightly docs job
lint:              # fast
  duration: 1      # minutes

docs:
  duration: 2
  after:
    - lint
  resource: docs-runner

archive:
  duration: 1
  after: docs
"""

DIAMOND = """
checkout:
  duration: 1
build:
  duration: 3
  after: checkout
docs:
  duration: 2
  after: checkout
bundle:
  duration: 1
  after: build, docs
"""

LOOP = """
a:
  duration: 1
  after: c
b:
  duration: 1
  after: a
c:
  duration: 1
  after: b
"""


def summary(tasks):
    return [(t.name, t.duration, t.deps, t.resource) for t in tasks]


def assert_respects_dependencies(test, graph, plan):
    for task in graph:
        slot = plan.slot_for(task.name)
        test.assertEqual(slot.end - slot.start, task.duration, f"{task.name} has the wrong length")
        for dep in task.deps:
            test.assertGreaterEqual(slot.start, plan.slot_for(dep).end,
                                    f"{task.name} started at {slot.start}, before {dep} finished")


class ParserTests(unittest.TestCase):
    def test_settings_and_inline_lists(self):
        self.assertEqual(summary(parse_pipeline(RELEASE)), [
            ("build", 4, (), "linux"),
            ("test", 3, ("build",), None),
            ("release", 1, ("build", "test"), None),
        ])

    def test_comments_blank_lines_and_block_lists(self):
        self.assertEqual(summary(parse_pipeline(NIGHTLY)), [
            ("lint", 1, (), None),
            ("docs", 2, ("lint",), "docs-runner"),
            ("archive", 1, ("docs",), None),
        ])

    def test_web_app_is_read_as_written(self):
        tasks = {t.name: t for t in parse_pipeline(WEB_APP)}
        self.assertEqual(len(tasks), 8)
        self.assertEqual(tasks["e2e-tests"], Task("e2e-tests", 6, ("compile", "seed-db"), "chrome"))
        self.assertEqual(tasks["deploy"].deps, ("package", "e2e-tests"))

    def test_mobile_release_is_read_as_written(self):
        self.assertEqual(summary(parse_pipeline(MOBILE_RELEASE)), [
            ("fetch-deps", 2, (), None),
            ("build-android", 6, ("fetch-deps",), "linux"),
            ("build-ios", 8, ("fetch-deps",), "macos"),
            ("unit-tests", 4, ("fetch-deps",), None),
            ("ui-tests", 9, ("build-android", "build-ios"), "macos"),
            ("sign-apk", 1, ("build-android",), None),
            ("sign-ipa", 2, ("build-ios",), "macos"),
            ("publish", 2, ("sign-apk", "sign-ipa", "ui-tests", "unit-tests"), None),
        ])

    def test_syntax_errors_report_the_line(self):
        cases = [
            ("build:\n  duraton: 4\n", 2),
            ("  duration: 4\n", 1),
            ("build:\n  duration: 4\n  - lint\n", 3),
            ("lint:\n  duration: 1\nbuild:\n  duration: four\n", 3),
        ]
        for text, line in cases:
            with self.subTest(text=text):
                with self.assertRaises(PipelineSyntaxError) as ctx:
                    parse_pipeline(text)
                self.assertEqual(ctx.exception.lineno, line)


class GraphTests(unittest.TestCase):
    def test_unknown_dependency_is_rejected(self):
        with self.assertRaises(PipelineError) as ctx:
            load_pipeline("build:\n  duration: 1\n  after: compile\n")
        self.assertIn("compile", str(ctx.exception))

    def test_cycle_error_shows_the_loop(self):
        with self.assertRaises(CycleError) as ctx:
            load_pipeline(LOOP)
        cycle = ctx.exception.cycle
        self.assertEqual(cycle[0], cycle[-1], "a cycle ends where it starts")
        self.assertEqual(sorted(cycle[:-1]), ["a", "b", "c"])
        self.assertIn(" -> ".join(cycle), str(ctx.exception))

    def test_diamond_is_not_a_cycle(self):
        graph = load_pipeline(DIAMOND)
        order = graph.topological_order()
        self.assertEqual(order[0], "checkout")
        self.assertEqual(order[-1], "bundle")

    def test_dependencies_may_be_defined_later(self):
        graph = load_pipeline("ship:\n  duration: 1\n  after: build\nbuild:\n  duration: 2\n")
        self.assertEqual(graph.topological_order(), ["build", "ship"])

    def test_web_app_topological_order(self):
        self.assertEqual(load_pipeline(WEB_APP).topological_order(), [
            "install", "seed-db", "compile", "lint", "unit-tests", "e2e-tests", "package", "deploy"])


class PlanTests(unittest.TestCase):
    def test_web_app_serial_plan_respects_dependencies(self):
        graph = load_pipeline(WEB_APP)
        plan = serial_schedule(graph)
        assert_respects_dependencies(self, graph, plan)
        self.assertEqual(plan.makespan, 26)

    def test_mobile_release_serial_plan_respects_dependencies(self):
        graph = load_pipeline(MOBILE_RELEASE)
        plan = serial_schedule(graph)
        assert_respects_dependencies(self, graph, plan)
        publish = plan.slot_for("publish")
        for dep in ("sign-apk", "sign-ipa", "ui-tests", "unit-tests"):
            self.assertGreaterEqual(publish.start, plan.slot_for(dep).end,
                                    f"publish started at {publish.start}, before {dep} finished")
        self.assertEqual(publish.end, 34, "publish must be the last step")

    def test_web_app_critical_path(self):
        self.assertEqual(load_pipeline(WEB_APP).critical_path(),
                         (16, ["install", "compile", "unit-tests", "package", "deploy"]))

    def test_mobile_release_critical_path(self):
        self.assertEqual(load_pipeline(MOBILE_RELEASE).critical_path(),
                         (21, ["fetch-deps", "build-ios", "ui-tests", "publish"]))

    def test_gantt_chart_rows(self):
        graph = load_pipeline(RELEASE)
        chart = render_gantt(serial_schedule(graph), graph).splitlines()
        self.assertEqual(len(chart), 5, "axis, one row per task, summary")
        self.assertEqual(chart[1], "build    r0   |====    | 0-4  [linux]")
        self.assertEqual(chart[3], "release  r0   |       =| 7-8")
        self.assertIn("makespan 8 min", chart[-1])


if __name__ == "__main__":
    unittest.main()
