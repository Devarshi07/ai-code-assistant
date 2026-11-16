package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static shipping.CartonType.MEDIUM;
import static shipping.Packer.packItems;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import shipping.Carton;
import shipping.CartonType;
import shipping.Item;

class Phase3Test {
    private static Item unit(String sku, int grams) {
        return new Item(sku, "test unit " + sku, grams, false, false);
    }

    private static Item fragile(String sku, int grams) {
        return new Item(sku, "test unit " + sku, grams, true, false);
    }

    private static Item hazmat(String sku, int grams) {
        return new Item(sku, "test unit " + sku, grams, false, true);
    }

    private static List<List<String>> skus(List<Carton> cartons) {
        return cartons.stream().map(carton -> carton.items().stream().map(Item::sku).toList()).toList();
    }

    private static Map<String, Long> tally(List<Item> items) {
        return items.stream().collect(Collectors.groupingBy(Item::sku, TreeMap::new, Collectors.counting()));
    }

    /** Every unit packed exactly once, cartons numbered in order, every packing rule respected. */
    private static void assertValidPlan(List<Item> items, List<Carton> cartons, CartonType kind) {
        List<Item> packed = cartons.stream().flatMap(carton -> carton.items().stream()).toList();
        assertEquals(tally(items), tally(packed), "every unit must be packed exactly once");
        for (int index = 0; index < cartons.size(); index++) {
            Carton carton = cartons.get(index);
            String label = "carton " + (index + 1);
            assertEquals(index + 1, carton.number(), label + " is numbered " + carton.number());
            assertFalse(carton.items().isEmpty(), label + " is empty");
            int weight = carton.items().stream().mapToInt(Item::weightG).sum();
            assertEquals(weight, carton.weightG(), label + ": weightG does not match its contents");
            assertTrue(weight <= kind.maxWeightG(), label + " is over the carton limit");
            if (carton.items().stream().anyMatch(Item::fragile)) {
                assertTrue(weight <= kind.fragileMaxWeightG(), label + " holds fragile goods and is over the padded limit");
            }
            if (carton.items().stream().anyMatch(Item::hazmat)) {
                assertEquals(1, carton.items().size(), label + ": a hazmat item must ship alone");
            }
        }
    }

    // Same plan

    @Test
    void benchRuleOn_aTightOrder() {
        List<Item> items = List.of(unit("P", 2500), unit("Q", 2000), unit("R", 2000), unit("S", 1500), unit("T", 1000), unit("U", 1000));
        assertEquals(List.of(List.of("P", "Q"), List.of("R", "S", "T"), List.of("U")), skus(packItems(items, MEDIUM)));
    }

    @Test
    void everyRuleOn_aMixedOrder() {
        List<Item> items = List.of(unit("DSK", 4000), fragile("MIR", 3200), fragile("LMP", 1200), unit("CAB", 900),
                hazmat("BAT", 800), fragile("VAS", 500), unit("PLG", 300));
        List<Carton> cartons = packItems(items, MEDIUM);
        assertEquals(List.of(List.of("DSK", "CAB"), List.of("MIR", "PLG"), List.of("LMP", "VAS"), List.of("BAT")), skus(cartons));
        assertValidPlan(items, cartons, MEDIUM);
    }

    @Test
    void equalWeightsKeepOrderLineOrder() {
        List<Item> items = List.of(unit("Y", 3200), unit("X", 3000), unit("B", 1900), unit("A", 1900));
        assertEquals(List.of(List.of("Y"), List.of("X", "B"), List.of("A")), skus(packItems(items, MEDIUM)));
    }

    @Test
    void restockOrderMatchesTheBenchPlan() {
        List<Item> items = Generator.wholesaleUnits(5, 2000);
        List<Carton> cartons = packItems(items, MEDIUM);
        assertValidPlan(items, cartons, MEDIUM);
        assertEquals(906, cartons.size());
        assertEquals(List.of(4879, 4868, 4839, 3175, 4960, 3488, 4989, 3350, 4969, 3335),
                IntStream.range(0, cartons.size()).filter(i -> i % 100 == 0).mapToObj(i -> cartons.get(i).weightG()).toList());
        assertEquals(205, cartons.stream().filter(Carton::fragile).count());
        assertEquals(60, cartons.stream().filter(Carton::hazmat).count());
        assertEquals(List.of(Collections.nCopies(8, "W0308"), Collections.nCopies(8, "W0011")),
                skus(cartons.subList(cartons.size() - 2, cartons.size())));
    }

    // Scale

    @Test
    void largeRestockOrderIsFast() {
        List<Item> items = Generator.wholesaleUnits(11, 60000);
        // Warm up on smaller orders first, so the timing measures the packer and not the JIT compiler.
        for (int round = 1; round <= 5; round++) packItems(Generator.wholesaleUnits(round, 4000), MEDIUM);
        long start = System.nanoTime();
        List<Carton> cartons = packItems(items, MEDIUM);
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;
        assertValidPlan(items, cartons, MEDIUM);
        assertEquals(33233, cartons.size());
        assertTrue(elapsedMs < 250, "took " + elapsedMs + "ms; a 60,000-unit order must plan in under 250ms");
    }
}
