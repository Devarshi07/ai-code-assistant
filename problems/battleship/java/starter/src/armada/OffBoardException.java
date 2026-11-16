package armada;

/** Thrown when a shot or a lookup falls outside the ocean. */
public class OffBoardException extends IllegalArgumentException {
    public OffBoardException(String message) {
        super(message);
    }
}
