package armada;

import java.util.List;

/**
 * The studio's reference opponent: finds and sinks a hidden fleet.
 *
 * <p>Every new fleet generator and rules change is benchmarked against it, so
 * it has to finish every match on its own.
 */
public class SeekerBot extends Bot {
    public SeekerBot(int size, List<Integer> shipSizes) {
        super(size, shipSizes);
    }

    @Override
    public Coord nextShot() {
        throw new UnsupportedOperationException("Phase 2: SeekerBot.nextShot is not implemented yet");
    }

    @Override
    public void observe(Coord coord, ShotResult result) {
        throw new UnsupportedOperationException("Phase 2: SeekerBot.observe is not implemented yet");
    }
}
