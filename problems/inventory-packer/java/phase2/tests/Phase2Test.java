package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static shipping.CartonType.LARGE;
import static shipping.CartonType.MEDIUM;
import static shipping.CartonType.SMALL;
import static shipping.Packer.packItems;
import static shipping.Packer.packOrder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import shipping.Carton;
import shipping.CartonType;
import shipping.Item;
import shipping.Order;
import shipping.OrderExport;
import shipping.PackingException;

class Phase2Test {
    private static final String TABLEWARE_EXPORT = """
            order_id,sku,description,weight_kg,qty,flags
            A1005,GLS-WIN-04,"Wine glasses, set of 4",1.12,3,fragile
            A1005,BRD-OAK-40,Oak serving board,1.9,2,
            A1005,DCN-GLS-01,Glass decanter,1.35,1,fragile
            A1005,NAP-LIN-06,"Linen napkins, set of 6",0.31,2,
            """;

    private static Item unit(String sku, int grams) {
        return unit(sku, grams, false, false);
    }

    private static Item fragile(String sku, int grams) {
        return unit(sku, grams, true, false);
    }

    private static Item hazmat(String sku, int grams) {
        return unit(sku, grams, false, true);
    }

    private static Item unit(String sku, int grams, boolean fragile, boolean hazmat) {
        return new Item(sku, "test unit " + sku, grams, fragile, hazmat);
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
            assertEquals(kind, carton.cartonType(), label + " is the wrong carton type");
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

    /** Exhaustive search: the fewest cartons ANY legal plan needs. Small inputs only. */
    private static int fewestCartons(List<Item> items, CartonType kind) {
        int[] best = {items.size()};
        place(items, kind, 0, new ArrayList<>(), best);
        return best[0];
    }

    private static void place(List<Item> items, CartonType kind, int index, List<List<Item>> groups, int[] best) {
        if (groups.size() >= best[0]) return;
        if (index == items.size()) {
            best[0] = groups.size();
            return;
        }
        Item item = items.get(index);
        for (int g = 0; g < groups.size(); g++) {
            List<Item> group = groups.get(g);
            if (fits(group, item, kind)) {
                group.add(item);
                place(items, kind, index + 1, groups, best);
                group.remove(group.size() - 1);
            }
        }
        groups.add(new ArrayList<>(List.of(item)));
        place(items, kind, index + 1, groups, best);
        groups.remove(groups.size() - 1);
    }

    private static boolean fits(List<Item> group, Item item, CartonType kind) {
        if (item.hazmat() || group.stream().anyMatch(Item::hazmat)) return false;
        boolean fragile = item.fragile() || group.stream().anyMatch(Item::fragile);
        int weight = item.weightG() + group.stream().mapToInt(Item::weightG).sum();
        return weight <= (fragile ? kind.fragileMaxWeightG() : kind.maxWeightG());
    }

    /** Park-Miller "minimal standard" generator, the same one every language version uses. */
    private static final class Lcg {
        private long state;

        Lcg(long seed) {
            state = seed;
        }

        int below(int n) {
            state = state * 48271 % 2147483647;
            return (int) (state % n);
        }
    }

    // Bench rule

    @Test
    void emptyOrderNeedsNoCartons() {
        assertEquals(List.of(), packItems(List.of(), MEDIUM));
    }

    @Test
    void lightOrderFitsOneCarton() {
        List<Item> items = List.of(unit("A", 1200), unit("B", 800), unit("C", 450));
        List<Carton> cartons = packItems(items, MEDIUM);
        assertEquals(List.of(List.of("A", "B", "C")), skus(cartons));
        assertValidPlan(items, cartons, MEDIUM);
    }

    @Test
    void heaviestUnitsArePackedFirst() {
        List<Item> items = List.of(unit("A", 1000), unit("B", 1000), unit("C", 1000), unit("D", 3000), unit("E", 3000), unit("F", 1000));
        List<Carton> cartons = packItems(items, MEDIUM);
        assertEquals(2, cartons.size(), "packing in arrival order would need 3 cartons");
        assertEquals(fewestCartons(items, MEDIUM), cartons.size());
        assertEquals(List.of(List.of("D", "A", "B"), List.of("E", "C", "F")), skus(cartons));
        assertValidPlan(items, cartons, MEDIUM);
    }

    @Test
    void aCartonMayBeFilledExactly() {
        assertEquals(List.of(List.of("A", "B")), skus(packItems(List.of(unit("A", 2500), unit("B", 2500)), MEDIUM)));
        assertEquals(List.of(List.of("X")), skus(packItems(List.of(unit("X", 5000)), MEDIUM)));
    }

    @Test
    void eachUnitGoesIntoTheEarliestCartonThatTakesIt() {
        List<Item> items = List.of(unit("A", 3000), unit("B", 2600), unit("C", 2100), unit("D", 1500), unit("E", 250));
        List<Carton> cartons = packItems(items, MEDIUM);
        assertEquals(List.of(List.of("A", "D", "E"), List.of("B", "C")), skus(cartons),
                "E fits both cartons; the bench uses the earliest one");
        assertValidPlan(items, cartons, MEDIUM);
    }

    @Test
    void benchRuleIsFollowedEvenWhen_aTighterPlanExists() {
        List<Item> items = List.of(unit("P", 2500), unit("Q", 2000), unit("R", 2000), unit("S", 1500), unit("T", 1000), unit("U", 1000));
        List<Carton> cartons = packItems(items, MEDIUM);
        assertEquals(2, fewestCartons(items, MEDIUM));
        assertEquals(List.of(List.of("P", "Q"), List.of("R", "S", "T"), List.of("U")), skus(cartons),
                "the bench follows its rule, so this order ships in 3 cartons");
    }

    @Test
    void equalWeightsKeepOrderLineOrder() {
        assertEquals(List.of(List.of("A", "B"), List.of("C")),
                skus(packItems(List.of(unit("A", 2000), unit("B", 2000), unit("C", 2000)), MEDIUM)));
        assertEquals(List.of(List.of("C", "B"), List.of("A")),
                skus(packItems(List.of(unit("C", 2000), unit("B", 2000), unit("A", 2000)), MEDIUM)));
    }

    // Packing rules

    @Test
    void fragileUnitLowersTheCartonLimit() {
        List<Item> items = List.of(fragile("VAS", 2000), unit("BK1", 1500), unit("BK2", 1500));
        List<Carton> cartons = packItems(items, MEDIUM);
        assertEquals(List.of(List.of("VAS", "BK1"), List.of("BK2")), skus(cartons), "a fragile carton takes at most 3,500 g");
        assertEquals(fewestCartons(items, MEDIUM), cartons.size());
        assertTrue(cartons.get(0).fragile());
        assertValidPlan(items, cartons, MEDIUM);
    }

    @Test
    void fragileUnitSkips_aCartonThatIsAlreadyTooHeavy() {
        List<Item> items = List.of(unit("A", 3000), fragile("G", 1000), unit("B", 1000));
        List<Carton> cartons = packItems(items, MEDIUM);
        assertEquals(List.of(List.of("A", "B"), List.of("G")), skus(cartons));
        assertValidPlan(items, cartons, MEDIUM);
    }

    @Test
    void hazmatShipsAlone() {
        List<Item> items = List.of(hazmat("BAT1", 300), unit("A", 400), unit("B", 500), hazmat("BAT2", 200));
        List<Carton> cartons = packItems(items, MEDIUM);
        assertEquals(List.of(List.of("B", "A"), List.of("BAT1"), List.of("BAT2")), skus(cartons));
        assertEquals(fewestCartons(items, MEDIUM), cartons.size());
        assertValidPlan(items, cartons, MEDIUM);
    }

    @Test
    void unitTooHeavyForTheCartonTypeIsRefused() {
        PackingException anvil = assertThrows(PackingException.class, () -> packItems(List.of(unit("A", 400), unit("ANV-01", 5200)), MEDIUM));
        assertTrue(anvil.getMessage().contains("ANV-01"), anvil.getMessage());
        PackingException mirror = assertThrows(PackingException.class, () -> packItems(List.of(fragile("MIR-01", 3600)), MEDIUM));
        assertTrue(mirror.getMessage().contains("MIR-01"), mirror.getMessage());
        assertEquals(1, packItems(List.of(fragile("MIR-02", 3500)), MEDIUM).size());
        assertThrows(PackingException.class, () -> packItems(List.of(hazmat("BAT", 2100)), SMALL));
    }

    @Test
    void callersListIsLeftAlone() {
        List<Item> items = new ArrayList<>(List.of(unit("A", 100), unit("B", 900), unit("C", 500)));
        packItems(items, MEDIUM);
        assertEquals(List.of("A", "B", "C"), items.stream().map(Item::sku).toList());
    }

    // Order packing

    @Test
    void wholeOrderFromTheExport() {
        Order order = OrderExport.load(TABLEWARE_EXPORT).get(0);
        List<Carton> cartons = packOrder(order, LARGE);
        assertEquals(List.of(
                List.of("BRD-OAK-40", "BRD-OAK-40", "DCN-GLS-01", "GLS-WIN-04", "NAP-LIN-06", "NAP-LIN-06"),
                List.of("GLS-WIN-04", "GLS-WIN-04")), skus(cartons));
        assertEquals(List.of(6890, 2240), cartons.stream().map(Carton::weightG).toList());
        assertValidPlan(order.units(), cartons, LARGE);
    }

    @Test
    void randomSmallOrdersAreValidAndRepeatable() {
        Lcg rng = new Lcg(42);
        List<CartonType> kinds = List.of(SMALL, MEDIUM, LARGE);
        for (int trial = 0; trial < 60; trial++) {
            CartonType kind = kinds.get(rng.below(3));
            List<Item> items = new ArrayList<>();
            int count = 1 + rng.below(8);
            for (int n = 0; n < count; n++) {
                boolean hazmat = rng.below(10) == 0;
                boolean fragile = !hazmat && rng.below(10) < 3;
                int top = fragile ? kind.fragileMaxWeightG() : kind.maxWeightG();
                items.add(unit("T" + trial + "-" + n, 100 * (1 + rng.below(top / 100)), fragile, hazmat));
            }
            List<Carton> cartons = packItems(items, kind);
            assertValidPlan(items, cartons, kind);
            assertTrue(cartons.size() >= fewestCartons(items, kind));
            assertEquals(skus(cartons), skus(packItems(items, kind)), "same order, same plan");
        }
    }
}
