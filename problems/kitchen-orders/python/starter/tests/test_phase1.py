import unittest
from pathlib import Path

from kitchen import (ClockError, HOUSE_LINE, HOUSE_MENU, KitchenRun, Order, TicketError,
                     format_clock, parse_clock, parse_log, parse_ticket)
from kitchen.report import service_report

LUNCH_LOG = Path(__file__).resolve().parent.parent / "data" / "saturday_lunch.txt"

RUSH = """
# printed in the order the tickets came in
11:50am order 1: burger
12:05pm order 2: fries
12:40pm order 3: house salad
1:10pm order 4: margherita
"""


class ClockTests(unittest.TestCase):
    def test_morning_stamps(self):
        self.assertEqual(parse_clock("7:00am"), 420)
        self.assertEqual(parse_clock("9:05am"), 545)
        self.assertEqual(parse_clock("11:59am"), 719)

    def test_afternoon_and_evening_stamps(self):
        self.assertEqual(parse_clock("1:15pm"), 795)
        self.assertEqual(parse_clock("6:30PM"), 1110)
        self.assertEqual(parse_clock("11:45pm"), 1425)

    def test_noon_hour_is_midday(self):
        self.assertEqual(parse_clock("12:00pm"), 720)
        self.assertEqual(parse_clock("12:41pm"), 761)

    def test_every_minute_of_the_day_round_trips(self):
        for minute in range(24 * 60):
            stamp = format_clock(minute)
            self.assertEqual(parse_clock(stamp), minute, f"{stamp} should parse back to minute {minute}")

    def test_malformed_stamps_are_rejected(self):
        for stamp in ("13:05pm", "9:5am", "12:60pm", "0:30am", "noon", "1205"):
            with self.assertRaises(ClockError, msg=stamp):
                parse_clock(stamp)


class TicketTests(unittest.TestCase):
    def test_ticket_with_portions_and_flags(self):
        order = parse_ticket("11:31am order 15: Caesar Salad, 2x fries | app | due 11:55am")
        self.assertEqual(order.id, 15)
        self.assertEqual(order.arrival, 691)
        self.assertEqual(order.dishes, ["caesar salad", "fries", "fries"])
        self.assertTrue(order.priority)
        self.assertEqual(order.due, 715)

    def test_rail_is_in_arrival_order(self):
        orders = parse_log(RUSH)
        self.assertEqual([o.id for o in orders], [1, 2, 3, 4])
        self.assertEqual([o.arrival for o in orders], [710, 725, 760, 790])

    def test_same_minute_tickets_keep_printer_order(self):
        orders = parse_log("10:15am order 9: fries\n10:15am order 3: burger\n10:05am order 5: wings\n")
        self.assertEqual([o.id for o in orders], [5, 9, 3])

    def test_bad_lines_report_their_line_number(self):
        with self.assertRaises(TicketError) as caught:
            parse_log("10:15am order 1: fries\n10:16am order 2: burger | rush\n")
        self.assertEqual(caught.exception.line_number, 2)
        with self.assertRaises(TicketError):
            parse_log("10:15am order 1: fries\n10:20am order 1: burger\n")


class QuoteTests(unittest.TestCase):
    def test_quote_is_arrival_plus_slowest_dish(self):
        order = Order(7, 600, ["fries", "steak frites", "house salad"])
        self.assertEqual(order.quote(HOUSE_MENU), 614)

    def test_lunch_quotes_stay_on_the_same_day(self):
        orders = parse_log(LUNCH_LOG.read_text())
        self.assertEqual(len(orders), 18)
        for order in orders:
            wait = order.quote(HOUSE_MENU) - order.arrival
            self.assertTrue(660 <= order.arrival <= 840,
                            f"order {order.id} was rung in at {format_clock(order.arrival)}, not during lunch")
            self.assertLessEqual(wait, 14)
            if order.due is not None:
                self.assertLess(order.due - order.arrival, 60, f"order {order.id} has an odd due time")


class ReportTests(unittest.TestCase):
    def test_report_shows_lateness_and_station_load(self):
        orders = [Order(1, 600, ["burger", "fries"]),
                  Order(2, 602, ["house salad"], priority=True, due=610),
                  Order(3, 603, ["burger"], due=612)]
        run = KitchenRun(ready={1: 607, 2: 605, 3: 616}, late=[(3, 4)])
        text = service_report("Test", orders, HOUSE_MENU, HOUSE_LINE, run)
        self.assertIn("3 orders, 4 dishes", text)
        self.assertIn("LATE 4m", text)
        self.assertIn("on time, app", text)
        self.assertIn("1 of 2 promised orders late", text)
        self.assertRegex(text, r"grill\s+2\s+2\s+14m\s+44%")


if __name__ == "__main__":
    unittest.main()
