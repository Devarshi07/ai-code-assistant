package tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import armada.Bot;
import armada.Coord;
import armada.Fleet;
import armada.Ocean;
import armada.Placer;
import armada.SeekerBot;
import armada.Ship;
import armada.ShotResult;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class Phase3Test {
    // Hand-drawn QA fleets where ships touch. '.' is water; each letter is one ship.
    private static final String STACKED = """
            AAAAA.....
            BBBB......
            CCC.......
            DDD.......
            EE........
            ..........
            ..........
            ..........
            ..........
            ..........
            """;

    private static final String PALISADE = """
            ..........
            ..........
            ..........
            ..........
            ..........
            .....A....
            .....AB...
            .....ABCD.
            .....ABCDE
            .....ABCDE
            """;

    private static final String HARBOUR = """
            ..........
            ..........
            ..........
            ...AAAAA..
            ...BBBBE..
            ...CCCDE..
            ......D...
            ......D...
            ..........
            ..........
            """;

    private static final String CORNER = """
            AAA..
            BB...
            C....
            D....
            .....
            """;

    /** Builds a Fleet from a hand-drawn chart (an independent parser, not the codebase's). */
    private static Fleet chartFleet(String text) {
        List<String> rows = text.lines().filter(line -> !line.isEmpty()).toList();
        Fleet fleet = new Fleet(new Ocean(rows.size()));
        Map<Character, List<Coord>> ships = new TreeMap<>();
        for (int r = 0; r < rows.size(); r++) {
            String line = rows.get(r);
            for (int c = 0; c < line.length(); c++) {
                char ch = line.charAt(c);
                if (ch != '.') ships.computeIfAbsent(ch, letter -> new ArrayList<>()).add(new Coord(r, c));
            }
        }
        for (List<Coord> cells : ships.values()) {
            boolean vertical = cells.size() > 1 && cells.get(0).col() == cells.get(1).col();
            fleet.place(cells.size(), cells.get(0), vertical);
        }
        return fleet;
    }

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

    private static double average(List<Integer> values) {
        return values.stream().mapToInt(Integer::intValue).average().orElse(0);
    }

    // Efficiency

    @Test
    void standardBoardAveragesUnder70Shots() {
        // Warm up on other fleets first, so the timing measures the bot and not the JIT compiler.
        for (int seed = 101; seed <= 130; seed++) referee(new SeekerBot(10, Fleet.DEFAULT_FLEET), Placer.randomFleet(seed));
        long start = System.nanoTime();
        List<Integer> shots = new ArrayList<>();
        for (int seed = 1; seed <= 60; seed++) shots.add(referee(new SeekerBot(10, Fleet.DEFAULT_FLEET), Placer.randomFleet(seed)));
        double elapsed = (System.nanoTime() - start) / 1e6;
        double mean = average(shots);
        assertTrue(mean < 70, String.format(Locale.ROOT, "averaged %.1f shots over 60 standard fleets; must be under 70", mean));
        assertTrue(elapsed < 1000, String.format(Locale.ROOT, "60 matches took %.0fms; the benchmark must finish in under 1000ms", elapsed));
    }

    @Test
    void largeBoardAveragesUnder135Shots() {
        List<Integer> shots = new ArrayList<>();
        for (int seed = 1; seed <= 30; seed++) shots.add(referee(new SeekerBot(15, Fleet.DEFAULT_FLEET), Placer.randomFleet(seed, 15)));
        double mean = average(shots);
        assertTrue(mean < 135, String.format(Locale.ROOT, "averaged %.1f shots over 30 fleets on 15x15; must be under 135", mean));
    }

    // Robustness

    @Test
    void touchingShipsAreAllSunk() {
        for (Map.Entry<String, String> chart : List.of(Map.entry("stacked", STACKED), Map.entry("palisade", PALISADE),
                Map.entry("harbour", HARBOUR), Map.entry("corner", CORNER))) {
            Fleet fleet = chartFleet(chart.getValue());
            try {
                referee(new SeekerBot(fleet.ocean().size(), fleet.shipSizes()), fleet);
            } catch (AssertionError | RuntimeException error) {
                fail(chart.getKey() + " fleet: " + error.getMessage(), error);
            }
        }
    }

    @Test
    void oneCellShipsAreFound() {
        record Case(int size, List<Integer> lengths) {
        }
        List<Integer> standardWithPatrolBoat = Stream.concat(Fleet.DEFAULT_FLEET.stream(), Stream.of(1)).toList();
        for (Case c : List.of(new Case(6, List.of(3, 2, 1, 1)), new Case(9, List.of(4, 3, 1, 1, 1)), new Case(12, standardWithPatrolBoat))) {
            for (int seed = 1; seed <= 15; seed++) referee(new SeekerBot(c.size(), c.lengths()), Placer.randomFleet(seed, c.size(), c.lengths()));
        }
    }

    @Test
    void manyBoardSizes() {
        for (int size = 5; size <= 16; size++) {
            List<Integer> lengths = size < 7 ? List.of(3, 2) : size < 10 ? List.of(4, 3, 2, 2) : size < 14 ? Fleet.DEFAULT_FLEET : List.of(5, 4, 4, 3, 3, 2, 2);
            for (int seed = 1; seed <= 8; seed++) referee(new SeekerBot(size, lengths), Placer.randomFleet(seed, size, lengths));
        }
    }
}
