package kitchen;

import java.util.List;

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

    /**
     * Run the service described by {@code orders} through the kitchen line.
     * {@code menu.get(name)} gives a dish's MenuItem, and {@code stations}
     * lists the Station objects of the line. Orders may be given in any order.
     */
    public static KitchenRun simulate(List<Order> orders, Menu menu, List<Station> stations) {
        throw new UnsupportedOperationException("Phase 2: simulate");
    }
}
