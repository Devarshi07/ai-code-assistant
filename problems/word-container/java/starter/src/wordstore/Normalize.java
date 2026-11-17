package wordstore;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Normalisation rules shared by everything that stores or looks up words.
 *
 * <p>A crossword grid holds one plain letter per square, so the store keeps every
 * entry in a single canonical form:
 *
 * <ol>
 *   <li>Surrounding whitespace is removed and letters are lowercased.
 *   <li>Accents are stripped: "Café" -> "cafe", "jalapeño" -> "jalapeno".
 *   <li>Spaces, hyphens and apostrophes inside an entry are dropped, the way grids
 *       ignore them: "ice cream" -> "icecream", "o'clock" -> "oclock".
 *   <li>What is left must be letters a-z. Digits and other symbols make the entry
 *       invalid ("r2d2", "24/7"), and so does an entry with no letters at all.
 * </ol>
 */
public final class Normalize {
    private static final java.util.regex.Pattern PLAIN_WORD = java.util.regex.Pattern.compile("[A-Za-z]+");
    private static final java.util.regex.Pattern COMBINING_MARKS = java.util.regex.Pattern.compile("\\p{M}");

    private Normalize() {}

    /** True for the squares a grid can hold: a-z. */
    public static boolean isLetter(int ch) {
        return ch >= 'a' && ch <= 'z';
    }

    /** True for characters that grids ignore: space, hyphen, straight and curly apostrophes. */
    public static boolean isIgnored(int ch) {
        return ch == ' ' || ch == '-' || ch == '\'' || ch == '’';
    }

    /** Remove combining marks after compatibility decomposition (é -> e, ﬁ -> fi). */
    public static String stripAccents(String text) {
        return COMBINING_MARKS.matcher(Normalizer.normalize(text, Normalizer.Form.NFKD)).replaceAll("");
    }

    /** The canonical form of an entry; throws InvalidWordException when there is none. */
    public static String normalizeWord(String raw) {
        if (raw == null) throw new InvalidWordException("expected a string, got null");
        String text = raw.strip();
        // Fast path: almost every line of a word list is a plain ASCII word.
        if (PLAIN_WORD.matcher(text).matches()) return text.toLowerCase(Locale.ROOT);
        StringBuilder letters = new StringBuilder();
        for (int ch : stripAccents(text).toLowerCase(Locale.ROOT).codePoints().toArray()) {
            if (isLetter(ch)) letters.append((char) ch);
            else if (!isIgnored(ch)) {
                throw new InvalidWordException("'" + raw + "': '" + new String(Character.toChars(ch)) + "' is not a letter");
            }
        }
        if (letters.length() == 0) throw new InvalidWordException("'" + raw + "': no letters");
        return letters.toString();
    }

    /** Like normalizeWord, but an empty prefix is allowed and means "every word". */
    public static String normalizePrefix(String raw) {
        if (raw != null && raw.isBlank()) return "";
        return normalizeWord(raw);
    }
}
