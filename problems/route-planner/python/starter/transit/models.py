"""Plain data models shared by the timetable loader, the network and the planner.

Station and line names are case-sensitive strings exactly as they appear in
the timetable ("Old Town", "Red"). Running times are whole minutes.
"""
from dataclasses import dataclass, field
from typing import Iterator, List, NamedTuple, Tuple

# Minutes a rider needs to change lines at a station (walk, wait, board).
DEFAULT_TRANSFER_MINUTES = 5


class Segment(NamedTuple):
    """One hop of a line between two consecutive stops, in timetable order."""
    origin: str
    destination: str
    minutes: int


class Connection(NamedTuple):
    """A directed edge in the network: from some station, ride `line` to `to`."""
    to: str
    line: str
    minutes: int


@dataclass
class Station:
    name: str
    lines: List[str] = field(default_factory=list)   # lines calling here, in load order

    def add_line(self, line_name):
        if line_name not in self.lines:
            self.lines.append(line_name)


@dataclass
class Line:
    """A transit line as written in the timetable.

    `minutes[i]` is the running time between `stations[i]` and
    `stations[i + 1]`. Trains run in both directions unless `one_way` is set.
    """
    name: str
    stations: List[str]
    minutes: List[int]
    one_way: bool = False

    def __post_init__(self):
        if len(self.stations) < 2:
            raise ValueError(f"line {self.name} needs at least two stations")
        if len(self.minutes) != len(self.stations) - 1:
            raise ValueError(f"line {self.name} needs one running time per pair of stops")

    def segments(self) -> Iterator[Segment]:
        """Yield each hop between consecutive stops, in timetable order."""
        for index, minutes in enumerate(self.minutes):
            yield Segment(self.stations[index], self.stations[index + 1], minutes)

    @property
    def running_time(self):
        """Minutes from the first stop to the last."""
        return sum(self.minutes)


@dataclass(frozen=True)
class Leg:
    """A continuous ride on one line.

    `stations` runs from the boarding station to the alighting station
    inclusive; `minutes` is the riding time of this leg only.
    """
    line: str
    stations: Tuple[str, ...]
    minutes: int

    @property
    def origin(self):
        return self.stations[0]

    @property
    def destination(self):
        return self.stations[-1]

    @property
    def stops(self):
        return len(self.stations) - 1


@dataclass(frozen=True)
class Journey:
    """A planned trip: legs in travel order and the transfer penalty used to plan it."""
    origin: str
    destination: str
    legs: Tuple[Leg, ...] = ()
    transfer_minutes: int = DEFAULT_TRANSFER_MINUTES

    @property
    def transfers(self):
        return max(len(self.legs) - 1, 0)

    @property
    def riding_minutes(self):
        return sum(leg.minutes for leg in self.legs)

    @property
    def total_minutes(self):
        return self.riding_minutes + self.transfers * self.transfer_minutes
