package nonogram;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Reading and writing .non puzzle files.
 *
 * Contributors send puzzles as small text files:
 *
 * <pre>
 * # Pack 3, puzzle 7
 * title: Sailboat
 * author: R. Okafor
 * rows: 1 | 2 | 3 | 1 1
 * cols: 2 | 0 | 3 1
 * </pre>
 *
 * Each field is `key: value` on its own line. `rows` and `cols` list one clue
 * per line, separated by `|`; the numbers inside a clue are separated by
 * spaces (commas are accepted too). `0` marks a line with no filled cells.
 * Lines starting with `#` are comments.
 */
public final class PuzzleFile {
    private static final List<String> FIELDS = List.of("title", "author", "rows", "cols");

    private PuzzleFile() {}

    private static int[][] parseClueList(String value, String field) {
        String[] parts = value.split("\\|", -1);
        int[][] clues = new int[parts.length][];
        for (int i = 0; i < parts.length; i++) {
            String part = parts[i];
            String[] tokens = Arrays.stream(part.replace(',', ' ').split("\\s+")).filter(t -> !t.isEmpty()).toArray(String[]::new);
            if (tokens.length == 0) {
                throw new PuzzleException(field + ": clue " + (i + 1) + " is blank (write 0 for an empty line)");
            }
            int[] numbers = new int[tokens.length];
            for (int t = 0; t < tokens.length; t++) {
                if (!tokens[t].matches("\\d{1,9}")) {
                    throw new PuzzleException(field + ": clue " + (i + 1) + " ('" + part.strip() + "') is not a list of numbers");
                }
                numbers[t] = Integer.parseInt(tokens[t]);
            }
            if (numbers.length == 1 && numbers[0] == 0) {
                clues[i] = new int[0];
            } else if (Arrays.stream(numbers).anyMatch(n -> n == 0)) {
                throw new PuzzleException(field + ": clue " + (i + 1) + " mixes 0 with other blocks");
            } else {
                clues[i] = numbers;
            }
        }
        return clues;
    }

    /** Parse the contents of a .non file into a Puzzle. */
    public static Puzzle parse(String text) {
        Map<String, String> fields = new HashMap<>();
        String[] lines = text.split("\n");
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].strip();
            if (line.isEmpty() || line.startsWith("#")) continue;
            int colon = line.indexOf(':');
            String key = (colon < 0 ? line : line.substring(0, colon)).strip().toLowerCase();
            if (colon < 0 || !FIELDS.contains(key)) {
                throw new PuzzleException("line " + (i + 1) + ": expected one of " + String.join(", ", FIELDS) + " followed by ':'");
            }
            if (fields.containsKey(key)) throw new PuzzleException("line " + (i + 1) + ": " + key + " is given twice");
            fields.put(key, line.substring(colon + 1).strip());
        }
        for (String required : List.of("rows", "cols")) {
            if (!fields.containsKey(required)) throw new PuzzleException("puzzle file has no " + required + " field");
        }
        String title = fields.getOrDefault("title", "");
        String author = fields.getOrDefault("author", "");
        return new Puzzle(parseClueList(fields.get("rows"), "rows"), parseClueList(fields.get("cols"), "cols"),
                title.isEmpty() ? "Untitled" : title, author.isEmpty() ? null : author);
    }

    /** Serialize a Puzzle in the .non format (round-trips through parse). */
    public static String format(Puzzle puzzle) {
        List<String> lines = new ArrayList<>();
        lines.add("title: " + puzzle.title());
        if (puzzle.author() != null && !puzzle.author().isEmpty()) lines.add("author: " + puzzle.author());
        lines.add("rows: " + Arrays.stream(puzzle.rowClues()).map(Puzzle::formatClue).collect(Collectors.joining(" | ")));
        lines.add("cols: " + Arrays.stream(puzzle.colClues()).map(Puzzle::formatClue).collect(Collectors.joining(" | ")));
        return String.join("\n", lines) + "\n";
    }

    public static Puzzle load(Path file) {
        try {
            return parse(Files.readString(file));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
