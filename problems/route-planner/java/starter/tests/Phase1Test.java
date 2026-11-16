package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;

import transit.Connection;
import transit.Line;
import transit.Network;
import transit.Planner;
import transit.Samples;
import transit.Timetable;
import transit.TimetableException;
import transit.UnknownStationException;

class Phase1Test {
    /** True when some line runs straight from a to b, judged from the timetable data. */
    private static boolean runsDirectly(Network network, String a, String b) {
        for (Line line : network.lines().values()) {
            List<String> stations = line.stations();
            for (int i = 0; i + 1 < stations.size(); i++) {
                String x = stations.get(i);
                String y = stations.get(i + 1);
                if ((x.equals(a) && y.equals(b)) || (!line.oneWay() && y.equals(a) && x.equals(b))) {
                    return true;
                }
            }
        }
        return false;
    }

    private static void assertRoute(Network network, List<String> route, String origin, String destination, int stops) {
        assertNotNull(route, "riders can get from " + origin + " to " + destination);
        assertEquals(origin, route.getFirst());
        assertEquals(destination, route.getLast());
        for (int i = 1; i < route.size(); i++) {
            assertTrue(runsDirectly(network, route.get(i - 1), route.get(i)), "no line runs from " + route.get(i - 1) + " to " + route.get(i));
        }
        assertEquals(stops, route.size() - 1, origin + " to " + destination + " is " + stops + " stops, got " + String.join(" -> ", route));
    }

    private static Set<String> connectionSet(List<Connection> connections) {
        return connections.stream().map(c -> c.to() + "|" + c.line() + "|" + c.minutes()).collect(Collectors.toSet());
    }

    // Quick routes

    @Test
    void outboundTripOnTheRedLine() {
        Network network = Samples.loadHarbourCity();
        assertRoute(network, Planner.fewestStops(network, "Airport", "Museum"), "Airport", "Museum", 3);
    }

    @Test
    void returnTripOnTheRedLine() {
        Network network = Samples.loadHarbourCity();
        assertRoute(network, Planner.fewestStops(network, "Museum", "Airport"), "Museum", "Airport", 3);
    }

    @Test
    void riversideToUniversityIsTwoStops() {
        Network network = Samples.loadHarbourCity();
        assertRoute(network, Planner.fewestStops(network, "Riverside", "University"), "Riverside", "University", 2);
    }

    @Test
    void roundTripsTakeTheSameNumberOfStops() {
        Network network = Samples.loadHarbourCity();
        String[][] pairs = {{"Airport", "Museum"}, {"University", "Harbor"}, {"City Hall", "Airport"}, {"Science Park", "Old Town"}};
        for (String[] pair : pairs) {
            List<String> there = Planner.fewestStops(network, pair[0], pair[1]);
            List<String> back = Planner.fewestStops(network, pair[1], pair[0]);
            assertNotNull(there, pair[0] + " to " + pair[1]);
            assertNotNull(back, pair[1] + " to " + pair[0]);
            assertEquals(there.size(), back.size(), pair[0] + " to " + pair[1] + " and back should be the same length");
        }
    }

    @Test
    void ferryOnlySailsOneWay() {
        assertEquals(List.of("Island Pier", "Lighthouse", "Harbor"), Planner.fewestStops(Samples.loadHarbourCity(), "Island Pier", "Harbor"));
    }

    @Test
    void sameStationIsAZeroStopRoute() {
        assertEquals(List.of("Central"), Planner.fewestStops(Samples.loadHarbourCity(), "Central", "Central"));
    }

    @Test
    void unknownStationIsReported() {
        assertThrows(UnknownStationException.class, () -> Planner.fewestStops(Samples.loadHarbourCity(), "Atlantis", "Central"));
    }

    // Network

    @Test
    void twoWayLinesConnectInBothDirections() {
        Set<String> connections = connectionSet(Samples.loadHarbourCity().connectionsFrom("Harbor"));
        assertEquals(Set.of("Central|Red|3", "Museum|Red|6", "Riverside|Green|6", "Island Pier|Ferry|8"), connections);
    }

    @Test
    void oneWayLineRunsInTimetableOrderOnly() {
        Set<String> connections = connectionSet(Samples.loadHarbourCity().connectionsFrom("Island Pier"));
        assertEquals(Set.of("Lighthouse|Ferry|5"), connections);
    }

    @Test
    void neighboursOfCentral() {
        assertEquals(List.of("Airport", "Harbor", "Market Square", "Old Town", "University"), Samples.loadHarbourCity().neighbours("Central"));
    }

    @Test
    void linesCallingAtCentral() {
        assertEquals(List.of("Red", "Blue", "Circle"), Samples.loadHarbourCity().linesAt("Central"));
    }

    // Timetable

    @Test
    void multiWordStationNamesAndMinutes() {
        Line circle = Samples.loadHarbourCity().lines().get("Circle");
        assertEquals(List.of("Central", "Market Square", "City Hall", "Old Town", "Central"), circle.stations());
        assertEquals(List.of(2, 2, 3, 2), circle.minutes());
        assertFalse(circle.oneWay());
    }

    @Test
    void onewayFlag() {
        Line ferry = Samples.loadHarbourCity().lines().get("Ferry");
        assertTrue(ferry.oneWay());
        assertEquals(List.of("Harbor", "Island Pier", "Lighthouse", "Harbor"), ferry.stations());
    }

    @Test
    void commentsAndBlankLinesAreIgnored() {
        Network network = Timetable.loadNetwork("# depot shuttle\n\nline Night Owl: Depot 12 Old Mill  # weekends\n");
        assertEquals(List.of("Night Owl"), List.copyOf(network.lines().keySet()));
        assertEquals(List.of("Depot", "Old Mill"), network.lines().get("Night Owl").stations());
    }

    @Test
    void malformedEntriesReportTheirLineNumber() {
        for (String entry : List.of("line Red Airport 4 Central", "line Red: Airport 4", "line Red: 4 Airport",
                "line Red: Airport", "line Red: Airport 0 Central", "line: Airport 4 Central")) {
            TimetableException error = assertThrows(TimetableException.class, () -> Timetable.loadNetwork("# header\n" + entry), entry);
            assertEquals(2, error.lineNumber(), entry);
        }
    }

    @Test
    void duplicateLineNamesAreRejected() {
        assertThrows(TimetableException.class, () -> Timetable.loadNetwork("line Red: A 1 B\nline Red: C 1 D\n"));
    }
}
