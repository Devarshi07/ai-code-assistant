package tests;

import java.util.ArrayList;
import java.util.List;

/**
 * Deterministic pseudo-English dictionaries and queries for the scale tests.
 * Every language edition has the same generator, so a seed produces the same
 * words everywhere.
 */
final class Generator {
    // "_" stands for the empty string, so the lists can be written as plain text.
    private static final String[] ONSETS = ("_ _ b b br c c ch cl d d dr f fl g gr h h j k l l m m n n p p pl r r s s sh sl sp "
            + "st t t th tr v w w y z").split(" ");
    private static final String[] VOWELS = "a a e e i o u ai au ea ee ie oa oo ou y".split(" ");
    private static final String[] CODAS = "_ _ _ _ _ _ _ _ b ck d g l ll m n n nd ng nt p r r s st t t x".split(" ");
    private static final String[] SUFFIXES = "_ _ _ _ _ _ _ _ _ _ s s s ed er ing ly y".split(" ");

    private Generator() {}

    /** 32-bit linear congruential generator, identical in every edition. */
    static final class Lcg {
        private int state;

        Lcg(int seed) {
            state = seed;
        }

        /** A number in [0, n). */
        int below(int n) {
            state = state * 1664525 + 1013904223;
            return (state >>> 16) % n;
        }
    }

    private static String pick(String[] list, Lcg lcg) {
        String item = list[lcg.below(list.length)];
        return item.equals("_") ? "" : item;
    }

    private static String makeWord(Lcg lcg) {
        StringBuilder word = new StringBuilder();
        int syllables = 1;
        syllables += lcg.below(2);
        syllables += lcg.below(2);
        for (int i = 0; i < syllables; i++) {
            word.append(pick(ONSETS, lcg));
            word.append(pick(VOWELS, lcg));
            word.append(pick(CODAS, lcg));
        }
        return word.append(pick(SUFFIXES, lcg)).toString();
    }

    /** count pseudo-words; expect some repeats. */
    static List<String> generateWords(int seed, int count) {
        Lcg lcg = new Lcg(seed);
        List<String> words = new ArrayList<>(count);
        for (int i = 0; i < count; i++) words.add(makeWord(lcg));
        return words;
    }

    /** Grid-fill queries: stored words with some squares still blank, e.g. "?ra??le". */
    static List<String> slotPatterns(List<String> words, int seed, int count) {
        return slotPatterns(words, seed, count, 40);
    }

    static List<String> slotPatterns(List<String> words, int seed, int count, int blankPercent) {
        Lcg lcg = new Lcg(seed);
        List<String> patterns = new ArrayList<>();
        while (patterns.size() < count) {
            String word = words.get(lcg.below(words.size()));
            if (word.length() < 4) continue;
            StringBuilder squares = new StringBuilder();
            int fixed = 0;
            for (int i = 0; i < word.length(); i++) {
                if (lcg.below(100) < blankPercent) {
                    squares.append('?');
                } else {
                    squares.append(word.charAt(i));
                    fixed++;
                }
            }
            if (fixed >= 2) patterns.add(squares.toString());
        }
        return patterns;
    }

    /** Solver-panel queries: the start of a word with a few blanks, then a star, e.g. "dr?n*". */
    static List<String> searchPatterns(List<String> words, int seed, int count) {
        Lcg lcg = new Lcg(seed);
        List<String> patterns = new ArrayList<>();
        while (patterns.size() < count) {
            String word = words.get(lcg.below(words.size()));
            if (word.length() < 6) continue;
            String start = word.substring(0, 3 + lcg.below(word.length() - 4));
            StringBuilder squares = new StringBuilder();
            int fixed = 0;
            for (int i = 0; i < start.length(); i++) {
                if (lcg.below(100) < 35) {
                    squares.append('?');
                } else {
                    squares.append(start.charAt(i));
                    fixed++;
                }
            }
            if (fixed >= 2) patterns.add(squares + "*");
        }
        return patterns;
    }
}
