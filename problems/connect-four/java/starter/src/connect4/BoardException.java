package connect4;

/** Thrown for malformed positions and illegal drops. */
public class BoardException extends RuntimeException {
    public BoardException(String message) {
        super(message);
    }
}
