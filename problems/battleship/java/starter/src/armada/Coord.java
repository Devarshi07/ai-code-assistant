package armada;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * One cell of the ocean, with the A1-style label used in logs.
 *
 * <p>Rows are lettered from the top (A, B, C, ...) and columns are numbered
 * from 1, so the corners of the standard 10x10 board are A1, A10, J1 and J10.
 * Internally everything is zero-based: {@code new Coord(0, 0)} is A1 and
 * {@code new Coord(1, 6)} is B7. Coords are values, so they work directly as
 * keys in sets and maps.
 */
public record Coord(int row, int col) {
    private static final Pattern LABEL = Pattern.compile("^\\s*([A-Za-z])\\s*(\\d{1,2})\\s*$");

    /** "B7" -> Coord(1, 6). Case and surrounding spaces are ignored. */
    public static Coord parse(String text) {
        Matcher match = LABEL.matcher(text);
        if (!match.matches()) throw new IllegalArgumentException("not a board label: '" + text + "'");
        int row = Character.toUpperCase(match.group(1).charAt(0)) - 'A';
        return new Coord(row, Integer.parseInt(match.group(2)) - 1);
    }

    /** Coord(1, 6) -> "B7". */
    public String label() {
        if (row < 0 || col < 0) return "(" + row + ", " + col + ")";
        return (char) ('A' + row) + String.valueOf(col + 1);
    }

    @Override
    public String toString() {
        return label();
    }
}
