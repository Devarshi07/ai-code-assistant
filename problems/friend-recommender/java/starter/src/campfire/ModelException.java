package campfire;

/** Thrown when a member record is malformed. */
public class ModelException extends IllegalArgumentException {
    public ModelException(String message) {
        super(message);
    }
}
