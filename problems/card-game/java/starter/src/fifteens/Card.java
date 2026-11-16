package fifteens;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * A playing card, and the text notation used across the app.
 *
 * <p>Cards are written rank first, then suit: "AC" is the ace of clubs, "10H" the ten of hearts
 * and "QS" the queen of spades. "T" is accepted for ten because some older clients still send it.
 * Hands travel as space- or comma-separated strings such as "5H 5S JD QC".
 */
public record Card(String rank, String suit) {
    public static final List<String> RANKS = List.of("A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K");
    public static final List<String> SUITS = List.of("C", "D", "H", "S");
    private static final Map<String, String> SUIT_NAMES = Map.of("C", "clubs", "D", "diamonds", "H", "hearts", "S", "spades");

    /** Jacks, queens and kings are worth ten when counting fifteens. */
    public static final int FACE_VALUE = 10;

    /** Rank order used for runs and sorting: A=1, 2-10, J=11, Q=12, K=13. */
    public int order() {
        return RANKS.indexOf(rank) + 1;
    }

    /** Counting value for fifteens: A=1, number cards at face value, J/Q/K=10. */
    public int value() {
        return Math.min(order(), FACE_VALUE);
    }

    public String name() {
        return rank + " of " + SUIT_NAMES.get(suit);
    }

    /** The short form, such as "10H". */
    @Override
    public String toString() {
        return rank + suit;
    }

    /** Parse one card such as "10H", "qs" or "AC". */
    public static Card parse(String text) {
        String token = text.strip().toUpperCase(Locale.ROOT);
        int split = Math.max(token.length() - 1, 0);
        String rank = token.substring(0, split);
        String suit = token.substring(split);
        if (rank.equals("T")) rank = "10";
        if (!RANKS.contains(rank) || !SUITS.contains(suit)) throw new CardException("not a card: '" + text + "'");
        return new Card(rank, suit);
    }

    /**
     * Parse a hand written as "5H 5S JD" or "5H,5S,JD".
     * The order of the cards is kept: it is the order the player sees them in.
     */
    public static List<Card> parseHand(String text) {
        List<Card> cards = new ArrayList<>();
        for (String token : text.replace(',', ' ').split("\\s+")) {
            if (!token.isEmpty()) cards.add(parse(token));
        }
        return cards;
    }

    /** Cards in short form, separated by spaces. */
    public static String format(List<Card> cards) {
        return cards.stream().map(Card::toString).collect(Collectors.joining(" "));
    }
}
