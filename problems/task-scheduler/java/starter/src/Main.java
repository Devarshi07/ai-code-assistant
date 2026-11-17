import foundry.DependencyGraph;
import foundry.Gantt;
import foundry.Samples;
import foundry.Scheduler;
import java.util.Map;

/** Prints the critical path and runner plans for the sample pipelines. */
public class Main {
    static final int RUNNERS = 3;

    public static void main(String[] args) {
        for (Map.Entry<String, String> sample : Samples.SAMPLES.entrySet()) {
            DependencyGraph graph = DependencyGraph.load(sample.getValue());
            DependencyGraph.CriticalPath critical = graph.criticalPath();
            System.out.println("== " + sample.getKey() + ": " + graph.size() + " tasks ==");
            System.out.println("critical path: " + String.join(" -> ", critical.path()) + " (" + critical.minutes() + " min)");
            System.out.println("\nserial plan (one runner, today's behaviour):");
            System.out.println(Gantt.render(Scheduler.serialSchedule(graph), graph));
            System.out.println("\nparallel plan (" + RUNNERS + " runners):");
            try {
                System.out.println(Gantt.render(Scheduler.schedule(graph, RUNNERS), graph));
            } catch (UnsupportedOperationException error) {
                System.out.println("  " + error.getMessage());
            }
            System.out.println();
        }
    }
}
