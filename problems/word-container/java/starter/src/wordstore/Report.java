package wordstore;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Text views of the store, used by the CLI and the editors' stats panel. */
public final class Report {
    private static final int BAR_WIDTH = 30;

    private Report() {}

    /** Words starting with each first letter in use, in letter order. */
    public static Map<String, Integer> letterBreakdown(WordContainer container) {
        Map<String, Integer> rows = new TreeMap<>();
        for (char letter = 'a'; letter <= 'z'; letter++) {
            int total = container.count(String.valueOf(letter));
            if (total > 0) rows.put(String.valueOf(letter), total);
        }
        return rows;
    }

    private static String plural(int n, String word) {
        return n == 1 ? n + " " + word : n + " " + word + "s";
    }

    public static String formatStoreReport(WordContainer container) {
        return formatStoreReport(container, "Word store");
    }

    /** Headline total plus an A-Z bar chart. */
    public static String formatStoreReport(WordContainer container, String title) {
        Map<String, Integer> rows = letterBreakdown(container);
        int widest = 1;
        int sum = 0;
        for (int total : rows.values()) {
            widest = Math.max(widest, total);
            sum += total;
        }
        List<String> lines = new ArrayList<>();
        lines.add(title + ": " + plural(container.size(), "word"));
        for (Map.Entry<String, Integer> row : rows.entrySet()) {
            int total = row.getValue();
            String bar = "#".repeat(Math.max(1, (BAR_WIDTH * total + widest / 2) / widest));
            lines.add(String.format("  %s  %-" + BAR_WIDTH + "s %4d", row.getKey(), bar, total));
        }
        lines.add("  A-Z total: " + sum);
        return String.join("\n", lines);
    }

    public static String formatPrefix(WordContainer container, String prefix) {
        return formatPrefix(container, prefix, 6);
    }

    /** One autocomplete line: the badge count and the first few completions. */
    public static String formatPrefix(WordContainer container, String prefix, int shown) {
        int total = container.count(prefix);
        List<String> words = container.withPrefix(prefix);
        if (words.size() > shown) words = words.subList(0, shown);
        String more = total > words.size() ? " (+" + (total - words.size()) + " more)" : "";
        String listed = words.isEmpty() ? "-" : String.join(", ", words);
        return prefix + "...  " + plural(total, "word") + ": " + listed + more;
    }

    /** One pattern-search line, noting when the list was cut at limit (null for no limit). */
    public static String formatMatches(String pattern, List<String> words, Integer limit) {
        if (words.isEmpty()) return pattern + "  no matches";
        String cut = limit != null && words.size() == limit ? " ..." : "";
        return pattern + "  " + String.join(", ", words) + cut;
    }
}
