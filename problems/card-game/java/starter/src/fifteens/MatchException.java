package fifteens;

/** Thrown for a match that can't be set up as requested. */
public class MatchException extends IllegalArgumentException {
    public MatchException(String message) {
        super(message);
    }
}
