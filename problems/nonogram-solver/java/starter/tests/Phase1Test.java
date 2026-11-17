package tests;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import nonogram.Clues;
import nonogram.Grid;
import nonogram.Puzzle;
import nonogram.PuzzleException;
import nonogram.PuzzleFile;
import nonogram.Render;
import nonogram.Verify;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase1Test {
    static final Path SAMPLES = Path.of("samples");

    static String sample(String name) {
        try {
            return Files.readString(SAMPLES.resolve(name));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // A correct answer to samples/sailboat.non, checked by hand against every clue.
    static final String SAILBOAT_ANSWER = """
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

    @Nested
    class LineClueTests {
        @Test
        void blocksSeparatedByGaps() {
            assertArrayEquals(new int[] {2, 1}, Clues.lineClue(new int[] {0, 1, 1, 0, 1, 0, 0}));
        }

        @Test
        void emptyLineHasEmptyClue() {
            assertArrayEquals(new int[] {}, Clues.lineClue(new int[] {0, 0, 0, 0}));
        }

        @Test
        void longAndShortBlocks() {
            assertArrayEquals(new int[] {5, 1, 2}, Clues.lineClue(new int[] {0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0}));
        }
    }

    @Nested
    class PublishingTests {
        @Test
        void mugDrawingClues() {
            Puzzle puzzle = Clues.puzzleFromPicture(sample("mug.pic"), "Mug");
            assertEquals(10, puzzle.width());
            assertEquals(10, puzzle.height());
            assertArrayEquals(new int[][] {{1, 1}, {1, 1}, {1, 1}, {}, {7}, {1, 3}, {1, 1, 1}, {1, 3}, {5}, {}}, puzzle.rowClues());
            assertArrayEquals(new int[][] {{4}, {1, 1, 1}, {1, 1, 1, 1}, {1, 1}, {1, 1, 1}, {1, 1, 1, 1}, {4}, {1, 1}, {3}, {}}, puzzle.colClues());
        }

        @Test
        void heartDrawingPublishes() {
            Puzzle puzzle = Clues.puzzleFromPicture(sample("heart.pic"), "Heart");
            assertArrayEquals(new int[][] {{1, 1}, {5}, {5}, {3}, {1}}, puzzle.rowClues());
            assertArrayEquals(new int[][] {{2}, {4}, {4}, {4}, {2}}, puzzle.colClues());
        }

        @Test
        void lighthouseDrawingPublishes() {
            Puzzle puzzle = Clues.puzzleFromPicture(sample("lighthouse.pic"), "Lighthouse");
            assertEquals(12, puzzle.width());
            assertEquals(13, puzzle.height());
            assertArrayEquals(new int[][] {{2}, {4, 3}, {1, 2}, {4, 3}, {2}, {4}, {1, 1}, {4}, {1, 1}, {4}, {6}, {1, 8, 1}, {12}}, puzzle.rowClues());
            assertArrayEquals(new int[][] {{2}, {1}, {2}, {3}, {3, 8}, {2, 3, 1, 4}, {2, 3, 1, 4}, {3, 8}, {1, 3}, {1, 1, 2}, {1, 1, 1}, {1, 1, 2}}, puzzle.colClues());
            assertEquals(65, puzzle.filledCells());
        }
    }

    @Nested
    class VerifierTests {
        @Test
        void acceptsCorrectSailboatAnswer() {
            Puzzle puzzle = PuzzleFile.load(SAMPLES.resolve("sailboat.non"));
            int[][] answer = Grid.parse(SAILBOAT_ANSWER);
            assertEquals(List.of(), Verify.findMismatches(puzzle, answer).stream().map(Object::toString).toList());
            assertTrue(Verify.isSolution(puzzle, answer));
        }

        @Test
        void drawingSolvesItsOwnPuzzle() {
            int[][] picture = Grid.parse(sample("mug.pic"));
            assertTrue(Verify.isSolution(Clues.puzzleFromPicture(picture), picture));
        }

        @Test
        void reportsExactlyTheWrongLines() {
            int[][] picture = Grid.parse(sample("mug.pic"));
            Puzzle puzzle = Clues.puzzleFromPicture(picture);
            picture[5][3] = 1;
            List<Verify.Mismatch> problems = Verify.findMismatches(puzzle, picture);
            assertEquals(List.of("row 5", "column 3"), problems.stream().map(p -> p.kind() + " " + p.index()).toList());
            assertFalse(Verify.isSolution(puzzle, picture));
        }

        @Test
        void rejectsGridOfTheWrongShape() {
            Puzzle puzzle = Clues.puzzleFromPicture(sample("mug.pic"));
            int[][] full = Grid.parse(sample("mug.pic"));
            assertFalse(Verify.isSolution(puzzle, Arrays.copyOf(full, full.length - 1)));
        }
    }

    @Nested
    class PuzzleFileTests {
        @Test
        void readsContributorFile() {
            Puzzle puzzle = PuzzleFile.load(SAMPLES.resolve("sailboat.non"));
            assertEquals("Sailboat", puzzle.title());
            assertEquals("R. Okafor", puzzle.author());
            assertEquals(10, puzzle.width());
            assertEquals(10, puzzle.height());
            assertArrayEquals(new int[] {10}, puzzle.rowClues()[6]);
            assertArrayEquals(new int[] {1, 1, 1, 1, 1}, puzzle.rowClues()[9]);
            assertArrayEquals(new int[] {4, 4}, puzzle.colClues()[5]);
        }

        @Test
        void zeroMarksAnEmptyLine() {
            Puzzle puzzle = PuzzleFile.parse("rows: 3 | 0 | 1 1\ncols: 2 | 1 | 2");
            assertArrayEquals(new int[][] {{3}, {}, {1, 1}}, puzzle.rowClues());
        }

        @Test
        void formatRoundTrip() {
            Puzzle original = PuzzleFile.parse("# draft\ntitle: Steps\nrows: 1 | 2 | 0\ncols: 2 | 1 | 0");
            Puzzle again = PuzzleFile.parse(PuzzleFile.format(original));
            assertEquals("Steps", again.title());
            assertArrayEquals(new int[][] {{1}, {2}, {}}, again.rowClues());
            assertArrayEquals(new int[][] {{2}, {1}, {}}, again.colClues());
        }

        @Test
        void clueTotalsMustAgree() {
            assertThrows(PuzzleException.class, () -> PuzzleFile.parse("rows: 2 | 1\ncols: 1 | 1"));
        }

        @Test
        void clueLongerThanItsLineIsRejected() {
            assertThrows(PuzzleException.class, () -> new Puzzle(new int[][] {{2, 1}}, new int[][] {{1}, {1}, {1}}));
        }
    }

    @Nested
    class RenderTests {
        @Test
        void boardWithClues() {
            Puzzle puzzle = new Puzzle(new int[][] {{1, 1}, {1}, {1, 1}}, new int[][] {{1, 1}, {}, {3}}, "Tiny", null);
            int[][] grid = {{1, 0, 1}, {0, 0, 1}, {1, 0, 1}};
            assertEquals(String.join("\n",
                    "    1",
                    "    1 0 3",
                    "1 1 # . #",
                    "  1 . . #",
                    "1 1 # . #"), Render.render(puzzle, grid));
        }

        @Test
        void unsolvedBoardShowsQuestionMarks() {
            Puzzle puzzle = new Puzzle(new int[][] {{1}, {}}, new int[][] {{}, {1}});
            String[] lines = Render.render(puzzle).split("\n");
            assertEquals(List.of("1 ? ?", "0 ? ?"), Arrays.asList(lines).subList(1, lines.length));
        }
    }
}
