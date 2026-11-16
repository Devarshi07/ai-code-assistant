import armada.Fleet;
import armada.Match;
import armada.MatchReport;
import armada.Placer;
import armada.ScriptedBot;
import armada.SeekerBot;
import armada.Ship;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/** Demo: a seeded fleet, a replayed bug report, and the reference bot. */
public class Main {
    private static final int SEED = 7;

    // QA ticket #212: shots recorded from an experimental bot that got stuck
    // re-firing at the same squares. It was replayed against the seed-7 fleet.
    private static final List<String> STUCK_BOT_SHOTS = List.of("C5", "A3", "A3", "A3", "A3", "A3", "F7", "F7", "F7", "F7",
            "D4", "D4", "D4", "G5", "G5", "G5", "F3", "F3");

    public static void main(String[] args) {
        Fleet fleet = Placer.randomFleet(SEED);
        System.out.println("Hidden fleet for seed " + SEED + " (10x10):");
        System.out.println(fleet.render());
        List<Ship> ships = fleet.ships();
        for (int i = 0; i < ships.size(); i++) {
            Ship ship = ships.get(i);
            System.out.printf("  %c  %-10s %d cells from %s%n", 'A' + i, ship.name(), ship.size(), ship.cells().get(0));
        }
        System.out.println();

        MatchReport replay = Match.play(ScriptedBot.fromLabels(10, STUCK_BOT_SHOTS), Placer.randomFleet(SEED), STUCK_BOT_SHOTS.size());
        System.out.println("Replay of ticket #212: " + replay.summary());
        System.out.println("  results: " + replay.battle().log().stream().map(record -> record.result().name()).collect(Collectors.joining(" ")));
        System.out.println();

        MatchReport report;
        try {
            report = Match.play(new SeekerBot(10, Fleet.DEFAULT_FLEET), Placer.randomFleet(SEED));
        } catch (UnsupportedOperationException error) {
            System.out.println("SeekerBot: " + error.getMessage());
            return;
        }
        System.out.println(report.summary());
        System.out.println(report.battle().chart());
        System.out.println();
        System.out.println("Benchmark over seeds 1-50:");
        List<Integer> seeds = IntStream.rangeClosed(1, 50).boxed().toList();
        System.out.println("  " + Match.runSeries(SeekerBot::new, seeds));
    }
}
