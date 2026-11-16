package armada;

import java.util.List;

/**
 * Base class for match bots. See "Writing a bot" in README.md for the contract.
 *
 * <p>A fresh bot is created for every match with the board size and the ship
 * lengths in the fleet: the fleet's make-up is public, its positions are not.
 * The match runner then calls nextShot() and observe(coord, result) in turn
 * until the fleet is sunk or the shot budget is spent.
 */
public abstract class Bot {
    /** Creates a fresh bot for one match, for example {@code SeekerBot::new}. */
    @FunctionalInterface
    public interface Factory {
        Bot create(int size, List<Integer> shipSizes);
    }

    protected final int size;
    protected final List<Integer> shipSizes;

    protected Bot(int size, List<Integer> shipSizes) {
        this.size = size;
        this.shipSizes = List.copyOf(shipSizes);
    }

    /** The cell to fire at next. */
    public abstract Coord nextShot();

    /** Called once after every shot with the cell and its result. */
    public void observe(Coord coord, ShotResult result) {
    }
}
