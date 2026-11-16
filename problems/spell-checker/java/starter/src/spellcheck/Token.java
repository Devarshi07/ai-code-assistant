package spellcheck;

/**
 * A word as it appears in the note.
 *
 * @param text  the word exactly as written in the note
 * @param start offset of its first character
 * @param end   offset one past its last character
 */
public record Token(String text, int start, int end) {
}
