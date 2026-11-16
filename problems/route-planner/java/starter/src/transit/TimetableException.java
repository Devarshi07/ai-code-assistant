package transit;

/** A malformed timetable entry, reported with its line number. */
public class TimetableException extends IllegalArgumentException {
    private final int lineNumber;

    public TimetableException(int lineNumber, String message) {
        super("line " + lineNumber + ": " + message);
        this.lineNumber = lineNumber;
    }

    public int lineNumber() {
        return lineNumber;
    }
}
