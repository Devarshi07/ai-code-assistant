package fifteens;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Tournament marathon mode.
 *
 * <p>In tournament finals the cards are not dealt into small hands. A marathon hand of up to a full
 * deck is spread face up and the table calls bonus targets such as 15, 31 or 100. For every target
 * the scoreboard shows how many combinations of cards (by position, as everywhere else) add up to
 * it. Only the counts are needed; nobody wants the combinations listed.
 */
public final class Tournament {
    /** Marathon hands come from a single deck. */
    public static final int MAX_MARATHON_CARDS = 52;
    public static final int MAX_TARGET = 200;

    private Tournament() {}

    /** Map each target to the number of combinations of cards adding up to it, in the order given. */
    public static Map<Integer, Long> marathonCounts(List<Card> cards, List<Integer> targets) {
        if (cards.size() > MAX_MARATHON_CARDS) {
            throw new IllegalArgumentException("a marathon hand has at most " + MAX_MARATHON_CARDS + " cards");
        }
        for (int target : targets) {
            if (target < 1 || target > MAX_TARGET) throw new IllegalArgumentException("targets must be between 1 and " + MAX_TARGET);
        }
        Map<Integer, Long> counts = new LinkedHashMap<>();
        for (int target : targets) counts.put(target, Evaluate.countCombinations(cards, target));
        return counts;
    }

    /** Counts for the default target, fifteen. */
    public static Map<Integer, Long> marathonCounts(List<Card> cards) {
        return marathonCounts(cards, List.of(Evaluate.FIFTEEN));
    }

    public static String formatMarathon(List<Card> cards, Map<Integer, Long> counts) {
        StringBuilder out = new StringBuilder("Marathon hand (" + cards.size() + " cards): ");
        out.append(Card.format(cards.subList(0, Math.min(8, cards.size())))).append(cards.size() > 8 ? " ..." : "");
        counts.forEach((target, count) -> out.append(String.format(Locale.ROOT, "\n  target %3d: %,d combinations", target, count)));
        return out.toString();
    }
}
