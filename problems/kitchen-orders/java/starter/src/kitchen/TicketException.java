package kitchen;

/** A log line that could not be read. Carries the 1-based line number. */
public class TicketException extends RuntimeException {
    private final int lineNumber;

    public TicketException(int lineNumber, String message) {
        super("line " + lineNumber + ": " + message);
        this.lineNumber = lineNumber;
    }

    public int lineNumber() {
        return lineNumber;
    }
}
