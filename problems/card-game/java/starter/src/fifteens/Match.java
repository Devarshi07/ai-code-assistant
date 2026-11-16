package fifteens;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Round and match runner used by the game server.
 *
 * <p>A match seats two to four players around one deck. Every round the dealer gathers and
 * shuffles all 52 cards, deals the hands one card at a time in seating order, then turns up one
 * more card. The turn-up counts as part of every player's hand when the round is scored.
 */
public class Match {
    public static final int MIN_PLAYERS = 2;
    public static final int MAX_PLAYERS = 4;
    public static final int DEFAULT_HAND_SIZE = 4;

    /**
     * One played round.
     *
     * @param number 1 for the first round of the match
     * @param turnUp the card turned up after the deal
     * @param hands  cards each player holds (turn-up not included), in seating order
     * @param scores each player's hand scored with the turn-up
     */
    public record RoundResult(int number, Card turnUp, Map<String, List<Card>> hands, Map<String, Score> scores) {}

    /** The cards of one round, before scoring. */
    public record Deal(Map<String, List<Card>> hands, Card turnUp) {}

    /** A player's total so far. */
    public record Standing(String name, int total) {}

    private final List<String> players;
    private final int seed;
    private final int handSize;
    private final Deck deck;
    private final Map<String, Integer> totals = new LinkedHashMap<>();
    private final List<RoundResult> rounds = new ArrayList<>();

    public Match(List<String> players, int seed) {
        this(players, seed, DEFAULT_HAND_SIZE);
    }

    public Match(List<String> players, int seed, int handSize) {
        if (players.size() < MIN_PLAYERS || players.size() > MAX_PLAYERS) {
            throw new MatchException("a match needs " + MIN_PLAYERS + " to " + MAX_PLAYERS + " players");
        }
        if (new HashSet<>(players).size() != players.size()) throw new MatchException("player names must be unique");
        if (handSize < 1 || players.size() * handSize + 1 > 52) {
            throw new MatchException("cannot deal " + handSize + " cards to " + players.size() + " players");
        }
        this.players = List.copyOf(players);
        this.seed = seed;
        this.handSize = handSize;
        this.deck = new Deck(seed);
        for (String name : this.players) totals.put(name, 0);
    }

    public List<String> players() {
        return players;
    }

    public int seed() {
        return seed;
    }

    public int handSize() {
        return handSize;
    }

    /** Each player's total so far, in seating order. */
    public Map<String, Integer> totals() {
        return Collections.unmodifiableMap(totals);
    }

    public List<RoundResult> rounds() {
        return Collections.unmodifiableList(rounds);
    }

    /** Shuffle the full deck and deal. */
    public Deal dealRound() {
        deck.reset();
        deck.shuffle();
        Map<String, List<Card>> hands = new LinkedHashMap<>();
        for (String name : players) hands.put(name, new ArrayList<>());
        for (int i = 0; i < handSize; i++) {
            for (String name : players) hands.get(name).addAll(deck.deal(1));
        }
        Card turnUp = deck.deal(1).get(0);
        return new Deal(hands, turnUp);
    }

    public RoundResult playRound() {
        Deal deal = dealRound();
        Map<String, Score> scores = new LinkedHashMap<>();
        for (String name : players) {
            List<Card> cards = new ArrayList<>(deal.hands().get(name));
            cards.add(deal.turnUp());
            Score score = Scoring.scoreHand(cards);
            scores.put(name, score);
            totals.merge(name, score.total(), Integer::sum);
        }
        RoundResult result = new RoundResult(rounds.size() + 1, deal.turnUp(), deal.hands(), scores);
        rounds.add(result);
        return result;
    }

    /** Play {@code count} more rounds and return the standings. */
    public List<Standing> play(int count) {
        for (int i = 0; i < count; i++) playRound();
        return standings();
    }

    /** Highest total first; ties keep seating order. */
    public List<Standing> standings() {
        List<Standing> standings = new ArrayList<>();
        for (String name : players) standings.add(new Standing(name, totals.get(name)));
        standings.sort(Comparator.comparingInt(Standing::total).reversed());
        return standings;
    }
}
