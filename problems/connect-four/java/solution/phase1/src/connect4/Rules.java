package connect4;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Win detection.
 *
 * <p>A player wins by connecting four or more of their discs in a straight line:
 * across, up and down, or along either diagonal. Lines are found by walking
 * outwards from a single disc, which is all the game needs after each drop.
 */
public final class Rules {
    private Rules() {}

    /** A four found on a loaded position: who has it and where. */
    public record Winner(char player, List<Cell> cells) {}

    private static final int[] SIGNS = {1, -1};

    // Every line a disc can belong to, as a {column step, row step} pair.
    // runLength walks each axis in both directions from the disc.
    public static final int[][] AXES = {
        {1, 0},   // horizontal
        {0, 1},   // vertical
        {1, 1},   // diagonal
        {1, -1},  // other diagonal
    };

    /**
     * Discs of player in an unbroken line through (col, row) along axis.
     *
     * <p>The cell (col, row) itself is counted as player's whether or not a disc is
     * there yet, so this also answers "what if player dropped here?".
     */
    private static int runLength(Board board, int col, int row, int[] axis, char player) {
        int length = 1;
        for (int sign : SIGNS) {
            int c = col + sign * axis[0];
            int r = row + sign * axis[1];
            while (board.inBounds(c, r) && board.cell(c, r) == player) {
                length += 1;
                c += sign * axis[0];
                r += sign * axis[1];
            }
        }
        return length;
    }

    /** The cells of the unbroken line counted by runLength, sorted by column then row. */
    private static List<Cell> lineCells(Board board, int col, int row, int[] axis, char player) {
        List<Cell> cells = new ArrayList<>();
        cells.add(new Cell(col, row));
        for (int sign : SIGNS) {
            int c = col + sign * axis[0];
            int r = row + sign * axis[1];
            while (board.inBounds(c, r) && board.cell(c, r) == player) {
                cells.add(new Cell(c, r));
                c += sign * axis[0];
                r += sign * axis[1];
            }
        }
        cells.sort(Comparator.comparingInt(Cell::col).thenComparingInt(Cell::row));
        return cells;
    }

    /** Cells of a four-or-longer line through the disc at (col, row), or empty. */
    public static Optional<List<Cell>> winningLine(Board board, int col, int row) {
        char player = board.cell(col, row);
        if (player == Board.EMPTY) return Optional.empty();
        for (int[] axis : AXES) {
            if (runLength(board, col, row, axis, player) >= 4) return Optional.of(lineCells(board, col, row, axis, player));
        }
        return Optional.empty();
    }

    /** Would the side to move connect four by dropping into col? The board is not changed. */
    public static boolean isWinningDrop(Board board, int col) {
        return isWinningDrop(board, col, board.toMove());
    }

    /** Would dropping player's disc into col connect four? The board is not changed. */
    public static boolean isWinningDrop(Board board, int col, char player) {
        if (!board.canPlay(col)) return false;
        int row = board.height(col);
        for (int[] axis : AXES) {
            if (runLength(board, col, row, axis, player) >= 4) return true;
        }
        return false;
    }

    /** Columns where the side to move would connect four right now. */
    public static List<Integer> winningColumns(Board board) {
        return winningColumns(board, board.toMove());
    }

    /** Columns where player would connect four right now. */
    public static List<Integer> winningColumns(Board board, char player) {
        List<Integer> columns = new ArrayList<>();
        for (int col = 0; col < board.columns(); col++) if (isWinningDrop(board, col, player)) columns.add(col);
        return columns;
    }

    /**
     * Scan a whole position for a four.
     * Used when a position is loaded from a grid and has no move history.
     */
    public static Optional<Winner> findWinner(Board board) {
        for (int col = 0; col < board.columns(); col++) {
            for (int row = 0; row < board.height(col); row++) {
                Optional<List<Cell>> cells = winningLine(board, col, row);
                if (cells.isPresent()) return Optional.of(new Winner(board.cell(col, row), cells.get()));
            }
        }
        return Optional.empty();
    }
}
