package transit;

import java.util.ArrayList;
import java.util.List;

/** Human-readable output for the rider app and the command line. */
public final class Formatting {
    private Formatting() {
    }

    private static String plural(int count, String word) {
        return count == 1 ? count + " " + word : count + " " + word + "s";
    }

    private static String pad(String text, int width) {
        return text + " ".repeat(Math.max(width - text.length(), 0));
    }

    /** "Airport -> Central -> Harbor (2 stops)" for a fewest-stops route. */
    public static String formatStops(List<String> route) {
        if (route == null) {
            return "no route";
        }
        return String.join(" -> ", route) + " (" + plural(route.size() - 1, "stop") + ")";
    }

    /**
     * One-sentence itinerary, as shown in the journey card.
     *
     * <pre>
     * Take Red from Airport to Central (4 min), transfer (5 min), take Blue
     * from Central to Museum (7 min). Total 16 min, 1 transfer.
     * </pre>
     */
    public static String formatJourney(Journey journey) {
        if (journey == null) {
            return "No journey found.";
        }
        if (journey.legs().isEmpty()) {
            return "You are already at " + journey.origin() + ".";
        }
        List<String> parts = new ArrayList<>();
        for (int index = 0; index < journey.legs().size(); index++) {
            Leg leg = journey.legs().get(index);
            if (index > 0) {
                parts.add("transfer (" + journey.transferMinutes() + " min)");
            }
            String verb = index > 0 ? "take" : "Take";
            parts.add("%s %s from %s to %s (%d min)".formatted(verb, leg.line(), leg.origin(), leg.destination(), leg.minutes()));
        }
        return "%s. Total %d min, %s.".formatted(String.join(", ", parts), journey.totalMinutes(), plural(journey.transfers(), "transfer"));
    }

    /** Multi-line itinerary with one row per leg, for the detail view. */
    public static String formatItinerary(Journey journey) {
        if (journey == null || journey.legs().isEmpty()) {
            return formatJourney(journey);
        }
        int width = journey.legs().stream().mapToInt(leg -> leg.line().length()).max().orElse(0);
        String blank = " ".repeat(width);
        List<String> rows = new ArrayList<>();
        for (int index = 0; index < journey.legs().size(); index++) {
            Leg leg = journey.legs().get(index);
            if (index > 0) {
                rows.add("  %s  change at %s (%d min)".formatted(blank, leg.origin(), journey.transferMinutes()));
            }
            rows.add("  %s  %s -> %s  %d min, %s".formatted(pad(leg.line(), width), leg.origin(), leg.destination(), leg.minutes(), plural(leg.stops(), "stop")));
        }
        rows.add("  %s  arrive after %d min".formatted(blank, journey.totalMinutes()));
        return String.join("\n", rows);
    }

    /** A short summary of every line, in timetable order. */
    public static String describeNetwork(Network network) {
        List<String> rows = new ArrayList<>();
        rows.add("%s: %d stations, %d lines".formatted(network.name(), network.size(), network.lines().size()));
        int width = network.lines().keySet().stream().mapToInt(String::length).max().orElse(0);
        for (Line line : network.lines().values()) {
            String first = line.stations().getFirst();
            String last = line.stations().getLast();
            String route = first.equals(last) ? first + " (loop)" : first + " - " + last;
            String direction = line.oneWay() ? "one-way" : "two-way";
            rows.add("  %s  %s  (%s, %d min, %s)".formatted(pad(line.name(), width), route, plural(line.stations().size(), "station"), line.runningTime(), direction));
        }
        return String.join("\n", rows);
    }
}
