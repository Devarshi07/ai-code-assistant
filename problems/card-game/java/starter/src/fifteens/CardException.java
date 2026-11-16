package fifteens;

/** Thrown for card text the parser doesn't understand. */
public class CardException extends IllegalArgumentException {
    public CardException(String message) {
        super(message);
    }
}
