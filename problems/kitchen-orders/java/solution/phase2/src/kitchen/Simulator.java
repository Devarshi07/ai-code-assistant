package kitchen;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Kitchen simulation: when will each order really be ready?
 *
 * <p>The host-stand quote ({@link Order#quote}) assumes every station is idle.
 * On a busy service, dishes queue at their station behind other tickets, so
 * expo needs a simulation of the line.
 *
 * <p>House rules, as agreed with the head chef:
 *
 * <ol>
 *   <li>When an order arrives, each of its dishes joins the queue of its station.
 *   <li>A station has {@code cooks} identical cooks. A cook makes one dish at a
 *       time, start to finish, which takes the dish's prep minutes.
 *   <li>A free cook always takes the waiting dish that ranks first: delivery-app
 *       orders before everything else, then the earliest order arrival, then
 *       the lowest order id, then the dish's position on its ticket.
 *   <li>Everything that happens in a minute (cooks finishing, orders arriving)
 *       counts before free cooks pick their next dish in that minute. A cook
 *       who finishes at 12:10pm can start another dish at 12:10pm.
 *   <li>An order is ready when its last dish is finished.
 * </ol>
 */
public final class Simulator {
    private Simulator() {}

    /** A dish waiting at a station. */
    record Dish(boolean priority, int arrival, int orderId, int position, int prep) {}

    /** True when waiting dish {@code a} ranks ahead of {@code b} under the house rules. */
    static boolean ranksAhead(Dish a, Dish b) {
        if (a.priority() != b.priority()) return a.priority();
        if (a.arrival() != b.arrival()) return a.arrival() < b.arrival();
        if (a.orderId() != b.orderId()) return a.orderId() < b.orderId();
        return a.position() < b.position();
    }

    /**
     * Run the service described by {@code orders} through the kitchen line.
     * {@code menu.get(name)} gives a dish's MenuItem, and {@code stations}
     * lists the Station objects of the line. Orders may be given in any order.
     *
     * <p>The clock advances one minute at a time. Each minute, newly arrived
     * dishes join their station's queue, cooks whose dish is done are
     * released, and every free cook takes the best-ranked waiting dish.
     */
    public static KitchenRun simulate(List<Order> orders, Menu menu, List<Station> stations) {
        Map<Integer, List<Order>> arrivals = new HashMap<>(); // minute -> orders rung in then
        int clock = Integer.MAX_VALUE;
        int left = 0;
        for (Order order : orders) {
            arrivals.computeIfAbsent(order.arrival(), minute -> new ArrayList<>()).add(order);
            clock = Math.min(clock, order.arrival());
            left += order.dishes().size();
        }
        Map<String, List<Dish>> waiting = new HashMap<>(); // queued dishes per station
        Map<String, List<Integer>> stoves = new HashMap<>(); // finish minute of each dish cooking
        for (Station station : stations) {
            waiting.put(station.name(), new ArrayList<>());
            stoves.put(station.name(), new ArrayList<>());
        }
        Map<Integer, Integer> ready = new HashMap<>();

        while (left > 0) {
            for (Order order : arrivals.getOrDefault(clock, List.of())) {
                for (int position = 0; position < order.dishes().size(); position++) {
                    String dish = order.dishes().get(position);
                    MenuItem item = menu.get(dish);
                    List<Dish> queue = waiting.get(item.station());
                    if (queue == null) {
                        throw new IllegalStateException("\"" + dish + "\" needs station \"" + item.station() + "\", which is not on the line");
                    }
                    queue.add(new Dish(order.priority(), order.arrival(), order.id(), position, item.prep()));
                }
            }
            for (Station station : stations) {
                List<Dish> queue = waiting.get(station.name());
                final int now = clock;
                List<Integer> stove = stoves.get(station.name());
                stove.removeIf(done -> done <= now);
                while (!queue.isEmpty() && stove.size() < station.cooks()) {
                    int best = 0;
                    for (int i = 1; i < queue.size(); i++) if (ranksAhead(queue.get(i), queue.get(best))) best = i;
                    Dish dish = queue.remove(best);
                    int done = clock + dish.prep();
                    stove.add(done);
                    ready.merge(dish.orderId(), done, Math::max);
                    left -= 1;
                }
            }
            clock += 1;
        }

        List<KitchenRun.Late> late = new ArrayList<>();
        for (Order order : orders) {
            if (order.due() != null && ready.get(order.id()) > order.due()) {
                late.add(new KitchenRun.Late(order.id(), ready.get(order.id()) - order.due()));
            }
        }
        late.sort(Comparator.comparingInt(KitchenRun.Late::id));
        return new KitchenRun(ready, late);
    }
}
