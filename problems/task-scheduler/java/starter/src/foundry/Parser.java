package foundry;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Parser for pipeline files.
 *
 * <p>Pipeline files use a small YAML-like format. Each task is a top-level key
 * followed by indented settings:
 *
 * <pre>
 * # comments run to the end of the line
 * compile:
 *   duration: 4            # minutes on one runner
 *   resource: linux        # optional runner label
 *
 * package:
 *   duration: 2
 *   after: compile, lint   # inline list; [compile, lint] also works
 *
 * deploy:
 *   duration: 3
 *   after:                 # block list, one dependency per line
 *     - package
 *     - smoke-tests
 * </pre>
 *
 * <p>{@link #parsePipeline} only checks syntax. {@link DependencyGraph#load}
 * also checks that every dependency exists and that there are no cycles.
 */
public final class Parser {
    private static final Set<String> SETTINGS = Set.of("duration", "after", "resource");
    private static final Pattern WHOLE_NUMBER = Pattern.compile("[0-9]+");

    private Parser() {}

    /** Parse pipeline text into a list of tasks, in file order. */
    public static List<Task> parsePipeline(String text) {
        Reader reader = new Reader();
        String[] lines = text.split("\r?\n", -1);
        for (int i = 0; i < lines.length; i++) reader.feed(i + 1, lines[i]);
        return reader.finish();
    }

    /** "a, b" or "[a, b]" becomes ["a", "b"]. */
    public static List<String> splitNames(String value, int lineno) {
        if (value.startsWith("[") && value.endsWith("]")) value = value.substring(1, value.length() - 1);
        List<String> names = new ArrayList<>();
        for (String part : value.split(",", -1)) {
            String name = part.strip();
            if (name.isEmpty()) throw new PipelineSyntaxError(lineno, "empty name in list '" + value + "'");
            names.add(name);
        }
        return names;
    }

    /** The settings collected for the task being read. */
    private static final class Fields {
        final String name;
        final int lineno;
        final Set<String> seen = new HashSet<>();
        String duration;
        List<String> after;
        String resource;

        Fields(String name, int lineno) {
            this.name = name;
            this.lineno = lineno;
        }
    }

    /** Line-by-line state machine behind parsePipeline. */
    private static final class Reader {
        private final List<Task> tasks = new ArrayList<>();
        private Fields fields = null;          // settings of the task being read
        private boolean inList = false;        // whether "- item" lines are being collected for `after`
        private List<String> items = new ArrayList<>();

        void feed(int lineno, String raw) {
            int hash = raw.indexOf('#');
            String line = (hash < 0 ? raw : raw.substring(0, hash)).stripTrailing();
            String text = line.strip();
            if (text.isEmpty()) return;
            if (!Character.isWhitespace(line.charAt(0))) {            // task header: "compile:"
                closeList();
                closeTask();
                int colon = text.indexOf(':');
                if (colon < 0 || !text.substring(colon + 1).strip().isEmpty()) {
                    throw new PipelineSyntaxError(lineno, "expected a task header like 'compile:', got '" + text + "'");
                }
                fields = new Fields(text.substring(0, colon).strip(), lineno);
            } else if (fields == null) {
                throw new PipelineSyntaxError(lineno, "indented line before the first task");
            } else if (text.startsWith("-")) {                        // block list item: "- package"
                if (!inList) throw new PipelineSyntaxError(lineno, "list item outside a list setting");
                items.add(text.substring(1).strip());
            } else {                                                  // setting: "duration: 4"
                closeList();
                int colon = text.indexOf(':');
                String key = (colon < 0 ? text : text.substring(0, colon)).strip();
                String value = colon < 0 ? "" : text.substring(colon + 1).strip();
                if (colon < 0 || !SETTINGS.contains(key)) throw new PipelineSyntaxError(lineno, "unknown setting '" + key + "'");
                if (!fields.seen.add(key)) throw new PipelineSyntaxError(lineno, "'" + key + "' is set twice");
                if (key.equals("after") && value.isEmpty()) {
                    inList = true;
                    items = new ArrayList<>();
                } else if (key.equals("after")) {
                    fields.after = splitNames(value, lineno);
                } else if (value.isEmpty()) {
                    throw new PipelineSyntaxError(lineno, "'" + key + "' needs a value");
                } else if (key.equals("duration")) {
                    fields.duration = value;
                } else {
                    fields.resource = value;
                }
            }
        }

        List<Task> finish() {
            closeTask();
            return tasks;
        }

        /** Store the collected block-list items on the current task. */
        void closeList() {
            if (inList) {
                fields.after = items;
                inList = false;
                items = new ArrayList<>();
            }
        }

        void closeTask() {
            if (fields == null) return;
            Fields f = fields;
            fields = null;
            if (f.duration == null) throw new PipelineSyntaxError(f.lineno, "task '" + f.name + "' has no duration");
            String bad = "task '" + f.name + "': duration must be whole minutes, got '" + f.duration + "'";
            if (!WHOLE_NUMBER.matcher(f.duration).matches()) throw new PipelineSyntaxError(f.lineno, bad);
            int minutes;
            try {
                minutes = Integer.parseInt(f.duration);
            } catch (NumberFormatException error) {
                throw new PipelineSyntaxError(f.lineno, bad);
            }
            try {
                tasks.add(new Task(f.name, minutes, f.after == null ? List.of() : f.after, f.resource));
            } catch (PipelineError error) {
                throw new PipelineSyntaxError(f.lineno, error.getMessage());
            }
        }
    }
}
