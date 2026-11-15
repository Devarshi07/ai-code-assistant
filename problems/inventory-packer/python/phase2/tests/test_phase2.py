import random
import unittest
from collections import Counter

from shipping import CARTON_TYPES, Item, PackingError, load_orders, pack_items, pack_order

SMALL, MEDIUM, LARGE = CARTON_TYPES["S"], CARTON_TYPES["M"], CARTON_TYPES["L"]

TABLEWARE_EXPORT = """order_id,sku,description,weight_kg,qty,flags
A1005,GLS-WIN-04,"Wine glasses, set of 4",1.12,3,fragile
A1005,BRD-OAK-40,Oak serving board,1.9,2,
A1005,DCN-GLS-01,Glass decanter,1.35,1,fragile
A1005,NAP-LIN-06,"Linen napkins, set of 6",0.31,2,
"""


def unit(sku, grams, fragile=False, hazmat=False):
    return Item(sku, f"test unit {sku}", grams, fragile, hazmat)


def skus(cartons):
    return [[item.sku for item in carton.items] for carton in cartons]


def assert_valid_plan(test, items, cartons, kind):
    """Every unit packed exactly once, cartons numbered in order, every packing rule respected."""
    packed = Counter(item.sku for carton in cartons for item in carton.items)
    test.assertEqual(packed, Counter(item.sku for item in items), "every unit must be packed exactly once")
    for number, carton in enumerate(cartons, start=1):
        label = f"carton {number}"
        test.assertEqual(carton.number, number, f"{label} is numbered {carton.number}")
        test.assertEqual(carton.carton_type, kind, f"{label} is the wrong carton type")
        test.assertTrue(carton.items, f"{label} is empty")
        weight = sum(item.weight_g for item in carton.items)
        test.assertEqual(carton.weight_g, weight, f"{label}: weight_g does not match its contents")
        test.assertLessEqual(weight, kind.max_weight_g, f"{label} is over the carton limit")
        if any(item.fragile for item in carton.items):
            test.assertLessEqual(weight, kind.fragile_max_weight_g, f"{label} holds fragile goods and is over the padded limit")
        if any(item.hazmat for item in carton.items):
            test.assertEqual(len(carton.items), 1, f"{label}: a hazmat item must ship alone")


def fewest_cartons(items, kind):
    """Exhaustive search: the fewest cartons ANY legal plan needs. Small inputs only."""
    groups, best = [], [len(items)]

    def fits(group, item):
        if item.hazmat or any(other.hazmat for other in group):
            return False
        everything = group + [item]
        limit = kind.fragile_max_weight_g if any(i.fragile for i in everything) else kind.max_weight_g
        return sum(i.weight_g for i in everything) <= limit

    def place(index):
        if len(groups) >= best[0]:
            return
        if index == len(items):
            best[0] = len(groups)
            return
        item = items[index]
        for group in groups:
            if fits(group, item):
                group.append(item)
                place(index + 1)
                group.pop()
        groups.append([item])
        place(index + 1)
        groups.pop()

    place(0)
    return best[0]


class BenchRuleTests(unittest.TestCase):
    def test_empty_order_needs_no_cartons(self):
        self.assertEqual(pack_items([], MEDIUM), [])

    def test_light_order_fits_one_carton(self):
        items = [unit("A", 1200), unit("B", 800), unit("C", 450)]
        cartons = pack_items(items, MEDIUM)
        self.assertEqual(skus(cartons), [["A", "B", "C"]])
        assert_valid_plan(self, items, cartons, MEDIUM)

    def test_heaviest_units_are_packed_first(self):
        items = [unit("A", 1000), unit("B", 1000), unit("C", 1000), unit("D", 3000), unit("E", 3000), unit("F", 1000)]
        cartons = pack_items(items, MEDIUM)
        self.assertEqual(len(cartons), 2, "packing in arrival order would need 3 cartons")
        self.assertEqual(len(cartons), fewest_cartons(items, MEDIUM))
        self.assertEqual(skus(cartons), [["D", "A", "B"], ["E", "C", "F"]])
        assert_valid_plan(self, items, cartons, MEDIUM)

    def test_a_carton_may_be_filled_exactly(self):
        self.assertEqual(skus(pack_items([unit("A", 2500), unit("B", 2500)], MEDIUM)), [["A", "B"]])
        self.assertEqual(skus(pack_items([unit("X", 5000)], MEDIUM)), [["X"]])

    def test_each_unit_goes_into_the_earliest_carton_that_takes_it(self):
        items = [unit("A", 3000), unit("B", 2600), unit("C", 2100), unit("D", 1500), unit("E", 250)]
        cartons = pack_items(items, MEDIUM)
        self.assertEqual(skus(cartons), [["A", "D", "E"], ["B", "C"]],
                         "E fits both cartons; the bench uses the earliest one")
        assert_valid_plan(self, items, cartons, MEDIUM)

    def test_bench_rule_is_followed_even_when_a_tighter_plan_exists(self):
        items = [unit("P", 2500), unit("Q", 2000), unit("R", 2000), unit("S", 1500), unit("T", 1000), unit("U", 1000)]
        cartons = pack_items(items, MEDIUM)
        self.assertEqual(fewest_cartons(items, MEDIUM), 2)
        self.assertEqual(skus(cartons), [["P", "Q"], ["R", "S", "T"], ["U"]],
                         "the bench follows its rule, so this order ships in 3 cartons")

    def test_equal_weights_keep_order_line_order(self):
        self.assertEqual(skus(pack_items([unit("A", 2000), unit("B", 2000), unit("C", 2000)], MEDIUM)),
                         [["A", "B"], ["C"]])
        self.assertEqual(skus(pack_items([unit("C", 2000), unit("B", 2000), unit("A", 2000)], MEDIUM)),
                         [["C", "B"], ["A"]])


class PackingRuleTests(unittest.TestCase):
    def test_fragile_unit_lowers_the_carton_limit(self):
        items = [unit("VAS", 2000, fragile=True), unit("BK1", 1500), unit("BK2", 1500)]
        cartons = pack_items(items, MEDIUM)
        self.assertEqual(skus(cartons), [["VAS", "BK1"], ["BK2"]], "a fragile carton takes at most 3,500 g")
        self.assertEqual(len(cartons), fewest_cartons(items, MEDIUM))
        self.assertTrue(cartons[0].fragile)
        assert_valid_plan(self, items, cartons, MEDIUM)

    def test_fragile_unit_skips_a_carton_that_is_already_too_heavy(self):
        items = [unit("A", 3000), unit("G", 1000, fragile=True), unit("B", 1000)]
        cartons = pack_items(items, MEDIUM)
        self.assertEqual(skus(cartons), [["A", "B"], ["G"]])
        assert_valid_plan(self, items, cartons, MEDIUM)

    def test_hazmat_ships_alone(self):
        items = [unit("BAT1", 300, hazmat=True), unit("A", 400), unit("B", 500), unit("BAT2", 200, hazmat=True)]
        cartons = pack_items(items, MEDIUM)
        self.assertEqual(skus(cartons), [["B", "A"], ["BAT1"], ["BAT2"]])
        self.assertEqual(len(cartons), fewest_cartons(items, MEDIUM))
        assert_valid_plan(self, items, cartons, MEDIUM)

    def test_unit_too_heavy_for_the_carton_type_is_refused(self):
        with self.assertRaisesRegex(PackingError, "ANV-01"):
            pack_items([unit("A", 400), unit("ANV-01", 5200)], MEDIUM)
        with self.assertRaisesRegex(PackingError, "MIR-01"):
            pack_items([unit("MIR-01", 3600, fragile=True)], MEDIUM)
        self.assertEqual(len(pack_items([unit("MIR-02", 3500, fragile=True)], MEDIUM)), 1)
        with self.assertRaises(PackingError):
            pack_items([unit("BAT", 2100, hazmat=True)], SMALL)

    def test_callers_list_is_left_alone(self):
        items = [unit("A", 100), unit("B", 900), unit("C", 500)]
        pack_items(items, MEDIUM)
        self.assertEqual([item.sku for item in items], ["A", "B", "C"])


class OrderPackingTests(unittest.TestCase):
    def test_whole_order_from_the_export(self):
        order = load_orders(TABLEWARE_EXPORT)[0]
        cartons = pack_order(order, LARGE)
        self.assertEqual(skus(cartons), [
            ["BRD-OAK-40", "BRD-OAK-40", "DCN-GLS-01", "GLS-WIN-04", "NAP-LIN-06", "NAP-LIN-06"],
            ["GLS-WIN-04", "GLS-WIN-04"],
        ])
        self.assertEqual([carton.weight_g for carton in cartons], [6890, 2240])
        assert_valid_plan(self, order.units(), cartons, LARGE)

    def test_random_small_orders_are_valid_and_repeatable(self):
        rng = random.Random(42)
        for trial in range(60):
            kind = rng.choice([SMALL, MEDIUM, LARGE])
            items = []
            for n in range(rng.randint(1, 8)):
                hazmat = rng.random() < 0.1
                fragile = not hazmat and rng.random() < 0.3
                top = kind.fragile_max_weight_g if fragile else kind.max_weight_g
                items.append(unit(f"T{trial}-{n}", rng.randrange(100, top + 1, 100), fragile, hazmat))
            cartons = pack_items(items, kind)
            assert_valid_plan(self, items, cartons, kind)
            self.assertGreaterEqual(len(cartons), fewest_cartons(items, kind))
            self.assertEqual(skus(pack_items(items, kind)), skus(cartons), "same order, same plan")


if __name__ == "__main__":
    unittest.main()
