package oneofeach;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.TreeSet;

/**
 * Loads the designers' candidate list.
 *
 * <p>Format: one word per line, then its difficulty (1-3), then optional
 * comma-separated theme tags. Blank lines and # comments are ignored.
 *
 * <pre>
 * # word      difficulty   tags
 * tango       2            music, dance
 * otter       1            animals
 * </pre>
 */
public final class WordList {
    public static final Path DEFAULT_PATH = Path.of("data", "words.txt");

    private WordList() {}

    /** Parse word-list text into a list of Words, in file order. */
    public static List<Word> parse(String text) {
        List<Word> words = new ArrayList<>();
        String[] lines = text.split("\\R", -1);
        for (int index = 0; index < lines.length; index++) {
            int number = index + 1;
            String line = lines[index].split("#", -1)[0].strip();
            if (line.isEmpty()) continue;
            String[] parts = line.split("\\s+");
            if (parts.length < 2) {
                throw new WordListException("line " + number + ": expected 'word difficulty [tags]', got '" + line + "'");
            }
            String difficulty = parts[1];
            if (!List.of("1", "2", "3").contains(difficulty)) {
                throw new WordListException("line " + number + ": difficulty must be 1, 2 or 3, got '" + difficulty + "'");
            }
            String rest = String.join(" ", Arrays.copyOfRange(parts, 2, parts.length));
            List<String> tags = Arrays.stream(rest.split(","))
                    .map(tag -> tag.strip().toLowerCase(Locale.ROOT))
                    .filter(tag -> !tag.isEmpty())
                    .toList();
            try {
                words.add(new Word(parts[0], Integer.parseInt(difficulty), tags));
            } catch (WordException error) {
                throw new WordListException("line " + number + ": " + error.getMessage());
            }
        }
        return words;
    }

    public static List<Word> load() {
        return load(DEFAULT_PATH);
    }

    public static List<Word> load(Path file) {
        try {
            return parse(Files.readString(file));
        } catch (IOException error) {
            throw new UncheckedIOException(error);
        }
    }

    /** Candidates tagged with theme (if not null) and no harder than maxDifficulty (if not null). */
    public static List<Word> filter(List<Word> words, String theme, Integer maxDifficulty) {
        return words.stream()
                .filter(word -> (theme == null || word.tags().contains(theme))
                        && (maxDifficulty == null || word.difficulty() <= maxDifficulty))
                .toList();
    }

    /** Every theme tag used in the list, alphabetically. */
    public static List<String> themes(List<Word> words) {
        TreeSet<String> all = new TreeSet<>();
        for (Word word : words) all.addAll(word.tags());
        return List.copyOf(all);
    }
}
