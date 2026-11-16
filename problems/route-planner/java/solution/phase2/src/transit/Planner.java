package transit;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Journey planning over a Network. */
public final class Planner {
    /** Minutes a rider needs to change lines at a station (walk, wait, board). */
    public static final int DEFAULT_TRANSFER_MINUTES = 5;

    // The line of the starting state: the rider has not boarded anything yet.
    private static final String NOT_BOARDED = "";

    /** A search state: standing at a station, having arrived on a line. */
    private record StateKey(String station, String line) {
    }

    /** The best known way to reach one state, with a parent pointer for the route. */
    private static final class State {
        final StateKey key;
        final int minutes;
        final int transfers;
        final State previous;
        final Connection via; // the connection ridden to get here

        State(StateKey key, int minutes, int transfers, State previous, Connection via) {
            this.key = key;
            this.minutes = minutes;
            this.transfers = transfers;
            this.previous = previous;
            this.via = via;
        }

        String station() {
            return key.station();
        }

        String line() {
            return key.line();
        }
    }

    /** Search order: fewer minutes, then fewer transfers, then station and line name. */
    private static final Comparator<State> SEARCH_ORDER = Comparator.<State>comparingInt(state -> state.minutes)
            .thenComparingInt(state -> state.transfers)
            .thenComparing(State::station)
            .thenComparing(State::line);

    private Planner() {
    }

    /**
     * Breadth-first search for the route with the fewest stops, ignoring lines.
     *
     * <p>Powers the "quick route" panel in the rider app. Returns the station names from
     * origin to destination inclusive, or null when there is no route. Unknown station names
     * throw UnknownStationException.
     */
    public static List<String> fewestStops(Network network, String origin, String destination) {
        network.station(origin);
        network.station(destination);
        if (origin.equals(destination)) {
            return List.of(origin);
        }
        Map<String, String> cameFrom = new HashMap<>();
        cameFrom.put(origin, null);
        ArrayDeque<String> queue = new ArrayDeque<>(List.of(origin));
        while (!queue.isEmpty()) {
            String current = queue.poll();
            for (Connection connection : network.connectionsFrom(current)) {
                String next = connection.to();
                if (cameFrom.containsKey(next)) {
                    continue;
                }
                cameFrom.put(next, current);
                if (next.equals(destination)) {
                    return walkBack(cameFrom, next);
                }
                queue.add(next);
            }
        }
        return null;
    }

    private static List<String> walkBack(Map<String, String> cameFrom, String station) {
        List<String> route = new ArrayList<>();
        for (String at = station; at != null; at = cameFrom.get(at)) {
            route.add(at);
        }
        Collections.reverse(route);
        return route;
    }

    /** The quickest journey from origin to destination, with the default transfer penalty. */
    public static Journey fastestJourney(Network network, String origin, String destination) {
        return fastestJourney(network, origin, destination, DEFAULT_TRANSFER_MINUTES);
    }

    /**
     * The quickest journey from origin to destination.
     *
     * <p>Riding time is the sum of segment minutes. Every change of line costs
     * {@code transferMinutes}; boarding the first line is free. Among equally quick journeys,
     * the one with fewer transfers wins. Returns a Journey with no legs when origin equals
     * destination, or null when the destination cannot be reached.
     *
     * <p>Dijkstra's algorithm over (station, line) states: the cost of the next hop depends on
     * the line the rider is already on.
     */
    public static Journey fastestJourney(Network network, String origin, String destination, int transferMinutes) {
        network.station(origin);
        network.station(destination);
        if (origin.equals(destination)) {
            return new Journey(origin, destination, List.of(), transferMinutes);
        }

        State start = new State(new StateKey(origin, NOT_BOARDED), 0, 0, null, null);
        Map<StateKey, State> states = new HashMap<>(); // best known state per key
        states.put(start.key, start);
        Set<StateKey> settled = new HashSet<>();
        while (true) {
            // Pick the cheapest state that is not settled yet.
            State current = null;
            for (State state : states.values()) {
                if (settled.contains(state.key)) {
                    continue;
                }
                if (current == null || SEARCH_ORDER.compare(state, current) < 0) {
                    current = state;
                }
            }
            if (current == null) {
                return null;
            }
            settled.add(current.key);
            if (current.station().equals(destination)) {
                return buildJourney(origin, destination, current, transferMinutes);
            }

            for (Connection connection : network.connectionsFrom(current.station())) {
                StateKey key = new StateKey(connection.to(), connection.line());
                if (settled.contains(key)) {
                    continue;
                }
                boolean changes = !current.line().equals(NOT_BOARDED) && !connection.line().equals(current.line());
                int minutes = current.minutes + connection.minutes() + (changes ? transferMinutes : 0);
                int transfers = current.transfers + (changes ? 1 : 0);
                State known = states.get(key);
                if (known != null && (known.minutes < minutes || (known.minutes == minutes && known.transfers <= transfers))) {
                    continue;
                }
                states.put(key, new State(key, minutes, transfers, current, connection));
            }
        }
    }

    /** Walks the parent pointers back and groups consecutive hops by line. */
    private static Journey buildJourney(String origin, String destination, State state, int transferMinutes) {
        List<State> hops = new ArrayList<>();
        for (State at = state; at.previous != null; at = at.previous) {
            hops.add(at);
        }
        Collections.reverse(hops);

        List<Leg> legs = new ArrayList<>();
        String line = null;
        List<String> stations = new ArrayList<>();
        int minutes = 0;
        for (State hop : hops) {
            Connection connection = hop.via;
            if (!connection.line().equals(line)) {
                if (line != null) {
                    legs.add(new Leg(line, stations, minutes));
                }
                line = connection.line();
                stations = new ArrayList<>(List.of(hop.previous.station()));
                minutes = 0;
            }
            stations.add(connection.to());
            minutes += connection.minutes();
        }
        legs.add(new Leg(line, stations, minutes));
        return new Journey(origin, destination, legs, transferMinutes);
    }
}
