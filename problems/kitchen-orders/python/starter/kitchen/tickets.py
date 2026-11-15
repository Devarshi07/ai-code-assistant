"""Parser for the ticket printer log.

One ticket per line:

    11:58am order 106: caesar salad, 2x fries | app | due 12:20pm

* The stamp is when the ticket was rung in (see clock.py).
* Dishes are comma separated. "2x fries" means two portions of fries.
* Optional flags follow a '|': "app" marks a delivery-app order, which the
  cooks take first, and "due <time>" is the ready time promised to the guest.

Blank lines and lines starting with '#' are ignored.
"""
import re

from .clock import ClockError, parse_clock
from .orders import Order

_TICKET = re.compile(r"^(?P<stamp>\S+)\s+order\s+(?P<id>\d+)\s*:\s*(?P<body>.*)$", re.IGNORECASE)
_PORTIONS = re.compile(r"^(\d+)\s*x\s+(.+)$", re.IGNORECASE)


class TicketError(ValueError):
    """A log line that could not be read. Carries the 1-based line number."""

    def __init__(self, line_number, message):
        super().__init__(f"line {line_number}: {message}")
        self.line_number = line_number


def parse_dishes(text):
    """'burger, 2x fries' -> ['burger', 'fries', 'fries']."""
    dishes = []
    for part in text.split(","):
        part = " ".join(part.split()).lower()
        if not part:
            continue
        match = _PORTIONS.match(part)
        if match:
            dishes.extend([match.group(2)] * int(match.group(1)))
        else:
            dishes.append(part)
    return dishes


def parse_ticket(line, line_number=1):
    """Parse a single log line into an Order."""
    match = _TICKET.match(line.strip())
    if not match:
        raise TicketError(line_number, f"expected '<time> order <id>: <dishes>', got {line.strip()!r}")
    body, *flags = match.group("body").split("|")
    try:
        arrival = parse_clock(match.group("stamp"))
        priority, due = False, None
        for flag in (f.strip().lower() for f in flags):
            if flag == "app":
                priority = True
            elif flag.startswith("due "):
                due = parse_clock(flag[4:])
            else:
                raise TicketError(line_number, f"unknown flag {flag!r}")
    except ClockError as exc:
        raise TicketError(line_number, str(exc)) from None
    dishes = parse_dishes(body)
    if not dishes:
        raise TicketError(line_number, "ticket has no dishes")
    return Order(int(match.group("id")), arrival, dishes, priority, due)


def parse_log(text):
    """Parse a whole log into the ticket rail.

    The rail lists orders by arrival time. Tickets rung in during the same
    minute keep their printer order. Order ids must be unique.
    """
    orders, seen = [], set()
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        order = parse_ticket(line, number)
        if order.id in seen:
            raise TicketError(number, f"order {order.id} appears twice")
        seen.add(order.id)
        orders.append(order)
    orders.sort(key=lambda order: order.arrival)
    return orders
