import java.util.List;

import transit.Formatting;
import transit.Journey;
import transit.Network;
import transit.Planner;
import transit.Samples;

/** Prints the planner's answers for a few common Harbour City trips. */
public class Main {
    private record Trip(String origin, String destination) {
    }

    private static final List<Trip> TRIPS = List.of(
            new Trip("Airport", "Museum"),
            new Trip("Museum", "Airport"),
            new Trip("Airport", "Science Park"),
            new Trip("Old Town", "Island Pier"),
            new Trip("Lighthouse", "City Hall"));

    public static void main(String[] args) {
        Network network = Samples.loadHarbourCity();
        System.out.println(Formatting.describeNetwork(network));

        System.out.println("\nQuick routes (fewest stops)");
        for (Trip trip : TRIPS) {
            List<String> route = Planner.fewestStops(network, trip.origin(), trip.destination());
            System.out.println("  " + trip.origin() + " to " + trip.destination() + ": " + Formatting.formatStops(route));
        }

        System.out.println("\nFastest journeys (5 min to change lines)");
        for (Trip trip : TRIPS) {
            System.out.println(trip.origin() + " to " + trip.destination());
            Journey journey;
            try {
                journey = Planner.fastestJourney(network, trip.origin(), trip.destination());
            } catch (UnsupportedOperationException error) {
                System.out.println("  " + error.getMessage());
                break;
            }
            System.out.println(journey != null ? Formatting.formatItinerary(journey) : "  no journey");
        }
    }
}
