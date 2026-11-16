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
     * Every combination of one or more cards whose values add up to target.
     *
     * <p>Each combination lists its cards in hand order. Combinations are ordered by the positions
     * of their cards, compared like words in a dictionary.
     *
     * <p>Depth-first search over positions: the next card added always sits to the right of the
     * last one, which yields combinations in exactly that dictionary order. Card values are
     * positive, so a branch stops as soon as its total reaches the target.
     */
    public static List<List<Card>> findCombinations(List<Card> cards, int target) {
        int[] values = cards.stream().mapToInt(Card::value).toArray();
        List<List<Card>> found = new ArrayList<>();
        if (target > 0) extend(cards, values, target, 0, 0, new ArrayList<>(), found);
        return found;
    }

    /** Adds every combination that extends {@code chosen} with cards from position {@code start} on. */
    private static void extend(List<Card> cards, int[] values, int target, int start, int total, List<Card> chosen, List<List<Card>> found) {
        for (int i = start; i < values.length; i++) {
            int newTotal = total + values[i];
            if (newTotal > target) continue;
            chosen.add(cards.get(i));
            if (newTotal == target) found.add(List.copyOf(chosen));
            else extend(cards, values, target, i + 1, newTotal, chosen, found);
            chosen.remove(chosen.size() - 1);
        }
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
