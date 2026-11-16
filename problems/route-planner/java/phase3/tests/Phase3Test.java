package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import transit.Journey;
import transit.Leg;
import transit.Line;
import transit.Network;
import transit.Planner;
import transit.Timetable;

class Phase3Test {
    /** A query and its reference result: [total minutes, transfers], or null when unreachable. */
    private record Case(String origin, String destination, int transfer, List<Integer> expected) {
    }

    // Reference results on the medium network, checked against an independent
    // brute-force planner.
    private static final List<Case> MEDIUM_CASES = List.of(
            new Case("S18-21", "S9-8", 5, List.of(139, 8)),
            new Case("S17-12", "S13-1", 0, List.of(47, 4)),
            new Case("S1-19", "S2-2", 10, List.of(67, 2)),
            new Case("S23-3", "S4-16", 2, null),
            new Case("S13-1", "S5-21", 5, List.of(78, 3)),
            new Case("S11-15", "S2-20", 0, List.of(59, 8)),
            new Case("S2-1", "S7-4", 10, List.of(43, 2)),
            new Case("S19-16", "S22-13", 2, List.of(17, 1)),
            new Case("S5-5", "S13-18", 5, List.of(215, 10)),
            new Case("S6-15", "S16-22", 0, List.of(70, 8)),
            new Case("S2-4", "S13-17", 10, List.of(243, 8)),
            new Case("S12-17", "S1-20", 2, List.of(145, 10)));

    private static final int BATCH_SIZE = 15;
    private static final long BATCH_LIMIT_MS = 1000;
    // Rounds of the medium cases to run, untimed, before the batch.
    private static final int WARM_UP_ROUNDS = 8;

    private static Integer hopMinutes(Network network, String lineName, String a, String b) {
        Line line = network.lines().get(lineName);
        for (int i = 0; i < line.minutes().size(); i++) {
            String x = line.stations().get(i);
            String y = line.stations().get(i + 1);
            if ((x.equals(a) && y.equals(b)) || (!line.oneWay() && y.equals(a) && x.equals(b))) {
                return line.minutes().get(i);
            }
        }
        return null;
    }

    /** Legs must chain from origin to destination over real hops, with consistent minutes. */
    private static void assertValidJourney(Network network, Journey journey, String origin, String destination, int transferMinutes) {
        assertEquals(origin, journey.origin());
        assertEquals(destination, journey.destination());
        List<Leg> legs = List.copyOf(journey.legs());
        String here = origin;
        for (int i = 0; i < legs.size(); i++) {
            Leg leg = legs.get(i);
            List<String> stations = List.copyOf(leg.stations());
            assertTrue(stations.size() >= 2);
            assertEquals(here, stations.getFirst(), "leg " + (i + 1) + " must start where the journey is");
            if (i > 0) {
                assertNotEquals(legs.get(i - 1).line(), leg.line(), "consecutive hops on one line belong in one leg");
            }
            int riding = 0;
            for (int s = 1; s < stations.size(); s++) {
                Integer minutes = hopMinutes(network, leg.line(), stations.get(s - 1), stations.get(s));
                assertNotNull(minutes, leg.line() + " does not run from " + stations.get(s - 1) + " to " + stations.get(s));
                riding += minutes;
            }
            assertEquals(riding, leg.minutes());
            here = stations.getLast();
        }
        assertEquals(destination, here);
        int changes = Math.max(legs.size() - 1, 0);
        assertEquals(changes, journey.transfers());
        assertEquals(legs.stream().mapToInt(Leg::minutes).sum() + changes * transferMinutes, journey.totalMinutes());
    }

    private static Network mediumNetwork() {
        return Timetable.loadNetwork(Generator.generateTimetable(11, 24, 40, 8, 20).text());
    }

    @Test
    void mediumNetworkMatchesReferenceResults() {
        Network network = mediumNetwork();
        for (Case c : MEDIUM_CASES) {
            Journey journey = Planner.fastestJourney(network, c.origin(), c.destination(), c.transfer());
            String label = c.origin() + " to " + c.destination() + " with " + c.transfer() + " min transfers";
            if (c.expected() == null) {
                assertNull(journey, label);
                continue;
            }
            assertNotNull(journey, label);
            assertValidJourney(network, journey, c.origin(), c.destination(), c.transfer());
            assertEquals(c.expected(), List.of(journey.totalMinutes(), journey.transfers()), label);
        }
    }

    @Test
    void regionalNetworkBatchIsFast() {
        Generator.GeneratedTimetable generated = Generator.generateTimetable(3, 80, 320, 20, 50);
        Network network = Timetable.loadNetwork(generated.text()); // about 5,100 stations and 320 lines
        List<Generator.Query> queries = Generator.pickQueries(17, generated.stations(), BATCH_SIZE);

        // Warm up on the medium network first, so the JIT compiler has done its
        // work before the clock starts.
        Network medium = mediumNetwork();
        for (int round = 0; round < WARM_UP_ROUNDS; round++) {
            for (Case c : MEDIUM_CASES) {
                Planner.fastestJourney(medium, c.origin(), c.destination(), c.transfer());
            }
        }

        long start = System.nanoTime();
        List<Journey> journeys = new ArrayList<>();
        for (Generator.Query query : queries) {
            journeys.add(Planner.fastestJourney(network, query.origin(), query.destination()));
        }
        long elapsed = (System.nanoTime() - start) / 1_000_000;

        for (int i = 0; i < queries.size(); i++) {
            Generator.Query query = queries.get(i);
            assertNotNull(journeys.get(i), query.origin() + " to " + query.destination());
            assertValidJourney(network, journeys.get(i), query.origin(), query.destination(), 5);
        }
        assertEquals(List.of(116, 6), List.of(journeys.getFirst().totalMinutes(), journeys.getFirst().transfers()));
        assertEquals(1692, journeys.stream().mapToInt(Journey::totalMinutes).sum());
        assertEquals(74, journeys.stream().mapToInt(Journey::transfers).sum());
        assertTrue(elapsed < BATCH_LIMIT_MS, BATCH_SIZE + " queries took " + elapsed + "ms; the batch must finish in under " + BATCH_LIMIT_MS + "ms");
    }
}
