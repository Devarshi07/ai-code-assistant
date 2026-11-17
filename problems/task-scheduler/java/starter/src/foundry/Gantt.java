package foundry;

import java.util.ArrayList;
import java.util.List;

/** A text Gantt chart of a schedule. */
public final class Gantt {
    private static final int DEFAULT_WIDTH = 48;

    private Gantt() {}

    /**
     * Draw one row per task: name, runner, a bar on a shared timeline, times.
     * Each column covers {@code scale} minutes, chosen so the bars fit in 48
     * columns. Pass the graph to show each task's resource label (or null).
     */
    public static String render(Schedule schedule, DependencyGraph graph) {
        return render(schedule, graph, DEFAULT_WIDTH);
    }

    public static String render(Schedule schedule, DependencyGraph graph, int width) {
        if (schedule.slots().isEmpty()) return "(empty schedule)";
        int span = schedule.makespan();
        int scale = (span + width - 1) / width;           // minutes per column, rounded up
        int columns = (span + scale - 1) / scale;
        int label = 0;
        for (Slot s : schedule.slots()) label = Math.max(label, s.task().length());
        String axis = "";
        for (int col = 0; col <= columns; col += 10) axis = padEnd(axis, col) + col * scale;
        List<String> lines = new ArrayList<>();
        lines.add(" ".repeat(label + 8) + axis);
        for (Slot s : schedule.slots()) {
            int first = s.start() / scale;
            int last = Math.max(first + 1, (s.end() + scale - 1) / scale);
            String bar = " ".repeat(first) + "=".repeat(last - first) + " ".repeat(columns - last);
            String row = padEnd(s.task(), label) + "  r" + padEnd(String.valueOf(s.worker()), 3)
                    + " |" + bar + "| " + s.start() + "-" + s.end();
            String resource = graph == null ? null : graph.get(s.task()).resource();
            lines.add(row + (resource != null ? "  [" + resource + "]" : ""));
        }
        lines.add("makespan " + span + " min on " + schedule.workers() + " runner(s), " + schedule.busyPercent() + "% busy");
        return String.join("\n", lines);
    }

    private static String padEnd(String text, int width) {
        return text.length() >= width ? text : text + " ".repeat(width - text.length());
    }
}
