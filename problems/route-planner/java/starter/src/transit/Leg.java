package transit;

import java.util.List;

/**
 * A continuous ride on one line.
 *
 * <p>{@code stations} runs from the boarding station to the alighting station inclusive;
 * {@code minutes} is the riding time of this leg only.
 */
public record Leg(String line, List<String> stations, int minutes) {
    public Leg {
        stations = List.copyOf(stations);
    }

    public String origin() {
        return stations.getFirst();
    }

    public String destination() {
        return stations.getLast();
    }

    public int stops() {
        return stations.size() - 1;
    }
}
