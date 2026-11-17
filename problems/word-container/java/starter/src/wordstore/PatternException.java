package wordstore;

/** Raised for text that is not a valid crossword pattern. */
public class PatternException extends RuntimeException {
    public PatternException(String message) {
        super(message);
    }
}
