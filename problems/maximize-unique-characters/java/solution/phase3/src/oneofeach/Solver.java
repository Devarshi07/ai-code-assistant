package oneofeach;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
     *
     * <ol>
     *   <li>Keep one spelling per letter set (anagrams are interchangeable), and keep
     *       the alphabetically first one so the tie-break is unaffected.</li>
     *   <li>Branch and bound, longest words first, finds the best total.</li>
     *   <li>A second search in alphabetical order stops at the first board that
     *       reaches that total. Alphabetical depth-first order visits boards in
     *       tie-break order, so that board is the answer.</li>
     * </ol>
     */
    public static Selection bestSelection(Collection<?> items) {
        Map<Integer, Word> firstSpelling = new LinkedHashMap<>();
        for (Word word : playableWords(items)) {
            Word current = firstSpelling.get(word.mask());
            if (current == null || word.text().compareTo(current.text()) < 0) firstSpelling.put(word.mask(), word);
        }
        List<Word> entries = new ArrayList<>(firstSpelling.values());
        Comparator<Word> byText = Comparator.comparing(Word::text);
        List<Word> longestFirst = new ArrayList<>(entries);
        longestFirst.sort(Comparator.comparingInt((Word word) -> word.text().length()).reversed().thenComparing(byText));
        int target = bestTotal(longestFirst);
        List<Word> alphabetical = new ArrayList<>(entries);
        alphabetical.sort(byText);
        return new Selection(firstBoard(alphabetical, target), target);
    }

    /** reach[p] is every letter that candidates[p..] could still add to the board. */
    private static int[] reachOf(int[] masks, int[] candidates) {
        int[] reach = new int[candidates.length + 1];
        for (int p = candidates.length - 1; p >= 0; p--) reach[p] = reach[p + 1] | masks[candidates[p]];
        return reach;
    }

    /** Candidates after position p that share no letter with mask. */
    private static int[] compatible(int[] masks, int[] candidates, int p, int mask) {
        int[] rest = new int[candidates.length - p - 1];
        int count = 0;
        for (int q = p + 1; q < candidates.length; q++) {
            if ((masks[candidates[q]] & mask) == 0) rest[count++] = candidates[q];
        }
        return java.util.Arrays.copyOf(rest, count);
    }

    private static int[] everyIndex(int size) {
        int[] all = new int[size];
        for (int i = 0; i < size; i++) all[i] = i;
        return all;
    }

    /** Branch-and-bound state for the best total. */
    private static final class Bound {
        final int[] masks;
        final int[] sizes;
        int best = 0;

        Bound(List<Word> entries) {
            masks = entries.stream().mapToInt(Word::mask).toArray();
            sizes = entries.stream().mapToInt(word -> word.text().length()).toArray();
        }

        // candidates: indexes of words that fit the current board, in search order.
        void grow(int[] candidates, int total) {
            if (total > best) best = total;
            int[] reach = reachOf(masks, candidates);
            for (int p = 0; p < candidates.length; p++) {
                // even every remaining letter could not beat the best board
                if (total + Letters.popcount(reach[p]) <= best) return;
                int i = candidates[p];
                grow(compatible(masks, candidates, p, masks[i]), total + sizes[i]);
            }
        }
    }

    /** Most letters any board can cover, using entries in the given search order. */
    private static int bestTotal(List<Word> entries) {
        Bound bound = new Bound(entries);
        bound.grow(everyIndex(entries.size()), 0);
        return bound.best;
    }

    /** Search for the first board, in alphabetical depth-first order, that covers target letters. */
    private static final class FirstBoard {
        final List<Word> entries;
        final int[] masks;
        final int target;
        final List<String> chosen = new ArrayList<>();

        FirstBoard(List<Word> entries, int target) {
            this.entries = entries;
            this.masks = entries.stream().mapToInt(Word::mask).toArray();
            this.target = target;
        }

        boolean extend(int[] candidates, int total) {
            if (total == target) return true;
            int[] reach = reachOf(masks, candidates);
            for (int p = 0; p < candidates.length; p++) {
                if (total + Letters.popcount(reach[p]) < target) return false;
                Word word = entries.get(candidates[p]);
                chosen.add(word.text());
                if (extend(compatible(masks, candidates, p, word.mask()), total + word.text().length())) return true;
                chosen.remove(chosen.size() - 1);
            }
            return false;
        }
    }

    private static List<String> firstBoard(List<Word> entries, int target) {
        FirstBoard search = new FirstBoard(entries, target);
        search.extend(everyIndex(entries.size()), 0);
        return List.copyOf(search.chosen);
    }
}
