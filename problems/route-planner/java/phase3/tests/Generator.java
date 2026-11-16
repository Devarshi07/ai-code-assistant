package tests;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Deterministic timetable generator for large test networks.
 *
 * <p>Stations sit on a size x size street grid and are named after their grid cell ("S12-7").
 * Each line wanders across the grid without revisiting a stop; about one in five is an
 * express that skips cells and runs faster per cell, and about one in eight is one-way. The
 * tests in the other languages use the same generator, so a seed produces the same network
 * in each.
 */
final class Generator {
    // Grid steps for east, south, west, north; turning right is +1, left is +3.
    private static final int[][] DIRECTIONS = {{0, 1}, {1, 0}, {0, -1}, {-1, 0}};

    private Generator() {
    }

    /** Park-Miller "minimal standard" generator. */
    static final class Lcg {
        private long state;

        Lcg(long seed) {
            state = seed % 2147483647L;
            if (state == 0) {
                state = 1;
            }
        }

        int below(int n) {
            state = state * 48271L % 2147483647L;
            return (int) (state % n);
        }
    }

    /** Timetable text and its station names, sorted. */
    record GeneratedTimetable(String text, List<String> stations) {
    }

    record Query(String origin, String destination) {
    }

    static GeneratedTimetable generateTimetable(long seed, int size, int lines, int minStops, int maxStops) {
        Lcg rng = new Lcg(seed);
        List<String> entries = new ArrayList<>();
        entries.add("# generated: seed " + seed + ", " + size + "x" + size + " grid, " + lines + " lines");
        Set<String> stations = new TreeSet<>();
        for (int number = 1; number <= lines; number++) {
            boolean express = rng.below(5) == 0;
            int stride = express ? 2 + rng.below(2) : 1;
            int row = rng.below(size);
            int col = rng.below(size);
            int heading = rng.below(4);
            int target = minStops + rng.below(maxStops - minStops + 1);
            List<int[]> stops = new ArrayList<>();
            stops.add(new int[] {row, col});
            List<Integer> minutes = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            seen.add(row + "," + col);
            while (stops.size() < target) {
                int roll = rng.below(10);
                int[] order;
                if (roll < 7) {
                    order = new int[] {heading, (heading + 1) % 4, (heading + 3) % 4};
                } else if (roll < 9) {
                    order = new int[] {(heading + 1) % 4, heading, (heading + 3) % 4};
                } else {
                    order = new int[] {(heading + 3) % 4, heading, (heading + 1) % 4};
                }
                boolean moved = false;
                for (int turn : order) {
                    int nr = row + DIRECTIONS[turn][0] * stride;
                    int nc = col + DIRECTIONS[turn][1] * stride;
                    if (nr >= 0 && nr < size && nc >= 0 && nc < size && !seen.contains(nr + "," + nc)) {
                        row = nr;
                        col = nc;
                        heading = turn;
                        moved = true;
                        break;
                    }
                }
                if (!moved) {
                    break; // boxed in: the line ends here
                }
                stops.add(new int[] {row, col});
                seen.add(row + "," + col);
                minutes.add(express ? stride + rng.below(2) : 2 + rng.below(3));
            }
            boolean oneWay = rng.below(8) == 0;
            List<String> names = stops.stream().map(cell -> "S" + cell[0] + "-" + cell[1]).toList();
            stations.addAll(names);
            StringBuilder body = new StringBuilder(names.getFirst());
            for (int i = 1; i < names.size(); i++) {
                body.append(' ').append(minutes.get(i - 1)).append(' ').append(names.get(i));
            }
            entries.add("line " + (express ? "X" : "L") + number + (oneWay ? " oneway" : "") + ": " + body);
        }
        return new GeneratedTimetable(String.join("\n", entries) + "\n", List.copyOf(stations));
    }

    /** Deterministic (origin, destination) pairs of distinct stations. */
    static List<Query> pickQueries(long seed, List<String> stations, int count) {
        Lcg rng = new Lcg(seed);
        List<Query> queries = new ArrayList<>();
        while (queries.size() < count) {
            String origin = stations.get(rng.below(stations.size()));
            String destination = stations.get(rng.below(stations.size()));
            if (!origin.equals(destination)) {
                queries.add(new Query(origin, destination));
            }
        }
        return queries;
    }
}
