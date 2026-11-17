package oneofeach;

import java.util.Collection;
import java.util.List;

/** A dated, themed board. Every letter may appear on it at most once. */
public final class Puzzle {
    private final String day;
    private final String theme;
    private final List<Word> words;

    public Puzzle(String day, String theme, Collection<?> words) {
        this.day = day;
        this.theme = theme;
        this.words = Word.asWords(words);
    }

    public String day() {
        return day;
    }

    public String theme() {
        return theme;
    }

    public List<Word> words() {
        return words;
    }

    /** Mask of every letter that appears on the board. */
    public int covered() {
        int mask = 0;
        for (Word word : words) mask |= word.mask();
        return mask;
    }

    /** Tiles shown on the board; the header and the score use this. */
    public int tileCount() {
        int sum = 0;
        for (Word word : words) sum += word.length();
        return sum;
    }

    /** Letters of the alphabet that are not on the board. */
    public String unusedLetters() {
        return Letters.maskLetters(Letters.FULL_MASK & ~covered());
    }
}
