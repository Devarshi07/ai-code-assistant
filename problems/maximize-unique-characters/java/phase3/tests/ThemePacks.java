package tests;

import java.util.ArrayList;
import java.util.List;

/**
 * Deterministic synthetic theme packs for scale tests (xorshift32 PRNG).
 *
 * <p>A pack mixes the things real candidate lists contain: fresh words, several
 * spellings of the same letters (anagrams), capitalized entries, and words
 * with a doubled letter. Every language's tests use the same generator, so
 * equal seeds give equal packs everywhere.
 */
final class ThemePacks {
    private ThemePacks() {}

    // Letters weighted roughly like English text, so common letters collide often.
    static final String ENGLISH = "eeeeeeeeeeeettttttttaaaaaaaaoooooooiiiiiiinnnnnnnssssssrrrrrrhhhhhdddddllllcccuuummmwwffggyyppbbvkjxqz";
    static final String EVEN = "abcdefghijklmnopqrstuvwxyz";

    static final class Rng {
        private int x;

        Rng(int seed) {
            x = seed == 0 ? 1 : seed;
        }

        int below(int n) {
            x ^= x << 13;
            x ^= x >>> 17;
            x ^= x << 5;
            return (int) ((x & 0xFFFFFFFFL) % n);
        }

        <T> List<T> shuffle(List<T> items) {
            for (int j = items.size() - 1; j > 0; j--) {
                int k = below(j + 1);
                T swap = items.get(j);
                items.set(j, items.get(k));
                items.set(k, swap);
            }
            return items;
        }
    }

    /** size candidate words; each letter set appears in 1..spellings spellings. */
    static List<String> themePack(int seed, int size, int minLength, int maxLength, int spellings, String bag) {
        Rng rng = new Rng(seed);
        List<String> pack = new ArrayList<>();
        while (pack.size() < size) {
            int length = minLength + rng.below(maxLength - minLength + 1);
            List<Character> letters = new ArrayList<>();
            while (letters.size() < length) {
                char letter = bag.charAt(rng.below(bag.length()));
                if (!letters.contains(letter)) letters.add(letter);
            }
            String word = join(letters);
            int roll = rng.below(10);
            if (roll == 0) pack.add(word + word.charAt(word.length() - 1)); // doubled letter: never playable
            else if (roll == 1) pack.add(Character.toUpperCase(word.charAt(0)) + word.substring(1));
            int copies = 1 + rng.below(spellings);
            for (int i = 0; i < copies; i++) pack.add(join(rng.shuffle(letters)));
        }
        return rng.shuffle(new ArrayList<>(pack.subList(0, size)));
    }

    private static String join(List<Character> letters) {
        StringBuilder text = new StringBuilder();
        letters.forEach(text::append);
        return text.toString();
    }

    /** Many 2-4 letter words: deep boards of eight or more words. */
    static List<String> shortWordPack(int seed, int size) {
        return themePack(seed, size, 2, 4, 2, ENGLISH);
    }

    /** 4-7 letter words, most letter sets in several spellings: shallow boards, many ties. */
    static List<String> longWordPack(int seed, int size) {
        return themePack(seed, size, 4, 7, 8, EVEN);
    }
}
