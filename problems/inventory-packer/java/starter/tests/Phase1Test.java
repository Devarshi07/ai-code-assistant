package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import shipping.Carton;
import shipping.CartonType;
import shipping.Item;
import shipping.Manifest;
import shipping.Order;
import shipping.OrderExport;
import shipping.OrderFormatException;
import shipping.OrderLine;
import shipping.Units;

class Phase1Test {
    private static final String BENCH_EXPORT = """
            order_id,sku,description,weight_kg,qty,flags
            B2001,TEA-BRK-80,Breakfast tea 80 bags,0.25,2,
            B2001,MUG-STN-350,Stoneware mug 350 ml,0.38,2,fragile
            B2002,BAT-LI-18,Lithium battery 18650,0.33,1,hazmat
            B2001,TWL-LIN-2,"Linen tea towels, set of 2",0.18,1,
            """;

    // Lines copied from orders the dispatch scale flagged this week.
    private static final String DISPATCH_EXPORT = """
            order_id,sku,description,weight_kg,qty,flags
            C3001,PAN-CI-26,Cast iron skillet 26 cm,2.03,1,
            C3001,TRV-CI-20,Cast iron trivet,1.015,3,
            C3001,TWL-LIN-2,"Linen tea towels, set of 2",0.18,2,
            C3002,KTL-ENM-15,Enamel kettle 1.5 l,1.005,1,
            C3002,APR-LIN-01,Linen apron,0.42,1,
            C3002,WRP-BEE-03,"Beeswax wraps, pack of 3",0.576,1,
            """;

    private static Map<String, Order> byId(List<Order> orders) {
        return orders.stream().collect(Collectors.toMap(Order::orderId, Function.identity()));
    }

    /** The code of the carton type chosen, or null when none is big enough. */
    private static String code(Optional<CartonType> kind) {
        return kind.map(CartonType::code).orElse(null);
    }

    private static void assertContains(String line, String expected) {
        assertContains(line, expected, null);
    }

    private static void assertContains(String line, String expected, String message) {
        assertTrue(line.contains(expected),
                () -> (message == null ? "" : message + ": ") + "expected \"" + line + "\" to contain \"" + expected + "\"");
    }

    // Weight readings

    @Test
    void simpleKilogramReadings() {
        String[] readings = {"2", "0.5", "0.25", "1.2", "0.035"};
        int[] grams = {2000, 500, 250, 1200, 35};
        for (int i = 0; i < readings.length; i++) {
            assertEquals(grams[i], Units.parseWeightKg(readings[i]), readings[i] + " kg");
        }
    }

    @Test
    void malformedReadingsAreRejected() {
        for (String text : List.of("", "abc", "-1", "1,5", "1.2kg")) {
            assertThrows(IllegalArgumentException.class, () -> Units.parseWeightKg(text), "\"" + text + "\"");
        }
    }

    @Test
    void weightFormatting() {
        assertEquals("5,435 g", Units.formatGrams(5435));
        assertEquals("800 g", Units.formatGrams(800));
        assertEquals("5.435 kg", Units.formatKg(5435));
        assertEquals("0.035 kg", Units.formatKg(35));
    }

    // Order export

    @Test
    void linesAreGroupedByOrder() {
        List<Order> orders = OrderExport.load(BENCH_EXPORT);
        assertEquals(List.of("B2001", "B2002"), orders.stream().map(Order::orderId).toList());
        Order first = orders.get(0);
        assertEquals(List.of("TEA-BRK-80", "MUG-STN-350", "TWL-LIN-2"), first.lines().stream().map(line -> line.item().sku()).toList());
        assertEquals(List.of(2, 2, 1), first.lines().stream().map(OrderLine::quantity).toList());
        assertEquals(5, first.unitCount());
        assertEquals("Linen tea towels, set of 2", first.lines().get(2).item().description());
    }

    @Test
    void flagsAreRead() {
        Map<String, Order> orders = byId(OrderExport.load(BENCH_EXPORT));
        Item tea = orders.get("B2001").lines().get(0).item();
        Item mug = orders.get("B2001").lines().get(1).item();
        Item battery = orders.get("B2002").lines().get(0).item();
        assertEquals(List.of(false, false), List.of(tea.fragile(), tea.hazmat()));
        assertEquals(List.of(true, false), List.of(mug.fragile(), mug.hazmat()));
        assertEquals(List.of(false, true), List.of(battery.fragile(), battery.hazmat()));
    }

    @Test
    void badLineIsReportedWithItsNumber() {
        String broken = BENCH_EXPORT.replace("0.33,1,hazmat", "0.33,1,explosive");
        OrderFormatException error = assertThrows(OrderFormatException.class, () -> OrderExport.load(broken));
        assertContains(error.getMessage(), "line 4");
    }

    @Test
    void unitWeightsMatchTheExport() {
        List<Integer> weights = OrderExport.load(DISPATCH_EXPORT).stream()
                .flatMap(order -> order.lines().stream())
                .map(line -> line.item().weightG())
                .toList();
        assertEquals(List.of(2030, 1015, 180, 1005, 420, 576), weights);
    }

    @Test
    void orderWeightMatchesTheDispatchScale() {
        Order order = byId(OrderExport.load(DISPATCH_EXPORT)).get("C3001");
        assertEquals(5435, order.totalWeightG(), "the dispatch scale weighed this order at 5,435 g");
    }

    // Carton choice

    @Test
    void smallestBoxThatHoldsTheWeight() {
        assertEquals("S", code(CartonType.smallestFor(1800)));
        assertEquals("S", code(CartonType.smallestFor(2000)), "a full Small box is still a Small box");
        assertEquals("M", code(CartonType.smallestFor(2001)));
        assertEquals("L", code(CartonType.smallestFor(9000)));
        assertEquals(Optional.empty(), CartonType.smallestFor(10001));
    }

    @Test
    void fragileOrdersUseThePaddedLimit() {
        assertEquals("S", code(CartonType.smallestFor(1500, true)));
        assertEquals("M", code(CartonType.smallestFor(1800, true)));
    }

    @Test
    void orderJustOverTheSmallBoxLimit() {
        Order order = byId(OrderExport.load(DISPATCH_EXPORT)).get("C3002");
        Optional<CartonType> kind = CartonType.smallestFor(order.totalWeightG(), order.hasFragile());
        assertEquals("M", code(kind), "the carrier weighed this order at 2,001 g: too heavy for a Small box");
    }

    // Manifest

    private static List<Carton> sampleCartons() {
        Item mug = new Item("MUG-STN-350", "Stoneware mug 350 ml", 380, true, false);
        Item tea = new Item("TEA-BRK-80", "Breakfast tea 80 bags", 250);
        Item battery = new Item("BAT-LI-18", "Lithium battery 18650", 330, false, true);
        Carton first = new Carton(CartonType.MEDIUM, 1);
        Carton second = new Carton(CartonType.MEDIUM, 2);
        for (Item item : List.of(mug, tea, mug)) first.add(item);
        second.add(battery);
        return List.of(first, second);
    }

    @Test
    void manifestGroupsUnitsPerCarton() {
        String[] lines = Manifest.format("B2001", sampleCartons()).split("\n", -1);
        assertContains(lines[0], "2 cartons");
        assertContains(lines[0], "1,340 g");
        assertContains(lines[1], "Carton 1/2");
        assertContains(lines[1], "1,010 g of 3,500 g", "a fragile carton shows the padded limit");
        assertContains(lines[1], "FRAGILE");
        assertContains(lines[2], "2 x MUG-STN-350");
        assertContains(lines[2], "760 g");
        assertContains(lines[3], "1 x TEA-BRK-80");
        assertContains(lines[4], "HAZMAT");
        assertEquals(6, lines.length);
    }

    @Test
    void carrierLabelsDeclareEachCarton() {
        assertEquals(List.of("B2001-1/2 M 1.010 kg", "B2001-2/2 M 0.330 kg"), Manifest.carrierLabels("B2001", sampleCartons()));
    }
}
