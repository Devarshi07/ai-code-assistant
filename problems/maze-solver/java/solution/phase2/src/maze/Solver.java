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

    /**
     * Shortest route from the start tile to the exit that steps on every gem.
     *
     * <p>Computes the shortest leg between every pair of stops, then tries every
     * order of gems. Legs are directional because gates are one-way.
     */
    public static Run collectAllGems(Level level) {
        List<Position> stops = new ArrayList<>();
        stops.add(level.start());
        stops.addAll(level.gems());
        stops.add(level.exit());
        int count = stops.size();
        // legs.get(a).get(b): the shortest path from stop a to stop b, or null.
        List<List<List<Position>>> legs = new ArrayList<>();
        for (Position from : stops) {
            List<List<Position>> row = new ArrayList<>();
            for (Position to : stops) row.add(shortestPath(level, from, to));
            legs.add(row);
        }

        OrderSearch search = new OrderSearch(legs, level.gems().size());
        search.visit(0, 0);
        if (search.bestOrder == null) return null;
        List<Position> path = new ArrayList<>(List.of(level.start()));
        int from = 0;
        for (int gem : search.bestOrder) {
            List<Position> leg = legs.get(from).get(gem);
            path.addAll(leg.subList(1, leg.size()));
            from = gem;
        }
        List<Position> tail = legs.get(from).get(count - 1);
        path.addAll(tail.subList(1, tail.size()));
        return new Run(path, path.size() - 1);
    }

    /** Depth-first search over every visiting order of the gems. */
    private static final class OrderSearch {
        private final List<List<List<Position>>> legs;
        private final int gemCount;
        private final int exit;
        private final boolean[] used;
        private final List<Integer> order = new ArrayList<>();
        private int bestTotal = Integer.MAX_VALUE;
        private List<Integer> bestOrder;

        OrderSearch(List<List<List<Position>>> legs, int gemCount) {
            this.legs = legs;
            this.gemCount = gemCount;
            this.exit = gemCount + 1;
            this.used = new boolean[gemCount + 1];
        }

        void visit(int last, int total) {
            if (order.size() == gemCount) {
                List<Position> tail = legs.get(last).get(exit);
                if (tail != null && total + tail.size() - 1 < bestTotal) {
                    bestTotal = total + tail.size() - 1;
                    bestOrder = List.copyOf(order);
                }
                return;
            }
            for (int gem = 1; gem <= gemCount; gem++) {
                List<Position> leg = legs.get(last).get(gem);
                if (used[gem] || leg == null) continue;
                used[gem] = true;
                order.add(gem);
                visit(gem, total + leg.size() - 1);
                order.remove(order.size() - 1);
                used[gem] = false;
            }
        }
    }
}
