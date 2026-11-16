import fifteens.Card;
import fifteens.Deck;
import fifteens.Match;
import fifteens.Score;
import fifteens.Scoring;
import fifteens.Tournament;
import java.util.ArrayList;
import java.util.List;

/** Plays a seeded five-round match, then scores a few showcase hands. */
public class Main {
    private static final List<List<String>> SHOWCASE = List.of(
            List.of("5C 5D 5H JS", "5S"),
            List.of("AC 2D 3H 4S", "5C"),
            List.of("2H 3C 4D 6S", "KH"));

    public static void main(String[] args) {
        printMatch();
        printShowcase();
        printMarathon();
    }

    static void printMatch() {
        Match match = new Match(List.of("Ana", "Ben", "Cy"), 2024);
        System.out.println("Fifteens match, seed " + match.seed() + ": " + String.join(", ", match.players()));
        for (int i = 0; i < 5; i++) {
            Match.RoundResult result = match.playRound();
            System.out.println("\nRound " + result.number() + "   turn-up " + result.turnUp());
            result.hands().forEach((name, hand) ->
                    System.out.printf("  %-4s %-14s %s%n", name, Card.format(hand), Scoring.describeScore(result.scores().get(name))));
        }
        System.out.println("\nStandings");
        List<Match.Standing> standings = match.standings();
        for (int i = 0; i < standings.size(); i++) {
            System.out.printf("  %d. %-4s %3d%n", i + 1, standings.get(i).name(), standings.get(i).total());
        }
    }

    static void printShowcase() {
        System.out.println("\nShowcase hands");
        for (List<String> showcase : SHOWCASE) {
            String handText = showcase.get(0), turnUp = showcase.get(1);
            List<Card> cards = new ArrayList<>(Card.parseHand(handText));
            cards.addAll(Card.parseHand(turnUp));
            Score score = Scoring.scoreHand(cards);
            System.out.println("  " + handText + " | " + turnUp + "   " + Scoring.describeScore(score));
            if (!score.fifteens().isEmpty()) System.out.println("    fifteens: " + Scoring.describeFifteens(score));
        }
    }

    static void printMarathon() {
        System.out.println();
        List<Card> fullDeck = new Deck().deal(52);
        try {
            System.out.println(Tournament.formatMarathon(fullDeck, Tournament.marathonCounts(fullDeck)));
        } catch (UnsupportedOperationException e) {
            System.out.println("Marathon preview: " + e.getMessage());
        }
    }
}
