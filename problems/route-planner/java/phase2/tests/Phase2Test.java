package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import transit.Formatting;
import transit.Journey;
import transit.Leg;
import transit.Line;
import transit.Network;
import transit.Planner;
import transit.Samples;
import transit.Timetable;
import transit.UnknownStationException;

class Phase2Test {
    // Pier to Point: 12 min on Coastal with no change, or 4 min of riding on
    // Hopper + Uptown with one change at Market.
    private static final String COAST = """
            line Coastal: Pier 3 Beach 3 Cliffs 3 Dunes 3 Point
            line Hopper: Pier 2 Market
            line Uptown: Market 2 Point
            """;

    // The Shuttle reaches Bridge first, but only the Local continues to Quarry.
    private static final String VALLEY = """
            line Local: Dock 2 Mill 2 Bridge 2 Quarry
            line Shuttle: Dock 1 Depot 1 Bridge
            """;

    // The cable car only goes up, and the coast road is a separate network.
    private static final String MOUNTAIN = """
            line Valley: North Gate 4 Mill 3 South Gate
            line Cable Car oneway: Mill 12 Summit
            line Coast Road: Harbour 6 Lighthouse
            """;

    /** One leg as (line, stations, minutes), for comparing whole journeys. */
    private record Ride(String line, List<String> stations, int minutes) {
    }

    /** Running time of one hop a -> b on the named line, read from the timetable data, or null. */
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
        assertNotNull(journey, "there is a journey from " + origin + " to " + destination);
        assertEquals(origin, journey.origin());
        assertEquals(destination, journey.destination());
        assertEquals(transferMinutes, journey.transferMinutes());
        List<Leg> legs = List.copyOf(journey.legs());
        String here = origin;
        for (int i = 0; i < legs.size(); i++) {
            Leg leg = legs.get(i);
            List<String> stations = List.copyOf(leg.stations());
            assertTrue(stations.size() >= 2, "leg " + (i + 1) + " must ride at least one hop");
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
            assertEquals(riding, leg.minutes(), "leg " + (i + 1) + " on " + leg.line() + " rides " + riding + " min");
            here = stations.getLast();
        }
        assertEquals(destination, here, "the last leg must end at the destination");
        int changes = Math.max(legs.size() - 1, 0);
        assertEquals(changes, journey.transfers());
        assertEquals(legs.stream().mapToInt(Leg::minutes).sum() + changes * transferMinutes, journey.totalMinutes());
    }

    private static List<Ride> summary(Journey journey) {
        return journey.legs().stream().map(leg -> new Ride(leg.line(), List.copyOf(leg.stations()), leg.minutes())).toList();
    }

    private static Journey plan(String origin, String destination) {
        return plan(origin, destination, 5, Samples.loadHarbourCity());
    }

    private static Journey plan(String origin, String destination, int transferMinutes) {
        return plan(origin, destination, transferMinutes, Samples.loadHarbourCity());
    }

    private static Journey plan(String origin, String destination, int transferMinutes, Network network) {
        Journey journey = Planner.fastestJourney(network, origin, destination, transferMinutes);
        assertValidJourney(network, journey, origin, destination, transferMinutes);
        return journey;
    }

    @Test
    void singleLineTripHasNoBoardingPenalty() {
        Journey journey = plan("Airport", "Museum");
        assertEquals(13, journey.totalMinutes());
        assertEquals(List.of(new Ride("Red", List.of("Airport", "Central", "Harbor", "Museum"), 13)), summary(journey));
    }

    @Test
    void defaultTransferPenaltyIsFiveMinutes() {
        Network network = Samples.loadHarbourCity();
        Journey journey = Planner.fastestJourney(network, "Airport", "Science Park");
        assertValidJourney(network, journey, "Airport", "Science Park", 5);
        assertEquals(17, journey.totalMinutes());
    }

    @Test
    void directExpressBeatsChangingLines() {
        Journey journey = plan("Airport", "University");
        assertEquals(9, journey.totalMinutes());
        assertEquals(List.of(new Ride("Express", List.of("Airport", "University"), 9)), summary(journey));
    }

    @Test
    void oneTransfer() {
        Journey journey = plan("Airport", "Science Park");
        assertEquals(List.of(17, 1), List.of(journey.totalMinutes(), journey.transfers()));
        assertEquals(List.of(
                new Ride("Express", List.of("Airport", "University"), 9),
                new Ride("Green", List.of("University", "Science Park"), 3)), summary(journey));
    }

    @Test
    void twoTransfersUsingTheCircleLine() {
        Journey journey = plan("Old Town", "Island Pier");
        assertEquals(List.of(23, 2), List.of(journey.totalMinutes(), journey.transfers()));
        assertEquals(List.of(
                new Ride("Circle", List.of("Old Town", "Central"), 2),
                new Ride("Red", List.of("Central", "Harbor"), 3),
                new Ride("Ferry", List.of("Harbor", "Island Pier"), 8)), summary(journey));
    }

    @Test
    void customTransferPenalty() {
        Journey journey = plan("Old Town", "Island Pier", 2);
        assertEquals(List.of(17, 2), List.of(journey.totalMinutes(), journey.transfers()));
    }

    @Test
    void oneWayFerryGoesRoundTheLoop() {
        Journey journey = plan("Island Pier", "Harbor");
        assertEquals(15, journey.totalMinutes());
        assertEquals(List.of(new Ride("Ferry", List.of("Island Pier", "Lighthouse", "Harbor"), 15)), summary(journey));
    }

    @Test
    void reverseOfAOneWayTrip() {
        assertEquals(21, plan("Lighthouse", "Museum").totalMinutes());
        assertEquals(24, plan("Museum", "Lighthouse").totalMinutes());
    }

    @Test
    void transferPenaltyDecidesTheRoute() {
        Network coast = Timetable.loadNetwork(COAST);
        Journey cheap = plan("Pier", "Point", 5, coast);
        assertEquals(9, cheap.totalMinutes());
        assertEquals(List.of("Hopper", "Uptown"), cheap.legs().stream().map(Leg::line).toList());
        Journey costly = plan("Pier", "Point", 10, coast);
        assertEquals(12, costly.totalMinutes());
        assertEquals(List.of("Coastal"), costly.legs().stream().map(Leg::line).toList());
    }

    @Test
    void equalTimesPreferFewerTransfers() {
        // With an 8 minute change both routes take 12 minutes.
        Journey journey = plan("Pier", "Point", 8, Timetable.loadNetwork(COAST));
        assertEquals(List.of(12, 0), List.of(journey.totalMinutes(), journey.transfers()));
    }

    @Test
    void freeTransfers() {
        Journey journey = plan("Pier", "Point", 0, Timetable.loadNetwork(COAST));
        assertEquals(List.of(4, 1), List.of(journey.totalMinutes(), journey.transfers()));
    }

    @Test
    void stayingOnBoardCanBeatAnEarlierArrival() {
        Network valley = Timetable.loadNetwork(VALLEY);
        Journey journey = plan("Dock", "Quarry", 5, valley);
        assertEquals(6, journey.totalMinutes());
        assertEquals(List.of(new Ride("Local", List.of("Dock", "Mill", "Bridge", "Quarry"), 6)), summary(journey));
        assertEquals(2, plan("Dock", "Bridge", 5, valley).totalMinutes());
    }

    @Test
    void sameOriginAndDestination() {
        Journey journey = plan("Central", "Central");
        assertEquals(List.of(), journey.legs());
        assertEquals(0, journey.totalMinutes());
    }

    @Test
    void unreachableDestinationReturnsNull() {
        Network mountain = Timetable.loadNetwork(MOUNTAIN);
        assertEquals(21, plan("North Gate", "Summit", 5, mountain).totalMinutes());
        assertNull(Planner.fastestJourney(mountain, "Summit", "Mill"));
        assertNull(Planner.fastestJourney(mountain, "North Gate", "Lighthouse"));
    }

    @Test
    void unknownStationThrows() {
        assertThrows(UnknownStationException.class, () -> Planner.fastestJourney(Samples.loadHarbourCity(), "Airport", "Atlantis"));
    }

    @Test
    void journeyCardText() {
        Journey journey = Planner.fastestJourney(Samples.loadHarbourCity(), "Airport", "Science Park");
        assertEquals("Take Express from Airport to University (9 min), transfer (5 min), "
                + "take Green from University to Science Park (3 min). Total 17 min, 1 transfer.", Formatting.formatJourney(journey));
    }
}
