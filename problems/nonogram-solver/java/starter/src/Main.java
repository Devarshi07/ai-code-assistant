import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import nonogram.Clues;
import nonogram.Grid;
import nonogram.Puzzle;
import nonogram.PuzzleException;
import nonogram.PuzzleFile;
import nonogram.Render;
import nonogram.Solver;
import nonogram.Verify;

/** Demo: publish the designers' drawings, then build answer keys for contributor puzzles. */
public class Main {
    private static final Path SAMPLES = Path.of("samples");
    private static final List<String> DRAWINGS = List.of("heart.pic", "mug.pic", "lighthouse.pic");
    private static final List<String> CONTRIBUTED = List.of("sailboat.non", "starfield.non");

    public static void main(String[] args) throws IOException {
        publishDrawings();
        buildAnswerKeys();
    }

    static void publishDrawings() throws IOException {
        System.out.println("== Publishing drawings ==");
        for (String name : DRAWINGS) {
            String base = name.replaceAll("\\.pic$", "");
            String title = Character.toUpperCase(base.charAt(0)) + base.substring(1);
            int[][] picture = Grid.parse(Files.readString(SAMPLES.resolve(name)));
            Puzzle puzzle;
            try {
                puzzle = Clues.puzzleFromPicture(picture, title);
            } catch (PuzzleException e) {
                System.out.println(name + ": cannot publish: " + e.getMessage() + "\n");
                continue;
            }
            String status = Verify.isSolution(puzzle, picture) ? "ok" : "drawing does not match its own clues";
            System.out.println(name + ": " + puzzle.width() + "x" + puzzle.height() + ", " + puzzle.filledCells()
                    + " filled cells, self-check " + status);
            System.out.println(Render.render(puzzle));
            System.out.println();
        }
    }

    static void buildAnswerKeys() {
        System.out.println("== Answer keys for contributed puzzles ==");
        for (String name : CONTRIBUTED) {
            Puzzle puzzle = PuzzleFile.load(SAMPLES.resolve(name));
            long started = System.nanoTime();
            int[][] grid;
            try {
                grid = Solver.solve(puzzle);
            } catch (RuntimeException e) {
                System.out.println(puzzle.title() + ": " + e.getMessage() + "\n");
                continue;
            }
            double elapsed = (System.nanoTime() - started) / 1e6;
            if (grid == null) {
                System.out.println(puzzle.title() + ": no grid fits these clues\n");
                continue;
            }
            String verdict = Verify.isSolution(puzzle, grid) ? "verified" : "FAILED verification";
            System.out.printf("%s by %s: solved in %.1f ms, %s%n", puzzle.title(), puzzle.author(), elapsed, verdict);
            System.out.println(Render.render(puzzle, grid));
            System.out.println();
        }
    }
}
