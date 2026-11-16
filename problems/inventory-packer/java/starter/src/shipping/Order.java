package shipping;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** A customer order: its lines, in the order the export listed them. */
public final class Order {
    private final String orderId;
    private final List<OrderLine> lines = new ArrayList<>();

    public Order(String orderId) {
        this.orderId = orderId;
    }

    public String orderId() {
        return orderId;
    }

    public List<OrderLine> lines() {
        return Collections.unmodifiableList(lines);
    }

    public void addLine(OrderLine line) {
        lines.add(line);
    }

    /** One entry per physical unit to pack, in order-line order. */
    public List<Item> units() {
        List<Item> units = new ArrayList<>();
        for (OrderLine line : lines) {
            for (int i = 0; i < line.quantity(); i++) units.add(line.item());
        }
        return units;
    }

    public int unitCount() {
        return lines.stream().mapToInt(OrderLine::quantity).sum();
    }

    public int totalWeightG() {
        return lines.stream().mapToInt(OrderLine::weightG).sum();
    }

    public boolean hasFragile() {
        return lines.stream().anyMatch(line -> line.item().fragile());
    }

    public boolean hasHazmat() {
        return lines.stream().anyMatch(line -> line.item().hazmat());
    }
}
