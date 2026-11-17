package foundry;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Slots on {@code workers} identical runners, kept sorted by (start, worker). */
public final class Schedule {
    private final int workers;
    private final List<Slot> slots;
    private final Map<String, Slot> byTask = new HashMap<>();

    public Schedule(int workers, List<Slot> slots) {
        this.workers = workers;
        List<Slot> sorted = new ArrayList<>(slots);
        sorted.sort(Comparator.comparingInt(Slot::start).thenComparingInt(Slot::worker));
        this.slots = List.copyOf(sorted);
        for (Slot slot : this.slots) byTask.put(slot.task(), slot);
    }

    public int workers() {
        return workers;
    }

    public List<Slot> slots() {
        return slots;
    }

    public int size() {
        return slots.size();
    }

    /** The slot of the named task, or null if it is not in the schedule. */
    public Slot slotFor(String name) {
        return byTask.get(name);
    }

    /** Minutes from the start of the pipeline until its last task finishes. */
    public int makespan() {
        int latest = 0;
        for (Slot s : slots) latest = Math.max(latest, s.end());
        return latest;
    }

    public int busyMinutes() {
        int total = 0;
        for (Slot s : slots) total += s.end() - s.start();
        return total;
    }

    public int busyPercent() {
        int capacity = workers * makespan();
        return capacity == 0 ? 0 : busyMinutes() * 100 / capacity;
    }
}
