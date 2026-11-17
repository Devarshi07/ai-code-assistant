package foundry;

import java.util.ArrayList;
import java.util.List;

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
     * Plan the pipeline on {@code workers} identical runners.
     *
     * <p>Uses the list-scheduling policy described under "Parallel runners" in
     * README.md: whenever a runner is idle, it starts the ready task with the
     * highest priority. Returns a Schedule with one slot per task.
     */
    public static Schedule schedule(DependencyGraph graph, int workers) {
        throw new UnsupportedOperationException("Phase 2: schedule is not implemented");
    }
}
