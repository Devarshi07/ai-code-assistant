package transit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * A stop on the network and the lines calling there.
 *
 * <p>Station and line names are case-sensitive strings exactly as they appear in the
 * timetable ("Old Town", "Red").
 */
public final class Station {
    private final String name;
    private final List<String> lines = new ArrayList<>(); // lines calling here, in load order

    public Station(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }

    /** The lines calling here, in load order, as a read-only list. */
    public List<String> lines() {
        return Collections.unmodifiableList(lines);
    }

    void addLine(String lineName) {
        if (!lines.contains(lineName)) {
            lines.add(lineName);
        }
    }

    @Override
    public String toString() {
        return "Station(" + name + ", " + lines + ")";
    }
}
