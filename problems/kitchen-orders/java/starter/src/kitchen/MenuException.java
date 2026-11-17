package kitchen;

/** Thrown when a ticket names a dish the kitchen does not make. */
public class MenuException extends RuntimeException {
    public MenuException(String message) {
        super(message);
    }
}
