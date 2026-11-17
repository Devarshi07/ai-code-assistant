package nonogram;

import java.util.ArrayList;
import java.util.List;

/** Solver used by the import pipeline to build answer keys for contributor puzzles. */
public final class Solver {
    private Solver() {}

    /** Every way to lay out clue's blocks in a line of `length` cells. */
    public static List<int[]> linePlacements(int[] clue, int length) {
        return placements(clue, 0, length);
    }

    /** Placements of blocks from.. of clue in a line of `length` cells. */
    private static List<int[]> placements(int[] clue, int from, int length) {
        if (from == clue.length) return List.of(new int[length]);
        int first = clue[from];
        int tailMin = 0; // later blocks plus the gap before each
        for (int k = from + 1; k < clue.length; k++) tailMin += clue[k] + 1;
        List<int[]> result = new ArrayList<>();
        for (int start = 0; start + first + tailMin <= length; start++) {
            int headLength = start + first;
            if (from + 1 < clue.length) {
                for (int[] tail : placements(clue, from + 1, length - headLength - 1)) {
                    int[] line = new int[length];
                    for (int i = start; i < headLength; i++) line[i] = Grid.FILLED;
                    System.arraycopy(tail, 0, line, headLength + 1, tail.length);
                    result.add(line);
                }
            } else {
                int[] line = new int[length];
                for (int i = start; i < headLength; i++) line[i] = Grid.FILLED;
                result.add(line);
            }
        }
        return result;
    }

    /** needed[b]: cells required to fit blocks b.. of clue, with gaps between them. */
    private static int[] roomNeeded(int[] clue) {
        int[] needed = new int[clue.length + 1];
        for (int b = clue.length - 1; b >= 0; b--) needed[b] = clue[b] + needed[b + 1] + (b + 1 < clue.length ? 1 : 0);
        return needed;
    }

    /**
     * Return a grid that satisfies every row and column clue of puzzle.
     *
     * The grid is an int[puzzle.height()][puzzle.width()] of cells (Grid.FILLED
     * or Grid.EMPTY). Returns null when no grid fits the clues.
     *
     * Row-by-row backtracking: try every placement of each row's clue and keep a
     * running state per column (blocks finished, length of the open block) so a
     * row is rejected as soon as some column prefix can no longer match.
     */
    public static int[][] solve(Puzzle puzzle) {
        int width = puzzle.width();
        int height = puzzle.height();
        int[][] colClues = puzzle.colClues();
        List<List<int[]>> options = new ArrayList<>();
        for (int[] clue : puzzle.rowClues()) options.add(linePlacements(clue, width));
        int[][] needed = new int[width][];
        for (int c = 0; c < width; c++) needed[c] = roomNeeded(colClues[c]);
        int[][] grid = new int[height][];
        return place(0, new int[width], new int[width], options, colClues, needed, grid) ? grid : null;
    }

    private static boolean place(int r, int[] blocks, int[] runs, List<List<int[]>> options,
                                 int[][] colClues, int[][] needed, int[][] grid) {
        int height = grid.length;
        if (r == height) return true;
        for (int[] row : options.get(r)) {
            int[][] state = advance(blocks, runs, row, height - r - 1, colClues, needed);
            if (state == null) continue;
            grid[r] = row.clone();
            if (place(r + 1, state[0], state[1], options, colClues, needed, grid)) return true;
        }
        return false;
    }

    /** Column states after adding row, or null if a column is now impossible. */
    private static int[][] advance(int[] blocksIn, int[] runsIn, int[] row, int rowsLeft, int[][] colClues, int[][] needed) {
        int width = row.length;
        int[] blocks = blocksIn.clone();
        int[] runs = runsIn.clone();
        for (int c = 0; c < width; c++) {
            int[] clue = colClues[c];
            int b = blocks[c];
            int run = runs[c];
            if (row[c] == Grid.FILLED) {
                run++;
                if (b >= clue.length || run > clue[b]) return null;
            } else if (run > 0) {
                if (run != clue[b]) return null;
                b++;
                run = 0;
            }
            if (needed[c][b] - run > rowsLeft) return null; // not enough rows left for this column
            blocks[c] = b;
            runs[c] = run;
        }
        return new int[][] {blocks, runs};
    }
}
