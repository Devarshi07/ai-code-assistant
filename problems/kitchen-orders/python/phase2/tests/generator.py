"""Seeded service generator for the larger simulation tests.

It uses a Park-Miller LCG, so the Python and JavaScript suites build exactly
the same services from the same seed.
"""
from kitchen import Menu, MenuItem, Order, Station

STADIUM_MENU = Menu([
    MenuItem("smash burger", "grill", 6),
    MenuItem("bratwurst", "grill", 4),
    MenuItem("chicken wrap", "grill", 5),
    MenuItem("fries", "fryer", 4),
    MenuItem("wings", "fryer", 8),
    MenuItem("tenders", "fryer", 6),
    MenuItem("pretzel", "oven", 3),
    MenuItem("pizza slice", "oven", 2),
    MenuItem("caesar salad", "salad", 3),
    MenuItem("fruit cup", "salad", 1),
])
DISHES = [item.name for item in STADIUM_MENU]


def stadium_line(grill, fryer, oven, salad):
    return [Station("grill", grill), Station("fryer", fryer), Station("oven", oven), Station("salad", salad)]


class Lcg:
    """Park-Miller 'minimal standard' generator."""
    MOD = 2147483647

    def __init__(self, seed):
        self.state = seed % self.MOD or 1

    def below(self, n):
        self.state = self.state * 48271 % self.MOD
        return self.state % n


def generate(seed, count, opens, minutes, app_percent=20, due_percent=35):
    """`count` orders rung in uniformly over `minutes` minutes from minute `opens`.

    Ids are unique but unrelated to arrival, and the list is not sorted.
    """
    rng = Lcg(seed)
    orders = []
    for k in range(count):
        arrival = opens + rng.below(minutes)
        size = 1 + rng.below(4)
        dishes = [DISHES[rng.below(len(DISHES))] for _ in range(size)]
        priority = rng.below(100) < app_percent
        promised = rng.below(100) < due_percent
        wait = 12 + rng.below(30)
        due = arrival + wait if priority or promised else None
        orders.append(Order(1000 + k, arrival, dishes, priority, due))
    return orders


def fingerprint(run):
    """Summary of a run that any correct simulation reproduces exactly."""
    ready = run.ready
    return (len(ready), sum(ready.values()), sum(oid * t for oid, t in ready.items()),
            max(ready.values()), len(run.late), sum(minutes for _, minutes in run.late))
