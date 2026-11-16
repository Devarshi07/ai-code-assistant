package maze;

import java.util.List;
import java.util.Map;

/** Compass directions as (row delta, col delta), and the one-way gate symbols. */
public enum Direction {
    N(-1, 0),
    E(0, 1),
    S(1, 0),
    W(0, -1);

    /** Every direction, in the order the solver tries them. */
    public static final List<Direction> ALL = List.of(values());

    /** One-way gate symbols and the single direction each one allows. */
    public static final Map<Character, Direction> GATES = Map.of('>', E, '<', W, '^', N, 'v', S);

    public final int rowDelta;
    public final int colDelta;

    Direction(int rowDelta, int colDelta) {
        this.rowDelta = rowDelta;
        this.colDelta = colDelta;
    }

    /** The direction a gate symbol allows, or null when the symbol is not a gate. */
    public static Direction ofGate(char symbol) {
        return GATES.get(symbol);
    }
}
