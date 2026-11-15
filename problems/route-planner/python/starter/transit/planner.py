"""Journey planning over a Network."""
from collections import deque
from typing import List, Optional

from .models import DEFAULT_TRANSFER_MINUTES, Journey


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
    """
    raise NotImplementedError("Phase 2: fastest_journey is not implemented yet")
