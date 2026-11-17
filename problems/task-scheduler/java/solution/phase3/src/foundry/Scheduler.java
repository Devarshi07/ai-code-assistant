package foundry;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

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
     * <p>Event-driven with three heaps, O((n + e) log n) overall:
     * <ul>
     *   <li>{@code ready}: tasks whose dependencies have all finished, best priority first</li>
     *   <li>{@code idle}: runner ids, lowest first</li>
     *   <li>{@code running}: slots in progress, soonest finish first</li>
     * </ul>
     * {@code blockers} counts each task's unfinished dependencies (Kahn's
     * algorithm), so a finish only touches the dependents of the task that
     * finished.
     */
    public static Schedule schedule(DependencyGraph graph, int workers) {
        if (workers < 1) throw new IllegalArgumentException("schedule needs at least one runner");
        Map<String, Integer> priority = remainingPaths(graph);
        Map<String, Integer> blockers = new HashMap<>();
        PriorityQueue<String> ready = new PriorityQueue<>(
                Comparator.<String>comparingInt(name -> -priority.get(name)).thenComparing(Comparator.naturalOrder()));
        for (Task task : graph) {
            blockers.put(task.name(), task.deps().size());
            if (task.deps().isEmpty()) ready.add(task.name());
        }
        PriorityQueue<Integer> idle = new PriorityQueue<>();
        for (int w = 0; w < workers; w++) idle.add(w);
        PriorityQueue<Slot> running = new PriorityQueue<>(Comparator.comparingInt(Slot::end));
        List<Slot> slots = new ArrayList<>(graph.size());
        int clock = 0;
        while (!ready.isEmpty() || !running.isEmpty()) {
            while (!ready.isEmpty() && !idle.isEmpty()) {
                String name = ready.poll();
                Slot s = new Slot(name, idle.poll(), clock, clock + graph.get(name).duration());
                slots.add(s);
                running.add(s);
            }
            clock = running.peek().end();
            // Finish everything that ends at this minute before starting anything new.
            while (!running.isEmpty() && running.peek().end() == clock) {
                Slot done = running.poll();
                idle.add(done.worker());
                for (String child : graph.dependents(done.task())) {
                    int left = blockers.merge(child, -1, Integer::sum);
                    if (left == 0) ready.add(child);
                }
            }
        }
        return new Schedule(workers, slots);
    }
}
