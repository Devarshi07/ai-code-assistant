import time
import unittest
from collections import Counter

from shipping import CARTON_TYPES, Item, pack_items
from tests.generator import wholesale_units

MEDIUM = CARTON_TYPES["M"]


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
        test.assertTrue(carton.items, f"{label} is empty")
        weight = sum(item.weight_g for item in carton.items)
        test.assertEqual(carton.weight_g, weight, f"{label}: weight_g does not match its contents")
        test.assertLessEqual(weight, kind.max_weight_g, f"{label} is over the carton limit")
        if any(item.fragile for item in carton.items):
            test.assertLessEqual(weight, kind.fragile_max_weight_g, f"{label} holds fragile goods and is over the padded limit")
        if any(item.hazmat for item in carton.items):
            test.assertEqual(len(carton.items), 1, f"{label}: a hazmat item must ship alone")


class SamePlanTests(unittest.TestCase):
    def test_bench_rule_on_a_tight_order(self):
        items = [unit("P", 2500), unit("Q", 2000), unit("R", 2000), unit("S", 1500), unit("T", 1000), unit("U", 1000)]
        self.assertEqual(skus(pack_items(items, MEDIUM)), [["P", "Q"], ["R", "S", "T"], ["U"]])

    def test_every_rule_on_a_mixed_order(self):
        items = [unit("DSK", 4000), unit("MIR", 3200, fragile=True), unit("LMP", 1200, fragile=True), unit("CAB", 900),
                 unit("BAT", 800, hazmat=True), unit("VAS", 500, fragile=True), unit("PLG", 300)]
        cartons = pack_items(items, MEDIUM)
        self.assertEqual(skus(cartons), [["DSK", "CAB"], ["MIR", "PLG"], ["LMP", "VAS"], ["BAT"]])
        assert_valid_plan(self, items, cartons, MEDIUM)

    def test_equal_weights_keep_order_line_order(self):
        items = [unit("Y", 3200), unit("X", 3000), unit("B", 1900), unit("A", 1900)]
        self.assertEqual(skus(pack_items(items, MEDIUM)), [["Y"], ["X", "B"], ["A"]])

    def test_restock_order_matches_the_bench_plan(self):
        items = wholesale_units(5, 2000)
        cartons = pack_items(items, MEDIUM)
        assert_valid_plan(self, items, cartons, MEDIUM)
        self.assertEqual(len(cartons), 906)
        self.assertEqual([carton.weight_g for carton in cartons[::100]],
                         [4879, 4868, 4839, 3175, 4960, 3488, 4989, 3350, 4969, 3335])
        self.assertEqual(sum(carton.fragile for carton in cartons), 205)
        self.assertEqual(sum(carton.hazmat for carton in cartons), 60)
        self.assertEqual(skus(cartons[-2:]), [["W0308"] * 8, ["W0011"] * 8])


class ScaleTests(unittest.TestCase):
    def test_large_restock_order_is_fast(self):
        items = wholesale_units(11, 13000)
        start = time.perf_counter()
        cartons = pack_items(items, MEDIUM)
        elapsed = time.perf_counter() - start
        assert_valid_plan(self, items, cartons, MEDIUM)
        self.assertEqual(len(cartons), 7259)
        self.assertLess(elapsed, 0.5, f"took {elapsed:.2f}s; a 13,000-unit order must plan in under 0.5s")


if __name__ == "__main__":
    unittest.main()
