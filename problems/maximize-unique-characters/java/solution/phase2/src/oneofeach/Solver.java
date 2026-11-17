package oneofeach;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
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

    /** True when word list a sorts before word list b (word by word, like a dictionary). */
    private static boolean listBefore(List<String> a, List<String> b) {
        for (int i = 0; i < Math.min(a.size(), b.size()); i++) {
            int order = a.get(i).compareTo(b.get(i));
            if (order != 0) return order < 0;
        }
        return a.size() < b.size();
    }

    /** Mutable state of one search. */
    private static final class Search {
        final List<Word> pool;
        final List<String> chosen = new ArrayList<>();
        int bestTotal = 0;
        List<String> bestWords = List.of();

        Search(List<Word> pool) {
            this.pool = pool;
        }

        void run(int start, int used, int total) {
            if (total > bestTotal || (total == bestTotal && listBefore(chosen, bestWords))) {
                bestTotal = total;
                bestWords = List.copyOf(chosen);
            }
            for (int i = start; i < pool.size(); i++) {
                Word word = pool.get(i);
                if ((word.mask() & used) != 0) continue;
                chosen.add(word.text());
                run(i + 1, used | word.mask(), total + word.length());
                chosen.remove(chosen.size() - 1);
            }
        }
    }

    /**
     * The board that covers the most letters without repeating any.
     *
     * <p>Returns a {@link Selection}: the chosen words in alphabetical order and the
     * number of letters they cover. Ties go to the alphabetically first word list.
     *
     * <p>Backtracking: try every set of mutually compatible words, extending a board
     * only with words that come later alphabetically and share no letter with it,
     * and keep the best board seen.
     */
    public static Selection bestSelection(Collection<?> items) {
        List<Word> pool = new ArrayList<>(playableWords(items));
        pool.sort(Comparator.comparing(Word::text));
        Search search = new Search(pool);
        search.run(0, 0, 0);
        return new Selection(search.bestWords, search.bestTotal);
    }
}
