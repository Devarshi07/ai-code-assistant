package tests;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import nonogram.Clues;
import nonogram.Grid;
import nonogram.Puzzle;
import nonogram.PuzzleFile;
import nonogram.Solver;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase2Test {
    static final Path SAMPLES = Path.of("samples");

    static String sample(String name) {
        try {
            return Files.readString(SAMPLES.resolve(name));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static final String SAILBOAT = """
            ....#.....
            ....##....
            ....###...
            ....####..
            ....#####.
            ....#.....
            ##########
            .########.
            ..######..
            .#.#.#.#.#
            """;

    // Line-by-line logic stalls on this one almost immediately: a solver has to
    // commit to a guess and back out of the wrong ones.
    static final String STARFIELD = """
            #.....#.#.
            #..#..##..
            ...#.#.###
            #..#.#.##.
            ...#..#.##
            ....####.#
            #..#..#...
            .#.#...#.#
            .#..###..#
            ###.#....#
            """;

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

    @Nested
    class SolveTests {
        @Test
        void heart() {
            Puzzle puzzle = new Puzzle(new int[][] {{1, 1}, {5}, {5}, {3}, {1}}, new int[][] {{2}, {4}, {4}, {4}, {2}}, "Heart", null);
            int[][] grid = Solver.solve(puzzle);
            assertSatisfies(puzzle, grid);
            assertArrayEquals(Grid.parse(sample("heart.pic")), grid);
        }

        @Test
        void sailboatAnswerKey() {
            Puzzle puzzle = PuzzleFile.load(SAMPLES.resolve("sailboat.non"));
            int[][] grid = Solver.solve(puzzle);
            assertSatisfies(puzzle, grid);
            assertArrayEquals(Grid.parse(SAILBOAT), grid);
        }

        @Test
        void starfieldNeedsMoreThanLineLogic() {
            Puzzle puzzle = PuzzleFile.load(SAMPLES.resolve("starfield.non"));
            int[][] grid = Solver.solve(puzzle);
            assertSatisfies(puzzle, grid);
            assertArrayEquals(Grid.parse(STARFIELD), grid);
        }

        @Test
        void publishedDrawingsSolveBackToTheDrawing() {
            for (String name : List.of("mug.pic", "lighthouse.pic")) {
                int[][] picture = Grid.parse(sample(name));
                Puzzle puzzle = Clues.puzzleFromPicture(picture);
                int[][] grid = Solver.solve(puzzle);
                assertSatisfies(puzzle, grid);
                assertArrayEquals(picture, grid, name + " should solve back to the drawing");
            }
        }

        @Test
        void singleCellPuzzles() {
            assertArrayEquals(new int[][] {{1}}, Solver.solve(new Puzzle(new int[][] {{1}}, new int[][] {{1}})));
            assertArrayEquals(new int[][] {{0}}, Solver.solve(new Puzzle(new int[][] {{}}, new int[][] {{}})));
        }

        @Test
        void fullAndEmptyLines() {
            Puzzle puzzle = new Puzzle(new int[][] {{4}, {}, {1, 1}, {4}}, new int[][] {{1, 2}, {1, 1}, {1, 1}, {1, 2}});
            int[][] grid = Solver.solve(puzzle);
            assertSatisfies(puzzle, grid);
            assertArrayEquals(new int[][] {{1, 1, 1, 1}, {0, 0, 0, 0}, {1, 0, 0, 1}, {1, 1, 1, 1}}, grid);
        }

        @Test
        void ambiguousPuzzleReturnsAValidGrid() {
            // Two diagonals both fit; either answer is acceptable.
            Puzzle puzzle = new Puzzle(new int[][] {{1}, {1}}, new int[][] {{1}, {1}});
            assertSatisfies(puzzle, Solver.solve(puzzle));
        }

        @Test
        void contradictoryCluesHaveNoSolution() {
            // Totals agree, but each outer column needs two stacked cells while row 2 is empty.
            assertNull(Solver.solve(new Puzzle(new int[][] {{1, 1}, {}, {1, 1}}, new int[][] {{2}, {}, {2}})));
        }

        @Test
        void solvingDoesNotChangeThePuzzle() {
            Puzzle puzzle = PuzzleFile.load(SAMPLES.resolve("sailboat.non"));
            String before = Arrays.deepToString(puzzle.rowClues()) + Arrays.deepToString(puzzle.colClues());
            Solver.solve(puzzle);
            assertEquals(before, Arrays.deepToString(puzzle.rowClues()) + Arrays.deepToString(puzzle.colClues()));
        }
    }
}
