package tests;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import nonogram.Clues;
import nonogram.Puzzle;
import nonogram.PuzzleFile;
import nonogram.Solver;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase3Test {
    static final Path SAMPLES = Path.of("samples");
    static final double LIMIT_MS = 100; // per large puzzle

    /** Independent run-length check, so these tests don't trust the verifier. */
    static int[] runs(int[] cells) {
        List<Integer> out = new ArrayList<>();
        int length = 0;
        for (int i = 0; i <= cells.length; i++) {
            if (i < cells.length && cells[i] == 1) {
                length++;
            } else if (length > 0) {
                out.add(length);
                length = 0;
            }
        }
        return out.stream().mapToInt(Integer::intValue).toArray();
    }

    static void assertSatisfies(Puzzle puzzle, int[][] grid) {
        assertNotNull(grid, "expected a solution");
        assertEquals(puzzle.height(), grid.length, "wrong number of rows");
        for (int r = 0; r < grid.length; r++) {
            int[] row = grid[r];
            assertEquals(puzzle.width(), row.length, "row " + r + " has the wrong length");
            assertTrue(Arrays.stream(row).allMatch(cell -> cell == 0 || cell == 1), "row " + r + " has cells that are not FILLED/EMPTY");
            assertArrayEquals(puzzle.rowClues()[r], runs(row), "row " + r + " does not match its clue");
        }
        for (int c = 0; c < puzzle.width(); c++) {
            int[] column = new int[puzzle.height()];
            for (int r = 0; r < column.length; r++) column[r] = grid[r][c];
            assertArrayEquals(puzzle.colClues()[c], runs(column), "column " + c + " does not match its clue");
        }
    }

    /** Solves the picture's puzzle and checks the answer and the time against the limit. */
    static void assertSolvesFast(int[][] picture, String label) {
        Puzzle puzzle = Clues.puzzleFromPicture(picture);
        long start = System.nanoTime();
        int[][] grid = Solver.solve(puzzle);
        double elapsed = (System.nanoTime() - start) / 1e6;
        assertSatisfies(puzzle, grid);
        assertArrayEquals(picture, grid);
        assertTrue(elapsed < LIMIT_MS, String.format(Locale.ROOT,
                "took %.0fms; a %s puzzle must solve in under %.0fms", elapsed, label, LIMIT_MS));
    }

    /** Untimed practice solves first, so the timed puzzles measure the algorithm rather than the JIT compiler. */
    static void warmUp() {
        for (int i = 0; i < 300; i++) {
            Puzzle puzzle = Clues.puzzleFromPicture(Generator.randomPicture(100 + i, 12, 12, 0.58));
            Solver.solve(puzzle);
        }
    }

    @Nested
    class CorrectnessTests {
        @Test
        void contributorSamplesStillSolve() {
            for (String name : List.of("sailboat.non", "starfield.non")) {
                Puzzle puzzle = PuzzleFile.load(SAMPLES.resolve(name));
                assertSatisfies(puzzle, Solver.solve(puzzle));
            }
        }

        @Test
        void puzzleWhereLineLogicStalls() {
            // Row-and-column deduction alone leaves most of this board unknown.
            int[][] picture = Generator.randomPicture(66, 20, 20, 0.55);
            Puzzle puzzle = Clues.puzzleFromPicture(picture);
            int[][] grid = Solver.solve(puzzle);
            assertSatisfies(puzzle, grid);
            assertArrayEquals(picture, grid);
        }

        @Test
        void contradictionFoundDeepInTheSearch() {
            // Two row clues swapped by a contributor: the totals still agree, but no grid fits.
            Puzzle puzzle = Clues.puzzleFromPicture(Generator.randomPicture(66, 20, 20, 0.55));
            int[][] rows = puzzle.rowClues().clone();
            int[] swap = rows[6];
            rows[6] = rows[7];
            rows[7] = swap;
            assertNull(Solver.solve(new Puzzle(rows, puzzle.colClues())));
        }

        @Test
        void ambiguousPuzzleReturnsAValidGrid() {
            Puzzle puzzle = new Puzzle(new int[][] {{1, 1}, {1, 1}, {1, 1}, {1, 1}}, new int[][] {{2}, {2}, {2}, {2}});
            assertSatisfies(puzzle, Solver.solve(puzzle));
        }
    }

    @Nested
    class ScaleTests {
        @Test
        void communityPuzzle25x25IsFast() {
            warmUp();
            assertSolvesFast(Generator.randomPicture(11, 25, 25, 0.58), "25x25");
        }

        @Test
        void communityPuzzle30x30IsFast() {
            warmUp();
            assertSolvesFast(Generator.randomPicture(53, 30, 30, 0.6), "30x30");
        }
    }
}
