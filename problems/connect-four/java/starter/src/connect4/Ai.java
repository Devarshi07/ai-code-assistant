package connect4;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The computer opponent and the puzzle checker.
 *
 * <p>{@link #chooseMove} powers "Play the computer". {@link #solve} checks the daily
 * puzzles ("Red to play and win in 5"): it finds how quickly the side to move can
 * force a win. Distances are counted in plies. A ply is one disc dropped by either
 * player, so a win in 5 plies means three discs from the winner and two from the
 * defender, the last of the three completing the four.
 */
public final class Ai {
    private Ai() {}

    public static final int DEFAULT_DEPTH = 4;
    public static final int WIN_SCORE = 1_000_000; // far above anything evaluate() can return

    // Heuristic points for a window of four cells that holds discs of one player
    // only, keyed by how many of that player's discs it holds.
    private static final int[] WINDOW_POINTS = {0, 0, 2, 5, 0};
    private static final int CENTRE_POINTS = 3;

    /**
     * A forced win found by solve(). move is the 0-based column to play now; plies
     * counts both sides' discs until the four is completed, so 1 means the move
     * wins at once.
     */
    public record ForcedWin(int move, int plies) {}

    /** Columns from the centre outwards, left before right: 7 gives [3, 2, 4, 1, 5, 0, 6]. */
    public static List<Integer> centreOrder(int columns) {
        double middle = (columns - 1) / 2.0;
        List<Integer> order = new ArrayList<>();
        for (int col = 0; col < columns; col++) order.add(col);
        order.sort(Comparator.<Integer>comparingDouble(col -> Math.abs(col - middle)).thenComparingInt(col -> col));
        return order;
    }

    private static final Map<String, List<Cell[]>> WINDOW_CACHE = new HashMap<>();

    /** Every straight line of four cells on a board of this size. */
    public static synchronized List<Cell[]> windows(int columns, int rows) {
        return WINDOW_CACHE.computeIfAbsent(columns + "x" + rows, key -> {
            List<Cell[]> found = new ArrayList<>();
            for (int[] axis : Rules.AXES) {
                for (int col = 0; col < columns; col++) {
                    for (int row = 0; row < rows; row++) {
                        int endCol = col + 3 * axis[0];
                        int endRow = row + 3 * axis[1];
                        if (endCol >= 0 && endCol < columns && endRow >= 0 && endRow < rows) {
                            Cell[] window = new Cell[4];
                            for (int i = 0; i < 4; i++) window[i] = new Cell(col + i * axis[0], row + i * axis[1]);
                            found.add(window);
                        }
                    }
                }
            }
            return found;
        });
    }

    /**
     * Static score of a position from player's point of view. Positive is good.
     *
     * <p>Rewards windows of four that only player could still complete, penalises the
     * opponent's in the same way, and prefers discs in the centre column.
     * Symmetric by construction: evaluate(b, p) == -evaluate(b, other(p)).
     * Only meaningful for positions that do not already contain a four.
     */
    public static int evaluate(Board board, char player) {
        char opponent = Board.other(player);
        int score = 0;
        for (Cell[] window : windows(board.columns(), board.rows())) {
            int mine = 0;
            int theirs = 0;
            for (Cell cell : window) {
                char disc = board.cell(cell.col(), cell.row());
                if (disc == player) mine += 1;
                else if (disc == opponent) theirs += 1;
            }
            if (theirs == 0) score += WINDOW_POINTS[mine];
            else if (mine == 0) score -= WINDOW_POINTS[theirs];
        }
        if (board.columns() % 2 == 1) {
            int centre = board.columns() / 2;
            for (int row = 0; row < board.height(centre); row++) {
                score += board.cell(centre, row) == player ? CENTRE_POINTS : -CENTRE_POINTS;
            }
        }
        return score;
    }

    /** Pick a 0-based column for the side to move, searching {@link #DEFAULT_DEPTH} plies. */
    public static int chooseMove(Board board) {
        return chooseMove(board, DEFAULT_DEPTH);
    }

    /**
     * Pick a 0-based column for the side to move.
     *
     * <p>Wins at once if it can, otherwise blocks a column where the opponent would
     * win next turn, otherwise looks depth plies ahead with minimax and scores the
     * positions it reaches with evaluate().
     */
    public static int chooseMove(Board board, int depth) {
        throw new UnsupportedOperationException("Phase 2: chooseMove is not implemented");
    }

    /** Fastest forced win for the side to move within maxPlies plies, or empty. */
    public static Optional<ForcedWin> solve(Board board, int maxPlies) {
        throw new UnsupportedOperationException("Phase 2: solve is not implemented");
    }
}
