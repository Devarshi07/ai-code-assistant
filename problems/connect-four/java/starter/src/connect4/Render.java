package connect4;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Plain-text rendering for the CLI, server logs and bug reports. */
public final class Render {
    private Render() {}

    /** The board as text, top row first, with the players' column numbers below. */
    public static String render(Board board) {
        return render(board, List.of());
    }

    /**
     * The board as text, top row first, with the players' column numbers below.
     *
     * <p>Discs whose cell is in highlight, such as a winning line, are drawn in
     * lowercase so they stand out in a terminal.
     */
    public static String render(Board board, List<Cell> highlight) {
        Set<Cell> marked = new HashSet<>(highlight);
        List<String> lines = new ArrayList<>();
        for (int row = board.rows() - 1; row >= 0; row--) {
            List<String> cells = new ArrayList<>();
            for (int col = 0; col < board.columns(); col++) {
                char disc = board.cell(col, row);
                cells.add(String.valueOf(marked.contains(new Cell(col, row)) ? Character.toLowerCase(disc) : disc));
            }
            lines.add("| " + String.join(" ", cells) + " |");
        }
        lines.add("+" + "-".repeat(2 * board.columns() + 1) + "+");
        List<String> numbers = new ArrayList<>();
        for (int col = 0; col < board.columns(); col++) numbers.add(String.valueOf(col + 1));
        lines.add("  " + String.join(" ", numbers));
        return String.join("\n", lines);
    }

    /** The board with any winning line highlighted, followed by the status. */
    public static String renderGame(Game game) {
        List<Cell> highlight = game.winningCells() == null ? List.of() : game.winningCells();
        return render(game.board(), highlight) + "\n" + game.status();
    }

    /** A column as players say it: describeMove(3) is "column 4". */
    public static String describeMove(int col) {
        return "column " + (col + 1);
    }
}
