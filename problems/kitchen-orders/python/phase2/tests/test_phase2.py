import unittest
from pathlib import Path

from kitchen import HOUSE_LINE, HOUSE_MENU, Menu, MenuError, MenuItem, Order, Station, parse_log, simulate
from tests.generator import STADIUM_MENU, fingerprint, generate, stadium_line

LUNCH_LOG = Path(__file__).resolve().parent.parent / "data" / "saturday_lunch.txt"

MENU = Menu([
    MenuItem("burger", "grill", 6),
    MenuItem("steak", "grill", 10),
    MenuItem("fries", "fryer", 4),
    MenuItem("rings", "fryer", 5),
    MenuItem("salad", "salad", 3),
])
ONE_EACH = [Station("grill", 1), Station("fryer", 1), Station("salad", 1)]
NOON = 12 * 60


def order(order_id, arrival, *dishes, app=False, due=None):
    return Order(order_id, arrival, list(dishes), priority=app, due=due)


class SimulationTests(unittest.TestCase):
    def test_single_order_is_ready_when_its_last_dish_finishes(self):
        run = simulate([order(1, NOON, "burger", "fries", "salad")], MENU, ONE_EACH)
        self.assertEqual(run.ready, {1: NOON + 6})
        self.assertEqual(list(run.late), [])

    def test_one_cook_works_through_the_queue_in_arrival_order(self):
        orders = [order(1, NOON, "steak"), order(2, NOON + 1, "burger"), order(3, NOON + 2, "burger")]
        run = simulate(orders, MENU, ONE_EACH)
        self.assertEqual(run.ready, {1: NOON + 10, 2: NOON + 16, 3: NOON + 22})

    def test_app_orders_jump_the_queue(self):
        orders = [order(1, NOON, "steak"), order(2, NOON + 1, "burger"), order(3, NOON + 5, "burger", app=True)]
        run = simulate(orders, MENU, ONE_EACH)
        self.assertEqual(run.ready, {1: NOON + 10, 2: NOON + 22, 3: NOON + 16})

    def test_same_minute_ties_go_to_the_lower_order_id(self):
        orders = [order(7, NOON, "burger"), order(4, NOON, "steak")]
        run = simulate(orders, MENU, ONE_EACH)
        self.assertEqual(run.ready, {4: NOON + 10, 7: NOON + 16})

    def test_dishes_on_one_ticket_cook_in_ticket_order(self):
        orders = [order(7, NOON, "steak", "burger"), order(8, NOON + 5, "burger", app=True)]
        run = simulate(orders, MENU, ONE_EACH)
        self.assertEqual(run.ready, {7: NOON + 22, 8: NOON + 16})

    def test_cook_who_finishes_can_take_a_dish_arriving_that_minute(self):
        orders = [order(1, NOON, "steak"), order(2, NOON + 2, "burger"), order(3, NOON + 10, "burger", app=True)]
        run = simulate(orders, MENU, ONE_EACH)
        self.assertEqual(run.ready, {1: NOON + 10, 2: NOON + 22, 3: NOON + 16})

    def test_cooks_on_a_station_work_side_by_side(self):
        line = [Station("grill", 2), Station("fryer", 1), Station("salad", 1)]
        orders = [order(1, NOON, "steak", "burger", "burger"), order(2, NOON + 1, "burger")]
        run = simulate(orders, MENU, line)
        self.assertEqual(run.ready, {1: NOON + 12, 2: NOON + 16})

    def test_kitchen_idles_until_the_next_order(self):
        orders = [order(3, 23 * 60 + 55, "steak"), order(1, NOON, "burger"), order(2, NOON + 30, "burger", "salad")]
        run = simulate(orders, MENU, ONE_EACH)
        self.assertEqual(run.ready, {1: NOON + 6, 2: NOON + 36, 3: 24 * 60 + 5})

    def test_late_orders_report_minutes_late(self):
        orders = [order(1, NOON, "steak", due=NOON + 10),
                  order(3, NOON + 1, "fries", due=NOON + 3),
                  order(2, NOON, "burger", due=NOON + 12),
                  order(4, NOON + 2, "burger")]
        run = simulate(orders, MENU, ONE_EACH)
        self.assertEqual(run.ready, {1: NOON + 10, 2: NOON + 16, 3: NOON + 5, 4: NOON + 22})
        self.assertEqual(list(run.late), [(2, 4), (3, 2)], "finishing exactly on the due minute is on time")

    def test_unknown_dish_is_rejected(self):
        with self.assertRaises(MenuError):
            simulate([order(1, NOON, "lobster")], MENU, ONE_EACH)


class ServiceTests(unittest.TestCase):
    def test_saturday_lunch(self):
        orders = parse_log(LUNCH_LOG.read_text())
        run = simulate(orders, HOUSE_MENU, HOUSE_LINE)
        self.assertEqual(run.ready, {
            101: 707, 102: 709, 103: 715, 104: 721, 105: 749, 106: 728, 107: 736, 108: 753, 109: 736,
            110: 732, 111: 762, 112: 745, 113: 745, 114: 767, 115: 778, 116: 790, 117: 798, 118: 811,
        })
        self.assertEqual(list(run.late), [(108, 13), (111, 7)])

    def test_busy_dinner_service(self):
        orders = generate(3, 300, 18 * 60, 240)
        run = simulate(orders, STADIUM_MENU, stadium_line(3, 3, 1, 1))
        self.assertEqual({k: run.ready[k] for k in (1000, 1001, 1002, 1299)},
                         {1000: 1267, 1001: 1438, 1002: 1174, 1299: 1085})
        self.assertEqual(fingerprint(run), (300, 390664, 448924524, 1556, 63, 7199))


if __name__ == "__main__":
    unittest.main()
