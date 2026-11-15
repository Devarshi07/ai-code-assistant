"""Plain-text reports for the expo screen and the end-of-service email."""
from .clock import format_clock, format_duration


def _flags(order):
    flags = []
    if order.priority:
        flags.append("app")
    if order.due is not None:
        flags.append(f"due {format_clock(order.due)}")
    return f"  [{', '.join(flags)}]" if flags else ""


def rail(orders, menu):
    """The ticket rail as the line sees it: one row per order with its quote."""
    return [
        f"{order.id:>5}  {format_clock(order.arrival):>7}  quote {format_clock(order.quote(menu)):<11}"
        f"{', '.join(order.dishes)}{_flags(order)}"
        for order in orders
    ]


def station_load(orders, menu, stations):
    """{station: (dish count, cooking minutes)} for the whole service."""
    load = {station.name: [0, 0] for station in stations}
    for order in orders:
        for dish in order.dishes:
            item = menu[dish]
            entry = load.setdefault(item.station, [0, 0])
            entry[0] += 1
            entry[1] += item.prep
    return {name: tuple(entry) for name, entry in load.items()}


def utilisation(orders, menu, stations, ready):
    """Share of each station's cook-minutes spent cooking, first ticket to last plate."""
    span = max(max(ready.values()) - min(order.arrival for order in orders), 1)
    load = station_load(orders, menu, stations)
    return {s.name: load[s.name][1] / (s.cooks * span) for s in stations}


def service_report(title, orders, menu, stations, run):
    """Per-order ready times and lateness, then how hard each station worked."""
    late = dict(run.late)
    first = min(order.arrival for order in orders)
    last = max(run.ready.values())
    dishes = sum(len(order.dishes) for order in orders)
    lines = [
        f"{title}: {len(orders)} orders, {dishes} dishes, "
        f"first ticket {format_clock(first)}, last plate {format_clock(last)}",
        "",
        "order  in       ready      wait  due      status",
    ]
    for order in sorted(orders, key=lambda o: (o.arrival, o.id)):
        ready = run.ready[order.id]
        due = format_clock(order.due) if order.due is not None else ""
        if order.id in late:
            status = f"LATE {format_duration(late[order.id])}"
        elif order.due is not None:
            status = "on time"
        else:
            status = ""
        if order.priority:
            status = f"{status}, app" if status else "app"
        lines.append(f"{order.id:>5}  {format_clock(order.arrival):>7}  {format_clock(ready):<9}"
                     f"{format_duration(ready - order.arrival):>6}  {due:<7}  {status}".rstrip())

    promised = sum(1 for order in orders if order.due is not None)
    waits = {order.id: run.ready[order.id] - order.arrival for order in orders}
    longest = max(waits, key=lambda oid: (waits[oid], -oid))
    lines += [
        "",
        f"{len(late)} of {promised} promised orders late ({format_duration(sum(late.values()))} in total). "
        f"Longest wait: {format_duration(waits[longest])} (order {longest}).",
        "",
        "station  cooks  dishes  cooking   busy",
    ]
    load = station_load(orders, menu, stations)
    shares = utilisation(orders, menu, stations, run.ready)
    for station in stations:
        count, minutes = load[station.name]
        lines.append(f"{station.name:<8} {station.cooks:>5}  {count:>6}  {format_duration(minutes):>7}"
                     f"  {shares[station.name]:>5.0%}")
    return "\n".join(lines)
