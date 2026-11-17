package foundry;

/** A pipeline definition is invalid: bad syntax, unknown task, cycle, ... */
public class PipelineError extends RuntimeException {
    public PipelineError(String message) {
        super(message);
    }
}
