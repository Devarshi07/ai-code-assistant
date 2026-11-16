package transit;

import java.util.Iterator;
import java.util.List;
import java.util.stream.IntStream;

/**
 * A transit line as written in the timetable.
 *
 * <p>{@code minutes.get(i)} is the running time in whole minutes between
 * {@code stations.get(i)} and {@code stations.get(i + 1)}. Trains run in both directions
 * unless {@code oneWay} is set.
 */
public record Line(String name, List<String> stations, List<Integer> minutes, boolean oneWay) {
    /** One hop of a line between two consecutive stops, in timetable order. */
    public record Segment(String origin, String destination, int minutes) {
    }

    public Line {
        if (stations.size() < 2) {
            throw new IllegalArgumentException("line " + name + " needs at least two stations");
        }
        if (minutes.size() != stations.size() - 1) {
            throw new IllegalArgumentException("line " + name + " needs one running time per pair of stops");
        }
        stations = List.copyOf(stations);
        minutes = List.copyOf(minutes);
    }

    /** Steps through each hop between consecutive stops, in timetable order. */
    public Iterator<Segment> segments() {
        return IntStream.range(0, minutes.size())
                .mapToObj(i -> new Segment(stations.get(i), stations.get(i + 1), minutes.get(i)))
                .iterator();
    }

    /** Minutes from the first stop to the last. */
    public int runningTime() {
        return minutes.stream().mapToInt(Integer::intValue).sum();
    }
}
