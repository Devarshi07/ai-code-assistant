"""Seeded random fleets for bot benchmarks.

QA replays the same matches in the Python and JavaScript harnesses, so a seed
must produce the identical fleet in both. Neither language's built-in random
module can promise that, so we use mulberry32: a tiny 32-bit generator that
ports bit-for-bit.
"""
from .ocean import Coord, Ocean
from .ships import DEFAULT_FLEET, Fleet, PlacementError

_MASK = 0xFFFFFFFF
MAX_ATTEMPTS = 1000


class Rng:
    """mulberry32. Same seed, same sequence, in every harness."""

    def __init__(self, seed: int):
        self._state = seed & _MASK

    def next_u32(self) -> int:
        self._state = (self._state + 0x6D2B79F5) & _MASK
        t = self._state
        t = ((t ^ (t >> 15)) * (t | 1)) & _MASK
        t = ((t + (((t ^ (t >> 7)) * (t | 61)) & _MASK)) & _MASK) ^ t
        return (t ^ (t >> 14)) & _MASK

    def below(self, n: int) -> int:
        """An integer in [0, n). The modulo bias is negligible for board-sized n."""
        return self.next_u32() % n


def random_fleet(seed: int, size: int = 10, ship_sizes=DEFAULT_FLEET) -> Fleet:
    """Place ships largest first, each at a random spot where it fits.

    For each attempt the generator draws the orientation, then the row, then
    the column. The JavaScript placer draws in the same order.
    """
    rng = Rng(seed)
    fleet = Fleet(Ocean(size))
    for length in sorted(ship_sizes, reverse=True):
        if length > size:
            raise PlacementError(f"a {length}-cell ship cannot fit on a {size}x{size} board")
        span = size - length + 1
        for _ in range(MAX_ATTEMPTS):
            vertical = rng.below(2) == 1
            if vertical:
                origin = Coord(rng.below(span), rng.below(size))
            else:
                origin = Coord(rng.below(size), rng.below(span))
            if fleet.fits(length, origin, vertical):
                fleet.place(length, origin, vertical)
                break
        else:
            raise PlacementError(f"seed {seed}: no room for a {length}-cell ship after {MAX_ATTEMPTS} attempts")
    return fleet
