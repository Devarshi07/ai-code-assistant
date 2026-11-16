package armada;

import java.util.List;

/**
 * The studio's reference opponent: finds and sinks a hidden fleet.
 *
 * <p>Sweeps the board row by row from A1. Every cell is tried exactly once, so
 * the fleet is always sunk within size * size shots and nothing repeats.
 */
public class SeekerBot extends Bot {
    private final List<Coord> queue;
    private int cursor;

    public SeekerBot(int size, List<Integer> shipSizes) {
        super(size, shipSizes);
        this.queue = new Ocean(size).cells();
    }

    @Override
    public Coord nextShot() {
        if (cursor >= queue.size()) throw new BotException("every cell has already been fired at");
        cursor += 1;
        return queue.get(cursor - 1);
    }

    @Override
    public void observe(Coord coord, ShotResult result) {
        // a sweep does not need the outcome
    }
}
