package campfire;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;

/**
 * Loaders for Campfire's nightly data exports.
 *
 * <pre>{@code
 * members.csv    one row per member: id,name,joined,interests
 *                (joined is YYYY-MM-DD; interests are separated by ';')
 * activity.log   one event per line, applied in order:
 *
 *     friend <a> <b>              a and b become friends
 *     unfriend <a> <b>            a ends the friendship with b
 *     block <blocker> <other>     blocker blocks other
 *     unblock <blocker> <other>   blocker lifts the block
 *     deactivate <member>         member closes their account
 * }</pre>
 *
 * Blank lines and lines starting with '#' are ignored.
 */
public final class Loader {
    private static final Path DATA_DIR = Path.of("data");
    private static final List<String> MEMBER_COLUMNS = List.of("id", "name", "joined", "interests");

    /** An activity verb: how many member ids it takes and what it does to the graph. */
    private record Event(int arity, BiConsumer<SocialGraph, List<String>> action) {}

    private static final Map<String, Event> EVENTS = Map.of(
            "friend", new Event(2, (graph, ids) -> graph.addFriendship(ids.get(0), ids.get(1))),
            "unfriend", new Event(2, (graph, ids) -> graph.removeFriendship(ids.get(0), ids.get(1))),
            "block", new Event(2, (graph, ids) -> graph.block(ids.get(0), ids.get(1))),
            "unblock", new Event(2, (graph, ids) -> graph.unblock(ids.get(0), ids.get(1))),
            "deactivate", new Event(1, (graph, ids) -> graph.deactivate(ids.get(0))));

    private Loader() {}

    /** Splits one CSV line into fields, honouring double-quoted fields. */
    public static List<String> parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (quoted) {
                if (ch == '"' && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    field.append('"');
                    i++;
                } else if (ch == '"') {
                    quoted = false;
                } else {
                    field.append(ch);
                }
            } else if (ch == '"') {
                quoted = true;
            } else if (ch == ',') {
                fields.add(field.toString());
                field.setLength(0);
            } else {
                field.append(ch);
            }
        }
        fields.add(field.toString());
        return fields;
    }

    /** Adds every member in a members.csv export to a new graph. */
    public static SocialGraph loadMembersCsv(String text) {
        return loadMembersCsv(text, new SocialGraph(), "members.csv");
    }

    /** Adds every member in a members.csv export to graph. */
    public static SocialGraph loadMembersCsv(String text, SocialGraph graph, String source) {
        String[] lines = text.replace("\r\n", "\n").split("\n", -1);
        List<String> header = parseCsvLine(lines[0]).stream().map(String::strip).toList();
        List<String> missing = MEMBER_COLUMNS.stream().filter(column -> !header.contains(column)).toList();
        if (!missing.isEmpty()) throw new LoadException(source + ": missing column(s) " + String.join(", ", missing));
        for (int i = 1; i < lines.length; i++) {
            if (lines[i].isBlank()) continue;
            List<String> values = parseCsvLine(lines[i]);
            Map<String, String> field = new LinkedHashMap<>();
            for (String column : MEMBER_COLUMNS) {
                int index = header.indexOf(column);
                field.put(column, index < values.size() ? values.get(index).strip() : "");
            }
            try {
                graph.addUser(new User(field.get("id"), field.get("name"),
                        User.parseDate(field.get("joined")), User.parseInterests(field.get("interests"))));
            } catch (ModelException | GraphException e) {
                throw new LoadException(source + " line " + (i + 1) + ": " + e.getMessage());
            }
        }
        return graph;
    }

    /** Applies an activity log to graph, in order. Returns a count of events by verb. */
    public static Map<String, Integer> applyActivity(SocialGraph graph, String text) {
        return applyActivity(graph, text, "activity.log");
    }

    /** Applies an activity log to graph, in order. Returns a count of events by verb. */
    public static Map<String, Integer> applyActivity(SocialGraph graph, String text, String source) {
        Map<String, Integer> applied = new LinkedHashMap<>();
        String[] lines = text.split("\n", -1);
        for (int index = 0; index < lines.length; index++) {
            String line = lines[index].strip();
            if (line.isEmpty() || line.startsWith("#")) continue;
            List<String> words = List.of(line.split("\\s+"));
            String verb = words.get(0);
            List<String> ids = words.subList(1, words.size());
            int number = index + 1;
            Event event = EVENTS.get(verb);
            if (event == null) throw new LoadException(source + " line " + number + ": unknown event '" + verb + "'");
            if (ids.size() != event.arity()) {
                throw new LoadException(source + " line " + number + ": " + verb + " takes " + event.arity()
                        + " member id(s), got " + ids.size());
            }
            try {
                event.action().accept(graph, ids);
            } catch (GraphException e) {
                throw new LoadException(source + " line " + number + ": " + e.getMessage());
            }
            applied.merge(verb, 1, Integer::sum);
        }
        return applied;
    }

    /** Builds a graph from a members export plus an activity log. */
    public static SocialGraph loadNetwork(String membersText, String activityText) {
        SocialGraph graph = loadMembersCsv(membersText);
        applyActivity(graph, activityText);
        return graph;
    }

    /** The small sample network in data/, used by Main and the tests. Paths are relative to the project root. */
    public static SocialGraph loadSample() throws IOException {
        String members = Files.readString(DATA_DIR.resolve("members.csv"));
        String activity = Files.readString(DATA_DIR.resolve("activity.log"));
        return loadNetwork(members, activity);
    }
}
