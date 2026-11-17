package connect4;

/** Thrown for moves the game does not allow, such as playing after a win. */
public class GameException extends RuntimeException {
    public GameException(String message) {
        super(message);
    }
}
