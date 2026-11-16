package spellcheck;

import java.util.ArrayList;
import java.util.List;

/**
 * Splits note text into words, keeping each word's character offsets.
 *
 * <p>The editor draws its red underline from the offsets reported here, so
 * every token must point at exactly the characters it came from in the note.
 *
 * <p>Rules:
 * <ul>
 *   <li>A word is a run of letters. An apostrophe with a letter on both sides
 *       belongs to the word, so contractions and possessives stay whole:
 *       don't, o'clock, team's.
 *   <li>Quotes, hyphens, dashes, slashes and other punctuation separate words.
 *       "well-known" is checked as "well" and "known"; 'draft' is just draft.
 *   <li>Runs that contain a digit (2024, 3rd, mp3, 10am) are not words and
 *       are skipped entirely.
 * </ul>
 */
public final class Tokenizer {
    private static final char APOSTROPHE = '\'';
    private static final String DIGITS = "0123456789";

    private Tokenizer() {
    }

    public static boolean isLetter(char ch) {
        return Character.isLetter(ch);
    }

    private static boolean isWordChar(char ch) {
        return isLetter(ch) || DIGITS.indexOf(ch) >= 0;
    }

    /** True when the character at i is an apostrophe with a letter on each side. */
    private static boolean joinsWord(String text, int i) {
        return text.charAt(i) == APOSTROPHE && i > 0 && i < text.length() - 1
                && isLetter(text.charAt(i - 1)) && isLetter(text.charAt(i + 1));
    }

    /** Every checkable word in text, in order. */
    public static List<Token> tokenize(String text) {
        List<Token> tokens = new ArrayList<>();
        int i = 0;
        while (i < text.length()) {
            if (!isWordChar(text.charAt(i))) {
                i++;
                continue;
            }
            int start = i;
            while (i < text.length() && (isWordChar(text.charAt(i)) || joinsWord(text, i))) {
                i++;
            }
            String word = text.substring(start, i);
            if (word.chars().noneMatch(ch -> DIGITS.indexOf(ch) >= 0)) {
                tokens.add(new Token(word, start, i));
            }
        }
        return tokens;
    }
}
