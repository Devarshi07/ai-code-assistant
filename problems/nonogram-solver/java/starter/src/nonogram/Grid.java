package nonogram;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Grids and pictures.
 *
 * A grid is an int[][] of rows, each an array of cells, where every cell is
 * FILLED or EMPTY. A clue lists the lengths of the filled blocks in one line,
 * in order (left to right for rows, top to bottom for columns). A line with no
 * filled cells has the empty clue, written `0` in puzzle files.
 */
public final class Grid {
    public static final int FILLED = 1;
    public static final int EMPTY = 0;

    private Grid() {}

    /** Character used for a cell in picture files and previews, or '?' for anything else. */
    public static char cellChar(int cell) {
        return switch (cell) {
            case FILLED -> '#';
            case EMPTY -> '.';
            default -> '?';
        };
    }

    /** Read a picture drawn with '#' (filled) and '.' (empty), one row per line. */
    public static int[][] parse(String text) {
        String[] rows = Arrays.stream(text.split("\n"))
                .map(String::strip)
                .filter(line -> !line.isEmpty())
                .toArray(String[]::new);
        if (rows.length == 0) throw new PuzzleException("picture is empty");
        int width = rows[0].length();
        int[][] grid = new int[rows.length][];
        for (int i = 0; i < rows.length; i++) {
            String line = rows[i];
            if (line.length() != width) {
                throw new PuzzleException("picture row " + (i + 1) + " has " + line.length() + " cells, expected " + width);
            }
            Set<Character> unknown = new LinkedHashSet<>();
            for (char ch : line.toCharArray()) if (ch != '#' && ch != '.') unknown.add(ch);
            if (!unknown.isEmpty()) {
                String symbols = unknown.stream().sorted().map(String::valueOf).collect(Collectors.joining());
                throw new PuzzleException("picture row " + (i + 1) + " has unknown symbols '" + symbols + "'");
            }
            grid[i] = new int[width];
            for (int c = 0; c < width; c++) grid[i][c] = line.charAt(c) == '#' ? FILLED : EMPTY;
        }
        return grid;
    }

    /** Inverse of parse. */
    public static String format(int[][] grid) {
        StringBuilder out = new StringBuilder();
        for (int r = 0; r < grid.length; r++) {
            if (r > 0) out.append('\n');
            for (int cell : grid[r]) out.append(cellChar(cell));
        }
        return out.toString();
    }

    /** The grid's columns, top to bottom, as arrays of cells. */
    public static int[][] columns(int[][] grid) {
        if (grid.length == 0) return new int[0][];
        int[][] cols = new int[grid[0].length][grid.length];
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[0].length; c++) cols[c][r] = grid[r][c];
        }
        return cols;
    }
}
