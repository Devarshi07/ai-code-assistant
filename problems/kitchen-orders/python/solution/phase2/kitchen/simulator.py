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
from collections import defaultdict
from typing import Dict, List, NamedTuple, Tuple


class KitchenRun(NamedTuple):
    """Outcome of one simulated service."""
    ready: Dict[int, int]          # order id -> minute its last dish finished
    late: List[Tuple[int, int]]    # (order id, minutes late), ascending order id


def simulate(orders, menu, stations) -> KitchenRun:
    """Run the service described by `orders` through the kitchen line.

    `menu` maps dish names to MenuItems, and `stations` lists the Station
    objects of the line. Orders may be given in any order.

    The clock advances one minute at a time. Each minute, newly arrived dishes
    join their station's queue, cooks whose dish is done are released, and
    every free cook takes the best-ranked waiting dish.
    """
    cooks = {station.name: station.cooks for station in stations}
    arrivals = defaultdict(list)                 # minute -> orders rung in then
    for order in orders:
        arrivals[order.arrival].append(order)
    waiting = {name: [] for name in cooks}       # queued dishes per station
    stoves = {name: [] for name in cooks}        # finish minute of each dish cooking
    ready = {}
    left = sum(len(order.dishes) for order in orders)
    clock = min(arrivals) if arrivals else 0

    while left:
        for order in arrivals.get(clock, ()):
            for position, dish in enumerate(order.dishes):
                item = menu[dish]
                if item.station not in cooks:
                    raise KeyError(f"{dish!r} needs station {item.station!r}, which is not on the line")
                # Tuples compare in house-rule order: app orders first, then
                # arrival, order id and ticket position. Prep rides along.
                waiting[item.station].append((not order.priority, order.arrival, order.id, position, item.prep))
        for name, queue in waiting.items():
            stove = stoves[name] = [done for done in stoves[name] if done > clock]
            while queue and len(stove) < cooks[name]:
                dish = min(queue)
                queue.remove(dish)
                done = clock + dish[4]
                stove.append(done)
                order_id = dish[2]
                ready[order_id] = max(ready.get(order_id, done), done)
                left -= 1
        clock += 1

    late = sorted((order.id, ready[order.id] - order.due) for order in orders
                  if order.due is not None and ready[order.id] > order.due)
    return KitchenRun(ready, late)
