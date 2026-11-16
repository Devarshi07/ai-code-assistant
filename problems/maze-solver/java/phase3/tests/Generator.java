package tests;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Deterministic level generator for large test levels (mulberry32 PRNG). It is
 * the same generator as the other language versions, so a seed always gives the
 * same level.
 */
final class Generator {
    private Generator() {}

    /** mulberry32: a small 32-bit PRNG that returns doubles in [0, 1). */
    static final class Mulberry32 {
        private int seed;

        Mulberry32(int seed) {
            this.seed = seed;
        }

        double next() {
            seed += 0x6d2b79f5;
            int t = (seed ^ (seed >>> 15)) * (1 | seed);
            t = (t + (t ^ (t >>> 7)) * (61 | t)) ^ t;
            return ((t ^ (t >>> 14)) & 0xffffffffL) / 4294967296.0;
        }

        int pick(int n) {
            return (int) Math.floor(next() * n);
        }
    }

    static String generate(int seed, int size, int gems) {
        return generate(seed, size, gems, 0.08);
    }

    /** Carves a maze of size x size tiles, opens extra loops and scatters gems. */
    static String generate(int seed, int size, int gems, double loops) {
        Mulberry32 random = new Mulberry32(seed);
        char[][] grid = new char[size][size];
        for (char[] row : grid) Arrays.fill(row, '#');
        grid[1][1] = '.';
        List<int[]> stack = new ArrayList<>();
        stack.add(new int[] {1, 1});
        int[][] jumps = {{-2, 0}, {2, 0}, {0, -2}, {0, 2}};
        while (!stack.isEmpty()) {
            int[] top = stack.get(stack.size() - 1);
            int r = top[0], c = top[1];
            List<int[]> options = new ArrayList<>();
            for (int[] jump : jumps) {
                int nr = r + jump[0], nc = c + jump[1];
                if (nr > 0 && nr < size - 1 && nc > 0 && nc < size - 1 && grid[nr][nc] == '#') options.add(new int[] {nr, nc});
            }
            if (options.isEmpty()) {
                stack.remove(stack.size() - 1);
                continue;
            }
            int[] next = options.get(random.pick(options.size()));
            grid[(r + next[0]) / 2][(c + next[1]) / 2] = '.';
            grid[next[0]][next[1]] = '.';
            stack.add(next);
        }
        for (int i = 0; i < Math.floor(size * size * loops); i++) {
            int r = 1 + random.pick(size - 2), c = 1 + random.pick(size - 2);
            if (grid[r][c] == '#' && ((grid[r - 1][c] == '.' && grid[r + 1][c] == '.') || (grid[r][c - 1] == '.' && grid[r][c + 1] == '.'))) grid[r][c] = '.';
        }
        List<int[]> cells = new ArrayList<>();
        for (int r = 0; r < size; r++) for (int c = 0; c < size; c++) if (grid[r][c] == '.') cells.add(new int[] {r, c});
        for (int i = 0; i < gems + 2; i++) {
            int j = i + random.pick(cells.size() - i);
            int[] swap = cells.get(i);
            cells.set(i, cells.get(j));
            cells.set(j, swap);
        }
        grid[cells.get(0)[0]][cells.get(0)[1]] = 'S';
        grid[cells.get(1)[0]][cells.get(1)[1]] = 'E';
        for (int[] cell : cells.subList(2, gems + 2)) grid[cell[0]][cell[1]] = '$';
        StringBuilder text = new StringBuilder();
        for (char[] row : grid) {
            if (!text.isEmpty()) text.append('\n');
            text.append(row);
        }
        return text.toString();
    }
}
