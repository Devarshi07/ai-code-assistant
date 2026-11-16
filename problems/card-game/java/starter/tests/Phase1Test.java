package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fifteens.Card;
import fifteens.CardException;
import fifteens.Deck;
import fifteens.DeckException;
import fifteens.Evaluate;
import fifteens.Match;
import fifteens.Score;
import fifteens.Scoring;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase1Test {
    static final List<String> PLAYERS = List.of("Ana", "Ben", "Cy");

    static List<String> names(List<Card> cards) {
        return cards.stream().map(Card::toString).toList();
    }

    /** Every card on the table in a round: all hands plus the turn-up. */
    static List<String> dealtCards(Match.RoundResult result) {
        List<String> cards = new ArrayList<>();
        for (List<Card> hand : result.hands().values()) cards.addAll(names(hand));
        cards.add(result.turnUp().toString());
        return cards;
    }

    @Nested
    class CardTests {
        @Test
        void parsesTensAndFaceCards() {
            Card ten = Card.parse("10H");
            assertEquals(List.of("10", "H", 10), List.of(ten.rank(), ten.suit(), ten.value()));
            assertEquals("QS", Card.parse("qs").toString());
            assertEquals("AC", Card.parse(" ac ").toString());
            assertEquals("10D", Card.parse("TD").toString());
        }

        @Test
        void countingValuesAndRankOrder() {
            List<Card> cards = Card.parseHand("AC 7D 10S JH QC KD");
            assertEquals(List.of(1, 7, 10, 10, 10, 10), cards.stream().map(Card::value).toList());
            assertEquals(List.of(1, 7, 10, 11, 12, 13), cards.stream().map(Card::order).toList());
        }

        @Test
        void rejectsUnknownCards() {
            for (String text : List.of("1H", "11S", "5X", "Z", "")) {
                assertThrows(CardException.class, () -> Card.parse(text), text);
            }
        }

        @Test
        void parseHandKeepsOrderAndAcceptsCommas() {
            assertEquals(List.of("5H", "5S", "JD", "QC"), names(Card.parseHand("5H, 5S JD,QC")));
        }
    }

    @Nested
    class ScoringTests {
        @Test
        void pairsScoreTwoPointsEach() {
            List<Card> cards = Card.parseHand("7H 7S 7D 2C");
            assertEquals(List.of(List.of("7H", "7S"), List.of("7H", "7D"), List.of("7S", "7D")),
                    Evaluate.findPairs(cards).stream().map(Phase1Test::names).toList());
            assertEquals(6, Scoring.scoreHand(cards).total());
        }

        @Test
        void runsScoreOnePointPerRank() {
            assertEquals(List.of(List.of("9", "10", "J", "Q", "K")), Evaluate.findRuns(Card.parseHand("9C 10D JH QS KD")));
            assertEquals(List.of(List.of("3", "4", "5")), Evaluate.findRuns(Card.parseHand("3C 4D 4H 5S 9C")));
            assertEquals(List.of(), Evaluate.findRuns(Card.parseHand("QC KD AH 2S")), "runs don't wrap from king to ace");
        }

        @Test
        void faceCardsMakeFifteenWithAFive() {
            Score score = Scoring.scoreHand(Card.parseHand("KH 5D"));
            assertEquals(List.of(List.of("KH", "5D")), score.fifteens().stream().map(Phase1Test::names).toList());
            assertEquals(2, score.total());
        }

        @Test
        void mixedHandBreakdown() {
            Score score = Scoring.scoreHand(Card.parseHand("QD 3S 4H 5C 5S"));
            assertEquals(List.of(4, 2, 3), List.of(score.fifteenPoints(), score.pairPoints(), score.runPoints()));
            assertEquals(9, score.total());
        }
    }

    @Nested
    class DeckTests {
        @Test
        void newDeckHoldsAll_52Cards() {
            Deck deck = new Deck(1);
            assertEquals(52, deck.size());
            List<String> cards = names(deck.deal(52));
            assertEquals(52, new HashSet<>(cards).size());
            assertEquals(List.of("AC", "2C", "3C"), cards.subList(0, 3), "an unshuffled deck is in fresh-deck order");
            assertThrows(DeckException.class, () -> deck.deal(1));
        }

        @Test
        void dealtCardsLeaveTheDeck() {
            Deck deck = new Deck(5);
            deck.shuffle();
            List<String> hand = names(deck.deal(5));
            assertEquals(47, deck.size());
            Set<String> rest = new HashSet<>(names(deck.peek()));
            assertTrue(hand.stream().noneMatch(rest::contains), "a dealt card is still in the deck");
        }

        @Test
        void resetBringsEveryCardBack() {
            Deck deck = new Deck(8);
            deck.shuffle();
            deck.deal(20);
            deck.reset();
            assertEquals(52, deck.size());
            assertEquals(52, new HashSet<>(names(deck.peek())).size());
        }

        @Test
        void seededShuffleMatchesTheReplayLog() {
            Deck deck = new Deck(42);
            deck.shuffle();
            assertEquals(List.of("5H", "9S", "9C", "JS", "3C", "2D"), names(deck.deal(6)));
        }

        @Test
        void sameSeedGivesTheSameDeal() {
            Deck first = new Deck(7);
            Deck second = new Deck(7);
            first.shuffle();
            second.shuffle();
            assertEquals(names(first.deal(5)), names(second.deal(5)));
        }
    }

    @Nested
    class MatchTests {
        @Test
        void roundDealsDistinctCards() {
            Match.RoundResult result = new Match(PLAYERS, 3).playRound();
            assertEquals(List.of(4, 4, 4), result.hands().values().stream().map(List::size).toList());
            assertEquals(13, new HashSet<>(dealtCards(result)).size(), "the same card was dealt twice in one round");
        }

        @Test
        void firstRoundsMatchTheReplayLog() {
            Match match = new Match(List.of("Ana", "Ben"), 4412);
            Match.RoundResult first = match.playRound();
            assertEquals(List.of("KH", "3C", "10C", "6S"), names(first.hands().get("Ana")));
            assertEquals(List.of("8C", "7C", "8D", "8H"), names(first.hands().get("Ben")));
            assertEquals("5D", first.turnUp().toString());
            Match.RoundResult second = match.playRound();
            assertEquals(List.of("4C", "2S", "7S", "JH"), names(second.hands().get("Ana")));
            assertEquals(List.of("6C", "AH", "JS", "9H"), names(second.hands().get("Ben")));
            assertEquals("4H", second.turnUp().toString());
        }

        @Test
        void longMatchUsesTheFullDeckEveryRound() {
            Match match = new Match(PLAYERS, 11);
            match.play(8);
            assertEquals(8, match.rounds().size());
            for (Match.RoundResult result : match.rounds()) {
                assertEquals(13, new HashSet<>(dealtCards(result)).size(), "round " + result.number() + " reused a card");
            }
            int scored = match.rounds().stream().flatMap(result -> result.scores().values().stream()).mapToInt(Score::total).sum();
            assertEquals(scored, match.totals().values().stream().mapToInt(Integer::intValue).sum());
        }

        @Test
        void replayingASeedReproducesTheMatch() {
            Match original = new Match(PLAYERS, 2024);
            original.play(3);
            Match replay = new Match(PLAYERS, 2024);
            replay.play(3);
            for (int i = 0; i < original.rounds().size(); i++) {
                Match.RoundResult before = original.rounds().get(i), after = replay.rounds().get(i);
                for (String name : PLAYERS) {
                    assertEquals(names(before.hands().get(name)), names(after.hands().get(name)), "round " + before.number() + ", " + name);
                }
                assertEquals(before.turnUp().toString(), after.turnUp().toString());
            }
            assertEquals(original.standings(), replay.standings());
        }
    }
}
