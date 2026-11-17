package wordstore;

/** Raised when an entry cannot be stored as a grid word. */
public class InvalidWordException extends RuntimeException {
    public InvalidWordException(String message) {
        super(message);
    }
}
