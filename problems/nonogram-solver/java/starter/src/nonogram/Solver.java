package nonogram;

/** Solver used by the import pipeline to build answer keys for contributor puzzles. */
public final class Solver {
    private Solver() {}

    /**
     * Return a grid that satisfies every row and column clue of puzzle.
     *
     * The grid is an int[puzzle.height()][puzzle.width()] of cells (Grid.FILLED
     * or Grid.EMPTY). Returns null when no grid fits the clues.
     */
    public static int[][] solve(Puzzle puzzle) {
        throw new UnsupportedOperationException("Phase 2: solve is not implemented");
    }
}
