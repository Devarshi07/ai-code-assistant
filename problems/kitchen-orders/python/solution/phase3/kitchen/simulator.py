"""Kitchen simulation: when will each order really be ready?

The host-stand quote (Order.quote) assumes every station is idle. On a busy
service, dishes queue at their station behind other tickets, so expo needs a
simulation of the line.

House rules, as agreed with the head chef:

1. When an order arrives, each of its dishes joins the queue of its station.
2. A station has `cooks` identical cooks. A cook makes one dish at a time,
   start to finish, which takes the dish's prep minutes.
3. A free cook always takes the waiting dish that ranks first: delivery-app
   orders before everything else, then the earliest order arrival, then the
   lowest order id, then the dish's position on its ticket.
4. Everything that happens in a minute (cooks finishing, orders arriving)
   counts before free cooks pick their next dish in that minute. A cook who
   finishes at 12:10pm can start another dish at 12:10pm.
5. An order is ready when its last dish is finished.
"""
from heapq import heappop, heappush
from typing import Dict, List, NamedTuple, Tuple


class KitchenRun(NamedTuple):
    """Outcome of one simulated service."""
    ready: Dict[int, int]          # order id -> minute its last dish finished
    late: List[Tuple[int, int]]    # (order id, minutes late), ascending order id


def simulate(orders, menu, stations) -> KitchenRun:
    """Run the service described by `orders` through the kitchen line.

    `menu` maps dish names to MenuItems, and `stations` lists the Station
    objects of the line. Orders may be given in any order.

    Stations never share cooks or dishes, so each one is simulated on its own
    as a discrete-event loop (see _run_station). An order's ready time is the
    latest finish over all of its dishes. O(D log D) for D dishes.
    """
    cooks = {station.name: station.cooks for station in stations}
    tickets = {name: [] for name in cooks}       # every dish bound for each station
    for order in orders:
        app_last = not order.priority
        for position, dish in enumerate(order.dishes):
            item = menu[dish]
            if item.station not in cooks:
                raise KeyError(f"{dish!r} needs station {item.station!r}, which is not on the line")
            tickets[item.station].append((order.arrival, app_last, order.id, position, item.prep))

    ready = {}
    for name, dishes in tickets.items():
        dishes.sort()
        _run_station(dishes, cooks[name], ready)

    late = sorted((order.id, ready[order.id] - order.due) for order in orders
                  if order.due is not None and ready[order.id] > order.due)
    return KitchenRun(ready, late)


def _run_station(dishes, cooks, ready):
    """Simulate one station. `dishes` is sorted by arrival; updates `ready` in place.

    waiting: heap of queued dishes keyed by house-rule rank.
    stove:   heap of finish minutes of the dishes being cooked.
    The clock only visits minutes where something happens: the next arrival
    when nothing is queued, or the next cook finishing when nobody is free.
    """
    waiting, stove = [], []
    free = cooks
    clock, i, n = 0, 0, len(dishes)
    while i < n or waiting:
        if not waiting:
            clock = max(clock, dishes[i][0])
        elif not free:
            clock = max(clock, stove[0])
        while stove and stove[0] <= clock:
            heappop(stove)
            free += 1
        while i < n and dishes[i][0] <= clock:
            arrival, app_last, order_id, position, prep = dishes[i]
            heappush(waiting, (app_last, arrival, order_id, position, prep))
            i += 1
        while free and waiting:
            _, _, order_id, _, prep = heappop(waiting)
            done = clock + prep
            heappush(stove, done)
            free -= 1
            if ready.get(order_id, -1) < done:
                ready[order_id] = done
