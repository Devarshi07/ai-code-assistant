package maze;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Route finding over Level grids. */
public final class Solver {
    /** Leg length for a stop that cannot be reached; large, but safe to add to. */
    private static final int UNREACHABLE = Integer.MAX_VALUE / 4;

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

    /** BFS over the whole level from source; maps each reachable tile to its parent. */
    private static Map<Position, Position> searchFrom(Level level, Position source) {
        Map<Position, Position> cameFrom = new HashMap<>();
        cameFrom.put(source, null);
        ArrayDeque<Position> queue = new ArrayDeque<>();
        queue.add(source);
        while (!queue.isEmpty()) {
            Position current = queue.poll();
            for (Position next : level.movesFrom(current)) {
                if (cameFrom.containsKey(next)) continue;
                cameFrom.put(next, current);
                queue.add(next);
            }
        }
        return cameFrom;
    }

    /** Shortest route from the start tile to the exit, ignoring gems; null when there is none. */
    public static Run solve(Level level) {
        List<Position> path = shortestPath(level, level.start(), level.exit());
        return path == null ? null : new Run(path, path.size() - 1);
    }

    /**
     * Shortest route from the start tile to the exit that steps on every gem.
     *
     * <p>One BFS per stop gives every directional leg. A Held-Karp dynamic
     * program over subsets of gems then finds the best order in O(2^k * k^2).
     */
    public static Run collectAllGems(Level level) {
        List<Position> gems = level.gems();
        int k = gems.size();
        if (k == 0) return solve(level);
        List<Map<Position, Position>> trees = new ArrayList<>();
        trees.add(searchFrom(level, level.start()));
        for (Position gem : gems) trees.add(searchFrom(level, gem));
        // toGem[i][j]: source i (0 = start, 1..k = gems) to gem j (0-based).
        int[][] toGem = new int[k + 1][k];
        int[] toExit = new int[k + 1];
        for (int i = 0; i <= k; i++) {
            for (int j = 0; j < k; j++) toGem[i][j] = legLength(trees.get(i), gems.get(j));
            toExit[i] = legLength(trees.get(i), level.exit());
        }

        int full = (1 << k) - 1;
        int[][] best = new int[1 << k][k];
        int[][] parent = new int[1 << k][k];
        for (int[] row : best) Arrays.fill(row, UNREACHABLE);
        for (int[] row : parent) Arrays.fill(row, -1);
        for (int j = 0; j < k; j++) best[1 << j][j] = toGem[0][j];
        for (int mask = 1; mask <= full; mask++) {
            int[] row = best[mask];
            for (int last = 0; last < k; last++) {
                int here = row[last];
                if (here >= UNREACHABLE) continue;
                int[] legs = toGem[last + 1];
                for (int next = 0; next < k; next++) {
                    int bit = 1 << next;
                    if ((mask & bit) != 0 || legs[next] >= UNREACHABLE) continue;
                    int cost = here + legs[next];
                    if (cost < best[mask | bit][next]) {
                        best[mask | bit][next] = cost;
                        parent[mask | bit][next] = last;
                    }
                }
            }
        }

        int bestTotal = UNREACHABLE;
        int bestLast = -1;
        for (int last = 0; last < k; last++) {
            if (best[full][last] >= UNREACHABLE || toExit[last + 1] >= UNREACHABLE) continue;
            int total = best[full][last] + toExit[last + 1];
            if (total < bestTotal) {
                bestTotal = total;
                bestLast = last;
            }
        }
        if (bestLast < 0) return null;

        List<Integer> order = new ArrayList<>();
        for (int mask = full, last = bestLast; last >= 0; ) {
            order.add(last);
            int previous = parent[mask][last];
            mask ^= 1 << last;
            last = previous;
        }
        Collections.reverse(order);

        List<Position> path = new ArrayList<>(List.of(level.start()));
        int from = 0;
        for (int gem : order) {
            List<Position> leg = rebuild(trees.get(from), gems.get(gem));
            path.addAll(leg.subList(1, leg.size()));
            from = gem + 1;
        }
        List<Position> tail = rebuild(trees.get(from), level.exit());
        path.addAll(tail.subList(1, tail.size()));
        return new Run(path, path.size() - 1);
    }

    /** Moves from a search tree's source to target, or UNREACHABLE. */
    private static int legLength(Map<Position, Position> tree, Position target) {
        if (!tree.containsKey(target)) return UNREACHABLE;
        int steps = 0;
        for (Position at = tree.get(target); at != null; at = tree.get(at)) steps++;
        return steps;
    }
}
