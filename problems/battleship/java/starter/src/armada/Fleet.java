package armada;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The ships hidden on one ocean.
 *
 * <p>A Fleet enforces the placement rules: every ship is a straight horizontal
 * or vertical line, stays on the board and never shares a cell with another
 * ship. Ships may touch side by side (studio rules).
 */
public final class Fleet {
    /** Ship lengths of the standard fleet: carrier, battleship, cruiser, submarine, destroyer. */
    public static final List<Integer> DEFAULT_FLEET = List.of(5, 4, 3, 3, 2);

    /** Class names by length. A repeated length takes the next name on its list. */
    static final Map<Integer, List<String>> CLASS_NAMES = Map.of(
            5, List.of("Carrier"), 4, List.of("Battleship"), 3, List.of("Cruiser", "Submarine"),
            2, List.of("Destroyer"), 1, List.of("Patrol boat"));

    private final Ocean ocean;
    private final List<Ship> ships = new ArrayList<>();
    private final Map<Coord, Ship> byCell = new HashMap<>();

    public Fleet(Ocean ocean) {
        this.ocean = ocean;
    }

    public Ocean ocean() {
        return ocean;
    }

    /** The ships in placement order. */
    public List<Ship> ships() {
        return Collections.unmodifiableList(ships);
    }

    /** The cells a ship of this length covers, starting at origin. */
    public static List<Coord> span(int length, Coord origin, boolean vertical) {
        List<Coord> cells = new ArrayList<>();
        for (int i = 0; i < length; i++) {
            cells.add(vertical ? new Coord(origin.row() + i, origin.col()) : new Coord(origin.row(), origin.col() + i));
        }
        return cells;
    }

    public boolean fits(int length, Coord origin, boolean vertical) {
        return span(length, origin, vertical).stream().allMatch(c -> ocean.inBounds(c) && !byCell.containsKey(c));
    }

    public Ship place(int length, String origin) {
        return place(length, Coord.parse(origin), false, null);
    }

    public Ship place(int length, String origin, boolean vertical) {
        return place(length, Coord.parse(origin), vertical, null);
    }

    public Ship place(int length, Coord origin, boolean vertical) {
        return place(length, origin, vertical, null);
    }

    /** Adds a ship whose bow is at origin, running east (or south if vertical). A null name means its class name. */
    public Ship place(int length, Coord origin, boolean vertical, String name) {
        if (length < 1) throw new PlacementException("a ship needs at least one cell, got " + length);
        if (name == null) {
            List<String> names = CLASS_NAMES.getOrDefault(length, List.of(length + "-cell ship"));
            int taken = (int) ships.stream().filter(ship -> ship.size() == length).count();
            name = taken < names.size() ? names.get(taken) : names.get(names.size() - 1) + " " + (taken + 1);
        }
        List<Coord> cells = span(length, origin, vertical);
        for (Coord cell : cells) {
            if (!ocean.inBounds(cell)) throw new PlacementException(name + " at " + origin + " runs off the board");
            Ship other = byCell.get(cell);
            if (other != null) throw new PlacementException(name + " at " + origin + " overlaps the " + other.name() + " at " + cell);
        }
        Ship ship = new Ship(name, cells);
        ships.add(ship);
        for (Coord cell : cells) byCell.put(cell, ship);
        return ship;
    }

    /** The ship covering c, or null. */
    public Ship shipAt(Coord c) {
        return byCell.get(c);
    }

    public Ship shipAt(String label) {
        return shipAt(Coord.parse(label));
    }

    public List<Integer> shipSizes() {
        return ships.stream().map(Ship::size).toList();
    }

    public void resetDamage() {
        for (Ship ship : ships) ship.resetDamage();
    }

    /** The fleet as a chart: ships are lettered A, B, C... in placement order. */
    public String render() {
        return ocean.render(c -> {
            Ship ship = byCell.get(c);
            return ship == null ? "." : String.valueOf((char) ('A' + ships.indexOf(ship)));
        });
    }
}
