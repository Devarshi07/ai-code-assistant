package kitchen;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * An order as the kitchen sees it.
 *
 * @param id       order number
 * @param arrival  minute the ticket was rung in (see {@link Clock})
 * @param dishes   one entry per portion, in ticket order
 * @param priority delivery-app order: cooks take these first
 * @param due      ready time promised to the guest, or null when none was promised
 */
public record Order(int id, int arrival, List<String> dishes, boolean priority, Integer due) {
    public Order {
        if (dishes == null || dishes.isEmpty()) throw new IllegalArgumentException("order " + id + " has no dishes");
    }

    public Order(int id, int arrival, List<String> dishes) {
        this(id, arrival, dishes, false, null);
    }

    /**
     * Host-stand estimate: arrival plus the slowest dish on the ticket. This
     * assumes every station is idle when the ticket comes in, so it is only
     * honest on a quiet afternoon. During a rush, dishes queue behind other
     * tickets; see {@link Simulator}.
     */
    public int quote(Menu menu) {
        int slowest = 0;
        for (String dish : dishes) slowest = Math.max(slowest, menu.get(dish).prep());
        return arrival + slowest;
    }

    /** The set of stations this ticket needs. */
    public Set<String> stations(Menu menu) {
        Set<String> stations = new LinkedHashSet<>();
        for (String dish : dishes) stations.add(menu.get(dish).station());
        return stations;
    }
}
