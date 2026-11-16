package transit

import (
	"errors"
	"slices"
)

// FewestStops is a breadth-first search for the route with the fewest stops,
// ignoring lines. It powers the "quick route" panel in the rider app.
//
// It returns the station names from origin to destination inclusive, or nil
// when there is no route. Unknown station names return an *UnknownStationError.
func FewestStops(network *Network, origin, destination string) ([]string, error) {
	if _, err := network.Station(origin); err != nil {
		return nil, err
	}
	if _, err := network.Station(destination); err != nil {
		return nil, err
	}
	if origin == destination {
		return []string{origin}, nil
	}
	cameFrom := map[string]string{origin: ""}
	queue := []string{origin}
	for head := 0; head < len(queue); head++ {
		for _, connection := range network.ConnectionsFrom(queue[head]) {
			next := connection.To
			if _, seen := cameFrom[next]; seen {
				continue
			}
			cameFrom[next] = queue[head]
			if next == destination {
				return walkBack(cameFrom, origin, next), nil
			}
			queue = append(queue, next)
		}
	}
	return nil, nil
}

func walkBack(cameFrom map[string]string, origin, station string) []string {
	route := []string{station}
	for station != origin {
		station = cameFrom[station]
		route = append(route, station)
	}
	slices.Reverse(route)
	return route
}

// FastestJourney returns the quickest journey from origin to destination.
//
// Riding time is the sum of segment minutes. Every change of line costs
// transferMinutes (callers usually pass DefaultTransferMinutes); boarding the
// first line is free. Among equally quick journeys, the one with fewer
// transfers wins. It returns a Journey with no legs when origin ==
// destination, nil when the destination cannot be reached, and an
// *UnknownStationError for an unknown station name.
func FastestJourney(network *Network, origin, destination string, transferMinutes int) (*Journey, error) {
	return nil, errors.New("phase 2: FastestJourney is not implemented yet")
}
