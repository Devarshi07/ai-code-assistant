package maze;

import java.util.List;

/** Text rendering used by the level editor preview and the CLI. */
public final class Render {
    public static final char PATH_MARK = 'o';

    private Render() {}

    /** The level as text with floor tiles on path marked. */
    public static String render(Level level, List<Position> path) {
        char[][] grid = new char[level.height()][];
        for (int r = 0; r < level.height(); r++) grid[r] = level.rows().get(r).toCharArray();
        if (path != null) {
            for (Position pos : path) {
                if (grid[pos.row()][pos.col()] == Level.FLOOR) grid[pos.row()][pos.col()] = PATH_MARK;
            }
        }
        StringBuilder text = new StringBuilder();
        for (char[] row : grid) {
            if (!text.isEmpty()) text.append('\n');
            text.append(row);
        }
        return text.toString();
    }

    /** Describes a path as compass letters, e.g. "EESSW". */
    public static String toMoves(List<Position> path) {
        StringBuilder moves = new StringBuilder();
        for (int i = 1; i < path.size(); i++) moves.append(path.get(i - 1).directionTo(path.get(i)));
        return moves.toString();
    }

    public static String summary(Level level, Run run) {
        if (run == null) return level.name() + ": no route";
        return level.name() + ": " + run.moves() + " moves  " + toMoves(run.path());
    }
}
