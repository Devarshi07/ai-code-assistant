"""Journey planning over a Network."""
from collections import deque
from typing import List, Optional

from .models import DEFAULT_TRANSFER_MINUTES, Journey, Leg

# The line of the starting state: the rider has not boarded anything yet.
NOT_BOARDED = ""


def fewest_stops(network, origin, destination) -> Optional[List[str]]:
    """Breadth-first search for the route with the fewest stops, ignoring lines.

    Powers the "quick route" panel in the rider app. Returns the station
    names from origin to destination inclusive, or None when there is no
    route. Unknown station names raise UnknownStationError.
    """
    network.station(origin)
    network.station(destination)
    if origin == destination:
        return [origin]
    came_from = {origin: None}
    queue = deque([origin])
    while queue:
        current = queue.popleft()
        for connection in network.connections_from(current):
            nxt = connection.to
            if nxt in came_from:
                continue
            came_from[nxt] = current
            if nxt == destination:
                return _walk_back(came_from, nxt)
            queue.append(nxt)
    return None


def _walk_back(came_from, station):
    route = [station]
    while came_from[route[-1]] is not None:
        route.append(came_from[route[-1]])
    route.reverse()
    return route


def fastest_journey(network, origin, destination,
                    transfer_minutes=DEFAULT_TRANSFER_MINUTES) -> Optional[Journey]:
    """The quickest journey from origin to destination.

    Riding time is the sum of segment minutes. Every change of line costs
    `transfer_minutes`; boarding the first line is free. Among equally quick
    journeys, the one with fewer transfers wins. Returns a Journey with no
    legs when origin == destination, or None when the destination cannot be
    reached.

    Dijkstra's algorithm over (station, line) states: the cost of the next
    hop depends on the line the rider is already on. Costs are compared as
    (minutes, transfers) pairs; remaining ties go to the smaller state.
    """
    network.station(origin)
    network.station(destination)
    if origin == destination:
        return Journey(origin, destination, (), transfer_minutes)

    start = (origin, NOT_BOARDED)
    cost = {start: (0, 0)}         # state -> best known (minutes, transfers)
    came_from = {start: None}      # state -> (previous state, connection ridden)
    settled = set()
    while True:
        # Pick the cheapest state that is not settled yet.
        current, best = None, None
        for state, value in cost.items():
            if state in settled:
                continue
            if current is None or value < best or (value == best and state < current):
                current, best = state, value
        if current is None:
            return None
        settled.add(current)
        station, line = current
        if station == destination:
            return _build_journey(origin, destination, current, came_from, transfer_minutes)

        minutes, transfers = best
        for connection in network.connections_from(station):
            nxt = (connection.to, connection.line)
            if nxt in settled:
                continue
            changes = line != NOT_BOARDED and connection.line != line
            value = (minutes + connection.minutes + (transfer_minutes if changes else 0),
                     transfers + (1 if changes else 0))
            if nxt not in cost or value < cost[nxt]:
                cost[nxt] = value
                came_from[nxt] = (current, connection)


def _build_journey(origin, destination, state, came_from, transfer_minutes):
    """Walk the parent pointers back and group consecutive hops by line."""
    hops = []
    while came_from[state] is not None:
        previous, connection = came_from[state]
        hops.append((previous[0], connection))
        state = previous
    hops.reverse()

    legs, stations, minutes, line = [], [], 0, None
    for boarded_at, connection in hops:
        if connection.line != line:
            if line is not None:
                legs.append(Leg(line, tuple(stations), minutes))
            line, stations, minutes = connection.line, [boarded_at], 0
        stations.append(connection.to)
        minutes += connection.minutes
    legs.append(Leg(line, tuple(stations), minutes))
    return Journey(origin, destination, tuple(legs), transfer_minutes)
