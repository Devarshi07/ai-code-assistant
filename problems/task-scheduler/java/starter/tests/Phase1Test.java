package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import foundry.CycleError;
import foundry.DependencyGraph;
import foundry.Gantt;
import foundry.Parser;
import foundry.PipelineError;
import foundry.PipelineSyntaxError;
import foundry.Samples;
import foundry.Schedule;
import foundry.Scheduler;
import foundry.Slot;
import foundry.Task;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class Phase1Test {
    static final String RELEASE = """
            build:
              duration: 4
              resource: linux
            test:
              duration: 3
              after: build
            release:
              duration: 1
              after: [build, test]
            """;

    static final String NIGHTLY = """
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
            """;

    static final String DIAMOND = """
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
            """;

    static final String LOOP = """
            a:
              duration: 1
              after: c
            b:
              duration: 1
              after: a
            c:
              duration: 1
              after: b
            """;

    /** Each task as [name, duration, deps, resource]. */
    static List<List<Object>> summary(List<Task> tasks) {
        List<List<Object>> rows = new ArrayList<>();
        for (Task t : tasks) rows.add(Arrays.asList(t.name(), t.duration(), t.deps(), t.resource()));
        return rows;
    }

    static List<Object> row(String name, int duration, List<String> deps, String resource) {
        return Arrays.asList(name, duration, deps, resource);
    }

    static void assertRespectsDependencies(DependencyGraph graph, Schedule plan) {
        for (Task task : graph) {
            Slot slot = plan.slotFor(task.name());
            assertEquals(task.duration(), slot.end() - slot.start(), task.name() + " has the wrong length");
            for (String dep : task.deps()) {
                assertTrue(slot.start() >= plan.slotFor(dep).end(),
                        task.name() + " started at " + slot.start() + ", before " + dep + " finished");
            }
        }
    }

    @Test
    void settingsAndInlineLists() {
        assertEquals(List.of(
                row("build", 4, List.of(), "linux"),
                row("test", 3, List.of("build"), null),
                row("release", 1, List.of("build", "test"), null)), summary(Parser.parsePipeline(RELEASE)));
    }

    @Test
    void commentsBlankLinesAndBlockLists() {
        assertEquals(List.of(
                row("lint", 1, List.of(), null),
                row("docs", 2, List.of("lint"), "docs-runner"),
                row("archive", 1, List.of("docs"), null)), summary(Parser.parsePipeline(NIGHTLY)));
    }

    @Test
    void webAppIsReadAsWritten() {
        Map<String, Task> tasks = Parser.parsePipeline(Samples.WEB_APP).stream()
                .collect(Collectors.toMap(Task::name, t -> t));
        assertEquals(8, tasks.size());
        assertEquals(List.of(row("e2e-tests", 6, List.of("compile", "seed-db"), "chrome")),
                summary(List.of(tasks.get("e2e-tests"))));
        assertEquals(List.of("package", "e2e-tests"), tasks.get("deploy").deps());
    }

    @Test
    void mobileReleaseIsReadAsWritten() {
        assertEquals(List.of(
                row("fetch-deps", 2, List.of(), null),
                row("build-android", 6, List.of("fetch-deps"), "linux"),
                row("build-ios", 8, List.of("fetch-deps"), "macos"),
                row("unit-tests", 4, List.of("fetch-deps"), null),
                row("ui-tests", 9, List.of("build-android", "build-ios"), "macos"),
                row("sign-apk", 1, List.of("build-android"), null),
                row("sign-ipa", 2, List.of("build-ios"), "macos"),
                row("publish", 2, List.of("sign-apk", "sign-ipa", "ui-tests", "unit-tests"), null)),
                summary(Parser.parsePipeline(Samples.MOBILE_RELEASE)));
    }

    @Test
    void syntaxErrorsReportTheLine() {
        String[] texts = {
            "build:\n  duraton: 4\n",
            "  duration: 4\n",
            "build:\n  duration: 4\n  - lint\n",
            "lint:\n  duration: 1\nbuild:\n  duration: four\n",
        };
        int[] lines = {2, 1, 3, 3};
        for (int i = 0; i < texts.length; i++) {
            String text = texts[i];
            PipelineSyntaxError error = assertThrows(PipelineSyntaxError.class, () -> Parser.parsePipeline(text),
                    "expected a syntax error for " + text);
            assertEquals(lines[i], error.lineno(), "expected a syntax error on line " + lines[i] + " for " + text);
        }
    }

    @Test
    void unknownDependencyIsRejected() {
        PipelineError error = assertThrows(PipelineError.class,
                () -> DependencyGraph.load("build:\n  duration: 1\n  after: compile\n"));
        assertTrue(error.getMessage().contains("compile"), error.getMessage());
    }

    @Test
    void cycleErrorShowsTheLoop() {
        CycleError caught = assertThrows(CycleError.class, () -> DependencyGraph.load(LOOP));
        List<String> cycle = caught.cycle();
        assertEquals(cycle.get(0), cycle.get(cycle.size() - 1), "a cycle ends where it starts");
        assertEquals(List.of("a", "b", "c"), cycle.subList(0, cycle.size() - 1).stream().sorted().toList());
        assertTrue(caught.getMessage().contains(String.join(" -> ", cycle)), caught.getMessage());
    }

    @Test
    void diamondIsNotACycle() {
        List<String> order = DependencyGraph.load(DIAMOND).topologicalOrder();
        assertEquals("checkout", order.get(0));
        assertEquals("bundle", order.get(order.size() - 1));
    }

    @Test
    void dependenciesMayBeDefinedLater() {
        DependencyGraph graph = DependencyGraph.load("ship:\n  duration: 1\n  after: build\nbuild:\n  duration: 2\n");
        assertEquals(List.of("build", "ship"), graph.topologicalOrder());
    }

    @Test
    void webAppTopologicalOrder() {
        assertEquals(List.of("install", "seed-db", "compile", "lint", "unit-tests", "e2e-tests", "package", "deploy"),
                DependencyGraph.load(Samples.WEB_APP).topologicalOrder());
    }

    @Test
    void webAppSerialPlanRespectsDependencies() {
        DependencyGraph graph = DependencyGraph.load(Samples.WEB_APP);
        Schedule plan = Scheduler.serialSchedule(graph);
        assertRespectsDependencies(graph, plan);
        assertEquals(26, plan.makespan());
    }

    @Test
    void mobileReleaseSerialPlanRespectsDependencies() {
        DependencyGraph graph = DependencyGraph.load(Samples.MOBILE_RELEASE);
        Schedule plan = Scheduler.serialSchedule(graph);
        assertRespectsDependencies(graph, plan);
        Slot publish = plan.slotFor("publish");
        for (String dep : List.of("sign-apk", "sign-ipa", "ui-tests", "unit-tests")) {
            assertTrue(publish.start() >= plan.slotFor(dep).end(),
                    "publish started at " + publish.start() + ", before " + dep + " finished");
        }
        assertEquals(34, publish.end(), "publish must be the last step");
    }

    @Test
    void webAppCriticalPath() {
        assertEquals(new DependencyGraph.CriticalPath(16, List.of("install", "compile", "unit-tests", "package", "deploy")),
                DependencyGraph.load(Samples.WEB_APP).criticalPath());
    }

    @Test
    void mobileReleaseCriticalPath() {
        assertEquals(new DependencyGraph.CriticalPath(21, List.of("fetch-deps", "build-ios", "ui-tests", "publish")),
                DependencyGraph.load(Samples.MOBILE_RELEASE).criticalPath());
    }

    @Test
    void ganttChartRows() {
        DependencyGraph graph = DependencyGraph.load(RELEASE);
        String[] chart = Gantt.render(Scheduler.serialSchedule(graph), graph).split("\n");
        assertEquals(5, chart.length, "axis, one row per task, summary");
        assertEquals("build    r0   |====    | 0-4  [linux]", chart[1]);
        assertEquals("release  r0   |       =| 7-8", chart[3]);
        assertTrue(chart[chart.length - 1].contains("makespan 8 min"));
    }
}
