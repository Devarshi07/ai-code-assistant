package foundry;

import java.util.List;

/** The pipeline's dependencies loop back on themselves. */
public class CycleError extends PipelineError {
    private final List<String> cycle;

    public CycleError(List<String> cycle) {
        super("dependency cycle: " + String.join(" -> ", cycle));
        this.cycle = List.copyOf(cycle);
    }

    /** One loop as [a, b, ..., a]. */
    public List<String> cycle() {
        return cycle;
    }
}
