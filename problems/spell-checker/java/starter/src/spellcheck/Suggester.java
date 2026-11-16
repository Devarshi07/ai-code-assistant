package spellcheck;

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

    private final Dictionary dictionary;

    public Suggester(Dictionary dictionary) {
        this.dictionary = dictionary;
    }

    /** Levenshtein distance between strings a and b. */
    public static int editDistance(String a, String b) {
        throw new UnsupportedOperationException("Phase 2: editDistance is not implemented yet");
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
        throw new UnsupportedOperationException("Phase 2: Suggester.suggest is not implemented yet");
    }
}
