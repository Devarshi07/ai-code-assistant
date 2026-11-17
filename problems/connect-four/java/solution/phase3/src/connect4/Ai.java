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

    /** Legal columns, centre first. */
    private static List<Integer> orderedMoves(Board board) {
        List<Integer> moves = new ArrayList<>();
        for (int col : centreOrder(board.columns())) if (board.canPlay(col)) moves.add(col);
        return moves;
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
        List<Integer> moves = orderedMoves(board);
        if (moves.isEmpty()) throw new IllegalStateException("no legal moves: the board is full");
        char me = board.toMove();
        for (int col : moves) if (Rules.isWinningDrop(board, col, me)) return col;
        for (int col : moves) if (Rules.isWinningDrop(board, col, Board.other(me))) return col;
        int bestCol = moves.get(0);
        int bestScore = Integer.MIN_VALUE;
        for (int col : moves) {
            board.drop(col);
            int score = -minimax(board, depth - 1);
            board.undo();
            if (score > bestScore) {
                bestCol = col;
                bestScore = score;
            }
        }
        return bestCol;
    }

    /** Negamax: the score for the side to move, looking depth plies ahead. */
    private static int minimax(Board board, int depth) {
        char me = board.toMove();
        if (depth <= 0) return evaluate(board, me);
        List<Integer> moves = orderedMoves(board);
        if (moves.isEmpty()) return 0;
        for (int col : moves) {
            if (Rules.isWinningDrop(board, col, me)) return WIN_SCORE + depth; // a sooner win leaves more depth
        }
        int best = Integer.MIN_VALUE;
        for (int col : moves) {
            board.drop(col);
            int score = -minimax(board, depth - 1);
            board.undo();
            if (score > best) best = score;
        }
        return best;
    }

    /**
     * Fastest forced win for the side to move within maxPlies plies, or empty.
     *
     * <p>Iterative deepening over odd distances 1, 3, 5, ...: the first distance at
     * which a forced win exists is the exact answer. Each step is a yes/no search
     * ("can the side to move force a four within n plies?"), which is alpha-beta
     * with the narrowest possible window, plus a transposition table, centre-first
     * move ordering and forced replies to immediate threats.
     */
    public static Optional<ForcedWin> solve(Board board, int maxPlies) {
        if (maxPlies < 1 || board.legalMoves().isEmpty()) return Optional.empty();
        WinSearch search = new WinSearch(board.copy());
        for (int plies = 1; plies <= maxPlies; plies += 2) {
            int move = search.winningMove(plies);
            if (move >= 0) return Optional.of(new ForcedWin(move, plies));
        }
        return Optional.empty();
    }

    /** Yes/no forced-win search for the player to move on the given board. */
    private static final class WinSearch {
        private static final int TWO_THREATS = -2;

        private final Board board;
        private final int[] order;
        private final boolean packed;
        private final long[][] weights;
        private long key;
        private final Map<Object, Integer> proven = new HashMap<>();  // key -> smallest n known to force a win
        private final Map<Object, Integer> refuted = new HashMap<>(); // key -> largest n known not to

        WinSearch(Board board) {
            this.board = board;
            this.order = centreOrder(board.columns()).stream().mapToInt(Integer::intValue).toArray();
            // Exact position key, updated as discs are dropped. Each column is a number
            // with a leading 1 bit above one bit per disc (1 = yellow), and the columns
            // are packed side by side. Larger boards fall back to the grid text.
            this.packed = (board.rows() + 1) * board.columns() <= 62;
            this.weights = new long[board.columns()][board.rows()];
            if (packed) {
                for (int col = 0; col < board.columns(); col++) {
                    long base = 1L << ((board.rows() + 1) * col);
                    for (int row = 0; row < board.rows(); row++) weights[col][row] = base << row;
                    key += base;
                    for (int row = 0; row < board.height(col); row++) key += weight(col, row, board.cell(col, row));
                }
            }
        }

        private long weight(int col, int row, char player) {
            return weights[col][row] * (player == Board.RED ? 1 : 2);
        }

        private Object positionKey() {
            return packed ? (Object) key : board.toGrid();
        }

        private long drop(int col) {
            char player = board.toMove();
            int row = board.drop(col);
            long weight = packed ? weight(col, row, player) : 0;
            key += weight;
            return weight;
        }

        private void undo(long weight) {
            board.undo();
            key -= weight;
        }

        /** Can the side to move force a four within plies plies? */
        private boolean winsWithin(int plies) {
            Object position = positionKey();
            Integer known = proven.get(position);
            if (known != null && known <= plies) return true;
            known = refuted.get(position);
            if (known != null && known >= plies) return false;
            boolean result = winningMove(plies) >= 0;
            (result ? proven : refuted).put(position, plies);
            return result;
        }

        /** A column that forces a four within plies plies, or -1. */
        int winningMove(int plies) {
            for (int col : order) if (Rules.isWinningDrop(board, col)) return col;
            if (plies < 3) return -1;
            int threat = soleThreat(Board.other(board.toMove()));
            if (threat == TWO_THREATS) return -1; // only one of them can be blocked
            if (threat >= 0) return everyReplyLoses(threat, plies) ? threat : -1;
            for (int col : order) {
                if (board.canPlay(col) && everyReplyLoses(col, plies)) return col;
            }
            return -1;
        }

        /** After dropping into col, does every reply still lose within plies - 1? */
        private boolean everyReplyLoses(int col, int plies) {
            long weight = drop(col);
            try {
                boolean any = false;
                char defender = board.toMove();
                for (int reply : order) {
                    if (!board.canPlay(reply)) continue;
                    any = true;
                    if (Rules.isWinningDrop(board, reply, defender)) return false;
                }
                if (!any) return false; // the board filled up: a draw
                int threat = soleThreat(Board.other(defender));
                if (threat == TWO_THREATS) return true; // two threats: the defender cannot block both
                if (threat >= 0) return replyLoses(threat, plies);
                for (int reply : order) {
                    if (board.canPlay(reply) && !replyLoses(reply, plies)) return false;
                }
                return true;
            } finally {
                undo(weight);
            }
        }

        /** The only column where player would connect four, -1 for none, or TWO_THREATS. */
        private int soleThreat(char player) {
            int found = -1;
            for (int col = 0; col < board.columns(); col++) {
                if (Rules.isWinningDrop(board, col, player)) {
                    if (found >= 0) return TWO_THREATS;
                    found = col;
                }
            }
            return found;
        }

        private boolean replyLoses(int reply, int plies) {
            long weight = drop(reply);
            boolean stillWinning = winsWithin(plies - 2);
            undo(weight);
            return stillWinning;
        }
    }
}
