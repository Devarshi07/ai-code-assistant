package nonogram;

import java.util.ArrayDeque;
import java.util.Arrays;

/**
 * Solver used by the import pipeline to build answer keys for contributor puzzles.
 *
 * Constraint propagation with a fallback search:
 *
 * 1. Line solving. For one row or column, a dynamic program finds every cell
 *    that has the same value in all placements of the clue that agree with
 *    the cells already known: O(length * blocks) per line instead of
 *    enumerating placements.
 * 2. Propagation. Lines are solved from a work queue; whenever a cell is
 *    settled, the crossing line is queued again. This runs to a fixpoint.
 * 3. Search. If cells are still unknown at the fixpoint, guess one,
 *    propagate, and back out of the guess on contradiction.
 */
public final class Solver {
    public static final int UNKNOWN = -1;

    private Solver() {}

    /**
     * Settle every forced cell of one line.
     *
     * cells holds FILLED, EMPTY or UNKNOWN. Returns a new array in which each
     * UNKNOWN cell that is the same in every consistent placement is set, or
     * null when no placement of clue agrees with the known cells.
     */
    public static int[] solveLine(int[] clue, int[] cells) {
        int n = cells.length;
        int k = clue.length;
        int[] empties = new int[n + 1]; // empties[i]: known-empty cells in cells[0, i)
        int[] fills = new int[n + 1];
        for (int i = 0; i < n; i++) {
            empties[i + 1] = empties[i] + (cells[i] == Grid.EMPTY ? 1 : 0);
            fills[i + 1] = fills[i] + (cells[i] == Grid.FILLED ? 1 : 0);
        }

        // fwd[j][i]: cells[0, i) can hold exactly the first j blocks.
        boolean[][] fwd = new boolean[k + 1][n + 1];
        for (int i = 0; i <= n && fills[i] == 0; i++) fwd[0][i] = true;
        for (int j = 1; j <= k; j++) {
            int size = clue[j - 1];
            boolean[] row = fwd[j];
            boolean[] prev = fwd[j - 1];
            for (int i = size; i <= n; i++) {
                boolean ok = row[i - 1] && cells[i - 1] != Grid.FILLED; // cell i-1 left empty
                if (!ok && empties[i] == empties[i - size]) { // block j ends at i
                    int s = i - size;
                    ok = j == 1 ? prev[s] : s >= 1 && cells[s - 1] != Grid.FILLED && prev[s - 1];
                }
                row[i] = ok;
            }
        }
        if (!fwd[k][n]) return null;

        // bwd[j][i]: cells[i, n) can hold exactly blocks j.. (last one included).
        boolean[][] bwd = new boolean[k + 1][n + 2];
        for (int i = n; i >= 0 && fills[n] == fills[i]; i--) bwd[k][i] = true;
        for (int j = k - 1; j >= 0; j--) {
            int size = clue[j];
            boolean[] row = bwd[j];
            boolean[] next = bwd[j + 1];
            for (int i = n - size; i >= 0; i--) {
                boolean ok = row[i + 1] && cells[i] != Grid.FILLED; // cell i left empty
                if (!ok && empties[i + size] == empties[i]) { // block j starts at i
                    int e = i + size;
                    ok = j == k - 1 ? next[e] : e < n && cells[e] != Grid.FILLED && next[e + 1];
                }
                row[i] = ok;
            }
        }

        // A block can sit at [s, e) if the prefix fits the earlier blocks and the
        // suffix fits the later ones; mark the covered cells with a difference array.
        int[] cover = new int[n + 1];
        for (int j = 0; j < k; j++) {
            int size = clue[j];
            boolean[] left = fwd[j];
            boolean[] right = bwd[j + 1];
            for (int s = 0; s + size <= n; s++) {
                int e = s + size;
                if (empties[e] != empties[s]) continue;
                boolean leftOk = j == 0 ? left[s] : s >= 1 && cells[s - 1] != Grid.FILLED && left[s - 1];
                if (!leftOk) continue;
                boolean rightOk = j == k - 1 ? right[e] : e < n && cells[e] != Grid.FILLED && right[e + 1];
                if (!rightOk) continue;
                cover[s]++;
                cover[e]--;
            }
        }

        int[] settled = cells.clone();
        int covered = 0;
        for (int i = 0; i < n; i++) {
            covered += cover[i];
            if (cells[i] != UNKNOWN) continue;
            boolean canBeEmpty = false;
            for (int j = 0; j <= k && !canBeEmpty; j++) canBeEmpty = fwd[j][i] && bwd[j][i + 1];
            if (covered > 0 && !canBeEmpty) settled[i] = Grid.FILLED;
            else if (canBeEmpty && covered == 0) settled[i] = Grid.EMPTY;
            else if (covered == 0) return null;
        }
        return settled;
    }

    /** Solve lines until nothing changes. Returns false on a contradiction. */
    private static boolean propagate(Puzzle puzzle, int[][] grid, int[] rows, int[] cols) {
        int width = puzzle.width();
        int height = puzzle.height();
        // Queue entries: index for a row, height + index for a column.
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        boolean[] rowQueued = new boolean[height];
        boolean[] colQueued = new boolean[width];
        for (int r : rows) {
            rowQueued[r] = true;
            queue.add(r);
        }
        for (int c : cols) {
            colQueued[c] = true;
            queue.add(height + c);
        }
        while (!queue.isEmpty()) {
            int entry = queue.poll();
            if (entry < height) {
                rowQueued[entry] = false;
                int[] line = grid[entry];
                int[] settled = solveLine(puzzle.rowClues()[entry], line);
                if (settled == null) return false;
                for (int c = 0; c < width; c++) {
                    if (settled[c] == line[c]) continue;
                    line[c] = settled[c];
                    if (!colQueued[c]) {
                        colQueued[c] = true;
                        queue.add(height + c);
                    }
                }
            } else {
                int index = entry - height;
                colQueued[index] = false;
                int[] line = new int[height];
                for (int r = 0; r < height; r++) line[r] = grid[r][index];
                int[] settled = solveLine(puzzle.colClues()[index], line);
                if (settled == null) return false;
                for (int r = 0; r < height; r++) {
                    if (settled[r] == line[r]) continue;
                    grid[r][index] = settled[r];
                    if (!rowQueued[r]) {
                        rowQueued[r] = true;
                        queue.add(r);
                    }
                }
            }
        }
        return true;
    }

    private static int[][] search(Puzzle puzzle, int[][] grid, int[] rows, int[] cols) {
        if (!propagate(puzzle, grid, rows, cols)) return null;
        for (int r = 0; r < puzzle.height(); r++) {
            for (int c = 0; c < puzzle.width(); c++) {
                if (grid[r][c] != UNKNOWN) continue;
                for (int value : new int[] {Grid.FILLED, Grid.EMPTY}) {
                    int[][] trial = Arrays.stream(grid).map(int[]::clone).toArray(int[][]::new);
                    trial[r][c] = value;
                    int[][] found = search(puzzle, trial, new int[] {r}, new int[] {c});
                    if (found != null) return found;
                }
                return null;
            }
        }
        return grid;
    }

    /**
     * Return a grid that satisfies every row and column clue of puzzle.
     *
     * The grid is an int[puzzle.height()][puzzle.width()] of cells (Grid.FILLED
     * or Grid.EMPTY). Returns null when no grid fits the clues.
     */
    public static int[][] solve(Puzzle puzzle) {
        int[][] grid = new int[puzzle.height()][puzzle.width()];
        for (int[] row : grid) Arrays.fill(row, UNKNOWN);
        int[] rows = new int[puzzle.height()];
        for (int r = 0; r < rows.length; r++) rows[r] = r;
        int[] cols = new int[puzzle.width()];
        for (int c = 0; c < cols.length; c++) cols[c] = c;
        return search(puzzle, grid, rows, cols);
    }
}
