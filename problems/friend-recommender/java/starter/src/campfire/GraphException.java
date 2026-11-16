package campfire;

/** Thrown for operations that would break the graph's rules. */
public class GraphException extends IllegalArgumentException {
    public GraphException(String message) {
        super(message);
    }
}
