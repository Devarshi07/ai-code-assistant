package oneofeach;

import java.util.Locale;
import java.util.TreeSet;

/**
 * Letter-set helpers shared by the whole package.
 *
 * <p>A word's letters are stored as a 26-bit mask: bit 0 is 'a', bit 25 is 'z'.
 * Masks make the puzzle rule cheap to check, because two words share a letter
 * exactly when {@code (a & b) != 0}.
 *
 * <pre>maskLetters(letterMask("tango"))  // "agnot"</pre>
 */
public final class Letters {
    public static final String ALPHABET = "abcdefghijklmnopqrstuvwxyz";
    public static final int FULL_MASK = (1 << ALPHABET.length()) - 1;

    private Letters() {}

    /** Trim and lower-case a word. Anything except the letters a-z is rejected. */
    public static String normalizeWord(String raw) {
        String word = raw.strip().toLowerCase(Locale.ROOT);
        if (word.isEmpty()) throw new WordException("empty word");
        TreeSet<Character> bad = new TreeSet<>();
        for (char ch : word.toCharArray()) {
            if (ALPHABET.indexOf(ch) < 0) bad.add(ch);
        }
        if (!bad.isEmpty()) {
            StringBuilder letters = new StringBuilder();
            bad.forEach(letters::append);
            throw new WordException("'" + raw.strip() + "' contains '" + letters + "'; only a-z are allowed");
        }
        return word;
    }

    /** The mask bit for a single lower-case letter. */
    public static int letterBit(char ch) {
        return 1 << (ch - 'a');
    }

    /** Bitmask of the distinct letters in a normalized word. */
    public static int letterMask(String word) {
        int mask = 0;
        for (char ch : word.toCharArray()) mask |= letterBit(ch);
        return mask;
    }

    /** Number of letters in a mask. */
    public static int popcount(int mask) {
        int count = 0;
        for (int rest = mask; rest != 0; rest &= rest - 1) count++;
        return count;
    }

    /** The letters in a mask, alphabetically: {@code maskLetters(letterMask("otter")).equals("eort")}. */
    public static String maskLetters(int mask) {
        StringBuilder letters = new StringBuilder();
        for (int i = 0; i < ALPHABET.length(); i++) {
            if ((mask & (1 << i)) != 0) letters.append(ALPHABET.charAt(i));
        }
        return letters.toString();
    }

    /** Letters present in both masks, alphabetically. */
    public static String sharedLetters(int a, int b) {
        return maskLetters(a & b);
    }
}
