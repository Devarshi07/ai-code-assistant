// Command route-planner prints the planner's answers for a few common Harbour
// City trips.
package main

import (
	"fmt"
	"log"

	"debuggym/route-planner/transit"
)

var trips = []struct{ origin, destination string }{
	{"Airport", "Museum"},
	{"Museum", "Airport"},
	{"Airport", "Science Park"},
	{"Old Town", "Island Pier"},
	{"Lighthouse", "City Hall"},
}

func main() {
	network, err := transit.LoadHarbourCity()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(transit.DescribeNetwork(network))

	fmt.Println("\nQuick routes (fewest stops)")
	for _, trip := range trips {
		route, err := transit.FewestStops(network, trip.origin, trip.destination)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("  %s to %s: %s\n", trip.origin, trip.destination, transit.FormatStops(route))
	}

	fmt.Println("\nFastest journeys (5 min to change lines)")
	for _, trip := range trips {
		fmt.Printf("%s to %s\n", trip.origin, trip.destination)
		journey, err := transit.FastestJourney(network, trip.origin, trip.destination, transit.DefaultTransferMinutes)
		if err != nil {
			fmt.Printf("  %v\n", err)
			break
		}
		if journey == nil {
			fmt.Println("  no journey")
			continue
		}
		fmt.Println(transit.FormatItinerary(journey))
	}
}
