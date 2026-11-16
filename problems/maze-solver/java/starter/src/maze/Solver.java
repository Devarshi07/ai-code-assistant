package maze;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Route finding over Level grids. */
public final class Solver {
    private Solver() {}

    /**
     * Breadth-first search from source to target.
     *
     * @return the positions from source to target inclusive, or null when the
     *     target cannot be reached
     */
    public static List<Position> shortestPath(Level level, Position source, Position target) {
        if (source.equals(target)) return List.of(source);
        Map<Position, Position> cameFrom = new HashMap<>();
        cameFrom.put(source, null);
        ArrayDeque<Position> queue = new ArrayDeque<>();
        queue.add(source);
        while (!queue.isEmpty()) {
            Position current = queue.poll();
            for (Position next : level.movesFrom(current)) {
                if (cameFrom.containsKey(next)) continue;
                cameFrom.put(next, current);
                if (next.equals(target)) return rebuild(cameFrom, next);
                queue.add(next);
            }
        }
        return null;
    }

    private static List<Position> rebuild(Map<Position, Position> cameFrom, Position target) {
        List<Position> path = new ArrayList<>();
        for (Position at = target; at != null; at = cameFrom.get(at)) path.add(at);
        Collections.reverse(path);
        return path;
    }

    /** Shortest route from the start tile to the exit, ignoring gems; null when there is none. */
    public static Run solve(Level level) {
        List<Position> path = shortestPath(level, level.start(), level.exit());
        return path == null ? null : new Run(path, path.size() - 1);
    }

    /** Shortest route from the start tile to the exit that steps on every gem. */
    public static Run collectAllGems(Level level) {
        throw new UnsupportedOperationException("Phase 2: collectAllGems is not implemented yet");
    }
}
