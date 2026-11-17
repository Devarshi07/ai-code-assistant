package kitchen;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Plain-text reports for the expo screen and the end-of-service email. */
public final class Report {
    private Report() {}

    /** Dishes cooked and cook-minutes spent at one station over a service. */
    public record Load(int dishes, int minutes) {}

    private static String format(String pattern, Object... args) {
        return String.format(Locale.ROOT, pattern, args);
    }

    private static String flagsOf(Order order) {
        List<String> flags = new ArrayList<>();
        if (order.priority()) flags.add("app");
        if (order.due() != null) flags.add("due " + Clock.formatClock(order.due()));
        return flags.isEmpty() ? "" : "  [" + String.join(", ", flags) + "]";
    }

    /** The ticket rail as the line sees it: one row per order with its quote. */
    public static List<String> rail(List<Order> orders, Menu menu) {
        List<String> rows = new ArrayList<>();
        for (Order order : orders) {
            rows.add(format("%5d  %7s  quote %-11s", order.id(), Clock.formatClock(order.arrival()),
                    Clock.formatClock(order.quote(menu))) + String.join(", ", order.dishes()) + flagsOf(order));
        }
        return rows;
    }

    /** Map of station to dishes and cook-minutes for the whole service. */
    public static Map<String, Load> stationLoad(List<Order> orders, Menu menu, List<Station> stations) {
        Map<String, Load> load = new LinkedHashMap<>();
        for (Station station : stations) load.put(station.name(), new Load(0, 0));
        for (Order order : orders) {
            for (String dish : order.dishes()) {
                MenuItem item = menu.get(dish);
                Load entry = load.getOrDefault(item.station(), new Load(0, 0));
                load.put(item.station(), new Load(entry.dishes() + 1, entry.minutes() + item.prep()));
            }
        }
        return load;
    }

    /** Share of each station's cook-minutes spent cooking, first ticket to last plate. */
    public static Map<String, Double> utilisation(List<Order> orders, Menu menu, List<Station> stations, Map<Integer, Integer> ready) {
        int lastPlate = ready.values().stream().max(Integer::compare).orElseThrow();
        int firstTicket = orders.stream().mapToInt(Order::arrival).min().orElseThrow();
        int span = Math.max(lastPlate - firstTicket, 1);
        Map<String, Load> load = stationLoad(orders, menu, stations);
        Map<String, Double> shares = new LinkedHashMap<>();
        for (Station station : stations) shares.put(station.name(), (double) load.get(station.name()).minutes() / (station.cooks() * span));
        return shares;
    }

    /** Per-order ready times and lateness, then how hard each station worked. */
    public static String serviceReport(String title, List<Order> orders, Menu menu, List<Station> stations, KitchenRun run) {
        Map<Integer, Integer> late = new LinkedHashMap<>();
        for (KitchenRun.Late entry : run.late()) late.put(entry.id(), entry.minutesLate());
        int first = orders.stream().mapToInt(Order::arrival).min().orElseThrow();
        int last = run.ready().values().stream().max(Integer::compare).orElseThrow();
        int dishes = orders.stream().mapToInt(o -> o.dishes().size()).sum();
        List<String> lines = new ArrayList<>();
        lines.add(format("%s: %d orders, %d dishes, first ticket %s, last plate %s",
                title, orders.size(), dishes, Clock.formatClock(first), Clock.formatClock(last)));
        lines.add("");
        lines.add("order  in       ready      wait  due      status");
        List<Order> byArrival = new ArrayList<>(orders);
        byArrival.sort(Comparator.comparingInt(Order::arrival).thenComparingInt(Order::id));
        for (Order order : byArrival) {
            int ready = run.ready().get(order.id());
            String due = order.due() != null ? Clock.formatClock(order.due()) : "";
            String status = "";
            if (late.containsKey(order.id())) status = "LATE " + Clock.formatDuration(late.get(order.id()));
            else if (order.due() != null) status = "on time";
            if (order.priority()) status = status.isEmpty() ? "app" : status + ", app";
            lines.add(format("%5d  %7s  %-9s%6s  %-7s  %s", order.id(), Clock.formatClock(order.arrival()),
                    Clock.formatClock(ready), Clock.formatDuration(ready - order.arrival()), due, status).stripTrailing());
        }

        long promised = orders.stream().filter(o -> o.due() != null).count();
        int longestId = -1;
        int longestWait = -1;
        for (Order order : orders) {
            int wait = run.ready().get(order.id()) - order.arrival();
            if (longestId < 0 || wait > longestWait || (wait == longestWait && order.id() < longestId)) {
                longestId = order.id();
                longestWait = wait;
            }
        }
        int lateMinutes = late.values().stream().mapToInt(Integer::intValue).sum();
        lines.add("");
        lines.add(format("%d of %d promised orders late (%s in total). Longest wait: %s (order %d).",
                late.size(), promised, Clock.formatDuration(lateMinutes), Clock.formatDuration(longestWait), longestId));
        lines.add("");
        lines.add("station  cooks  dishes  cooking   busy");
        Map<String, Load> load = stationLoad(orders, menu, stations);
        Map<String, Double> shares = utilisation(orders, menu, stations, run.ready());
        for (Station station : stations) {
            Load entry = load.get(station.name());
            String share = Math.round(shares.get(station.name()) * 100) + "%";
            lines.add(format("%-8s %5d  %6d  %7s  %5s", station.name(), station.cooks(), entry.dishes(),
                    Clock.formatDuration(entry.minutes()), share));
        }
        return String.join("\n", lines);
    }
}
