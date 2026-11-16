package maze;

/** Thrown when a level layout is malformed. */
public class LevelException extends IllegalArgumentException {
    public LevelException(String message) {
        super(message);
    }
}
