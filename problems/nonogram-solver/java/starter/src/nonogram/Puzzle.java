package nonogram;

import java.util.Arrays;

/** Row and column clues for one nonogram, validated on construction. */
public final class Puzzle {
    private final String title;
    private final String author;
    private final int[][] rowClues;
    private final int[][] colClues;

    public Puzzle(int[][] rowClues, int[][] colClues) {
        this(rowClues, colClues, "Untitled", null);
    }

    public Puzzle(int[][] rowClues, int[][] colClues, String title, String author) {
        this.title = title;
        this.author = author;
        this.rowClues = Arrays.stream(rowClues).map(int[]::clone).toArray(int[][]::new);
        this.colClues = Arrays.stream(colClues).map(int[]::clone).toArray(int[][]::new);
        validate();
    }

    /** Total of a clue's blocks. */
    public static int sum(int[] numbers) {
        return Arrays.stream(numbers).sum();
    }

    /** Fewest cells that can hold clue: every block plus one gap between blocks. */
    public static int minLength(int[] clue) {
        return sum(clue) + Math.max(clue.length - 1, 0);
    }

    /** Clue as designers write it: "3 1 2", or "0" for an empty line. */
    public static String formatClue(int[] clue) {
        if (clue.length == 0) return "0";
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < clue.length; i++) {
            if (i > 0) out.append(' ');
            out.append(clue[i]);
        }
        return out.toString();
    }

    private void validate() {
        if (width() == 0 || height() == 0) {
            throw new PuzzleException(title + ": a puzzle needs at least one row and one column");
        }
        checkLines("row", rowClues, width());
        checkLines("column", colClues, height());
        int byRows = Arrays.stream(rowClues).mapToInt(Puzzle::sum).sum();
        int byCols = Arrays.stream(colClues).mapToInt(Puzzle::sum).sum();
        if (byRows != byCols) {
            throw new PuzzleException(title + ": row clues fill " + byRows + " cells but column clues fill " + byCols);
        }
    }

    private void checkLines(String kind, int[][] clues, int length) {
        for (int i = 0; i < clues.length; i++) {
            int[] clue = clues[i];
            if (Arrays.stream(clue).anyMatch(n -> n <= 0)) {
                throw new PuzzleException(title + ": " + kind + " " + (i + 1) + " has a block that is not a positive whole number");
            }
            if (minLength(clue) > length) {
                throw new PuzzleException(title + ": " + kind + " " + (i + 1) + " clue " + formatClue(clue) + " needs "
                        + minLength(clue) + " cells but the " + kind + " has " + length);
            }
        }
    }

    public String title() {
        return title;
    }

    /** The contributor's name, or null when the puzzle has none. */
    public String author() {
        return author;
    }

    public int[][] rowClues() {
        return rowClues;
    }

    public int[][] colClues() {
        return colClues;
    }

    public int height() {
        return rowClues.length;
    }

    public int width() {
        return colClues.length;
    }

    public int filledCells() {
        return Arrays.stream(rowClues).mapToInt(Puzzle::sum).sum();
    }

    @Override
    public String toString() {
        return "Puzzle(" + title + ", " + width() + "x" + height() + ")";
    }
}
