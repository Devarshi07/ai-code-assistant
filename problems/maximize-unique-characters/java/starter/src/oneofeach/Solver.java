package oneofeach;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Suggests boards: the best set of candidate words for a puzzle. */
public final class Solver {
    private Solver() {}

    /**
     * Candidates that could appear on a board at all, one per spelling.
     *
     * <p>Words that repeat a letter are dropped, and so are exact duplicates (the
     * same word often appears in several themes). Order is preserved.
     */
    public static List<Word> playableWords(Collection<?> items) {
        Set<String> seen = new HashSet<>();
        List<Word> playable = new ArrayList<>();
        for (Word word : Word.asWords(items)) {
            if (word.hasRepeats() || !seen.add(word.text())) continue;
            playable.add(word);
        }
        return playable;
    }

    /**
     * The board that covers the most letters without repeating any.
     *
     * <p>Returns a {@link Selection}: the chosen words in alphabetical order and the
     * number of letters they cover. Ties go to the alphabetically first word list.
     */
    public static Selection bestSelection(Collection<?> items) {
        throw new UnsupportedOperationException("Phase 2: bestSelection is not implemented");
    }
}
