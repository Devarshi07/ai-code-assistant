"""Prints the planner's answers for a few common Harbour City trips."""
from transit import describe_network, fastest_journey, fewest_stops, format_itinerary, format_stops
from transit.samples import load_harbour_city

TRIPS = [
    ("Airport", "Museum"),
    ("Museum", "Airport"),
    ("Airport", "Science Park"),
    ("Old Town", "Island Pier"),
    ("Lighthouse", "City Hall"),
]


def main():
    network = load_harbour_city()
    print(describe_network(network))

    print("\nQuick routes (fewest stops)")
    for origin, destination in TRIPS:
        print(f"  {origin} to {destination}: {format_stops(fewest_stops(network, origin, destination))}")

    print("\nFastest journeys (5 min to change lines)")
    for origin, destination in TRIPS:
        print(f"{origin} to {destination}")
        try:
            journey = fastest_journey(network, origin, destination)
        except NotImplementedError as exc:
            print(f"  {exc}")
            break
        print(format_itinerary(journey) if journey else "  no journey")


if __name__ == "__main__":
    main()
