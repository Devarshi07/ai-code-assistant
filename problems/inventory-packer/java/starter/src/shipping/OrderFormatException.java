package shipping;

/** The export is malformed. The message names the offending line. */
public class OrderFormatException extends RuntimeException {
    public OrderFormatException(String message) {
        super(message);
    }
}
