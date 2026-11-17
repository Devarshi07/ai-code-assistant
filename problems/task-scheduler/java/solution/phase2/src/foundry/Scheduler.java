package foundry;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Turns a dependency graph into a Schedule of runner assignments. */
public final class Scheduler {
    private Scheduler() {}

    /** Today's behaviour: one runner, tasks back to back in topological order. */
    public static Schedule serialSchedule(DependencyGraph graph) {
        List<Slot> slots = new ArrayList<>();
        int clock = 0;
        for (String name : graph.topologicalOrder()) {
            int duration = graph.get(name).duration();
            slots.add(new Slot(name, 0, clock, clock + duration));
            clock += duration;
        }
        return new Schedule(1, slots);
    }

    /**
     * Each task's priority: its duration plus the longest remaining path of
     * any task that depends on it. Dependents come first in reverse
     * topological order, so one backward pass is enough.
     */
    public static Map<String, Integer> remainingPaths(DependencyGraph graph) {
        Map<String, Integer> longest = new HashMap<>();
        List<String> order = graph.topologicalOrder();
        for (int i = order.size() - 1; i >= 0; i--) {
            String name = order.get(i);
            int tail = 0;
            for (String child : graph.dependents(name)) tail = Math.max(tail, longest.get(child));
            longest.put(name, graph.get(name).duration() + tail);
        }
        return longest;
    }

    /**
     * Plan the pipeline on {@code workers} identical runners.
     *
     * <p>Uses the list-scheduling policy described under "Parallel runners" in
     * README.md: whenever a runner is idle, it starts the ready task with the
     * highest priority. Returns a Schedule with one slot per task.
     *
     * <p>Event by event: finish everything ending now, rescan the waiting tasks
     * for ready ones, hand them out by priority, then jump to the next finish.
     */
    public static Schedule schedule(DependencyGraph graph, int workers) {
        if (workers < 1) throw new IllegalArgumentException("schedule needs at least one runner");
        Map<String, Integer> priority = remainingPaths(graph);
        List<String> waiting = graph.names();        // tasks that have not started yet
        Set<String> finished = new HashSet<>();
        List<Slot> running = new ArrayList<>();      // slots in progress
        List<Integer> idle = new ArrayList<>();
        for (int w = 0; w < workers; w++) idle.add(w);
        List<Slot> slots = new ArrayList<>();
        int clock = 0;
        while (!waiting.isEmpty() || !running.isEmpty()) {
            List<Slot> stillRunning = new ArrayList<>();
            for (Slot s : running) {
                if (s.end() == clock) {
                    finished.add(s.task());
                    idle.add(s.worker());
                } else {
                    stillRunning.add(s);
                }
            }
            running = stillRunning;
            List<String> ready = new ArrayList<>();
            for (String name : waiting) {
                if (finished.containsAll(graph.get(name).deps())) ready.add(name);
            }
            ready.sort((a, b) -> {
                int byPriority = Integer.compare(priority.get(b), priority.get(a));
                return byPriority != 0 ? byPriority : a.compareTo(b);
            });
            idle.sort(null);
            int count = Math.min(ready.size(), idle.size());
            Set<String> started = new HashSet<>();
            for (int i = 0; i < count; i++) {
                Slot s = new Slot(ready.get(i), idle.get(i), clock, clock + graph.get(ready.get(i)).duration());
                slots.add(s);
                running.add(s);
                started.add(ready.get(i));
            }
            idle = new ArrayList<>(idle.subList(count, idle.size()));
            if (count > 0) {
                List<String> rest = new ArrayList<>();
                for (String name : waiting) if (!started.contains(name)) rest.add(name);
                waiting = rest;
            }
            if (!running.isEmpty()) {
                clock = Integer.MAX_VALUE;
                for (Slot s : running) clock = Math.min(clock, s.end());
            }
        }
        return new Schedule(workers, slots);
    }
}
