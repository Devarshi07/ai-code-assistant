package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fifteens.Card;
import fifteens.Evaluate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;

class Phase3Test {
    // Every expected count in this file was checked two independent ways:
    // enumerating all subsets (for the hands of up to 18 cards) and summing
    // binomial coefficients over how many cards of each value are used.

    static final List<Card> FULL_DECK = fullDeck();
    static final List<Card> MARATHON_40 = Card.parseHand(
            "2D 2H 9D KH 10C 8S JH 4C 3H 9H 6D 2S KD 10S 3C 7D 6C QH 7C 9C "
            + "QS 4D 10D 2C 4S 5C 6S JD 10H 4H 3S KS KC AC AS JS 5S 3D 5D 7H");
    static final List<Card> MARATHON_30 = Card.parseHand(
            "3D QH 4C KC KH JD 2D 10S 6H 3H QS 9C 9H JC 6S JH 4S 8S 3S 3C "
            + "AS 5S QC 2C 2H 8C 5D JS QD 5H");

    record MediumHand(String text, Map<Integer, Long> expected) {}

    static final List<MediumHand> MEDIUM_HANDS = List.of(
            new MediumHand("7D 3S 8H 5S 9D KC AC 9H 7C 10H AD 3D", Map.of(15, 25L, 21, 64L, 31, 119L, 40, 124L)),
            new MediumHand("KH 4H KD KS 10S 9D 6D QD JD 10C 6H QH 5D 5S", Map.of(15, 22L, 21, 35L, 31, 137L, 40, 422L)),
            new MediumHand("JS JD KD 8S QD KH AC 8D 4H 5H QS 2H JC 10S 7S 9S", Map.of(15, 25L, 21, 79L, 31, 291L, 40, 723L)),
            new MediumHand("6C 5S 9S KS 3H 6D 8C 8H JS 10C KD 9D AH QH 2H KC 5C 8S", Map.of(15, 47L, 21, 175L, 31, 773L, 40, 2078L)),
            // A practice-mode hand with repeated cards: every position counts.
            new MediumHand("5H 5H 10S 5H JD AC AC 4S 6D 6D 9C 5H KS 2C", Map.of(15, 64L, 21, 199L, 31, 453L, 40, 459L)));

    /** One call at the table: a hand, the target called and the count the scoreboard must show. */
    record Call(List<Card> cards, int target, long expected) {}

    // One tournament round: the targets called at the table, in order.
    static final List<Call> MARATHON_ROUND = List.of(
            new Call(FULL_DECK, 15, 17_264L),
            new Call(FULL_DECK, 25, 746_736L),
            new Call(FULL_DECK, 31, 5_011_024L),
            new Call(FULL_DECK, 100, 1_864_192_096_504L),
            new Call(FULL_DECK, 170, 68_141_176_483_932L),
            new Call(FULL_DECK, 200, 35_865_475_414_775L),
            new Call(MARATHON_40, 77, 1_471_665_517L),
            new Call(MARATHON_30, 120, 12_473_861L));
    static final double ROUND_BUDGET_MS = 25; // for the whole round

    // The medium hands at target 31, played as an untimed practice round first.
    static final List<Call> PRACTICE_ROUND = MEDIUM_HANDS.stream()
            .map(medium -> new Call(Card.parseHand(medium.text()), 31, medium.expected().get(31)))
            .toList();

    static List<Card> fullDeck() {
        List<String> names = new ArrayList<>();
        for (String suit : Card.SUITS) {
            for (String rank : Card.RANKS) names.add(rank + suit);
        }
        return Card.parseHand(String.join(" ", names));
    }

    @Test
    void countMatchesTheListingOnNormalHands() {
        for (String text : List.of("JH 5D 5S QC", "7C 2D 6H 8S AD 5C", "4H 6C 5D 5S JC AH 9D 3S")) {
            List<Card> cards = Card.parseHand(text);
            assertEquals(Evaluate.findCombinations(cards).size(), Evaluate.countCombinations(cards), text);
        }
        assertEquals(3, Evaluate.countCombinations(Card.parseHand("KD 4C 6H 10S"), 10));
    }

    @Test
    void mediumHandsMatchBruteForce() {
        for (MediumHand medium : MEDIUM_HANDS) {
            List<Card> cards = Card.parseHand(medium.text());
            new TreeMap<>(medium.expected()).forEach((target, count) ->
                    assertEquals(count, Evaluate.countCombinations(cards, target), medium.text() + ", target " + target));
        }
    }

    @Test
    void edgeCases() {
        List<Card> fives = Card.parseHand("5H 5H 5H 5H");
        assertEquals(List.of(4L, 6L, 4L, 1L, 0L), List.of(5, 10, 15, 20, 25).stream().map(t -> Evaluate.countCombinations(fives, t)).toList());
        assertEquals(0, Evaluate.countCombinations(List.of(), 15));
        assertEquals(1, Evaluate.countCombinations(Card.parseHand("KH"), 10));
        assertEquals(0, Evaluate.countCombinations(Card.parseHand("5H 10S"), 0), "the empty combination never counts");
        assertEquals(0, Evaluate.countCombinations(Card.parseHand("5H 10S"), -4));
    }

    @Test
    void marathonRoundIsFastAndExact() {
        // Warm up with untimed practice rounds first, so the timed round below
        // measures the algorithm rather than the JIT compiler.
        for (int i = 0; i < 20; i++) playRound(PRACTICE_ROUND, Double.POSITIVE_INFINITY);
        playRound(MARATHON_ROUND, ROUND_BUDGET_MS);
    }

    /** Makes each call in order and checks the count, and the time so far against the budget. */
    static void playRound(List<Call> round, double budgetMs) {
        long start = System.nanoTime();
        for (Call call : round) {
            long count = Evaluate.countCombinations(call.cards(), call.target());
            double elapsed = (System.nanoTime() - start) / 1e6;
            // Checked after every call, so a slow solution fails quickly instead of
            // running for hours on the bigger targets.
            assertTrue(elapsed < budgetMs, () -> String.format(Locale.ROOT,
                    "took %.0fms to get through target %d (%d cards); the whole marathon round must finish in under %.0fms",
                    elapsed, call.target(), call.cards().size(), budgetMs));
            assertEquals(call.expected(), count, () -> call.cards().size() + "-card hand, target " + call.target());
        }
    }
}
