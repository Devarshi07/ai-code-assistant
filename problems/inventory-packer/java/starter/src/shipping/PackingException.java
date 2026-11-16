package shipping;

/** An item cannot ship in the requested carton type at all. */
public class PackingException extends RuntimeException {
    public PackingException(String message) {
        super(message);
    }
}
