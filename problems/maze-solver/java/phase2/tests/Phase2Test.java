package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import maze.Level;
import maze.Levels;
import maze.Position;
import maze.Run;
import maze.Solver;
import org.junit.jupiter.api.Test;

class Phase2Test {
    // Nearest-gem-first walks left, then all the way right, then back: 22 moves.
    // Going right first is shorter.
    static final String CORRIDOR = """
            #############
            #E$..S.....$#
            #############
            """;

    // The gem is only reachable through the eastbound gate, and the only way back
    // to the exit is the long loop through the westbound gate.
    static final String ONE_WAY_LOOP = """
            #########
            #S.>.$..#
            #.#####.#
            #E..<...#
            #########
            """;

    static final String SEALED_GEM = """
            #######
            #S..E.#
            #####.#
            #$#...#
            #######
            """;

    static final String SEALED_EXIT = """
            #######
            #S.$#E#
            #######
            """;

    static final Map<Character, List<Integer>> GATE_DELTAS = Map.of(
            '>', List.of(0, 1), '<', List.of(0, -1), '^', List.of(-1, 0), 'v', List.of(1, 0));

    /** A run starts at S, ends at E, takes legal steps and visits every gem. */
    static void assertValidRun(Level level, Run run) {
        List<Position> path = run.path();
        assertEquals(path.size() - 1, run.moves(), "moves must equal path.size() - 1");
        assertEquals(level.start(), path.get(0), "run must begin on the start tile");
        assertEquals(level.exit(), path.get(path.size() - 1), "run must end on the exit tile");
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
    void levelWithoutGemsMatchesPlainSolve() {
        Level level = Level.parse(Levels.TUTORIAL);
        Run run = Solver.collectAllGems(level);
        assertNotNull(run);
        assertEquals(Solver.solve(level).moves(), run.moves());
        assertValidRun(level, run);
    }

    @Test
    void singleGemDetour() {
        Level level = Level.parse(Levels.TOWER);
        Run run = Solver.collectAllGems(level);
        assertEquals(13, run.moves());
        assertValidRun(level, run);
    }

    @Test
    void orderMatters() {
        Level level = Level.parse(CORRIDOR);
        Run run = Solver.collectAllGems(level);
        assertEquals(16, run.moves(), "collect the far gem first");
        assertValidRun(level, run);
    }

    @Test
    void legsAreDirectional() {
        Level level = Level.parse(ONE_WAY_LOOP);
        Run run = Solver.collectAllGems(level);
        assertNotNull(run);
        assertEquals(14, run.moves());
        assertValidRun(level, run);
    }

    @Test
    void treasuryThreeGems() {
        Level level = Level.parse(Levels.TREASURY);
        Run run = Solver.collectAllGems(level);
        assertEquals(28, run.moves());
        assertValidRun(level, run);
    }

    @Test
    void unreachableGemMeansNoRun() {
        assertNull(Solver.collectAllGems(Level.parse(SEALED_GEM)));
    }

    @Test
    void unreachableExitMeansNoRun() {
        assertNull(Solver.collectAllGems(Level.parse(SEALED_EXIT)));
    }
}
