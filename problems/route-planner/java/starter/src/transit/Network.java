package transit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Stations and lines loaded from a timetable.
 *
 * <p>Connections are directed: a two-way line contributes one connection in each direction
 * for every segment, a one-way line only the timetable direction.
 */
public final class Network {
    private final String name;
    private final Map<String, Station> stations = new LinkedHashMap<>(); // station name -> Station
    private final Map<String, Line> lines = new LinkedHashMap<>(); // line name -> Line, in timetable order
    private final Map<String, List<Connection>> connections = new HashMap<>(); // station name -> connections leaving it

    public Network() {
        this("network");
    }

    public Network(String name) {
        this.name = name;
    }

    public void addLine(Line line) {
        if (lines.containsKey(line.name())) {
            throw new IllegalArgumentException("duplicate line '" + line.name() + "'");
        }
        lines.put(line.name(), line);
        for (String stationName : line.stations()) {
            ensureStation(stationName).addLine(line.name());
        }

        var segments = line.segments();
        while (segments.hasNext()) {
            var segment = segments.next();
            connect(segment.origin(), new Connection(segment.destination(), line.name(), segment.minutes()));
        }
        if (!line.oneWay()) {
            // Trains run back along the same track, with the same running times.
            while (segments.hasNext()) {
                var segment = segments.next();
                connect(segment.destination(), new Connection(segment.origin(), line.name(), segment.minutes()));
            }
        }
    }

    private Station ensureStation(String stationName) {
        Station station = stations.get(stationName);
        if (station == null) {
            station = new Station(stationName);
            stations.put(stationName, station);
            connections.put(stationName, new ArrayList<>());
        }
        return station;
    }

    private void connect(String origin, Connection connection) {
        connections.get(origin).add(connection);
    }

    /** Looks up a station by name, throwing UnknownStationException if it does not exist. */
    public Station station(String stationName) {
        Station station = stations.get(stationName);
        if (station == null) {
            throw new UnknownStationException(stationName);
        }
        return station;
    }

    /** Every connection leaving the named station, across all lines, as a read-only list. */
    public List<Connection> connectionsFrom(String stationName) {
        station(stationName);
        return Collections.unmodifiableList(connections.get(stationName));
    }

    /** Names of the stations one hop away, sorted. */
    public List<String> neighbours(String stationName) {
        return connectionsFrom(stationName).stream().map(Connection::to).distinct().sorted().toList();
    }

    public List<String> linesAt(String stationName) {
        return List.copyOf(station(stationName).lines());
    }

    public boolean contains(String stationName) {
        return stations.containsKey(stationName);
    }

    public String name() {
        return name;
    }

    /** Stations by name, read-only. */
    public Map<String, Station> stations() {
        return Collections.unmodifiableMap(stations);
    }

    /** Lines by name in timetable order, read-only. */
    public Map<String, Line> lines() {
        return Collections.unmodifiableMap(lines);
    }

    public int size() {
        return stations.size();
    }

    @Override
    public String toString() {
        return "Network(" + name + ", " + stations.size() + " stations, " + lines.size() + " lines)";
    }
}
