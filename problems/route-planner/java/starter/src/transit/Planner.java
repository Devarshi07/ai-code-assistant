package transit;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Journey planning over a Network. */
public final class Planner {
    /** Minutes a rider needs to change lines at a station (walk, wait, board). */
    public static final int DEFAULT_TRANSFER_MINUTES = 5;

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
     */
    public static Journey fastestJourney(Network network, String origin, String destination, int transferMinutes) {
        throw new UnsupportedOperationException("Phase 2: fastestJourney is not implemented yet");
    }
}
