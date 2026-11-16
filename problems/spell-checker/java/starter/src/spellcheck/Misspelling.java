package spellcheck;

/**
 * A word the dictionary doesn't know.
 *
 * @param word  as written in the note
 * @param start offset of the first character, like a {@link Token}'s
 * @param end   offset one past the last character
 */
public record Misspelling(String word, int start, int end) {
}
