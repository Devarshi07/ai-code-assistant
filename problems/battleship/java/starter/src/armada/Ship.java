package armada;

import java.util.List;

/** One ship of a fleet: its class name, the cells it covers and the damage it has taken. */
public final class Ship {
    private final String name;
    private final List<Coord> cells;
    private int damage; // hits taken so far in the current battle

    public Ship(String name, List<Coord> cells) {
        this.name = name;
        this.cells = List.copyOf(cells);
    }

    public String name() {
        return name;
    }

    public List<Coord> cells() {
        return cells;
    }

    public int size() {
        return cells.size();
    }

    public int damage() {
        return damage;
    }

    public boolean isSunk() {
        return damage >= size();
    }

    public void takeHit() {
        damage += 1;
    }

    void resetDamage() {
        damage = 0;
    }
}
