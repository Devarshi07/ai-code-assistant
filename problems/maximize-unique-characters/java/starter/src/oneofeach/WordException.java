package oneofeach;

/** Thrown for text that cannot be used as a puzzle word. */
public class WordException extends RuntimeException {
    public WordException(String message) {
        super(message);
    }
}
