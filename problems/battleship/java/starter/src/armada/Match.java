package armada;

import java.util.IntSummaryStatistics;
import java.util.List;
import java.util.Locale;

/** Match runner: plays a bot against a hidden fleet and reports the outcome. */
public final class Match {
    private Match() {
    }

    /** Plays a match with the default budget of one shot per cell. */
    public static MatchReport play(Bot bot, Fleet fleet) {
        int size = fleet.ocean().size();
        return play(bot, fleet, size * size);
    }

    /**
     * Lets bot fire until the fleet is sunk or the shot budget is spent.
     *
     * <p>The bot only ever sees coordinates and ShotResults; it never gets the
     * fleet. The default budget is one shot per cell, which is enough for any
     * bot that never fires at the same cell twice.
     */
    public static MatchReport play(Bot bot, Fleet fleet, int budget) {
        Battle battle = new Battle(fleet);
        while (!battle.fleetSunk() && battle.shotsFired() < budget) {
            ShotResult result = battle.fire(bot.nextShot());
            bot.observe(battle.log().get(battle.log().size() - 1).coord(), result);
        }
        return new MatchReport(bot.getClass().getSimpleName(), battle.shotsFired(), battle.fleetSunk(), battle.repeats(), battle);
    }

    public static String runSeries(Bot.Factory factory, List<Integer> seeds) {
        return runSeries(factory, seeds, 10, Fleet.DEFAULT_FLEET);
    }

    /**
     * Benchmarks a bot over seeded fleets. Each match gets a fresh bot from
     * factory.create(size, shipSizes). Returns a one-line summary for dashboards and the CLI.
     */
    public static String runSeries(Bot.Factory factory, List<Integer> seeds, int size, List<Integer> shipSizes) {
        List<MatchReport> reports = seeds.stream()
                .map(seed -> play(factory.create(size, shipSizes), Placer.randomFleet(seed, size, shipSizes)))
                .toList();
        IntSummaryStatistics shots = reports.stream().mapToInt(MatchReport::shots).summaryStatistics();
        long wins = reports.stream().filter(MatchReport::won).count();
        return String.format(Locale.ROOT, "%s: %d/%d fleets sunk, %.1f shots on average (best %d, worst %d)",
                reports.get(0).bot(), wins, reports.size(), shots.getAverage(), shots.getMin(), shots.getMax());
    }
}
