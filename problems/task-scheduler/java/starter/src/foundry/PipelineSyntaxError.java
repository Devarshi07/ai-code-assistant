package foundry;

/** A line of a pipeline file could not be understood. */
public class PipelineSyntaxError extends PipelineError {
    private final int lineno;

    public PipelineSyntaxError(int lineno, String message) {
        super("line " + lineno + ": " + message);
        this.lineno = lineno;
    }

    /** The 1-based line number the problem was found on. */
    public int lineno() {
        return lineno;
    }
}
