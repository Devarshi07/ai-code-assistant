package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fifteens.Card;
import fifteens.Evaluate;
import fifteens.Match;
import fifteens.Score;
import fifteens.Scoring;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase2Test {
    static final List<String> PLAYERS = List.of("Ana", "Ben", "Cy");

    static List<String> names(List<Card> cards) {
        return cards.stream().map(Card::toString).toList();
    }

    static List<List<String>> listed(List<List<Card>> combos) {
        return combos.stream().map(Phase2Test::names).toList();
    }

    static List<Card> hand(String text) {
        return Card.parseHand(text);
    }

    /**
     * Checks every listed combination without trusting the code under test.
     *
     * <p>Each combination must use cards from the hand, in hand order, and add up to the target.
     * The list must have no repeats and must be sorted by card positions in dictionary order.
     * (Needs a hand without repeated cards.)
     */
    static void assertValidCombinations(List<Card> cards, int target, List<List<Card>> combos) {
        Map<String, Integer> position = new HashMap<>();
        for (int i = 0; i < cards.size(); i++) position.put(cards.get(i).toString(), i);
        assertEquals(cards.size(), position.size(), "checker needs a hand without repeated cards");
        List<List<Integer>> seen = new ArrayList<>();
        for (List<Card> combo : combos) {
            assertFalse(combo.isEmpty(), "a combination must hold at least one card");
            for (Card card : combo) assertTrue(position.containsKey(card.toString()), card + " is not in the hand");
            List<Integer> index = combo.stream().map(card -> position.get(card.toString())).toList();
            assertTrue(IntStream.range(1, index.size()).allMatch(i -> index.get(i) > index.get(i - 1)), names(combo) + " is not in hand order");
            assertEquals(target, combo.stream().mapToInt(Card::value).sum(), names(combo) + " doesn't add up to " + target);
            seen.add(index);
        }
        assertEquals(seen.size(), new HashSet<>(seen).size(), "a combination is listed twice");
        List<List<Integer>> sorted = new ArrayList<>(seen);
        sorted.sort(Phase2Test::dictionary);
        assertEquals(sorted, seen, "combinations are not in dictionary order of positions");
    }

    static int dictionary(List<Integer> a, List<Integer> b) {
        for (int i = 0; i < Math.min(a.size(), b.size()); i++) {
            if (!a.get(i).equals(b.get(i))) return Integer.compare(a.get(i), b.get(i));
        }
        return Integer.compare(a.size(), b.size());
    }

    @Nested
    class FindCombinationsTests {
        @Test
        void twoCardFifteen() {
            assertEquals(List.of(List.of("5H", "10S")), listed(Evaluate.findCombinations(hand("5H 10S"))));
        }

        @Test
        void fiveCardFifteen() {
            assertEquals(List.of(List.of("AC", "2D", "3H", "4S", "5C")), listed(Evaluate.findCombinations(hand("AC 2D 3H 4S 5C"))));
        }

        @Test
        void twoFivesCountSeparately() {
            List<List<Card>> combos = Evaluate.findCombinations(hand("JH 5D 5S QC"));
            assertEquals(List.of(List.of("JH", "5D"), List.of("JH", "5S"), List.of("5D", "QC"), List.of("5S", "QC")), listed(combos));
        }

        @Test
        void combinationsAreListedInPositionOrder() {
            assertEquals(List.of(
                    List.of("7C", "2D", "6H"),
                    List.of("7C", "2D", "AD", "5C"),
                    List.of("7C", "8S"),
                    List.of("2D", "8S", "5C"),
                    List.of("6H", "8S", "AD")), listed(Evaluate.findCombinations(hand("7C 2D 6H 8S AD 5C"))));
        }

        @Test
        void mixedSizesWithRepeatedRanks() {
            assertEquals(List.of(
                    List.of("9S", "6D"),
                    List.of("9S", "3C", "3H"),
                    List.of("9S", "3C", "AS", "2D"),
                    List.of("9S", "3H", "AS", "2D"),
                    List.of("6D", "3C", "3H", "AS", "2D")), listed(Evaluate.findCombinations(hand("9S 6D 3C 3H AS 2D"))));
        }

        @Test
        void aCardTypedTwiceCountsTwice() {
            assertEquals(List.of(List.of("8C", "7H"), List.of("7H", "8C")), listed(Evaluate.findCombinations(hand("8C 7H 8C"))));
        }

        @Test
        void otherTargets() {
            assertEquals(List.of(List.of("KD"), List.of("4C", "6H"), List.of("10S")), listed(Evaluate.findCombinations(hand("KD 4C 6H 10S"), 10)));
            assertEquals(List.of(List.of("3S", "3D", "9C", "6H")), listed(Evaluate.findCombinations(hand("3S 3D 9C 6H"), 21)));
        }

        @Test
        void nothingAddsUp() {
            assertEquals(List.of(), Evaluate.findCombinations(hand("KC QD JH")));
            assertEquals(List.of(), Evaluate.findCombinations(List.of()));
            assertEquals(List.of(), Evaluate.findCombinations(hand("5H 10S"), 0), "only non-empty combinations count");
            assertEquals(List.of(), Evaluate.findCombinations(hand("5H 10S"), -5));
        }

        @Test
        void eightCardHand() {
            List<Card> cards = hand("4H 6C 5D 5S JC AH 9D 3S");
            List<List<Card>> combos = Evaluate.findCombinations(cards);
            assertEquals(11, combos.size());
            assertValidCombinations(cards, 15, combos);
        }

        @Test
        void sixteenCardPracticeHand() {
            List<Card> cards = hand("5C 2C QS 6S 7H AC 3S 3H QC AD JC 7D QD 6H 2S AH");
            List<List<Card>> combos = Evaluate.findCombinations(cards);
            assertEquals(205, combos.size());
            assertValidCombinations(cards, 15, combos);
        }

        @Test
        void returnsTheHandCards() {
            List<Card> cards = hand("6C 4D 5H 9S AC");
            List<List<Card>> combos = Evaluate.findCombinations(cards);
            assertEquals(List.of(List.of("6C", "4D", "5H"), List.of("6C", "9S"), List.of("5H", "9S", "AC")), listed(combos));
            assertEquals(List.of(cards.get(0), cards.get(3)), combos.get(1));
        }
    }

    @Nested
    class ScoreHandTests {
        @Test
        void famousTwentyEightHand() {
            Score score = Scoring.scoreHand(hand("5C 5D 5H JS 5S"));
            assertEquals(List.of(8, 6, List.of()), List.of(score.fifteens().size(), score.pairs().size(), score.runs()));
            assertEquals(28, score.total());
        }

        @Test
        void fifteensOfEverySizeScore() {
            Score score = Scoring.scoreHand(hand("2H 3C 4D 6S KH"));
            assertEquals(List.of(List.of("2H", "3C", "4D", "6S"), List.of("2H", "3C", "KH")), listed(score.fifteens()));
            assertEquals(7, score.total());
            assertEquals(7, Scoring.scoreHand(hand("AC 2D 3H 4S 5C")).total());
        }

        @Test
        void eightCardHandTotal() {
            Score score = Scoring.scoreHand(hand("4H 6C 5D 5S JC AH 9D 3S"));
            assertEquals(List.of(22, 2, 4), List.of(score.fifteenPoints(), score.pairPoints(), score.runPoints()));
            assertEquals(28, score.total());
        }

        @Test
        void seededMatchStandings() {
            Match match = new Match(PLAYERS, 2024);
            assertEquals(List.of(
                    new Match.Standing("Cy", 31),
                    new Match.Standing("Ana", 24),
                    new Match.Standing("Ben", 22)), match.play(5));
            Match.RoundResult last = match.rounds().get(match.rounds().size() - 1);
            List<String> cyCards = new ArrayList<>(names(last.hands().get("Cy")));
            cyCards.add(last.turnUp().toString());
            assertEquals(List.of("3C", "AS", "2S", "5D", "4S"), cyCards);
            assertEquals(7, last.scores().get("Cy").total(), "A-2-3-4-5 is a five-card fifteen plus a run of five");
        }
    }
}
