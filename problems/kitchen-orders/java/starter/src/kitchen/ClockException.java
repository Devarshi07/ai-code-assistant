package kitchen;

/** Thrown for a time stamp the ticket printer could not have produced. */
public class ClockException extends IllegalArgumentException {
    public ClockException(String message) {
        super(message);
    }
}
