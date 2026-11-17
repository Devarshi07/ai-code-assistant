package nonogram;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Answer checking: is a player's (or the solver's) grid a solution? */
public final class Verify {
    private Verify() {}

    /**
     * One line whose cells do not produce its clue.
     * kind is "row" or "column", index is 0-based, expected is the puzzle's clue
     * and actual is the clue the grid's cells produce.
     */
    public record Mismatch(String kind, int index, int[] expected, int[] actual) {
        @Override
        public String toString() {
            return kind + " " + (index + 1) + ": clue is " + Puzzle.formatClue(expected) + ", grid gives " + Puzzle.formatClue(actual);
        }
    }

    /** Throw PuzzleException unless grid is height x width and every cell is FILLED or EMPTY. */
    public static void checkShape(Puzzle puzzle, int[][] grid) {
        boolean ok = grid != null && grid.length == puzzle.height();
        if (ok) {
            for (int[] row : grid) {
                if (row == null || row.length != puzzle.width()) ok = false;
            }
        }
        if (!ok) throw new PuzzleException(puzzle.title() + ": grid must be " + puzzle.width() + "x" + puzzle.height());
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[r].length; c++) {
                int cell = grid[r][c];
                if (cell != Grid.FILLED && cell != Grid.EMPTY) {
                    throw new PuzzleException(puzzle.title() + ": cell (" + r + ", " + c + ") is " + cell + ", not filled or empty");
                }
            }
        }
    }

    /** Every row and column of grid that disagrees with puzzle's clues. */
    public static List<Mismatch> findMismatches(Puzzle puzzle, int[][] grid) {
        checkShape(puzzle, grid);
        List<Mismatch> problems = new ArrayList<>();
        for (int r = 0; r < grid.length; r++) {
            int[] actual = Clues.lineClue(grid[r]);
            if (!Arrays.equals(actual, puzzle.rowClues()[r])) problems.add(new Mismatch("row", r, puzzle.rowClues()[r], actual));
        }
        int[][] cols = Grid.columns(grid);
        for (int c = 0; c < cols.length; c++) {
            int[] actual = Clues.lineClue(cols[c]);
            if (!Arrays.equals(actual, puzzle.colClues()[c])) problems.add(new Mismatch("column", c, puzzle.colClues()[c], actual));
        }
        return problems;
    }

    /** True when grid has the puzzle's shape and matches every clue. */
    public static boolean isSolution(Puzzle puzzle, int[][] grid) {
        try {
            return findMismatches(puzzle, grid).isEmpty();
        } catch (PuzzleException e) {
            return false;
        }
    }
}
