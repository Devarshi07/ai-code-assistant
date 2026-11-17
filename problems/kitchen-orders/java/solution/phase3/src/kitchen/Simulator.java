package kitchen;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

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

    /** Orders waiting dishes under the house rules; the first dish is the one a free cook takes. */
    static int houseRank(Dish a, Dish b) {
        if (a.priority() != b.priority()) return a.priority() ? -1 : 1;
        if (a.arrival() != b.arrival()) return Integer.compare(a.arrival(), b.arrival());
        if (a.orderId() != b.orderId()) return Integer.compare(a.orderId(), b.orderId());
        return Integer.compare(a.position(), b.position());
    }

    /**
     * Run the service described by {@code orders} through the kitchen line.
     * {@code menu.get(name)} gives a dish's MenuItem, and {@code stations}
     * lists the Station objects of the line. Orders may be given in any order.
     *
     * <p>Stations never share cooks or dishes, so each one is simulated on its
     * own as a discrete-event loop (see {@link #runStation}). An order's ready
     * time is the latest finish over all of its dishes. O(D log D) for D dishes.
     */
    public static KitchenRun simulate(List<Order> orders, Menu menu, List<Station> stations) {
        Map<String, List<Dish>> tickets = new HashMap<>(); // every dish bound for each station
        for (Station station : stations) tickets.put(station.name(), new ArrayList<>());
        for (Order order : orders) {
            for (int position = 0; position < order.dishes().size(); position++) {
                String dish = order.dishes().get(position);
                MenuItem item = menu.get(dish);
                List<Dish> queue = tickets.get(item.station());
                if (queue == null) {
                    throw new IllegalStateException("\"" + dish + "\" needs station \"" + item.station() + "\", which is not on the line");
                }
                queue.add(new Dish(order.priority(), order.arrival(), order.id(), position, item.prep()));
            }
        }

        Map<Integer, Integer> ready = new HashMap<>();
        for (Station station : stations) {
            List<Dish> dishes = tickets.get(station.name());
            dishes.sort(Comparator.comparingInt(Dish::arrival));
            runStation(dishes, station.cooks(), ready);
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

    /**
     * Simulate one station. {@code dishes} is sorted by arrival; updates
     * {@code ready} in place.
     *
     * <p>waiting: heap of queued dishes in house-rule order.
     * stove: heap of finish minutes of the dishes being cooked.
     * The clock only visits minutes where something happens: the next arrival
     * when nothing is queued, or the next cook finishing when nobody is free.
     */
    private static void runStation(List<Dish> dishes, int cooks, Map<Integer, Integer> ready) {
        PriorityQueue<Dish> waiting = new PriorityQueue<>(Simulator::houseRank);
        PriorityQueue<Integer> stove = new PriorityQueue<>();
        int free = cooks;
        int clock = Integer.MIN_VALUE;
        int i = 0;
        while (i < dishes.size() || !waiting.isEmpty()) {
            if (waiting.isEmpty()) clock = Math.max(clock, dishes.get(i).arrival());
            else if (free == 0) clock = Math.max(clock, stove.peek());
            while (!stove.isEmpty() && stove.peek() <= clock) {
                stove.poll();
                free += 1;
            }
            while (i < dishes.size() && dishes.get(i).arrival() <= clock) waiting.add(dishes.get(i++));
            while (free > 0 && !waiting.isEmpty()) {
                Dish dish = waiting.poll();
                int done = clock + dish.prep();
                stove.add(done);
                free -= 1;
                ready.merge(dish.orderId(), done, Math::max);
            }
        }
    }
}
