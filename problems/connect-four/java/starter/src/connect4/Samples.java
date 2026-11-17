package connect4;

import java.util.List;

/** Sample games and puzzles used by the demo and by the support team. */
public final class Samples {
    private Samples() {}

    /**
     * moves: how the position arose (1-based); plies: the advertised forced-win distance.
     */
    public record Puzzle(String name, String moves, int plies) {
        public Board board() {
            return Board.fromMoves(moves);
        }
    }

    // Move log attached to support ticket #4127. The player says Yellow's last disc
    // completed a diagonal running from column 2 down to column 5.
    public static final String REPORTED_GAME = "453421332272";

    // A short opening for the computer-opponent demo.
    public static final String OPENING = "4453";

    public static final List<Puzzle> DAILY_PUZZLES = List.of(
            new Puzzle("Monday", "216646", 3),
            new Puzzle("Wednesday", "36566312253", 5),
            new Puzzle("Friday", "164773774571", 7));
}
