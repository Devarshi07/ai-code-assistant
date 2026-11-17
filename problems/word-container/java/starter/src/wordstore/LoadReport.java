package wordstore;

import java.util.ArrayList;
import java.util.List;

/** What happened while importing one list. */
public class LoadReport {
    /** One entry that could not be stored. */
    public record Rejection(int line, String entry, String reason) {}

    public final String source;
    public int added;
    public int duplicates;
    public final List<Rejection> rejected = new ArrayList<>();

    public LoadReport(String source) {
        this.source = source;
    }

    public String summary() {
        String text = source + ": " + added + " added, " + duplicates + " already stored";
        if (!rejected.isEmpty()) text += ", " + rejected.size() + " rejected";
        return text;
    }
}
