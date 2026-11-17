package wordstore;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Reading word lists into a {@link WordContainer}.
 *
 * <p>Lists are UTF-8 text with one entry per line:
 *
 * <pre>
 *   # comment lines start with '#'; blank lines are skipped
 *   apple
 *   Ice cream        stored as "icecream"
 *   jalapeño;60      "entry;score" lines from crossword lists; the score is ignored
 * </pre>
 *
 * <p>A bad entry is recorded in the LoadReport instead of throwing, so one stray
 * line does not abort an import. The bundled lists live in data/: core.txt holds
 * everyday words and the themed packs (sports.txt, kitchen.txt) overlap it.
 */
public final class Loader {
    /** Where the bundled lists are, relative to the project root. */
    public static final Path DATA_DIR = Path.of("data");

    public static final List<String> BUNDLED = List.of("core", "sports", "kitchen");

    private Loader() {}

    /** One line that holds an entry. */
    record Line(int number, String entry) {}

    static List<Line> entries(String text) {
        // Lists exported from spreadsheets often start with a byte-order mark.
        int skip = 0;
        while (skip < text.length() && text.charAt(skip) == 0xFEFF) skip++;
        String[] lines = text.substring(skip).split("\n", -1);
        List<Line> found = new ArrayList<>();
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            int semicolon = line.indexOf(';');
            String entry = (semicolon >= 0 ? line.substring(0, semicolon) : line).strip();
            if (!entry.isEmpty() && !entry.startsWith("#")) found.add(new Line(i + 1, entry));
        }
        return found;
    }

    /** Add every entry in text to container and report what happened. */
    public static LoadReport loadText(WordContainer container, String text, String source) {
        LoadReport report = new LoadReport(source);
        for (Line line : entries(text)) {
            boolean isNew;
            try {
                isNew = container.add(line.entry());
            } catch (InvalidWordException error) {
                report.rejected.add(new LoadReport.Rejection(line.number(), line.entry(), error.getMessage()));
                continue;
            }
            if (isNew) report.added++;
            else report.duplicates++;
        }
        return report;
    }

    public static LoadReport loadText(WordContainer container, String text) {
        return loadText(container, text, "<text>");
    }

    public static LoadReport loadFile(WordContainer container, Path file) {
        try {
            return loadText(container, Files.readString(file, StandardCharsets.UTF_8), file.getFileName().toString());
        } catch (IOException error) {
            throw new UncheckedIOException(error);
        }
    }

    /** Import bundled lists in order; returns one LoadReport per list. */
    public static List<LoadReport> loadBundled(WordContainer container) {
        List<LoadReport> reports = new ArrayList<>();
        for (String name : BUNDLED) reports.add(loadFile(container, DATA_DIR.resolve(name + ".txt")));
        return reports;
    }
}
