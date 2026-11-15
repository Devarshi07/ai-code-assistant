import time
import unittest

from kitchen import Order, simulate
from tests.generator import STADIUM_MENU, fingerprint, generate, stadium_line


class ScaleTests(unittest.TestCase):
    def test_stadium_afternoon_matches_reference(self):
        orders = generate(11, 4000, 16 * 60, 720)
        run = simulate(orders, STADIUM_MENU, stadium_line(8, 10, 3, 2))
        self.assertEqual({k: run.ready[k] for k in (1000, 1001, 1002, 4999)},
                         {1000: 1309, 1001: 2342, 1002: 2288, 4999: 1261})
        self.assertEqual(fingerprint(run), (4000, 7669837, 23035378252, 2918, 1099, 792208))

    def test_burst_of_simultaneous_orders(self):
        # 60 one-burger orders land in the same minute; every 7th is an app order.
        # Four grill cooks plate them four at a time, strictly in rank order.
        ids = list(range(60, 0, -1))
        orders = [Order(i, 1200, ["smash burger"], priority=i % 7 == 0) for i in ids]
        run = simulate(orders, STADIUM_MENU, stadium_line(4, 1, 1, 1))
        ranked = sorted(ids, key=lambda i: (i % 7 != 0, i))
        expected = {oid: 1200 + 6 * (k // 4 + 1) for k, oid in enumerate(ranked)}
        self.assertEqual(run.ready, expected)

    def test_quiet_service_matches_the_quote(self):
        # Orders 30 minutes apart never queue, so each is ready at its quote.
        template = generate(5, 500, 0, 1)
        orders = [Order(o.id, 600 + 30 * k, o.dishes, o.priority, 600 + 30 * k + 5)
                  for k, o in enumerate(template)]
        run = simulate(orders, STADIUM_MENU, stadium_line(4, 4, 4, 4))
        self.assertEqual(run.ready, {o.id: o.quote(STADIUM_MENU) for o in orders})
        expected_late = sorted((o.id, o.quote(STADIUM_MENU) - o.due) for o in orders if o.quote(STADIUM_MENU) > o.due)
        self.assertEqual(list(run.late), expected_late)

    def test_game_day_rush_is_fast(self):
        orders = generate(7, 28000, 16 * 60, 3 * 24 * 60)
        line = stadium_line(16, 19, 5, 4)
        start = time.perf_counter()
        run = simulate(orders, STADIUM_MENU, line)
        elapsed = time.perf_counter() - start
        self.assertEqual(fingerprint(run), (28000, 123340827, 1846193389934, 7972, 7782, 12124177))
        self.assertLess(elapsed, 1.0, f"took {elapsed:.2f}s; a 28,000-order game day must simulate in under 1.0s")


if __name__ == "__main__":
    unittest.main()
