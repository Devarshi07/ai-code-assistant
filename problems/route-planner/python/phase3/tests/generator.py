"""Deterministic timetable generator for large test networks.

Stations sit on a size x size street grid and are named after their grid
cell ("S12-7"). Each line wanders across the grid without revisiting a
stop; about one in five is an express that skips cells and runs faster per
cell, and about one in eight is one-way. The JavaScript tests use the same
generator, so a seed produces the same network in both languages.
"""

# Grid steps for east, south, west, north; turning right is +1, left is +3.
DIRECTIONS = [(0, 1), (1, 0), (0, -1), (-1, 0)]


class Lcg:
    """Park-Miller "minimal standard" generator."""

    def __init__(self, seed):
        self.state = seed % 2147483647 or 1

    def below(self, n):
        self.state = self.state * 48271 % 2147483647
        return self.state % n


def generate_timetable(seed, size, lines, min_stops=12, max_stops=30):
    """Return (timetable_text, sorted_station_names)."""
    rng = Lcg(seed)
    entries = [f"# generated: seed {seed}, {size}x{size} grid, {lines} lines"]
    stations = set()
    for number in range(1, lines + 1):
        express = rng.below(5) == 0
        stride = 2 + rng.below(2) if express else 1
        row, col, heading = rng.below(size), rng.below(size), rng.below(4)
        target = min_stops + rng.below(max_stops - min_stops + 1)
        stops, minutes = [(row, col)], []
        seen = {(row, col)}
        while len(stops) < target:
            roll = rng.below(10)
            if roll < 7:
                order = [heading, (heading + 1) % 4, (heading + 3) % 4]
            elif roll < 9:
                order = [(heading + 1) % 4, heading, (heading + 3) % 4]
            else:
                order = [(heading + 3) % 4, heading, (heading + 1) % 4]
            for turn in order:
                dr, dc = DIRECTIONS[turn]
                nr, nc = row + dr * stride, col + dc * stride
                if 0 <= nr < size and 0 <= nc < size and (nr, nc) not in seen:
                    row, col, heading = nr, nc, turn
                    break
            else:
                break   # boxed in: the line ends here
            stops.append((row, col))
            seen.add((row, col))
            minutes.append(stride + rng.below(2) if express else 2 + rng.below(3))
        one_way = rng.below(8) == 0
        names = [f"S{r}-{c}" for r, c in stops]
        stations.update(names)
        body = names[0]
        for name, ride in zip(names[1:], minutes):
            body += f" {ride} {name}"
        flag = " oneway" if one_way else ""
        entries.append(f"line {'X' if express else 'L'}{number}{flag}: {body}")
    return "\n".join(entries) + "\n", sorted(stations)


def pick_queries(seed, stations, count):
    """Deterministic (origin, destination) pairs of distinct stations."""
    rng = Lcg(seed)
    queries = []
    while len(queries) < count:
        origin = stations[rng.below(len(stations))]
        destination = stations[rng.below(len(stations))]
        if origin != destination:
            queries.append((origin, destination))
    return queries
