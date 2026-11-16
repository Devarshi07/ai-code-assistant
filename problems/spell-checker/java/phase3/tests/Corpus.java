package tests;

import java.util.ArrayList;
import java.util.List;

import spellcheck.Dictionary;

/**
 * Deterministic large dictionaries and typo batches for the scale tests.
 *
 * <p>The tests in the other languages use the same generator, so every version
 * sees exactly the same words, frequencies and queries.
 */
final class Corpus {
    private static final String[] ONSETS = {"", "", "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s",
        "t", "v", "w", "z", "br", "ch", "cl", "dr", "fl", "gr", "pl", "sh", "st", "th", "tr"};
    private static final String[] VOWELS = {"a", "e", "i", "o", "u", "a", "e", "i", "o", "y", "ai", "ea", "ee", "oo", "ou"};
    private static final String[] CODAS = {"", "", "", "", "", "n", "r", "s", "t", "l", "m", "d", "ck", "nd", "st", "ng"};
    private static final String[] SUFFIXES = {"", "", "", "", "", "", "s", "s", "ed", "er", "ing", "ly"};
    private static final int[] SYLLABLES = {1, 1, 2, 2, 2, 3};
    private static final String LETTERS = "abcdefghijklmnopqrstuvwxyz";

    private Corpus() {
    }

    /** Small 32-bit linear congruential generator. */
    static final class Lcg {
        private long state;

        Lcg(long seed) {
            state = seed & 0xFFFFFFFFL;
        }

        /** A pseudo-random integer in [0, n). */
        int below(int n) {
            state = (state * 1664525L + 1013904223L) & 0xFFFFFFFFL;
            return (int) ((state * n) >>> 32);
        }

        String pick(String[] items) {
            return items[below(items.length)];
        }

        char pick(String letters) {
            return letters.charAt(below(letters.length()));
        }
    }

    private static String pseudoWord(Lcg rng) {
        int syllables = SYLLABLES[rng.below(SYLLABLES.length)];
        StringBuilder word = new StringBuilder();
        for (int s = 0; s < syllables; s++) {
            word.append(rng.pick(ONSETS)).append(rng.pick(VOWELS)).append(rng.pick(CODAS));
        }
        return word.append(rng.pick(SUFFIXES)).toString();
    }

    /** The base word list plus generated words: {@code size} entries in total. */
    static Dictionary largeDictionary(int size) {
        return largeDictionary(size, 1);
    }

    static Dictionary largeDictionary(int size, long seed) {
        Dictionary dictionary = Dictionary.load();
        Lcg rng = new Lcg(seed);
        while (dictionary.size() < size) {
            String word = pseudoWord(rng);
            int count = 1 + rng.below(400);
            if (!dictionary.contains(word)) {
                dictionary.add(word, count);
            }
        }
        return dictionary;
    }

    /** word with one random insertion, deletion, substitution or swap. */
    private static String typo(Lcg rng, String word) {
        int kind = rng.below(4);
        if (kind == 0 || word.length() < 2) {
            int i = rng.below(word.length() + 1);
            return word.substring(0, i) + rng.pick(LETTERS) + word.substring(i);
        }
        if (kind == 1) {
            int i = rng.below(word.length());
            return word.substring(0, i) + word.substring(i + 1);
        }
        if (kind == 2) {
            int i = rng.below(word.length());
            return word.substring(0, i) + rng.pick(LETTERS) + word.substring(i + 1);
        }
        int i = rng.below(word.length() - 1);
        return word.substring(0, i) + word.charAt(i + 1) + word.charAt(i) + word.substring(i + 2);
    }

    /** {@code count} misspellings, each a dictionary word with one or two typos. */
    static List<String> typoBatch(Dictionary dictionary, int count) {
        return typoBatch(dictionary, count, 7);
    }

    static List<String> typoBatch(Dictionary dictionary, int count, long seed) {
        Lcg rng = new Lcg(seed);
        List<String> words = dictionary.words();
        List<String> batch = new ArrayList<>();
        for (int n = 0; n < count; n++) {
            String word = words.get(rng.below(words.size()));
            int typos = 1 + rng.below(2);
            for (int t = 0; t < typos; t++) {
                word = typo(rng, word);
            }
            batch.add(word);
        }
        return batch;
    }
}
