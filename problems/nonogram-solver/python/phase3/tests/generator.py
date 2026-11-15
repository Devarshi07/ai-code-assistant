"""Deterministic random pictures for the large-puzzle tests.

Uses the Park-Miller "minimal standard" generator so the JavaScript tests can
reproduce exactly the same pictures. The seeds used in test_phase3.py were
checked offline: each picture is the *only* grid that fits its clues.
"""


class ParkMiller:
    MODULUS = 2147483647

    def __init__(self, seed):
        self.state = seed % self.MODULUS or 1

    def random(self):
        self.state = self.state * 48271 % self.MODULUS
        return self.state / self.MODULUS


def random_picture(seed, width, height, density):
    """A width x height grid where each cell is filled with probability density."""
    rng = ParkMiller(seed)
    return [[1 if rng.random() < density else 0 for _ in range(width)] for _ in range(height)]
