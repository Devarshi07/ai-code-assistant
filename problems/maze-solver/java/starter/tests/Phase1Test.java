package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import maze.Level;
import maze.LevelException;
import maze.Levels;
import maze.Position;
import maze.Render;
import maze.Run;
import maze.Solver;
import org.junit.jupiter.api.Test;

class Phase1Test {
    static final String GATED_SQUARE = """
            #######
            #S..>E#
            #.###.#
            #.....#
            #.###.#
            #.....#
            #######
            """;

    static final String WALLED_OFF = """
            #####
            #S#E#
            #.#.#
            #.#.#
            #####
            """;

    static final Map<Character, List<Integer>> GATE_DELTAS = Map.of(
            '>', List.of(0, 1), '<', List.of(0, -1), '^', List.of(-1, 0), 'v', List.of(1, 0));

    /** Every step must stay on the map, avoid walls and respect gates. */
    static void assertRoute(Level level, List<Position> path) {
        for (int i = 1; i < path.size(); i++) {
            Position a = path.get(i - 1);
            Position b = path.get(i);
            List<Integer> delta = List.of(b.row() - a.row(), b.col() - a.col());
            assertEquals(1, Math.abs(delta.get(0)) + Math.abs(delta.get(1)), a + " -> " + b + " is not a single step");
            assertTrue(b.row() >= 0 && b.row() < level.height() && b.col() >= 0 && b.col() < level.width(), b + " is off the map");
            char here = level.rows().get(a.row()).charAt(a.col());
            char there = level.rows().get(b.row()).charAt(b.col());
            assertNotEquals('#', there, b + " is a wall");
            if (GATE_DELTAS.containsKey(here)) assertEquals(GATE_DELTAS.get(here), delta, "left gate " + here + " the wrong way");
            if (GATE_DELTAS.containsKey(there)) assertEquals(GATE_DELTAS.get(there), delta, "entered gate " + there + " the wrong way");
        }
    }

    @Test
    void squareLevelShortestRoute() {
        Run run = Solver.solve(Level.parse(GATED_SQUARE));
        assertNotNull(run);
        assertEquals(4, run.moves());
        assertEquals("EEEE", Render.toMoves(run.path()));
    }

    @Test
    void gatesOnlyOpenOneWay() {
        Level level = Level.parse(GATED_SQUARE);
        List<Position> back = Solver.shortestPath(level, level.exit(), level.start());
        assertEquals(8, back.size() - 1, "the way back must go around the gate");
        assertRoute(level, back);
    }

    @Test
    void unreachableExitReturnsNull() {
        assertNull(Solver.solve(Level.parse(WALLED_OFF)));
    }

    @Test
    void wideLevelIsSolvable() {
        Level level = Level.parse(Levels.TUTORIAL, "tutorial");
        Run run = Solver.solve(level);
        assertNotNull(run, "the tutorial level has a route to the exit");
        assertEquals(12, run.moves());
        assertRoute(level, run.path());
    }

    @Test
    void wideCanyonRoute() {
        Level level = Level.parse(Levels.CANYON, "canyon");
        Run run = Solver.solve(level);
        assertNotNull(run, "the canyon level has a route to the exit");
        assertEquals(20, run.moves());
        assertRoute(level, run.path());
    }

    @Test
    void tallLevelStaysOnTheMap() {
        Level level = Level.parse(Levels.SPIRE, "spire");
        Run run = Solver.solve(level);
        assertNotNull(run);
        assertRoute(level, run.path());
        assertEquals(22, run.moves());
    }

    @Test
    void parseReadsDimensionsAndMarkers() {
        Level level = Level.parse(Levels.TUTORIAL);
        assertEquals(List.of(9, 5), List.of(level.width(), level.height()));
        assertEquals(new Position(1, 1), level.start());
        assertEquals(new Position(3, 7), level.exit());
    }

    @Test
    void raggedRowsAreRejected() {
        assertThrows(LevelException.class, () -> Level.parse("#####\n#S.E#\n###"));
    }

    @Test
    void exactlyOneStartRequired() {
        assertThrows(LevelException.class, () -> Level.parse("######\n#SS.E#\n######"));
    }
}
