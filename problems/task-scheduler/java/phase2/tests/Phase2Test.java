package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import foundry.DependencyGraph;
import foundry.Samples;
import foundry.Schedule;
import foundry.Scheduler;
import foundry.Slot;
import foundry.Task;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class Phase2Test {
    // Duration-first would start lint and docs; the setup -> build -> bundle chain
    // is longer, so it must start first.
    static final String CHAIN_FIRST = """
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
            """;

    // alpha, bravo and charlie all have a remaining path of 4 minutes.
    static final String TIES = """
            charlie:
              duration: 4
            bravo:
              duration: 4
            zulu:
              duration: 2
              after: alpha
            alpha:
              duration: 2
            """;

    // api and web finish at the same minute.
    static final String SIMULTANEOUS = """
            notify:
              duration: 1
            web:
              duration: 2
            api:
              duration: 2
            integration:
              duration: 5
              after: api, web
            """;

    // Runners free up in different orders; the lowest-numbered idle one is used.
    static final String RUNNER_CHOICE = """
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
            """;

    static List<Integer> w(int worker, int start, int end) {
        return List.of(worker, start, end);
    }

    /** Task name to [runner, start, end]. */
    static Map<String, List<Integer>> table(Schedule plan) {
        Map<String, List<Integer>> out = new HashMap<>();
        for (Slot s : plan.slots()) out.put(s.task(), w(s.worker(), s.start(), s.end()));
        return out;
    }

    /** One slot per task, right lengths, dependencies first, no runner double-booked. */
    static void assertValidSchedule(DependencyGraph graph, Schedule plan, int workers) {
        assertEquals(workers, plan.workers());
        assertEquals(graph.names().stream().sorted().toList(),
                plan.slots().stream().map(Slot::task).sorted().toList(), "every task must be scheduled exactly once");
        Map<Integer, List<Slot>> byWorker = new HashMap<>();
        for (Slot s : plan.slots()) {
            Task task = graph.get(s.task());
            assertTrue(s.worker() >= 0 && s.worker() < workers, s.task() + " is on runner " + s.worker());
            assertTrue(s.start() >= 0, s.task() + " starts before minute 0");
            assertEquals(task.duration(), s.end() - s.start(), s.task() + " has the wrong length");
            for (String dep : task.deps()) {
                assertTrue(s.start() >= plan.slotFor(dep).end(), s.task() + " started before " + dep + " finished");
            }
            byWorker.computeIfAbsent(s.worker(), k -> new ArrayList<>()).add(s);
        }
        for (Map.Entry<Integer, List<Slot>> entry : byWorker.entrySet()) {
            List<Slot> slots = new ArrayList<>(entry.getValue());
            slots.sort(Comparator.comparingInt(Slot::start));
            for (int i = 1; i < slots.size(); i++) {
                assertTrue(slots.get(i - 1).end() <= slots.get(i).start(),
                        "runner " + entry.getKey() + " runs " + slots.get(i - 1).task() + " and " + slots.get(i).task() + " at once");
            }
        }
        assertEquals(plan.slots().stream().mapToInt(Slot::end).max().orElse(0), plan.makespan());
    }

    static Schedule check(String text, int workers, Map<String, List<Integer>> expected) {
        DependencyGraph graph = DependencyGraph.load(text);
        Schedule plan = Scheduler.schedule(graph, workers);
        assertValidSchedule(graph, plan, workers);
        assertEquals(expected, table(plan));
        return plan;
    }

    @Test
    void singleRunnerFollowsPriority() {
        Schedule plan = check(Samples.WEB_APP, 1, Map.of(
                "install", w(0, 0, 2), "compile", w(0, 2, 6), "seed-db", w(0, 6, 9), "unit-tests", w(0, 9, 14),
                "e2e-tests", w(0, 14, 20), "lint", w(0, 20, 21), "package", w(0, 21, 23), "deploy", w(0, 23, 26)));
        assertEquals(26, plan.makespan());
    }

    @Test
    void longChainsStartFirst() {
        Schedule plan = check(CHAIN_FIRST, 2, Map.of(
                "setup", w(0, 0, 1), "lint", w(1, 0, 5), "build", w(0, 1, 3), "bundle", w(0, 3, 9), "docs", w(1, 5, 9)));
        assertEquals(9, plan.makespan());
    }

    @Test
    void tiesGoToTheAlphabeticallyFirstName() {
        check(TIES, 2, Map.of("alpha", w(0, 0, 2), "bravo", w(1, 0, 4), "charlie", w(0, 2, 6), "zulu", w(1, 4, 6)));
    }

    @Test
    void everythingFinishingTogetherIsReleasedFirst() {
        check(SIMULTANEOUS, 2, Map.of(
                "api", w(0, 0, 2), "web", w(1, 0, 2), "integration", w(0, 2, 7), "notify", w(1, 2, 3)));
    }

    @Test
    void lowestNumberedIdleRunnerIsUsed() {
        check(RUNNER_CHOICE, 3, Map.of(
                "docs", w(0, 0, 9), "lint", w(1, 0, 1), "build", w(2, 0, 3), "test", w(1, 3, 10),
                "report", w(0, 9, 21), "ship", w(1, 10, 12)));
    }

    @Test
    void webAppOnThreeRunners() {
        Schedule plan = check(Samples.WEB_APP, 3, Map.of(
                "install", w(0, 0, 2), "seed-db", w(1, 0, 3), "compile", w(0, 2, 6), "lint", w(2, 2, 3),
                "unit-tests", w(0, 6, 11), "e2e-tests", w(1, 6, 12), "package", w(0, 11, 13), "deploy", w(0, 13, 16)));
        assertEquals(16, plan.makespan());
    }

    @Test
    void mobileReleaseOnTwoRunners() {
        Schedule plan = check(Samples.MOBILE_RELEASE, 2, Map.of(
                "fetch-deps", w(0, 0, 2), "build-ios", w(0, 2, 10), "build-android", w(1, 2, 8), "unit-tests", w(1, 8, 12),
                "ui-tests", w(0, 10, 19), "sign-ipa", w(1, 12, 14), "sign-apk", w(1, 14, 15), "publish", w(0, 19, 21)));
        assertEquals(21, plan.makespan());
    }

    @Test
    void plentyOfRunnersReachesTheCriticalPath() {
        for (String text : List.of(Samples.WEB_APP, Samples.MOBILE_RELEASE)) {
            DependencyGraph graph = DependencyGraph.load(text);
            Schedule plan = Scheduler.schedule(graph, 20);
            assertValidSchedule(graph, plan, 20);
            assertEquals(graph.criticalPath().minutes(), plan.makespan());
        }
    }

    @Test
    void emptyPipeline() {
        Schedule plan = Scheduler.schedule(DependencyGraph.load("# nothing here yet\n"), 4);
        assertEquals(0, plan.slots().size());
        assertEquals(0, plan.makespan());
    }

    @Test
    void needsAtLeastOneRunner() {
        assertThrows(RuntimeException.class, () -> Scheduler.schedule(DependencyGraph.load(Samples.WEB_APP), 0));
    }
}
