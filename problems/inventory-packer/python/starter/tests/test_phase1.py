import unittest

from shipping import (CARTON_TYPES, Carton, Item, OrderFormatError, carrier_labels, format_grams,
                      format_kg, format_manifest, load_orders, parse_weight_kg, smallest_carton_for)

BENCH_EXPORT = """order_id,sku,description,weight_kg,qty,flags
B2001,TEA-BRK-80,Breakfast tea 80 bags,0.25,2,
B2001,MUG-STN-350,Stoneware mug 350 ml,0.38,2,fragile
B2002,BAT-LI-18,Lithium battery 18650,0.33,1,hazmat
B2001,TWL-LIN-2,"Linen tea towels, set of 2",0.18,1,
"""

# Lines copied from orders the dispatch scale flagged this week.
DISPATCH_EXPORT = """order_id,sku,description,weight_kg,qty,flags
C3001,PAN-CI-26,Cast iron skillet 26 cm,2.03,1,
C3001,TRV-CI-20,Cast iron trivet,1.015,3,
C3001,TWL-LIN-2,"Linen tea towels, set of 2",0.18,2,
C3002,KTL-ENM-15,Enamel kettle 1.5 l,1.005,1,
C3002,APR-LIN-01,Linen apron,0.42,1,
C3002,WRP-BEE-03,"Beeswax wraps, pack of 3",0.576,1,
"""


def by_id(orders):
    return {order.order_id: order for order in orders}


class WeightReadingTests(unittest.TestCase):
    def test_simple_kilogram_readings(self):
        for text, grams in [("2", 2000), ("0.5", 500), ("0.25", 250), ("1.2", 1200), ("0.035", 35)]:
            self.assertEqual(parse_weight_kg(text), grams, f"{text} kg")

    def test_malformed_readings_are_rejected(self):
        for text in ["", "abc", "-1", "1,5", "1.2kg"]:
            with self.assertRaises(ValueError, msg=repr(text)):
                parse_weight_kg(text)

    def test_weight_formatting(self):
        self.assertEqual(format_grams(5435), "5,435 g")
        self.assertEqual(format_grams(800), "800 g")
        self.assertEqual(format_kg(5435), "5.435 kg")
        self.assertEqual(format_kg(35), "0.035 kg")


class OrderExportTests(unittest.TestCase):
    def test_lines_are_grouped_by_order(self):
        orders = load_orders(BENCH_EXPORT)
        self.assertEqual([order.order_id for order in orders], ["B2001", "B2002"])
        first = orders[0]
        self.assertEqual([line.item.sku for line in first.lines], ["TEA-BRK-80", "MUG-STN-350", "TWL-LIN-2"])
        self.assertEqual([line.quantity for line in first.lines], [2, 2, 1])
        self.assertEqual(first.unit_count, 5)
        self.assertEqual(first.lines[2].item.description, "Linen tea towels, set of 2")

    def test_flags_are_read(self):
        orders = by_id(load_orders(BENCH_EXPORT))
        tea, mug, _ = (line.item for line in orders["B2001"].lines)
        battery = orders["B2002"].lines[0].item
        self.assertEqual((tea.fragile, tea.hazmat), (False, False))
        self.assertEqual((mug.fragile, mug.hazmat), (True, False))
        self.assertEqual((battery.fragile, battery.hazmat), (False, True))

    def test_bad_line_is_reported_with_its_number(self):
        broken = BENCH_EXPORT.replace("0.33,1,hazmat", "0.33,1,explosive")
        with self.assertRaisesRegex(OrderFormatError, "line 4"):
            load_orders(broken)

    def test_unit_weights_match_the_export(self):
        orders = load_orders(DISPATCH_EXPORT)
        weights = [line.item.weight_g for order in orders for line in order.lines]
        self.assertEqual(weights, [2030, 1015, 180, 1005, 420, 576])

    def test_order_weight_matches_the_dispatch_scale(self):
        order = by_id(load_orders(DISPATCH_EXPORT))["C3001"]
        self.assertEqual(order.total_weight_g, 5435, "the dispatch scale weighed this order at 5,435 g")


class CartonChoiceTests(unittest.TestCase):
    def test_smallest_box_that_holds_the_weight(self):
        self.assertEqual(smallest_carton_for(1800).code, "S")
        self.assertEqual(smallest_carton_for(2000).code, "S", "a full Small box is still a Small box")
        self.assertEqual(smallest_carton_for(2001).code, "M")
        self.assertEqual(smallest_carton_for(9000).code, "L")
        self.assertIsNone(smallest_carton_for(10001))

    def test_fragile_orders_use_the_padded_limit(self):
        self.assertEqual(smallest_carton_for(1500, fragile=True).code, "S")
        self.assertEqual(smallest_carton_for(1800, fragile=True).code, "M")

    def test_order_just_over_the_small_box_limit(self):
        order = by_id(load_orders(DISPATCH_EXPORT))["C3002"]
        kind = smallest_carton_for(order.total_weight_g, order.has_fragile)
        self.assertEqual(kind.code, "M", "the carrier weighed this order at 2,001 g: too heavy for a Small box")


class ManifestTests(unittest.TestCase):
    def setUp(self):
        mug = Item("MUG-STN-350", "Stoneware mug 350 ml", 380, fragile=True)
        tea = Item("TEA-BRK-80", "Breakfast tea 80 bags", 250)
        battery = Item("BAT-LI-18", "Lithium battery 18650", 330, hazmat=True)
        medium = CARTON_TYPES["M"]
        self.first, self.second = Carton(medium, 1), Carton(medium, 2)
        for item in (mug, tea, mug):
            self.first.add(item)
        self.second.add(battery)

    def test_manifest_groups_units_per_carton(self):
        lines = format_manifest("B2001", [self.first, self.second]).splitlines()
        self.assertIn("2 cartons", lines[0])
        self.assertIn("1,340 g", lines[0])
        self.assertIn("Carton 1/2", lines[1])
        self.assertIn("1,010 g of 3,500 g", lines[1], "a fragile carton shows the padded limit")
        self.assertIn("FRAGILE", lines[1])
        self.assertIn("2 x MUG-STN-350", lines[2])
        self.assertIn("760 g", lines[2])
        self.assertIn("1 x TEA-BRK-80", lines[3])
        self.assertIn("HAZMAT", lines[4])
        self.assertEqual(len(lines), 6)

    def test_carrier_labels_declare_each_carton(self):
        labels = carrier_labels("B2001", [self.first, self.second])
        self.assertEqual(labels, ["B2001-1/2 M 1.010 kg", "B2001-2/2 M 0.330 kg"])


if __name__ == "__main__":
    unittest.main()
