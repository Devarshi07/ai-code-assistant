package armada;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The studio's reference opponent: hunt/target with checkerboard parity.
 *
 * <p>Hunt: fire at cells where row + col is even. A ship two or more cells
 * long always covers one of them, so the hunt finds every such ship with at
 * most half the board. The odd cells stay queued behind them as a fallback,
 * which covers 1-cell ships and guarantees the bot can always finish.
 *
 * <p>Target: a HIT queues the cell's untried neighbours. They are fired at,
 * most recent first, before hunting resumes, so a ship is finished off as soon
 * as it is found. Leftover neighbours after a SUNK are simply tried too: a
 * sunk report doesn't say which hits belonged to the ship, and a touching ship
 * may still be hiding behind them.
 */
public class SeekerBot extends Bot {
    private final Ocean ocean;
    private final Set<Coord> fired = new HashSet<>(); // cells already fired at
    private final Deque<Coord> targets = new ArrayDeque<>(); // stack of cells next to hits
    private final List<Coord> hunt = new ArrayList<>(); // even cells, then odd cells
    private int cursor;

    public SeekerBot(int size, List<Integer> shipSizes) {
        super(size, shipSizes);
        this.ocean = new Ocean(size);
        List<Coord> cells = ocean.cells();
        for (Coord c : cells) if ((c.row() + c.col()) % 2 == 0) hunt.add(c);
        for (Coord c : cells) if ((c.row() + c.col()) % 2 == 1) hunt.add(c);
    }

    @Override
    public Coord nextShot() {
        while (!targets.isEmpty()) {
            Coord c = targets.pop();
            if (!fired.contains(c)) return c;
        }
        while (cursor < hunt.size() && fired.contains(hunt.get(cursor))) cursor += 1;
        if (cursor == hunt.size()) throw new BotException("every cell has already been fired at");
        return hunt.get(cursor);
    }

    @Override
    public void observe(Coord shot, ShotResult result) {
        fired.add(shot);
        if (result == ShotResult.HIT) {
            for (Coord n : ocean.neighbours(shot)) if (!fired.contains(n)) targets.push(n);
        }
    }
}
