"""Seeded generator for large Campfire-like networks.

Members belong to clubs of `club` consecutive ids and make most of their
friends inside their club, so friends of friends overlap the way they do in
real communities. A few organisers have hundreds of friends across the whole
network. The generator uses a Park-Miller random number generator so the
JavaScript copy of this file builds exactly the same network.
"""
from datetime import date

from campfire.graph import SocialGraph
from campfire.models import User

TAGS = ("climbing", "jazz", "film", "cooking", "cycling", "photography", "board-games",
        "running", "chess", "gardening", "poetry", "baking", "hiking", "anime", "knitting",
        "surfing", "podcasts", "yoga", "sci-fi", "vinyl", "pottery", "birding", "coding", "dance")


class Rng:
    def __init__(self, seed):
        self.state = seed % 2147483647 or 1

    def below(self, n):
        """A pseudo-random integer in [0, n)."""
        self.state = self.state * 48271 % 2147483647
        return self.state % n


def member_id(index):
    return f"m{index:05d}"


def build_network(seed, size, *, friends=7, club=50, local_pct=85,
                  organisers=0, reach=0, blocks=0, inactive=0):
    rng = Rng(seed)
    graph = SocialGraph()
    for i in range(size):
        tags = frozenset(TAGS[rng.below(len(TAGS))] for _ in range(3))
        graph.add_user(User(member_id(i), f"Member {i}", date(2021, 1, 1), tags))

    links = [[] for _ in range(size)]

    def link(a, b):
        if a != b and graph.add_friendship(member_id(a), member_id(b)):
            links[a].append(b)
            links[b].append(a)

    for i in range(size):
        start = i - i % club
        span = min(club, size - start)
        for _ in range(friends):
            if rng.below(100) < local_pct:
                link(i, start + rng.below(span))
            else:
                link(i, rng.below(size))
    for _ in range(organisers):
        hub = rng.below(size)
        for _ in range(reach):
            link(hub, rng.below(size))
    for _ in range(blocks):
        a = rng.below(size)
        if not links[a]:
            continue
        via = links[a][rng.below(len(links[a]))]
        c = links[via][rng.below(len(links[via]))]
        if c != a:
            if rng.below(2):
                graph.block(member_id(a), member_id(c))
            else:
                graph.block(member_id(c), member_id(a))
    for _ in range(inactive):
        graph.deactivate(member_id(rng.below(size)))
    return graph
