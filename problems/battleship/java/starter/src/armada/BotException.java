package armada;

/** Thrown when a bot has no legal shot left to offer. */
public class BotException extends IllegalStateException {
    public BotException(String message) {
        super(message);
    }
}
