"""Human-readable output for the rider app and the command line."""


def _plural(count, word):
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def format_stops(route):
    """'Airport -> Central -> Harbor (2 stops)' for a fewest-stops route."""
    if route is None:
        return "no route"
    return f"{' -> '.join(route)} ({_plural(len(route) - 1, 'stop')})"


def format_journey(journey):
    """One-sentence itinerary, as shown in the journey card.

    Take Red from Airport to Central (4 min), transfer (5 min), take Blue
    from Central to Museum (7 min). Total 16 min, 1 transfer.
    """
    if journey is None:
        return "No journey found."
    if not journey.legs:
        return f"You are already at {journey.origin}."
    parts = []
    for index, leg in enumerate(journey.legs):
        if index:
            parts.append(f"transfer ({journey.transfer_minutes} min)")
        verb = "take" if index else "Take"
        parts.append(f"{verb} {leg.line} from {leg.origin} to {leg.destination} ({leg.minutes} min)")
    return (f"{', '.join(parts)}. Total {journey.total_minutes} min, "
            f"{_plural(journey.transfers, 'transfer')}.")


def format_itinerary(journey):
    """Multi-line itinerary with one row per leg, for the detail view."""
    if journey is None or not journey.legs:
        return format_journey(journey)
    width = max(len(leg.line) for leg in journey.legs)
    rows = []
    for index, leg in enumerate(journey.legs):
        if index:
            rows.append(f"  {'':<{width}}  change at {leg.origin} ({journey.transfer_minutes} min)")
        rows.append(f"  {leg.line:<{width}}  {leg.origin} -> {leg.destination}"
                    f"  {leg.minutes} min, {_plural(leg.stops, 'stop')}")
    rows.append(f"  {'':<{width}}  arrive after {journey.total_minutes} min")
    return "\n".join(rows)


def describe_network(network):
    """A short summary of every line, in timetable order."""
    rows = [f"{network.name}: {len(network.stations)} stations, {len(network.lines)} lines"]
    width = max((len(name) for name in network.lines), default=0)
    for line in network.lines.values():
        first, last = line.stations[0], line.stations[-1]
        route = f"{first} (loop)" if first == last else f"{first} - {last}"
        direction = "one-way" if line.one_way else "two-way"
        rows.append(f"  {line.name:<{width}}  {route}"
                    f"  ({_plural(len(line.stations), 'station')}, {line.running_time} min, {direction})")
    return "\n".join(rows)
