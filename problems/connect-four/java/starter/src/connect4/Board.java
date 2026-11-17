package connect4;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Board model for Connect Four.
 *
 * <p>The board is stored column by column with row 0 at the bottom, because discs
 * fall: each column is a stack. In code, columns are numbered from 0 (leftmost).
 * Players see them numbered from 1, and move strings use the players' numbers:
 * "4453" means the 4th, 4th, 5th and 3rd columns from the left.
 *
 * <p>The board knows nothing about winning; see {@link Rules} for that. It will
 * happily keep accepting discs after someone has connected four, which is what the
 * search code wants when it plays moves out and takes them back.
 */
public class Board {
    public static final char EMPTY = '.';
    public static final char RED = 'R'; // Red always moves first
    public static final char YELLOW = 'Y';

    /** The opponent of player. */
    public static char other(char player) {
        return player == RED ? YELLOW : RED;
    }

    /** "Red" or "Yellow". */
    public static String name(char player) {
        return player == RED ? "Red" : "Yellow";
    }

    private final int columns;
    private final int rows;
    private char[][] cells;
    private int[] heights;
    private List<Integer> history;
    private int discs;

    public Board() {
        this(7, 6);
    }

    public Board(int columns, int rows) {
        if (columns < 4 || rows < 4) {
            throw new BoardException("a " + columns + "x" + rows + " board is too small for four in a row");
        }
        this.columns = columns;
        this.rows = rows;
        this.cells = new char[columns][rows];
        for (char[] column : cells) Arrays.fill(column, EMPTY);
        this.heights = new int[columns];
        this.history = new ArrayList<>();
        this.discs = 0;
    }

    // -- construction and serialisation ----------------------------------------

    /** Replay a move string such as "4453" (1-based columns, Red first) on a 7x6 board. */
    public static Board fromMoves(String moves) {
        return fromMoves(moves, 7, 6);
    }

    /** Replay a move string such as "4453" (1-based columns, Red first). */
    public static Board fromMoves(String moves, int columns, int rows) {
        Board board = new Board(columns, rows);
        String text = moves.replace(" ", "");
        for (int index = 0; index < text.length(); index++) {
            char symbol = text.charAt(index);
            int col = symbol - '0';
            if (symbol < '0' || symbol > '9' || col < 1 || col > columns) {
                throw new BoardException("move " + (index + 1) + ": '" + symbol + "' is not a column from 1 to " + columns);
            }
            board.drop(col - 1);
        }
        return board;
    }

    /**
     * Parse a position drawn top row first, as in puzzle files and bug reports.
     *
     * <p>Each non-blank line is one row; spaces and '|' borders are ignored.
     * The side to move follows from the disc counts (Red moves first).
     * Loaded boards have no history, so undo() stops at the loaded position.
     */
    public static Board fromGrid(String text) {
        List<String> grid = new ArrayList<>();
        for (String line : text.split("\n")) {
            String cleaned = line.replace(" ", "").replace("\r", "").replaceAll("^\\|+|\\|+$", "");
            if (!cleaned.isEmpty()) grid.add(cleaned);
        }
        if (grid.isEmpty()) throw new BoardException("grid is empty");
        int width = grid.get(0).length();
        for (String line : grid) {
            if (line.length() != width) throw new BoardException("every row of the grid must have the same width");
        }
        Board board = new Board(width, grid.size());
        int reds = 0;
        for (int col = 0; col < board.columns; col++) {
            for (int row = 0; row < board.rows; row++) {
                char symbol = grid.get(board.rows - 1 - row).charAt(col);
                if (symbol != EMPTY && symbol != RED && symbol != YELLOW) {
                    throw new BoardException("unknown symbol '" + symbol + "' in the grid");
                }
                if (symbol == EMPTY) continue;
                if (board.heights[col] != row) throw new BoardException("column " + (col + 1) + " has a floating disc");
                board.cells[col][row] = symbol;
                board.heights[col] += 1;
                board.discs += 1;
                if (symbol == RED) reds += 1;
            }
        }
        int yellows = board.discs - reds;
        if (reds - yellows != 0 && reds - yellows != 1) {
            throw new BoardException("impossible position: " + reds + " red discs and " + yellows + " yellow");
        }
        return board;
    }

    /** The moves played on this board object, as a 1-based move string. */
    public String toMoves() {
        StringBuilder text = new StringBuilder();
        for (int col : history) text.append(col + 1);
        return text.toString();
    }

    /** The position as text, top row first: the format {@link #fromGrid} reads. */
    public String toGrid() {
        List<String> lines = new ArrayList<>();
        for (int row = rows - 1; row >= 0; row--) {
            StringBuilder line = new StringBuilder();
            for (int col = 0; col < columns; col++) line.append(cells[col][row]);
            lines.add(line.toString());
        }
        return String.join("\n", lines);
    }

    public Board copy() {
        Board clone = new Board(columns, rows);
        for (int col = 0; col < columns; col++) clone.cells[col] = cells[col].clone();
        clone.heights = heights.clone();
        clone.history = new ArrayList<>(history);
        clone.discs = discs;
        return clone;
    }

    // -- queries ---------------------------------------------------------------

    public int columns() {
        return columns;
    }

    public int rows() {
        return rows;
    }

    /** The player whose disc goes in next. */
    public char toMove() {
        return discs % 2 == 0 ? RED : YELLOW;
    }

    /** Discs on the board. */
    public int moveCount() {
        return discs;
    }

    public boolean inBounds(int col, int row) {
        return col >= 0 && col < columns && row >= 0 && row < rows;
    }

    public char cell(int col, int row) {
        return cells[col][row];
    }

    /** Number of discs in a column; also the row the next disc lands on. */
    public int height(int col) {
        return heights[col];
    }

    public boolean canPlay(int col) {
        return col >= 0 && col < columns && heights[col] < rows;
    }

    public List<Integer> legalMoves() {
        List<Integer> moves = new ArrayList<>();
        for (int col = 0; col < columns; col++) if (heights[col] < rows) moves.add(col);
        return moves;
    }

    public boolean isFull() {
        return discs == columns * rows;
    }

    // -- changes ---------------------------------------------------------------

    /** Drop the side to move's disc into col and return the row it lands on. */
    public int drop(int col) {
        if (col < 0 || col >= columns) throw new BoardException("there is no column " + col);
        int row = heights[col];
        if (row >= rows) throw new BoardException("column " + (col + 1) + " is full");
        cells[col][row] = toMove();
        heights[col] = row + 1;
        discs += 1;
        history.add(col);
        return row;
    }

    /** Take back the most recent drop and return its column. */
    public int undo() {
        if (history.isEmpty()) throw new BoardException("there is no move to undo");
        int col = history.remove(history.size() - 1);
        heights[col] -= 1;
        cells[col][heights[col]] = EMPTY;
        discs -= 1;
        return col;
    }

    @Override
    public String toString() {
        return "Board(" + columns + "x" + rows + ", " + discs + " discs, " + toMove() + " to move)";
    }
}
