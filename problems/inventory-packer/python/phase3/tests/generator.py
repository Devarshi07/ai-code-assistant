"""Deterministic wholesale orders for the scale tests."""
from shipping import Item


class Lcg:
    """Park-Miller "minimal standard" generator. The JavaScript tests use the same one."""

    def __init__(self, seed):
        self.state = seed % 2147483647 or 1

    def below(self, n):
        self.state = self.state * 48271 % 2147483647
        return self.state % n


def wholesale_units(seed, count, catalogue_size=400, max_g=4900, fragile_max_g=3400):
    """count units of a restock order: random catalogue lines, each ordered in bulk."""
    rng = Lcg(seed)
    catalogue = []
    for n in range(catalogue_size):
        roll = rng.below(100)
        hazmat, fragile = roll < 2, 2 <= roll < 20
        top = fragile_max_g if fragile else max_g
        catalogue.append(Item(f"W{n:04d}", f"wholesale line {n}", 60 + rng.below(top - 59), fragile, hazmat))
    units = []
    while len(units) < count:
        item = catalogue[rng.below(catalogue_size)]
        units.extend([item] * min(1 + rng.below(40), count - len(units)))
    return units
