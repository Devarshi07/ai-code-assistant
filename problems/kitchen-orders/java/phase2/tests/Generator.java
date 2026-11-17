package tests;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import kitchen.KitchenRun;
import kitchen.Menu;
import kitchen.MenuItem;
import kitchen.Order;
import kitchen.Station;

/**
 * Seeded service generator for the larger simulation tests.
 *
 * <p>It uses a Park-Miller LCG, so every language's suite builds exactly the
 * same services from the same seed.
 */
final class Generator {
    static final Menu STADIUM_MENU = new Menu(List.of(
            new MenuItem("smash burger", "grill", 6),
            new MenuItem("bratwurst", "grill", 4),
            new MenuItem("chicken wrap", "grill", 5),
            new MenuItem("fries", "fryer", 4),
            new MenuItem("wings", "fryer", 8),
            new MenuItem("tenders", "fryer", 6),
            new MenuItem("pretzel", "oven", 3),
            new MenuItem("pizza slice", "oven", 2),
            new MenuItem("caesar salad", "salad", 3),
            new MenuItem("fruit cup", "salad", 1)));

    static final List<String> DISHES = STADIUM_MENU.items().stream().map(MenuItem::name).toList();

    private Generator() {}

    static List<Station> stadiumLine(int grill, int fryer, int oven, int salad) {
        return List.of(new Station("grill", grill), new Station("fryer", fryer), new Station("oven", oven), new Station("salad", salad));
    }

    /** Park-Miller "minimal standard" generator; below(n) returns 0..n-1. */
    static final class Lcg {
        private static final long MOD = 2147483647L;
        private long state;

        Lcg(long seed) {
            state = seed % MOD != 0 ? seed % MOD : 1;
        }

        int below(int n) {
            state = (state * 48271) % MOD;
            return (int) (state % n);
        }
    }

    static List<Order> generate(long seed, int count, int opens, int minutes) {
        return generate(seed, count, opens, minutes, 20, 35);
    }

    /**
     * {@code count} orders rung in uniformly over {@code minutes} minutes from
     * minute {@code opens}. Ids are unique but unrelated to arrival, and the
     * list is not sorted.
     */
    static List<Order> generate(long seed, int count, int opens, int minutes, int appPercent, int duePercent) {
        Lcg random = new Lcg(seed);
        List<Order> orders = new ArrayList<>();
        for (int k = 0; k < count; k++) {
            int arrival = opens + random.below(minutes);
            int size = 1 + random.below(4);
            List<String> dishes = new ArrayList<>();
            for (int d = 0; d < size; d++) dishes.add(DISHES.get(random.below(DISHES.size())));
            boolean priority = random.below(100) < appPercent;
            boolean promised = random.below(100) < duePercent;
            int wait = 12 + random.below(30);
            Integer due = priority || promised ? arrival + wait : null;
            orders.add(new Order(1000 + k, arrival, dishes, priority, due));
        }
        return orders;
    }

    /**
     * Summary of a run that any correct simulation reproduces exactly: orders,
     * sum of ready minutes, sum of id times minute, last plate, late orders and
     * total minutes late.
     */
    static List<Long> fingerprint(KitchenRun run) {
        long total = 0;
        long weighted = 0;
        long last = Long.MIN_VALUE;
        for (Map.Entry<Integer, Integer> entry : run.ready().entrySet()) {
            long minute = entry.getValue();
            total += minute;
            weighted += entry.getKey() * minute;
            if (minute > last) last = minute;
        }
        long lateMinutes = run.late().stream().mapToLong(KitchenRun.Late::minutesLate).sum();
        return List.of((long) run.ready().size(), total, weighted, last, (long) run.late().size(), lateMinutes);
    }
}
