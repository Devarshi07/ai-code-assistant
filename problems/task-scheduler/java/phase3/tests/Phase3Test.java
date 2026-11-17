package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import foundry.DependencyGraph;
import foundry.Schedule;
import foundry.Scheduler;
import foundry.Slot;
import foundry.Task;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class Phase3Test {
    // Test shards fan out from build and fan back in to report.
    static final String SHARDS = """
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
            """;

    /** One slot per task, right lengths, dependencies first, no runner double-booked. */
    static void assertValidSchedule(DependencyGraph graph, Schedule plan, int workers) {
        assertEquals(workers, plan.workers());
        assertEquals(graph.size(), plan.slots().size(), "every task must be scheduled exactly once");
        assertEquals(new HashSet<>(graph.names()), new HashSet<>(plan.slots().stream().map(Slot::task).toList()));
        Map<Integer, List<Slot>> byWorker = new HashMap<>();
        for (Slot s : plan.slots()) {
            Task task = graph.get(s.task());
            assertTrue(s.worker() >= 0 && s.worker() < workers, s.task() + " is on runner " + s.worker());
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
    }

    static List<Object> slotTuple(Slot s) {
        return List.of(s.task(), s.worker(), s.start(), s.end());
    }

    static List<Integer> w(int worker, int start, int end) {
        return List.of(worker, start, end);
    }

    @Test
    void testShardsFanOutAndBackIn() {
        DependencyGraph graph = DependencyGraph.load(SHARDS);
        Schedule plan = Scheduler.schedule(graph, 3);
        assertValidSchedule(graph, plan, 3);
        Map<String, List<Integer>> got = new HashMap<>();
        for (Slot s : plan.slots()) got.put(s.task(), w(s.worker(), s.start(), s.end()));
        assertEquals(Map.of(
                "build", w(0, 0, 3), "lint", w(1, 0, 2), "docs", w(2, 0, 5), "test-e2e", w(0, 3, 9),
                "test-api", w(1, 3, 7), "test-ui", w(2, 5, 9), "test-db", w(1, 7, 9), "test-cli", w(0, 9, 10),
                "report", w(0, 10, 11), "publish", w(0, 11, 13)), got);
    }

    @Test
    void generatedPipelineMatchesReference() {
        List<Task> tasks = Generator.generatePipeline(11, 600, 30);
        DependencyGraph graph = new DependencyGraph(tasks);
        Schedule plan = Scheduler.schedule(graph, 5);
        assertValidSchedule(graph, plan, 5);
        assertEquals(1289, plan.makespan());
        assertEquals(List.of("lint-7", 1, 31, 41), slotTuple(plan.slotFor("lint-7")));
        assertEquals(143128735L, Generator.fingerprint(tasks, plan), "the schedule differs from the reference");
    }

    @Test
    void widePipelineMatchesReference() {
        List<Task> tasks = Generator.generatePipeline(23, 2000, 400);
        DependencyGraph graph = new DependencyGraph(tasks);
        Schedule plan = Scheduler.schedule(graph, 12);
        assertValidSchedule(graph, plan, 12);
        assertEquals(1745, plan.makespan());
        assertEquals(List.of("scan-1999", 4, 1654, 1663), slotTuple(plan.slotFor("scan-1999")));
        assertEquals(829942898L, Generator.fingerprint(tasks, plan), "the schedule differs from the reference");
    }

    @Test
    void monorepoPipelineIsFast() {
        List<Task> tasks = Generator.generatePipeline(2026, 12000, 48);
        DependencyGraph graph = new DependencyGraph(tasks);
        // Warm up on a smaller pipeline, so JIT compilation isn't timed.
        DependencyGraph warmUp = new DependencyGraph(Generator.generatePipeline(5, 3000, 48));
        for (int i = 0; i < 5; i++) Scheduler.schedule(warmUp, 32);
        long start = System.nanoTime();
        Schedule plan = Scheduler.schedule(graph, 32);
        long elapsed = (System.nanoTime() - start) / 1_000_000;
        assertValidSchedule(graph, plan, 32);
        assertEquals(8249, plan.makespan());
        assertEquals(List.of("build-11999", 3, 8236, 8243), slotTuple(plan.slotFor("build-11999")));
        assertEquals(1775225865L, Generator.fingerprint(tasks, plan), "the schedule differs from the reference");
        assertTrue(elapsed < 400, "took " + elapsed + "ms; 12,000 tasks on 32 runners must schedule in under 400ms");
    }
}
