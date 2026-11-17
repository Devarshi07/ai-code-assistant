package oneofeach;

/** Text previews of a board for the puzzle desk and the CLI. */
public final class Board {
    private Board() {}

    /** "AB.D.." style strip: upper-case letters are on the board, dots are unused. */
    public static String alphabetStrip(int mask) {
        StringBuilder strip = new StringBuilder();
        for (int i = 0; i < Letters.ALPHABET.length(); i++) {
            strip.append((mask & (1 << i)) != 0 ? Character.toUpperCase(Letters.ALPHABET.charAt(i)) : '.');
        }
        return strip.toString();
    }

    /** Header, word row and alphabet strip for one puzzle. */
    public static String render(Puzzle puzzle) {
        String words = String.join("  ", puzzle.words().stream().map(word -> word.text().toUpperCase()).toList());
        if (words.isEmpty()) words = "(empty board)";
        return puzzle.day() + "  " + puzzle.theme() + ": " + puzzle.tileCount() + " tiles\n"
                + "  " + words + "\n"
                + "  [" + alphabetStrip(puzzle.covered()) + "]  " + puzzle.unusedLetters().length() + " letters unused";
    }
}
