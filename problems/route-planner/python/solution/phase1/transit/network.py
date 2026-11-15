"""The transit network: stations, lines and the directed connections between them."""
from .models import Connection, Station


class UnknownStationError(KeyError):
    """Raised when a query names a station that is not in the network."""

    def __str__(self):
        return f"unknown station: {self.args[0]!r}"


class Network:
    """Stations and lines loaded from a timetable.

    Connections are directed: a two-way line contributes one connection in
    each direction for every segment, a one-way line only the timetable
    direction.
    """

    def __init__(self, name="network"):
        self.name = name
        self.stations = {}        # station name -> Station
        self.lines = {}           # line name -> Line
        self._connections = {}    # station name -> [Connection, ...]

    def add_line(self, line):
        if line.name in self.lines:
            raise ValueError(f"duplicate line {line.name!r}")
        self.lines[line.name] = line
        for name in line.stations:
            self._ensure_station(name).add_line(line.name)

        # segments() is a generator, so materialise it: both loops need every hop.
        segments = list(line.segments())
        for segment in segments:
            self._connect(segment.origin, Connection(segment.destination, line.name, segment.minutes))
        if not line.one_way:
            # Trains run back along the same track, with the same running times.
            for segment in segments:
                self._connect(segment.destination, Connection(segment.origin, line.name, segment.minutes))

    def _ensure_station(self, name):
        if name not in self.stations:
            self.stations[name] = Station(name)
            self._connections[name] = []
        return self.stations[name]

    def _connect(self, origin, connection):
        self._connections[origin].append(connection)

    def station(self, name):
        """Look up a station by name, raising UnknownStationError if it does not exist."""
        try:
            return self.stations[name]
        except KeyError:
            raise UnknownStationError(name) from None

    def connections_from(self, name):
        """Every connection leaving the named station, across all lines.

        The list is shared with the network; treat it as read-only.
        """
        self.station(name)
        return self._connections[name]

    def neighbours(self, name):
        """Names of the stations one hop away, sorted."""
        return sorted({connection.to for connection in self.connections_from(name)})

    def lines_at(self, name):
        return list(self.station(name).lines)

    def __contains__(self, name):
        return name in self.stations

    def __len__(self):
        return len(self.stations)

    def __repr__(self):
        return f"Network({self.name!r}, {len(self.stations)} stations, {len(self.lines)} lines)"
