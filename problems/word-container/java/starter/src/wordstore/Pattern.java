package wordstore;

import java.util.Locale;

/**
 * A parsed crossword pattern. Create one with {@link #parse(String)}.
 *
 * <p>The syntax used by the solver panel and the grid filler. A pattern describes a
 * whole entry, one symbol per square:
 *
 * <pre>
 *   letter   that exact letter                    c?t   -> cat, cot, cut
 *   ?        exactly one letter, any letter       ???   -> every 3-letter word
 *   *        any run of letters, including none   c*t   -> cat, chart, cut, ...
 *                                                 cat*  -> cat, cats, catalog, ...
 * </pre>
 *
 * <p>A pattern must match the *whole* word: "c?t" matches neither "scat" nor "cats".
 *
 * <p>Setters often type blanks as "." or "_", so both are read as "?". Letters get
 * the same clean-up as stored words (case, accents, spaces, hyphens and
 * apostrophes are ignored), so "C.T", "ç?t" and "c-?-t" all mean "c?t".
 * Runs of stars collapse: "c**t" is the same pattern as "c*t".
 */
public final class Pattern {
    public static final char ANY_LETTER = '?';
    public static final char ANY_RUN = '*';
    // Our largest grid is 25x25, so anything longer is almost certainly a paste mistake.
    public static final int MAX_SYMBOLS = 25;

    private final String text; // canonical form: letters a-z, "?" and "*", e.g. "c?t*"
    private final int minLength;
    private final Integer maxLength; // null when the pattern contains a star and so has no upper bound

    private Pattern(String text) {
        this.text = text;
        this.minLength = (int) text.chars().filter(symbol -> symbol != ANY_RUN).count();
        this.maxLength = text.indexOf(ANY_RUN) >= 0 ? null : text.length();
    }

    /** The canonical text, e.g. "c?t*". */
    public String text() {
        return text;
    }

    public int minLength() {
        return minLength;
    }

    /** The longest word that can match, or null when the pattern contains a star. */
    public Integer maxLength() {
        return maxLength;
    }

    /** True when word (already normalised, as stored) fits this pattern. */
    public boolean matches(String word) {
        throw new UnsupportedOperationException("Phase 2: Pattern.matches is not implemented");
    }

    @Override
    public String toString() {
        return text;
    }

    /** Turn user input into a Pattern. Throws PatternException when it is not one. */
    public static Pattern parse(String raw) {
        if (raw == null) throw new PatternException("expected a string, got null");
        StringBuilder symbols = new StringBuilder();
        for (int ch : Normalize.stripAccents(raw.strip()).toLowerCase(Locale.ROOT).codePoints().toArray()) {
            if (Normalize.isLetter(ch)) {
                symbols.append((char) ch);
            } else if (ch == '?' || ch == '.' || ch == '_') {
                symbols.append(ANY_LETTER);
            } else if (ch == ANY_RUN) {
                if (symbols.length() == 0 || symbols.charAt(symbols.length() - 1) != ANY_RUN) symbols.append(ANY_RUN);
            } else if (!Normalize.isIgnored(ch)) {
                throw new PatternException("'" + raw + "': '" + new String(Character.toChars(ch)) + "' is not allowed in a pattern");
            }
        }
        if (symbols.length() == 0) throw new PatternException("'" + raw + "': pattern is empty");
        if (symbols.length() > MAX_SYMBOLS) {
            throw new PatternException("'" + raw + "': patterns are limited to " + MAX_SYMBOLS + " symbols");
        }
        return new Pattern(symbols.toString());
    }
}
