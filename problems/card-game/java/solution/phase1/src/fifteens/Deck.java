package fifteens;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * A standard 52-card deck with reproducible shuffles: the cards not yet dealt, top of the deck
 * first.
 *
 * <p>Every match stores its seed. Support's replay tool rebuilds a disputed match from that seed,
 * so a given seed must always produce the same deals, on the server and in the JavaScript client
 * alike. That is why the deck uses its own small generator instead of {@code java.util.Random}.
 */
public class Deck {
    /** Fresh-deck order: clubs, diamonds, hearts, spades; ace to king in each suit. */
    static final List<Card> STANDARD_ORDER = freshOrder();

    private final int seed;
    private final SeededRandom rng;
    private List<Card> cards;

    public Deck() {
        this(0);
    }

    public Deck(int seed) {
        this.seed = seed;
        this.rng = new SeededRandom(seed);
        reset();
    }

    private static List<Card> freshOrder() {
        List<Card> order = new ArrayList<>(Card.SUITS.size() * Card.RANKS.size());
        for (String suit : Card.SUITS) {
            for (String rank : Card.RANKS) order.add(new Card(rank, suit));
        }
        return order;
    }

    public int seed() {
        return seed;
    }

    /** Gather all 52 cards back into the deck, in fresh-deck order. */
    public void reset() {
        cards = new ArrayList<>(STANDARD_ORDER);
    }

    /** Fisher-Yates shuffle of the cards currently in the deck. */
    public void shuffle() {
        for (int i = cards.size() - 1; i > 0; i--) {
            int j = rng.below(i + 1);
            Collections.swap(cards, i, j);
        }
    }

    /** Remove {@code count} cards from the top of the deck and return them. */
    public List<Card> deal(int count) {
        if (count > cards.size()) {
            throw new DeckException("cannot deal " + count + " card(s), only " + cards.size() + " left");
        }
        List<Card> top = cards.subList(0, count);
        List<Card> dealt = new ArrayList<>(top);
        top.clear();
        return dealt;
    }

    /** The cards still in the deck, top first (a copy). */
    public List<Card> peek() {
        return new ArrayList<>(cards);
    }

    public int size() {
        return cards.size();
    }

    @Override
    public String toString() {
        return "Deck(seed=" + seed + ", " + size() + " cards left)";
    }
}
