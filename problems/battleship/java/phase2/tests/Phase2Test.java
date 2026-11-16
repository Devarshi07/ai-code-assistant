package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import armada.Bot;
import armada.Coord;
import armada.Fleet;
import armada.Match;
import armada.MatchReport;
import armada.Ocean;
import armada.Placer;
import armada.SeekerBot;
import armada.Ship;
import armada.ShotResult;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class Phase2Test {
    /**
     * Plays bot against fleet with an independent referee and returns the shot count.
     *
     * <p>Results are worked out from the ships' cells here, not by Battle. The bot
     * must stay on the board, never fire at a cell twice, and sink every ship
     * within one shot per cell.
     */
    private static int referee(Bot bot, Fleet fleet) {
        int size = fleet.ocean().size();
        List<Ship> ships = fleet.ships();
        Map<Integer, Integer> owner = new HashMap<>(); // row * size + col -> index of the ship there
        int[] afloat = new int[ships.size()];
        for (int i = 0; i < ships.size(); i++) {
            for (Coord c : ships.get(i).cells()) owner.put(c.row() * size + c.col(), i);
            afloat[i] = ships.get(i).cells().size();
        }
        Set<Integer> fired = new HashSet<>();
        while (Arrays.stream(afloat).anyMatch(n -> n > 0)) {
            assertTrue(fired.size() < size * size, () -> "the fleet is still afloat after " + size * size + " shots");
            Coord shot = bot.nextShot();
            assertNotNull(shot, "nextShot() returned null");
            int row = shot.row(), col = shot.col();
            assertTrue(row >= 0 && row < size && col >= 0 && col < size,
                    () -> "shot (" + row + ", " + col + ") is off the " + size + "x" + size + " board");
            assertTrue(fired.add(row * size + col), () -> "cell (" + row + ", " + col + ") was fired at twice");
            ShotResult result = ShotResult.MISS;
            Integer ship = owner.get(row * size + col);
            if (ship != null) {
                afloat[ship] -= 1;
                result = afloat[ship] == 0 ? ShotResult.SUNK : ShotResult.HIT;
            }
            bot.observe(new Coord(row, col), result);
        }
        return fired.size();
    }

    @Test
    void sinksStandardFleetsWithoutRepeats() {
        for (int seed = 1; seed <= 25; seed++) {
            int shots = referee(new SeekerBot(10, Fleet.DEFAULT_FLEET), Placer.randomFleet(seed));
            assertTrue(shots <= 100, "seed " + seed + ": " + shots + " shots");
        }
    }

    @Test
    void shipsHidingAlongTheFarEdges() {
        Fleet fleet = new Fleet(new Ocean(10));
        fleet.place(5, "J6"); // J6-J10, the bottom row
        fleet.place(4, "E10", true); // E10-H10, the right-hand column
        fleet.place(3, "A8"); // A8-A10
        fleet.place(3, "H1", true); // H1-J1
        fleet.place(2, "J4"); // J4-J5
        referee(new SeekerBot(10, Fleet.DEFAULT_FLEET), fleet);
    }

    @Test
    void smallBoard() {
        for (int seed = 1; seed <= 20; seed++) referee(new SeekerBot(5, List.of(3, 2)), Placer.randomFleet(seed, 5, List.of(3, 2)));
    }

    @Test
    void crowdedBoard() {
        for (int seed = 1; seed <= 10; seed++) referee(new SeekerBot(7, Fleet.DEFAULT_FLEET), Placer.randomFleet(seed, 7, Fleet.DEFAULT_FLEET));
    }

    @Test
    void largeBoard() {
        List<Integer> lengths = List.of(5, 4, 4, 3, 3, 2);
        for (int seed = 1; seed <= 5; seed++) referee(new SeekerBot(20, lengths), Placer.randomFleet(seed, 20, lengths));
    }

    @Test
    void fleetWithAOneCellPatrolBoat() {
        List<Integer> lengths = List.of(4, 3, 1);
        for (int seed = 1; seed <= 20; seed++) referee(new SeekerBot(8, lengths), Placer.randomFleet(seed, 8, lengths));
    }

    @Test
    void fullMatchThroughTheRunner() {
        MatchReport report = Match.play(new SeekerBot(10, Fleet.DEFAULT_FLEET), Placer.randomFleet(7));
        assertTrue(report.won());
        assertEquals(0, report.repeats());
        assertTrue(report.shots() <= 100);
    }
}
