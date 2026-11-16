package armada;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/** A square board of size x size cells: bounds, neighbours and text rendering. */
public final class Ocean {
    public static final int MIN_SIZE = 4;
    public static final int MAX_SIZE = 26; // one letter per row

    private final int size;

    public Ocean(int size) {
        if (size < MIN_SIZE || size > MAX_SIZE) {
            throw new IllegalArgumentException("board size must be between " + MIN_SIZE + " and " + MAX_SIZE + ", got " + size);
        }
        this.size = size;
    }

    public int size() {
        return size;
    }

    public boolean inBounds(Coord c) {
        return c.row() >= 0 && c.row() < size && c.col() >= 0 && c.col() < size;
    }

    /** Returns c, or throws OffBoardException if it is not on this board. */
    public Coord require(Coord c) {
        if (!inBounds(c)) throw new OffBoardException(c + " is off the " + size + "x" + size + " board");
        return c;
    }

    /** Every cell, row by row from A1. */
    public List<Coord> cells() {
        List<Coord> all = new ArrayList<>(size * size);
        for (int row = 0; row < size; row++) {
            for (int col = 0; col < size; col++) all.add(new Coord(row, col));
        }
        return all;
    }

    /** The on-board cells directly north, south, west and east of c. */
    public List<Coord> neighbours(Coord c) {
        List<Coord> around = List.of(new Coord(c.row() - 1, c.col()), new Coord(c.row() + 1, c.col()),
                new Coord(c.row(), c.col() - 1), new Coord(c.row(), c.col() + 1));
        return around.stream().filter(this::inBounds).toList();
    }

    /** Draws the board as text, calling mark for each cell's character. */
    public String render(Function<Coord, String> mark) {
        StringBuilder text = new StringBuilder("   ");
        for (int col = 0; col < size; col++) text.append(String.format("%3d", col + 1));
        for (int row = 0; row < size; row++) {
            text.append("\n ").append((char) ('A' + row)).append(' ');
            for (int col = 0; col < size; col++) text.append(String.format("%3s", mark.apply(new Coord(row, col))));
        }
        return text.toString();
    }
}
