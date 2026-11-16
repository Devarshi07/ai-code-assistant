package spellcheck;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.Function;

/** Plain-text views of spell-check results, for the CLI and support logs. */
public final class Report {
    /** A 1-based line and column in the note. */
    public record Position(int line, int column) {
    }

    private Report() {
    }

    /** 1-based line and column of a character offset in text. */
    public static Position lineCol(String text, int offset) {
        String before = text.substring(0, Math.min(offset, text.length()));
        int line = (int) before.chars().filter(ch -> ch == '\n').count() + 1;
        int column = offset - before.lastIndexOf('\n');
        return new Position(line, column);
    }

    public static String underline(String text, List<Misspelling> misspellings) {
        return underline(text, misspellings, '^');
    }

    /** The text with a row of marks under each misspelled word. */
    public static String underline(String text, List<Misspelling> misspellings, char mark) {
        List<String> out = new ArrayList<>();
        int lineStart = 0;
        for (String line : text.split("\n", -1)) {
            int lineEnd = lineStart + line.length();
            char[] marks = new char[line.length()];
            Arrays.fill(marks, ' ');
            for (Misspelling m : misspellings) {
                for (int i = Math.max(m.start(), lineStart); i < Math.min(m.end(), lineEnd); i++) {
                    marks[i - lineStart] = mark;
                }
            }
            out.add(line);
            String row = new String(marks);
            if (row.indexOf(mark) >= 0) {
                out.add(row.stripTrailing());
            }
            lineStart = lineEnd + 1;
        }
        return String.join("\n", out);
    }

    public static String formatReport(String text, List<Misspelling> misspellings) {
        return formatReport(text, misspellings, null);
    }

    /**
     * One row per misspelling: line:column, the word, and suggestions.
     * suggest, when not null, is called with each misspelled word and returns
     * the replacements to list.
     */
    public static String formatReport(String text, List<Misspelling> misspellings,
            Function<String, List<String>> suggest) {
        if (misspellings.isEmpty()) {
            return "No spelling issues found.";
        }
        String noun = misspellings.size() == 1 ? "issue" : "issues";
        List<String> rows = new ArrayList<>();
        rows.add(misspellings.size() + " spelling " + noun + ":");
        for (Misspelling m : misspellings) {
            Position at = lineCol(text, m.start());
            String row = String.format("%-10s", "  " + at.line() + ":" + at.column()) + m.word();
            if (suggest != null) {
                List<String> options = suggest.apply(m.word());
                row = String.format("%-24s", row)
                        + (options.isEmpty() ? "(no suggestions)" : "-> " + String.join(", ", options));
            }
            rows.add(row);
        }
        return String.join("\n", rows);
    }
}
