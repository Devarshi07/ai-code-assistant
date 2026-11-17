package kitchen;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser for the ticket printer log.
 *
 * <p>One ticket per line:
 *
 * <pre>
 *     11:58am order 106: caesar salad, 2x fries | app | due 12:20pm
 * </pre>
 *
 * <ul>
 *   <li>The stamp is when the ticket was rung in (see {@link Clock}).
 *   <li>Dishes are comma separated. "2x fries" means two portions of fries.
 *   <li>Optional flags follow a "|": "app" marks a delivery-app order, which
 *       the cooks take first, and "due &lt;time&gt;" is the ready time promised
 *       to the guest.
 * </ul>
 *
 * <p>Blank lines and lines starting with "#" are ignored.
 */
public final class Tickets {
    private static final Pattern TICKET = Pattern.compile("^(\\S+)\\s+order\\s+(\\d+)\\s*:\\s*(.*)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PORTIONS = Pattern.compile("^(\\d+)\\s*x\\s+(.+)$", Pattern.CASE_INSENSITIVE);

    private Tickets() {}

    /** "burger, 2x fries" gives ["burger", "fries", "fries"]. */
    public static List<String> parseDishes(String text) {
        List<String> dishes = new ArrayList<>();
        for (String raw : text.split(",", -1)) {
            String part = String.join(" ", raw.trim().split("\\s+")).toLowerCase(Locale.ROOT);
            if (part.isEmpty()) continue;
            Matcher match = PORTIONS.matcher(part);
            if (match.matches()) {
                for (int i = 0; i < Integer.parseInt(match.group(1)); i++) dishes.add(match.group(2));
            } else {
                dishes.add(part);
            }
        }
        return dishes;
    }

    /** Parse a single log line into an Order. */
    public static Order parseTicket(String line) {
        return parseTicket(line, 1);
    }

    public static Order parseTicket(String line, int lineNumber) {
        Matcher match = TICKET.matcher(line.trim());
        if (!match.matches()) {
            throw new TicketException(lineNumber, "expected \"<time> order <id>: <dishes>\", got \"" + line.trim() + "\"");
        }
        String[] parts = match.group(3).split("\\|", -1);
        int arrival;
        boolean priority = false;
        Integer due = null;
        try {
            arrival = Clock.parseClock(match.group(1));
            for (int i = 1; i < parts.length; i++) {
                String flag = parts[i].trim().toLowerCase(Locale.ROOT);
                if (flag.equals("app")) priority = true;
                else if (flag.startsWith("due ")) due = Clock.parseClock(flag.substring(4));
                else throw new TicketException(lineNumber, "unknown flag \"" + flag + "\"");
            }
        } catch (ClockException error) {
            throw new TicketException(lineNumber, error.getMessage());
        }
        List<String> dishes = parseDishes(parts[0]);
        if (dishes.isEmpty()) throw new TicketException(lineNumber, "ticket has no dishes");
        return new Order(Integer.parseInt(match.group(2)), arrival, dishes, priority, due);
    }

    /**
     * Parse a whole log into the ticket rail. The rail lists orders by arrival
     * time. Tickets rung in during the same minute keep their printer order.
     * Order ids must be unique.
     */
    public static List<Order> parseLog(String text) {
        List<Order> orders = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        String[] lines = text.split("\n", -1);
        for (int index = 0; index < lines.length; index++) {
            String line = lines[index];
            if (line.trim().isEmpty() || line.trim().startsWith("#")) continue;
            Order order = parseTicket(line, index + 1);
            if (!seen.add(order.id())) throw new TicketException(index + 1, "order " + order.id() + " appears twice");
            orders.add(order);
        }
        orders.sort((a, b) -> Integer.compare(a.arrival(), b.arrival())); // stable
        return orders;
    }
}
