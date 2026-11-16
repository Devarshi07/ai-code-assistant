package transit;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Loads a Network from the plain-text timetable format used by the scheduling team.
 *
 * <pre>
 * # Harbour City weekday service
 * line Red: Airport 4 Central 3 Harbor 6 Museum
 * line Ferry oneway: Harbor 8 Island Pier 5 Lighthouse
 * </pre>
 *
 * <p>Each entry lists the stations of one line, separated by the running time in minutes to
 * the next stop. Station names may contain spaces but must not be plain numbers. Lines run
 * both ways unless the name is followed by {@code oneway}. Everything after a {@code #} is a
 * comment.
 */
public final class Timetable {
    public static final String ONE_WAY_FLAG = "oneway";

    private static final Pattern NEWLINE = Pattern.compile("\\r?\\n");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern NUMBER = Pattern.compile("\\d+");

    private Timetable() {
    }

    /** The stations and running times of one entry, in timetable order. */
    private record Stops(List<String> stations, List<Integer> minutes) {
    }

    /** Builds a Network named "network" from timetable text. */
    public static Network loadNetwork(String text) {
        return loadNetwork(text, "network");
    }

    /** Builds a Network from timetable text. */
    public static Network loadNetwork(String text, String name) {
        Network network = new Network(name);
        String[] rows = NEWLINE.split(text, -1);
        for (int index = 0; index < rows.length; index++) {
            int lineNumber = index + 1;
            String raw = rows[index];
            int hash = raw.indexOf('#');
            String content = (hash < 0 ? raw : raw.substring(0, hash)).strip();
            if (content.isEmpty()) {
                continue;
            }
            Line line = parseEntry(content, lineNumber);
            if (network.lines().containsKey(line.name())) {
                throw new TimetableException(lineNumber, "duplicate line '" + line.name() + "'");
            }
            network.addLine(line);
        }
        return network;
    }

    /** Parses one {@code line <name> [oneway]: <stops>} entry into a Line. */
    public static Line parseEntry(String text, int lineNumber) {
        int colon = text.indexOf(':');
        List<String> words = words(colon < 0 ? text : text.substring(0, colon));
        if (colon < 0 || words.isEmpty() || !words.getFirst().equals("line")) {
            throw new TimetableException(lineNumber, "expected 'line <name>: <stations>'");
        }
        words = words.subList(1, words.size());
        boolean oneWay = !words.isEmpty() && words.getLast().equals(ONE_WAY_FLAG);
        if (oneWay) {
            words = words.subList(0, words.size() - 1);
        }
        if (words.isEmpty()) {
            throw new TimetableException(lineNumber, "the line has no name");
        }
        Stops stops = parseStops(text.substring(colon + 1), lineNumber);
        return new Line(String.join(" ", words), stops.stations(), stops.minutes(), oneWay);
    }

    private static Stops parseStops(String body, int lineNumber) {
        List<String> stations = new ArrayList<>();
        List<Integer> minutes = new ArrayList<>();
        List<String> name = new ArrayList<>();
        for (String token : words(body)) {
            if (!NUMBER.matcher(token).matches()) {
                name.add(token);
                continue;
            }
            if (name.isEmpty()) {
                throw new TimetableException(lineNumber, "running time " + token + " must follow a station name");
            }
            int value = Integer.parseInt(token);
            if (value < 1) {
                throw new TimetableException(lineNumber, "running times must be at least 1 minute");
            }
            stations.add(String.join(" ", name));
            minutes.add(value);
            name.clear();
        }
        if (name.isEmpty()) {
            throw new TimetableException(lineNumber, "a line must end with a station name");
        }
        stations.add(String.join(" ", name));
        if (stations.size() < 2) {
            throw new TimetableException(lineNumber, "a line needs at least two stations");
        }
        return new Stops(stations, minutes);
    }

    private static List<String> words(String text) {
        return Arrays.stream(WHITESPACE.split(text)).filter(word -> !word.isEmpty()).toList();
    }
}
