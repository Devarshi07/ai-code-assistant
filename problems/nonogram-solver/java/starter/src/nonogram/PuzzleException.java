package nonogram;

/** Raised for puzzles, pictures and puzzle files that are malformed. */
public class PuzzleException extends RuntimeException {
    public PuzzleException(String message) {
        super(message);
    }
}
