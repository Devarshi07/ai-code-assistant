"""Sample levels from the designers' shared folder."""
from .level import Level

TUTORIAL = """
#########
#S..#...#
#.#.#.#.#
#.#...#E#
#########
"""

GATEHOUSE = """
###########
#S...>...E#
#.#######.#
#....<....#
###########
"""

TREASURY = """
###########
#S..#....$#
#.#.#.###.#
#.#$..#...#
#.#####.#.#
#...$...#E#
###########
"""

CANYON = """
###############
#S....#.......#
#.###.#.#####.#
#...#...#...#.#
###.#####.#.#.#
#.........#..E#
###############
"""

TOWER = """
#####
#S..#
#.#.#
#.#.#
#...#
##.##
#..$#
#.###
#..E#
#####
"""


SPIRE = """
#####
#S...
###.#
#...#
#.###
#...#
###.#
#...#
#.###
#...#
###.#
#E...
"""


def load_samples():
    return [
        Level.parse(TUTORIAL, "tutorial"),
        Level.parse(GATEHOUSE, "gatehouse"),
        Level.parse(TREASURY, "treasury"),
        Level.parse(CANYON, "canyon"),
        Level.parse(TOWER, "tower"),
        Level.parse(SPIRE, "spire"),
    ]
