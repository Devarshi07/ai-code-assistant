package fifteens;

/** Thrown when more cards are requested than the deck holds. */
public class DeckException extends IllegalStateException {
    public DeckException(String message) {
        super(message);
    }
}
