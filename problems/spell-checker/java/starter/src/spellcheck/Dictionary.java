package spellcheck;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The word list behind the spell checker, with usage frequencies.
 *
 * <p>File format: one entry per line, a word and how often it appeared in the
 * notes corpus, separated by whitespace. A missing count means 1. Blank lines
 * and lines starting with # are ignored.
 *
 * <pre>
 *     receive   215
 *     don't     3020
 * </pre>
 *
 * <p>Entries are keyed by {@link #normalize(String)}.
 */
public final class Dictionary {
    /** The base dictionary, relative to the project root. */
    public static final Path DEFAULT_WORDS = Path.of("data", "words.txt");

    private static final Pattern LINE_BREAK = Pattern.compile("\\r?\\n");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern COUNT = Pattern.compile("\\d+");

    private final Map<String, Integer> counts = new LinkedHashMap<>();

    /** Lookup key for a word: lower case, typographic apostrophes as '. */
    public static String normalize(String word) {
        return word.replace('’', '\'').toLowerCase(Locale.ROOT);
    }

    public static Dictionary parse(String text) {
        Dictionary dictionary = new Dictionary();
        String[] lines = LINE_BREAK.split(text, -1);
        for (int index = 0; index < lines.length; index++) {
            String raw = lines[index];
            String line = raw.strip();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            String[] parts = WHITESPACE.split(line);
            if (parts.length > 2 || (parts.length == 2 && !COUNT.matcher(parts[1]).matches())) {
                throw new IllegalArgumentException("line " + (index + 1) + ": expected 'word count', got '" + raw + "'");
            }
            dictionary.add(parts[0], parts.length == 2 ? Integer.parseInt(parts[1]) : 1);
        }
        return dictionary;
    }

    public static Dictionary load() {
        return load(DEFAULT_WORDS);
    }

    public static Dictionary load(Path file) {
        try {
            return parse(Files.readString(file));
        } catch (IOException e) {
            throw new UncheckedIOException("cannot read the dictionary " + file, e);
        }
    }

    /** Adds word, or adds count to it if it is already known. */
    public void add(String word, int count) {
        counts.merge(normalize(word), count, Integer::sum);
    }

    public void add(String word) {
        add(word, 1);
    }

    public boolean contains(String word) {
        return counts.containsKey(normalize(word));
    }

    /** How common word is; 0 when it isn't in the dictionary. */
    public int frequency(String word) {
        return counts.getOrDefault(normalize(word), 0);
    }

    /** Every entry's lookup key, in the order they were added. */
    public List<String> words() {
        return new ArrayList<>(counts.keySet());
    }

    public int size() {
        return counts.size();
    }
}
