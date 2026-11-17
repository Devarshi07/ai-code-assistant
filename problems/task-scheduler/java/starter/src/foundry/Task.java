package foundry;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Pattern;

/**
 * A unit of work such as compiling the app or running a test suite.
 *
 * @param name     the task's name
 * @param duration whole minutes the task keeps one runner busy (at least 1)
 * @param deps     names of the tasks that must finish before this one may start
 * @param resource optional runner label such as "macos" (null if none); informational for now
 */
public record Task(String name, int duration, List<String> deps, String resource) {
    private static final Pattern NAME_PATTERN = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]*");

    public Task {
        if (name == null || !NAME_PATTERN.matcher(name).matches()) {
            throw new PipelineError("invalid task name \"" + name + "\"");
        }
        if (duration < 1) {
            throw new PipelineError(name + ": duration must be a whole number of minutes, at least 1");
        }
        // Keep dependencies without repeats, in the order given.
        deps = List.copyOf(new LinkedHashSet<>(deps));
    }

    public Task(String name, int duration, List<String> deps) {
        this(name, duration, deps, null);
    }

    @Override
    public String toString() {
        String after = deps.isEmpty() ? "" : " after " + String.join(", ", deps);
        String on = resource == null ? "" : " on " + resource;
        return name + " (" + duration + " min)" + after + on;
    }
}
