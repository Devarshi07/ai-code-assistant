package armada;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Shot resolution: the referee between a shooter and a hidden fleet.
 *
 * <p>House rules (also in README.md):
 * <ul>
 *   <li>Every call to fire() is a shot and counts toward shotsFired().
 *   <li>A shot at a cell that has already been fired at is wasted. It always comes
 *       back MISS, it is flagged as a repeat in the log, and nothing on the board changes.
 *   <li>SUNK is reported by the shot that hits the last undamaged cell of a ship.
 *   <li>Shots off the board throw OffBoardException and are not counted.
 * </ul>
 *
 * <p>One Battle is one fleet under fire. A battle always starts from an undamaged fleet.
 */
public final class Battle {
    /** One entry in the shot log: ship is the name of the ship that was struck, or null. */
    public record ShotRecord(Coord coord, ShotResult result, String ship, boolean repeat) {
    }

    private final Fleet fleet;
    private final Ocean ocean;
    private int shotsFired;
    private final List<ShotRecord> log = new ArrayList<>();
    private final Set<Coord> misses = new HashSet<>(); // water cells that have been fired at
    private final Set<Coord> hits = new HashSet<>(); // ship cells that have been fired at

    public Battle(Fleet fleet) {
        this.fleet = fleet;
        this.ocean = fleet.ocean();
        fleet.resetDamage();
    }

    public int shotsFired() {
        return shotsFired;
    }

    /** Every shot so far, in order. */
    public List<ShotRecord> log() {
        return Collections.unmodifiableList(log);
    }

    public boolean fleetSunk() {
        return fleet.ships().stream().allMatch(Ship::isSunk);
    }

    public int repeats() {
        return (int) log.stream().filter(ShotRecord::repeat).count();
    }

    /** Resolves one shot at target. */
    public ShotResult fire(Coord target) {
        Coord c = ocean.require(target);
        shotsFired += 1;
        if (misses.contains(c)) return record(c, ShotResult.MISS, null, true);

        Ship ship = fleet.shipAt(c);
        if (ship == null) {
            misses.add(c);
            return record(c, ShotResult.MISS, null, false);
        }

        hits.add(c);
        ship.takeHit();
        return record(c, ship.isSunk() ? ShotResult.SUNK : ShotResult.HIT, ship.name(), false);
    }

    /** Resolves one shot at a labelled cell such as "B7". */
    public ShotResult fire(String label) {
        return fire(Coord.parse(label));
    }

    private ShotResult record(Coord c, ShotResult result, String ship, boolean repeat) {
        log.add(new ShotRecord(c, result, ship, repeat));
        return result;
    }

    /** The shooter's view: '.' unknown, 'o' miss, 'X' hit, '#' part of a sunk ship. */
    public String chart() {
        return ocean.render(c -> {
            if (misses.contains(c)) return "o";
            if (hits.contains(c)) return fleet.shipAt(c).isSunk() ? "#" : "X";
            return ".";
        });
    }
}
