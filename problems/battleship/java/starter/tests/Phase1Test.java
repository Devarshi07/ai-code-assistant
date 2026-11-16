package tests;

import static armada.ShotResult.HIT;
import static armada.ShotResult.MISS;
import static armada.ShotResult.SUNK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import armada.Battle;
import armada.Coord;
import armada.Fleet;
import armada.Match;
import armada.MatchReport;
import armada.Ocean;
import armada.OffBoardException;
import armada.PlacementException;
import armada.Placer;
import armada.ScriptedBot;
import armada.Ship;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class Phase1Test {
    // Placer.randomFleet(7) as recorded by QA. Every other harness produces the same chart.
    private static final String SEED_7_CHART = """
                 1  2  3  4  5  6  7  8  9 10
             A   .  .  A  A  A  A  A  .  .  .
             B   .  .  .  .  .  .  .  .  .  .
             C   .  .  .  .  .  .  .  .  .  .
             D   .  .  .  C  .  .  .  .  .  .
             E   .  .  .  C  .  .  .  .  .  .
             F   .  .  E  C  .  .  B  B  B  B
             G   .  .  E  .  D  .  .  .  .  .
             H   .  .  .  .  D  .  .  .  .  .
             I   .  .  .  .  D  .  .  .  .  .
             J   .  .  .  .  .  .  .  .  .  .
            """;

    // QA ticket #212: an experimental bot that kept re-firing at the same squares.
    private static final List<String> STUCK_BOT_SHOTS = List.of("C5", "A3", "A3", "A3", "A3", "A3", "F7", "F7", "F7", "F7",
            "D4", "D4", "D4", "G5", "G5", "G5", "F3", "F3");

    /** 6x6 board: a destroyer on A1-A2 and a vertical cruiser on C4-E4. */
    private static Fleet smallFleet() {
        Fleet fleet = new Fleet(new Ocean(6));
        fleet.place(2, "A1");
        fleet.place(3, "C4", true);
        return fleet;
    }

    private record Cell(int row, int col) {
    }

    /** Ships are straight, unbroken, on the board and never share a cell. */
    private static void assertValidFleet(Fleet fleet, int size, List<Integer> lengths) {
        assertEquals(lengths.stream().sorted().toList(), fleet.ships().stream().map(ship -> ship.cells().size()).sorted().toList());
        Set<Cell> seen = new HashSet<>();
        for (Ship ship : fleet.ships()) {
            List<Cell> cells = ship.cells().stream().map(c -> new Cell(c.row(), c.col()))
                    .sorted(Comparator.comparingInt(Cell::row).thenComparingInt(Cell::col)).toList();
            Cell first = cells.get(0);
            List<Cell> across = new ArrayList<>();
            List<Cell> down = new ArrayList<>();
            for (int i = 0; i < cells.size(); i++) {
                across.add(new Cell(first.row(), first.col() + i));
                down.add(new Cell(first.row() + i, first.col()));
            }
            assertTrue(cells.equals(across) || cells.equals(down), ship.name() + " is not a straight unbroken line: " + cells);
            for (Cell cell : cells) {
                int r = cell.row(), c = cell.col();
                assertTrue(r >= 0 && r < size && c >= 0 && c < size, ship.name() + " hangs off the board at (" + r + ", " + c + ")");
                assertTrue(seen.add(cell), ship.name() + " overlaps another ship at (" + r + ", " + c + ")");
            }
        }
    }

    // Shots

    @Test
    void freshShotsReportMissHitAndSunk() {
        Battle battle = new Battle(smallFleet());
        assertEquals(List.of(MISS, HIT, SUNK), List.of(battle.fire("A3"), battle.fire("A1"), battle.fire("A2")));
        assertEquals(3, battle.shotsFired());
        assertFalse(battle.fleetSunk());
    }

    @Test
    void repeatShotIntoWaterIsAWastedMiss() {
        Battle battle = new Battle(smallFleet());
        assertEquals(List.of(MISS, MISS), List.of(battle.fire("B5"), battle.fire("B5")));
        assertEquals(2, battle.shotsFired());
        assertTrue(battle.log().get(1).repeat());
        assertEquals(1, battle.repeats());
    }

    @Test
    void repeatShotAtAHitIsAWastedMiss() {
        Battle battle = new Battle(smallFleet());
        assertEquals(HIT, battle.fire("D4"));
        assertEquals(MISS, battle.fire("D4"), "a second shot at a cell that was already hit must be a MISS");
        assertEquals(2, battle.shotsFired());
        assertTrue(battle.log().get(1).repeat(), "the second shot must be logged as a repeat");
    }

    @Test
    void doubleTapDoesNotSinkADestroyer() {
        Fleet fleet = smallFleet();
        Battle battle = new Battle(fleet);
        assertEquals(List.of(HIT, MISS), List.of(battle.fire("A1"), battle.fire("A1")));
        assertFalse(fleet.shipAt("A1").isSunk(), "only one of the destroyer's two cells has been hit");
        assertEquals(SUNK, battle.fire("A2"));
    }

    @Test
    void firingAtASunkShipAgainIsAMiss() {
        Battle battle = new Battle(smallFleet());
        for (String cell : List.of("C4", "D4", "E4")) battle.fire(cell);
        assertEquals(MISS, battle.fire("E4"));
        assertEquals(1, battle.repeats());
    }

    @Test
    void fleetIsSunkOnlyWhenEveryShipIs() {
        Battle battle = new Battle(smallFleet());
        for (String cell : List.of("A1", "A2", "C4", "D4")) battle.fire(cell);
        assertFalse(battle.fleetSunk());
        assertEquals(SUNK, battle.fire("E4"));
        assertTrue(battle.fleetSunk());
    }

    @Test
    void offBoardShotThrowsAndIsNotCounted() {
        Battle battle = new Battle(smallFleet());
        assertThrows(OffBoardException.class, () -> battle.fire("G1"));
        assertThrows(OffBoardException.class, () -> battle.fire(new Coord(0, 6)));
        assertEquals(0, battle.shotsFired());
    }

    // Matches

    @Test
    void stuckBotCannotWinByRepeating() {
        ScriptedBot bot = ScriptedBot.fromLabels(10, STUCK_BOT_SHOTS);
        MatchReport report = Match.play(bot, Placer.randomFleet(7), STUCK_BOT_SHOTS.size());
        assertEquals(18, report.shots());
        assertFalse(report.won(), "the bot only ever hit five distinct cells");
        assertEquals(12, report.repeats());
    }

    @Test
    void rowByRowReplayWinsWithoutRepeats() {
        List<Coord> shots = new ArrayList<>();
        for (int r = 0; r < 10; r++) for (int c = 0; c < 10; c++) shots.add(new Coord(r, c));
        MatchReport report = Match.play(new ScriptedBot(10, shots), Placer.randomFleet(7));
        assertTrue(report.won());
        assertEquals(85, report.shots(), "the last ship cell in row order is I5");
        assertEquals(0, report.repeats());
    }

    // Placement

    @Test
    void overlappingShipIsRejected() {
        Fleet fleet = smallFleet();
        assertThrows(PlacementException.class, () -> fleet.place(3, "D3"));
        assertEquals(2, fleet.ships().size());
    }

    @Test
    void shipRunningOffTheBoardIsRejected() {
        Fleet fleet = new Fleet(new Ocean(6));
        assertThrows(PlacementException.class, () -> fleet.place(4, "A4"));
        assertThrows(PlacementException.class, () -> fleet.place(3, "E2", true));
    }

    @Test
    void seededFleetsAreValidAndReproducible() {
        record Case(int size, List<Integer> lengths) {
        }
        for (Case c : List.of(new Case(10, List.of(5, 4, 3, 3, 2)), new Case(6, List.of(4, 3, 2)), new Case(15, List.of(5, 4, 4, 3, 3, 2, 1)))) {
            for (int seed = 1; seed <= 40; seed++) {
                Fleet fleet = Placer.randomFleet(seed, c.size(), c.lengths());
                assertValidFleet(fleet, c.size(), c.lengths());
                Fleet again = Placer.randomFleet(seed, c.size(), c.lengths());
                assertEquals(fleet.ships().stream().map(Ship::cells).toList(), again.ships().stream().map(Ship::cells).toList());
            }
        }
    }

    @Test
    void seed7MatchesTheRecordedChart() {
        assertEquals(SEED_7_CHART.stripTrailing(), Placer.randomFleet(7).render());
    }

    @Test
    void labels() {
        assertEquals(new Coord(1, 6), Coord.parse("B7"));
        assertEquals(new Coord(9, 9), Coord.parse(" j10 "));
        assertEquals("A1", new Coord(0, 0).label());
    }
}
