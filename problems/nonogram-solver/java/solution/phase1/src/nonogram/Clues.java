package nonogram;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Clue derivation: turning a designer's drawing into the puzzle players see. */
public final class Clues {
    private Clues() {}

    /** Row clues and column clues of a complete grid. */
    public record GridClues(int[][] rows, int[][] cols) {}

    /**
     * Run-length encode one line of a picture.
     *
     * Returns the lengths of the filled blocks in order, e.g. the line `.##.#..`
     * has the clue [2, 1]. An all-empty line has the clue [].
     */
    public static int[] lineClue(int[] cells) {
        List<Integer> clue = new ArrayList<>();
        int run = 0;
        for (int cell : cells) {
            if (cell == Grid.FILLED) {
                run++;
            } else if (run > 0) {
                clue.add(run);
                run = 0;
            }
        }
        if (run > 0) clue.add(run);
        return clue.stream().mapToInt(Integer::intValue).toArray();
    }

    /** Row and column clues for a complete grid. */
    public static GridClues cluesFromGrid(int[][] grid) {
        int[][] rows = Arrays.stream(grid).map(Clues::lineClue).toArray(int[][]::new);
        int[][] cols = Arrays.stream(Grid.columns(grid)).map(Clues::lineClue).toArray(int[][]::new);
        return new GridClues(rows, cols);
    }

    /** Build the puzzle for a drawing given as a grid. */
    public static Puzzle puzzleFromPicture(int[][] picture, String title) {
        GridClues clues = cluesFromGrid(picture);
        return new Puzzle(clues.rows(), clues.cols(), title, null);
    }

    public static Puzzle puzzleFromPicture(int[][] picture) {
        return puzzleFromPicture(picture, "Untitled");
    }

    /** Build the puzzle for a drawing given as picture text. */
    public static Puzzle puzzleFromPicture(String picture, String title) {
        return puzzleFromPicture(Grid.parse(picture), title);
    }

    public static Puzzle puzzleFromPicture(String picture) {
        return puzzleFromPicture(picture, "Untitled");
    }
}
