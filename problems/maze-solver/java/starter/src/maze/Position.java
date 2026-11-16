package maze;

/**
 * A tile on the map. Row 0 is the top of the map, matching the way level files
 * are written.
 */
public record Position(int row, int col) {

    /** The neighbouring position one step from here in direction. */
    public Position step(Direction direction) {
        return new Position(row + direction.rowDelta, col + direction.colDelta);
    }

    /** The compass direction of a single step from here to other. */
    public Direction directionTo(Position other) {
        int dr = other.row - row;
        int dc = other.col - col;
        for (Direction direction : Direction.values()) {
            if (direction.rowDelta == dr && direction.colDelta == dc) return direction;
        }
        throw new IllegalArgumentException(this + " and " + other + " are not adjacent");
    }

    public int manhattan(Position other) {
        return Math.abs(row - other.row) + Math.abs(col - other.col);
    }

    @Override
    public String toString() {
        return "(" + row + ", " + col + ")";
    }
}
