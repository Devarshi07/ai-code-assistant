package maze;

import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

/**
 * Level model: turns a designer's text layout into a queryable grid.
 *
 * <pre>
 * Symbols
 *   #   wall
 *   .   floor
 *   S   start tile (exactly one)
 *   E   exit tile (exactly one)
 *   $   gem
 *   &gt; &lt; ^ v   one-way gates (see {@link #movesFrom})
 * </pre>
 */
public final class Level {
    public static final char WALL = '#';
    public static final char FLOOR = '.';
    public static final char START = 'S';
    public static final char EXIT = 'E';
    public static final char GEM = '$';
    private static final String SYMBOLS = "#.SE$><^v";

    private final String name;
    private final List<String> rows;
    private final int height;
    private final int width;
    private final Position start;
    private final Position exit;
    private final List<Position> gems;

    public Level(String name, List<String> rows) {
        if (rows.isEmpty() || rows.get(0).isEmpty()) throw new LevelException(name + ": level is empty");
        int width = rows.get(0).length();
        if (rows.stream().anyMatch(row -> row.length() != width)) {
            throw new LevelException(name + ": every row must have the same width");
        }
        TreeSet<Character> unknown = new TreeSet<>();
        for (String row : rows) {
            for (char ch : row.toCharArray()) if (SYMBOLS.indexOf(ch) < 0) unknown.add(ch);
        }
        if (!unknown.isEmpty()) {
            StringBuilder symbols = new StringBuilder();
            unknown.forEach(symbols::append);
            throw new LevelException(name + ": unknown symbols '" + symbols + "'");
        }
        this.name = name;
        this.rows = List.copyOf(rows);
        this.height = rows.size();
        this.width = width;
        this.start = findOne(START);
        this.exit = findOne(EXIT);
        this.gems = findAll(GEM);
    }

    /** Builds a Level named "level" from a block of text, ignoring blank lines. */
    public static Level parse(String text) {
        return parse(text, "level");
    }

    /** Builds a Level from a block of text, ignoring blank lines. */
    public static Level parse(String text, String name) {
        List<String> rows = text.lines().map(String::strip).filter(line -> !line.isEmpty()).toList();
        return new Level(name, rows);
    }

    private List<Position> findAll(char symbol) {
        List<Position> found = new ArrayList<>();
        for (int r = 0; r < rows.size(); r++) {
            String line = rows.get(r);
            for (int c = 0; c < line.length(); c++) if (line.charAt(c) == symbol) found.add(new Position(r, c));
        }
        return List.copyOf(found);
    }

    private Position findOne(char symbol) {
        List<Position> found = findAll(symbol);
        if (found.size() != 1) {
            throw new LevelException(name + ": expected exactly one '" + symbol + "', found " + found.size());
        }
        return found.get(0);
    }

    public String name() {
        return name;
    }

    /** The layout, one string per row. */
    public List<String> rows() {
        return rows;
    }

    public int height() {
        return height;
    }

    public int width() {
        return width;
    }

    public Position start() {
        return start;
    }

    public Position exit() {
        return exit;
    }

    /** Every gem, in reading order. */
    public List<Position> gems() {
        return gems;
    }

    public boolean inBounds(Position pos) {
        return pos.row() >= 0 && pos.row() < height && pos.col() >= 0 && pos.col() < height;
    }

    public char cell(Position pos) {
        return rows.get(pos.row()).charAt(pos.col());
    }

    public boolean isWalkable(Position pos) {
        return inBounds(pos) && cell(pos) != WALL;
    }

    /**
     * Every position reachable in a single step from pos.
     *
     * <p>Gates are one-way doors: a gate can only be entered while moving in its
     * arrow's direction, and the next step must continue that way.
     */
    public List<Position> movesFrom(Position pos) {
        Direction gate = Direction.ofGate(cell(pos));
        List<Direction> allowed = gate != null ? List.of(gate) : Direction.ALL;
        List<Position> moves = new ArrayList<>(allowed.size());
        for (Direction direction : allowed) {
            Position next = pos.step(direction);
            if (!isWalkable(next)) continue;
            Direction entry = Direction.ofGate(cell(next));
            if (entry != null && entry != direction) continue;
            moves.add(next);
        }
        return moves;
    }

    @Override
    public String toString() {
        return "Level(" + name + ", " + width + "x" + height + ", gems=" + gems.size() + ")";
    }
}
