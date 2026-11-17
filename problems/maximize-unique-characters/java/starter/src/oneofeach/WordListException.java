package oneofeach;

/** Thrown for a malformed word-list line, with its line number. */
public class WordListException extends RuntimeException {
    public WordListException(String message) {
        super(message);
    }
}
