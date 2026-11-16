package shipping;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Packing manifests (printed at the pack bench) and carrier labels. */
public final class Manifest {
    /** Units of one SKU in a carton. */
    public record Group(Item item, int quantity) {
    }

    private Manifest() {
    }

    /** The bench sheet: one block per carton, identical units grouped. */
    public static String format(String orderId, List<Carton> cartons) {
        int count = cartons.size();
        int total = cartons.stream().mapToInt(Carton::weightG).sum();
        List<String> lines = new ArrayList<>();
        lines.add("Order " + orderId + ": " + plural(count, "carton") + ", " + Units.formatGrams(total));
        for (Carton carton : cartons) {
            lines.add(heading(carton, count));
            for (Group group : groupUnits(carton.items())) {
                Item item = group.item();
                String description = item.description().length() > 30 ? item.description().substring(0, 30) : item.description();
                lines.add(String.format(Locale.ROOT, "    %3d x %-12s %-30s %9s", group.quantity(), item.sku(), description,
                        Units.formatGrams(item.weightG() * group.quantity())));
            }
        }
        return String.join("\n", lines);
    }

    /** Declared weight for each carton, as printed on the carrier label. */
    public static List<String> carrierLabels(String orderId, List<Carton> cartons) {
        int count = cartons.size();
        return cartons.stream()
                .map(carton -> orderId + "-" + carton.number() + "/" + count + " " + carton.cartonType().code() + " "
                        + Units.formatKg(carton.weightG()))
                .toList();
    }

    /** Units of the same SKU merged, in first-packed order. */
    public static List<Group> groupUnits(List<Item> items) {
        Map<String, Group> groups = new LinkedHashMap<>();
        for (Item item : items) {
            groups.merge(item.sku(), new Group(item, 1), (first, more) -> new Group(first.item(), first.quantity() + 1));
        }
        return new ArrayList<>(groups.values());
    }

    private static String heading(Carton carton, int count) {
        String marks = (carton.fragile() ? "  FRAGILE" : "") + (carton.hazmat() ? "  HAZMAT" : "");
        return String.format(Locale.ROOT, "  Carton %d/%d  %-10s %9s of %s%s", carton.number(), count,
                carton.cartonType().displayName(), Units.formatGrams(carton.weightG()), Units.formatGrams(carton.limitG()), marks);
    }

    private static String plural(int n, String word) {
        return n == 1 ? n + " " + word : n + " " + word + "s";
    }
}
