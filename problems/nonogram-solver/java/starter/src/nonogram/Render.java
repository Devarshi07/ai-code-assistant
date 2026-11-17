package nonogram;

import java.util.ArrayList;
import java.util.List;

/**
 * ASCII previews of puzzles, used by the CLI and in review e-mails.
 *
 * Column clues are stacked above the board and row clues sit to its left:
 *
 * <pre>
 *           1
 *         2 4 1 4 2
 *     1 1 . # . # .
 *       5 # # # # #
 * </pre>
 */
public final class Render {
    private Render() {}

    private static String padStart(String text, int width) {
        return " ".repeat(Math.max(width - text.length(), 0)) + text;
    }

    /** Board with clues and every cell shown as '?'. */
    public static String render(Puzzle puzzle) {
        return render(puzzle, null);
    }

    /** Board with clues. Without a grid every cell shows as '?'. */
    public static String render(Puzzle puzzle, int[][] grid) {
        List<String> rowLabels = new ArrayList<>();
        for (int[] clue : puzzle.rowClues()) rowLabels.add(Puzzle.formatClue(clue));
        int margin = rowLabels.stream().mapToInt(String::length).max().orElse(0);

        List<List<String>> stacks = new ArrayList<>();
        int depth = 0;
        int widest = 0;
        for (int[] clue : puzzle.colClues()) {
            List<String> stack = new ArrayList<>();
            if (clue.length == 0) stack.add("0");
            for (int n : clue) stack.add(String.valueOf(n));
            for (String entry : stack) widest = Math.max(widest, entry.length());
            depth = Math.max(depth, stack.size());
            stacks.add(stack);
        }
        int cellWidth = Math.max(2, 1 + widest);

        List<String> lines = new ArrayList<>();
        for (int level = 0; level < depth; level++) {
            StringBuilder line = new StringBuilder(" ".repeat(margin));
            for (List<String> stack : stacks) {
                int offset = depth - stack.size();
                line.append(level >= offset ? padStart(stack.get(level - offset), cellWidth) : " ".repeat(cellWidth));
            }
            lines.add(line.toString());
        }
        for (int r = 0; r < rowLabels.size(); r++) {
            StringBuilder line = new StringBuilder(padStart(rowLabels.get(r), margin));
            for (int c = 0; c < puzzle.width(); c++) {
                char ch = grid == null ? '?' : Grid.cellChar(grid[r][c]);
                line.append(padStart(String.valueOf(ch), cellWidth));
            }
            lines.add(line.toString());
        }
        return String.join("\n", lines.stream().map(String::stripTrailing).toList());
    }
}
