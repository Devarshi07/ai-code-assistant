package fifteens;

import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

/**
 * Hand evaluation: finds the card patterns that the scoring rules pay for.
 *
 * <p>Every method takes a list of cards and works by <em>position</em> in that list. Two different
 * fives are two different cards, and so is the same card typed twice in practice mode. Nothing in
 * this class awards points; {@link Scoring} turns these patterns into a score.
 */
public final class Evaluate {
    public static final int FIFTEEN = 15;
    public static final int MIN_RUN = 3;

    private Evaluate() {}

    /** Every two cards of the same rank, as [first, second] in hand order. */
    public static List<List<Card>> findPairs(List<Card> cards) {
        List<List<Card>> pairs = new ArrayList<>();
        for (int i = 0; i < cards.size(); i++) {
            for (int j = i + 1; j < cards.size(); j++) {
                if (cards.get(i).rank().equals(cards.get(j).rank())) pairs.add(List.of(cards.get(i), cards.get(j)));
            }
        }
        return pairs;
    }

    /**
     * Runs of three or more consecutive ranks, aces low, kings high, no wrap.
     *
     * <p>Each run is reported once, as rank symbols from lowest to highest, and is as long as
     * possible. Repeated ranks don't make extra runs, so 3-4-4-5 holds a single run of three.
     */
    public static List<List<String>> findRuns(List<Card> cards) {
        TreeSet<Integer> present = new TreeSet<>();
        for (Card card : cards) present.add(card.order());
        List<List<String>> runs = new ArrayList<>();
        List<Integer> current = new ArrayList<>();
        for (int order : present) {
            if (!current.isEmpty() && order != current.get(current.size() - 1) + 1) {
                if (current.size() >= MIN_RUN) runs.add(rankSymbols(current));
                current = new ArrayList<>();
            }
            current.add(order);
        }
        if (current.size() >= MIN_RUN) runs.add(rankSymbols(current));
        return runs;
    }

    private static List<String> rankSymbols(List<Integer> orders) {
        return orders.stream().map(order -> Card.RANKS.get(order - 1)).toList();
    }

    /**
     * Two- and three-card combinations worth fifteen, in hand order.
     *
     * <p>This is the shortcut the v1 scorer shipped with. It misses fifteens that need four or more
     * cards, such as A-2-3-4-5 or 2-3-4-6.
     */
    public static List<List<Card>> smallFifteens(List<Card> cards) {
        List<List<Card>> found = new ArrayList<>();
        for (int i = 0; i < cards.size(); i++) {
            for (int j = i + 1; j < cards.size(); j++) {
                int pairTotal = cards.get(i).value() + cards.get(j).value();
                if (pairTotal == FIFTEEN) found.add(List.of(cards.get(i), cards.get(j)));
                for (int k = j + 1; k < cards.size(); k++) {
                    if (pairTotal + cards.get(k).value() == FIFTEEN) found.add(List.of(cards.get(i), cards.get(j), cards.get(k)));
                }
            }
        }
        return found;
    }

    /**
     * Every combination of one or more cards whose values add up to target.
     *
     * <p>Each combination lists its cards in hand order. Combinations are ordered by the positions
     * of their cards, compared like words in a dictionary.
     */
    public static List<List<Card>> findCombinations(List<Card> cards, int target) {
        throw new UnsupportedOperationException("Phase 2: findCombinations is not implemented yet");
    }

    /** Every combination of cards worth fifteen. */
    public static List<List<Card>> findCombinations(List<Card> cards) {
        return findCombinations(cards, FIFTEEN);
    }

    /** How many combinations of cards add up to target. */
    public static long countCombinations(List<Card> cards, int target) {
        return findCombinations(cards, target).size();
    }

    /** How many combinations of cards are worth fifteen. */
    public static long countCombinations(List<Card> cards) {
        return countCombinations(cards, FIFTEEN);
    }
}
