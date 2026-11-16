package fifteens;

import java.util.List;

/**
 * What a hand scored, with the patterns behind each part of the score.
 *
 * @param fifteens card combinations adding up to 15
 * @param pairs    [card, card] pairs of the same rank
 * @param runs     runs as rank symbols, e.g. ["3", "4", "5"]
 */
public record Score(List<List<Card>> fifteens, List<List<Card>> pairs, List<List<String>> runs) {
    public static final int POINTS_PER_FIFTEEN = 2;
    public static final int POINTS_PER_PAIR = 2;
    public static final int POINTS_PER_RUN_RANK = 1;

    public int fifteenPoints() {
        return POINTS_PER_FIFTEEN * fifteens.size();
    }

    public int pairPoints() {
        return POINTS_PER_PAIR * pairs.size();
    }

    public int runPoints() {
        return POINTS_PER_RUN_RANK * runs.stream().mapToInt(List::size).sum();
    }

    public int total() {
        return fifteenPoints() + pairPoints() + runPoints();
    }
}
