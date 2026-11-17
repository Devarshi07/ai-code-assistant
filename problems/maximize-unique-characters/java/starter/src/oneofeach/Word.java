package oneofeach;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * One candidate from the designers' word list.
 *
 * <p>{@code text} is always normalized (lower-case a-z). {@code mask} holds the
 * word's letters as a bitmask (see {@link Letters}). {@code difficulty} runs from
 * 1 (easy) to 3 (hard) and {@code tags} names the themes the word belongs to.
 */
public final class Word {
    private final String text;
    private final int difficulty;
    private final Set<String> tags;
    private final int mask;

    public Word(String text) {
        this(text, 1, List.of());
    }

    public Word(String text, int difficulty, Collection<String> tags) {
        this.text = Letters.normalizeWord(text);
        this.difficulty = difficulty;
        this.tags = new TreeSet<>(tags);
        this.mask = Letters.letterMask(this.text);
    }

    public String text() {
        return text;
    }

    public int difficulty() {
        return difficulty;
    }

    public Set<String> tags() {
        return tags;
    }

    public int mask() {
        return mask;
    }

    /** The word's distinct letters in alphabetical order ("otter" -> "eort"). */
    public String letters() {
        return Letters.maskLetters(mask);
    }

    /** How many tiles the word puts on the board. */
    public int length() {
        return letters().length();
    }

    /** True when some letter appears more than once in the word. */
    public boolean hasRepeats() {
        return Letters.popcount(mask) != length();
    }

    @Override
    public String toString() {
        return "Word(" + text + ")";
    }

    /** Accept Word objects or plain strings; return a list of Words. */
    public static List<Word> asWords(Collection<?> items) {
        List<Word> words = new ArrayList<>();
        for (Object item : items) {
            words.add(item instanceof Word word ? word : new Word((String) item));
        }
        return words;
    }
}
