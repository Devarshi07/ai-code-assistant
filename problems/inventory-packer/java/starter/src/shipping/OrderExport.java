package shipping;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Loads orders from the WMS order export (CSV).
 *
 * <pre>
 *   order_id,sku,description,weight_kg,qty,flags
 *   A1001,MUG-STN-350,Stoneware mug 350 ml,0.38,2,fragile
 * </pre>
 *
 * <p>weight_kg is the weight of ONE unit. flags is empty or a '|'-separated list
 * drawn from: fragile, hazmat. Lines of one order need not be adjacent; orders
 * come back in the order they first appear in the export.
 */
public final class OrderExport {
    public static final List<String> COLUMNS = List.of("order_id", "sku", "description", "weight_kg", "qty", "flags");
    private static final List<String> FLAGS = List.of("fragile", "hazmat");
    private static final Pattern QUANTITY = Pattern.compile("\\d+");

    private OrderExport() {
    }

    public static List<Order> load(String text) {
        String[] lines = text.split("\\r?\\n", -1);
        List<String> header = splitCsvLine(lines[0]).stream().map(String::strip).toList();
        if (!String.join(",", header).equals(String.join(",", COLUMNS))) {
            throw new OrderFormatException("line 1: expected header " + String.join(",", COLUMNS));
        }
        Map<String, Order> orders = new LinkedHashMap<>();
        for (int index = 1; index < lines.length; index++) {
            int lineNo = index + 1;
            List<String> row = splitCsvLine(lines[index]);
            if (row.stream().allMatch(String::isBlank)) continue;
            if (row.size() != COLUMNS.size()) {
                throw new OrderFormatException("line " + lineNo + ": expected " + COLUMNS.size() + " fields, found " + row.size());
            }
            List<String> cells = row.stream().map(String::strip).toList();
            Item item;
            int quantity;
            try {
                Set<String> flags = parseFlags(cells.get(5));
                item = new Item(cells.get(1), cells.get(2), Units.parseWeightKg(cells.get(3)),
                        flags.contains("fragile"), flags.contains("hazmat"));
                quantity = parseQuantity(cells.get(4));
            } catch (IllegalArgumentException e) {
                throw new OrderFormatException("line " + lineNo + ": " + e.getMessage());
            }
            orders.computeIfAbsent(cells.get(0), Order::new).addLine(new OrderLine(item, quantity));
        }
        return new ArrayList<>(orders.values());
    }

    public static List<Order> read(Path file) throws IOException {
        return load(Files.readString(file, StandardCharsets.UTF_8));
    }

    /** Split one CSV line, honouring "quoted, fields" and "" escapes. */
    public static List<String> splitCsvLine(String line) {
        List<String> cells = new ArrayList<>();
        if (line.isEmpty()) return cells;
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (quoted) {
                if (ch == '"' && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else if (ch == '"') {
                    quoted = false;
                } else {
                    cell.append(ch);
                }
            } else if (ch == '"') {
                quoted = true;
            } else if (ch == ',') {
                cells.add(cell.toString());
                cell.setLength(0);
            } else {
                cell.append(ch);
            }
        }
        cells.add(cell.toString());
        return cells;
    }

    private static Set<String> parseFlags(String text) {
        Set<String> flags = new HashSet<>();
        for (String part : text.split("\\|")) {
            String name = part.strip().toLowerCase(Locale.ROOT);
            if (name.isEmpty()) continue;
            if (!FLAGS.contains(name)) throw new IllegalArgumentException("unknown flag '" + name + "'");
            flags.add(name);
        }
        return flags;
    }

    private static int parseQuantity(String text) {
        if (!QUANTITY.matcher(text).matches() || Integer.parseInt(text) < 1) {
            throw new IllegalArgumentException("quantity '" + text + "' must be a whole number, at least 1");
        }
        return Integer.parseInt(text);
    }
}
