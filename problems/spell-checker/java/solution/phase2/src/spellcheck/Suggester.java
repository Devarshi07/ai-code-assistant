package spellcheck;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Spelling suggestions: the dictionary words closest to a misspelling.
 *
 * <p>Closeness is Levenshtein edit distance, the fewest single-character
 * insertions, deletions and substitutions that turn one word into the other.
 * Swapping two neighbouring letters therefore costs 2 ("teh" -> "the").
 */
public final class Suggester {
    /** Anything further away is not a useful suggestion. */
    public static final int MAX_DISTANCE = 2;
    /** Entries shown in the editor's right-click menu. */
    public static final int DEFAULT_LIMIT = 5;

    /** A dictionary word with what it is ranked by. */
    private record Ranked(String word, int distance, int frequency) {
    }

    /** Closest first, then most frequent, then alphabetical (String.compareTo). */
    private static final Comparator<Ranked> BY_RANK = Comparator.comparingInt(Ranked::distance)
            .thenComparing(Comparator.comparingInt(Ranked::frequency).reversed())
            .thenComparing(Ranked::word);

    private final Dictionary dictionary;

    public Suggester(Dictionary dictionary) {
        this.dictionary = dictionary;
    }

    /**
     * Levenshtein distance between strings a and b.
     *
     * <p>Classic dynamic program, keeping one row of the table at a time:
     * row[j] is the distance between the current prefix of a and the first j
     * characters of b.
     */
    public static int editDistance(String a, String b) {
        int[] row = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            row[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            int previous = row[0];
            row[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int current = Math.min(Math.min(
                        row[j] + 1, // delete a[i - 1]
                        row[j - 1] + 1), // insert b[j - 1]
                        previous + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1)); // substitute
                previous = row[j];
                row[j] = current;
            }
        }
        return row[b.length()];
    }

    public List<String> suggest(String word) {
        return suggest(word, DEFAULT_LIMIT);
    }

    /**
     * Up to {@code limit} dictionary words within {@link #MAX_DISTANCE} edits of word.
     *
     * <p>The word is compared in its normalized (lower-case) form and the
     * results are dictionary keys. Closest words come first; ties go to the
     * more frequent word, then to the alphabetically smaller one.
     */
    public List<String> suggest(String word, int limit) {
        String key = Dictionary.normalize(word);
        List<Ranked> ranked = new ArrayList<>();
        for (String candidate : dictionary.words()) {
            int distance = editDistance(key, candidate);
            if (distance <= MAX_DISTANCE) {
                ranked.add(new Ranked(candidate, distance, dictionary.frequency(candidate)));
            }
        }
        ranked.sort(BY_RANK);
        return ranked.stream().limit(Math.max(limit, 0)).map(Ranked::word).toList();
    }
}
