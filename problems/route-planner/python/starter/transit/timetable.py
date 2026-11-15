"""Loads a Network from the plain-text timetable format used by the scheduling team.

    # Harbour City weekday service
    line Red: Airport 4 Central 3 Harbor 6 Museum
    line Ferry oneway: Harbor 8 Island Pier 5 Lighthouse

Each entry lists the stations of one line, separated by the running time in
minutes to the next stop. Station names may contain spaces but must not be
plain numbers. Lines run both ways unless the name is followed by `oneway`.
Everything after a `#` is a comment.
"""
from .models import Line
from .network import Network

ONE_WAY_FLAG = "oneway"


class TimetableError(ValueError):
    """A malformed timetable entry, reported with its line number."""

    def __init__(self, line_number, message):
        super().__init__(f"line {line_number}: {message}")
        self.line_number = line_number


def parse_entry(text, line_number=1):
    """Parse one `line <name> [oneway]: <stops>` entry into a Line."""
    header, colon, body = text.partition(":")
    words = header.split()
    if not colon or not words or words[0] != "line":
        raise TimetableError(line_number, "expected 'line <name>: <stations>'")
    words = words[1:]
    one_way = bool(words) and words[-1] == ONE_WAY_FLAG
    if one_way:
        words = words[:-1]
    if not words:
        raise TimetableError(line_number, "the line has no name")
    stations, minutes = _parse_stops(body, line_number)
    return Line(" ".join(words), stations, minutes, one_way)


def _parse_stops(body, line_number):
    stations, minutes, name = [], [], []
    for token in body.split():
        if not token.isdigit():
            name.append(token)
            continue
        if not name:
            raise TimetableError(line_number, f"running time {token} must follow a station name")
        if int(token) < 1:
            raise TimetableError(line_number, "running times must be at least 1 minute")
        stations.append(" ".join(name))
        minutes.append(int(token))
        name = []
    if not name:
        raise TimetableError(line_number, "a line must end with a station name")
    stations.append(" ".join(name))
    if len(stations) < 2:
        raise TimetableError(line_number, "a line needs at least two stations")
    return stations, minutes


def load_network(text, name="network"):
    """Build a Network from timetable text."""
    network = Network(name)
    for number, raw in enumerate(text.splitlines(), start=1):
        content = raw.split("#", 1)[0].strip()
        if not content:
            continue
        line = parse_entry(content, number)
        if line.name in network.lines:
            raise TimetableError(number, f"duplicate line {line.name!r}")
        network.add_line(line)
    return network
