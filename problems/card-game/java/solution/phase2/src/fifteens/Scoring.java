package fifteens;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Scoring rules for Fifteens.
 *
 * <pre>
 *   fifteens   2 points for every combination of cards adding up to 15
 *   pairs      2 points for every two cards of the same rank
 *   runs       1 point per rank in each run of three or more consecutive ranks
 * </pre>
 *
 * <p>During a match a player's hand is scored together with the round's turn-up card, so a
 * four-card hand is scored as five cards. The point values live in {@link Score}.
 */
public final class Scoring {
    private Scoring() {}

    /** Score a hand (including the turn-up card, if there is one). */
    public static Score scoreHand(List<Card> cards) {
        return new Score(Evaluate.findCombinations(cards, Evaluate.FIFTEEN), Evaluate.findPairs(cards), Evaluate.findRuns(cards));
    }

    /** One-line summary for the table view, e.g. "8 pts: 15s x2, pair x1, run 3-4-5". */
    public static String describeScore(Score score) {
        List<String> parts = new ArrayList<>();
        if (!score.fifteens().isEmpty()) parts.add("15s x" + score.fifteens().size());
        if (!score.pairs().isEmpty()) parts.add("pair x" + score.pairs().size());
        for (List<String> run : score.runs()) parts.add("run " + String.join("-", run));
        return score.total() + " pts" + (parts.isEmpty() ? "" : ": " + String.join(", ", parts));
    }

    /** The fifteens spelled out, e.g. "5H+JD, 5H+QC". */
    public static String describeFifteens(Score score) {
        return score.fifteens().stream().map(combo -> Card.format(combo).replace(' ', '+')).collect(Collectors.joining(", "));
    }
}
