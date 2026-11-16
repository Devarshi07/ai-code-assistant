package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import maze.Level;
import maze.Position;
import maze.Run;
import maze.Solver;
import org.junit.jupiter.api.Test;

class Phase3Test {
    static final String VAULT = """
            ###############
            #S..#...$...>.#
            #.#.#.#####.#.#
            #.#$..#...#.#.#
            #.#####.#.#.#.#
            #...$...#..$#E#
            #####v#######.#
            #.....$.......#
            ###############
            """;

    static final Map<Character, List<Integer>> GATE_DELTAS = Map.of(
            '>', List.of(0, 1), '<', List.of(0, -1), '^', List.of(-1, 0), 'v', List.of(1, 0));

    static void assertValidRun(Level level, Run run) {
        List<Position> path = run.path();
        assertEquals(path.size() - 1, run.moves());
        assertEquals(level.start(), path.get(0));
        assertEquals(level.exit(), path.get(path.size() - 1));
        for (int i = 1; i < path.size(); i++) {
            Position a = path.get(i - 1);
            Position b = path.get(i);
            List<Integer> delta = List.of(b.row() - a.row(), b.col() - a.col());
            assertEquals(1, Math.abs(delta.get(0)) + Math.abs(delta.get(1)), a + " -> " + b + " is not a single step");
            assertTrue(b.row() >= 0 && b.row() < level.height() && b.col() >= 0 && b.col() < level.width(), b + " is off the map");
            char here = level.rows().get(a.row()).charAt(a.col());
            char there = level.rows().get(b.row()).charAt(b.col());
            assertNotEquals('#', there, b + " is a wall");
            if (GATE_DELTAS.containsKey(here)) assertEquals(GATE_DELTAS.get(here), delta, "left a gate the wrong way");
            if (GATE_DELTAS.containsKey(there)) assertEquals(GATE_DELTAS.get(there), delta, "entered a gate the wrong way");
        }
        Set<Position> visited = new HashSet<>(path);
        for (Position gem : level.gems()) assertTrue(visited.contains(gem), "gem at " + gem + " was never collected");
    }

    @Test
    void vaultWithGatesAndFiveGems() {
        Level level = Level.parse(VAULT);
        Run run = Solver.collectAllGems(level);
        assertEquals(42, run.moves());
        assertValidRun(level, run);
    }

    @Test
    void generatedLevelWithEightGems() {
        Level level = Level.parse(Generator.generate(21, 31, 8));
        Run run = Solver.collectAllGems(level);
        assertEquals(121, run.moves());
        assertValidRun(level, run);
    }

    // The underscore keeps "a" a separate word in the test name shown in the app.
    @Test
    void elevenGemsOnA_LargeLevelIsFast() {
        Level level = Level.parse(Generator.generate(7, 61, 11));
        // Warm up on another large level with fewer gems, so JIT compilation isn't timed.
        Level warmUp = Level.parse(Generator.generate(3, 61, 8));
        for (int i = 0; i < 5; i++) Solver.collectAllGems(warmUp);
        long start = System.nanoTime();
        Run run = Solver.collectAllGems(level);
        long elapsed = (System.nanoTime() - start) / 1_000_000;
        assertNotNull(run);
        assertEquals(450, run.moves());
        assertValidRun(level, run);
        assertTrue(elapsed < 300, "took " + elapsed + "ms; an 11-gem level must solve in under 300ms");
    }
}
