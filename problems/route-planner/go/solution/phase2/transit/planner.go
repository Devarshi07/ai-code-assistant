package transit

import "slices"

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

// notBoarded is the line of the starting state: the rider has not boarded
// anything yet.
const notBoarded = ""

// stateKey identifies a search state: standing at a station, having arrived
// on a line.
type stateKey struct {
	station string
	line    string
}

// searchState is the best known way to reach a state, with a parent pointer
// for the route.
type searchState struct {
	stateKey
	minutes   int
	transfers int
	previous  *searchState
	via       Connection // the connection ridden to get here
}

// before is the search order: fewer minutes, then fewer transfers, then
// station and line name.
func (s *searchState) before(other *searchState) bool {
	if s.minutes != other.minutes {
		return s.minutes < other.minutes
	}
	if s.transfers != other.transfers {
		return s.transfers < other.transfers
	}
	if s.station != other.station {
		return s.station < other.station
	}
	return s.line < other.line
}

// FastestJourney returns the quickest journey from origin to destination.
//
// Riding time is the sum of segment minutes. Every change of line costs
// transferMinutes (callers usually pass DefaultTransferMinutes); boarding the
// first line is free. Among equally quick journeys, the one with fewer
// transfers wins. It returns a Journey with no legs when origin ==
// destination, nil when the destination cannot be reached, and an
// *UnknownStationError for an unknown station name.
//
// Dijkstra's algorithm over (station, line) states: the cost of the next hop
// depends on the line the rider is already on.
func FastestJourney(network *Network, origin, destination string, transferMinutes int) (*Journey, error) {
	if _, err := network.Station(origin); err != nil {
		return nil, err
	}
	if _, err := network.Station(destination); err != nil {
		return nil, err
	}
	if origin == destination {
		return &Journey{Origin: origin, Destination: destination, TransferMinutes: transferMinutes}, nil
	}

	start := &searchState{stateKey: stateKey{origin, notBoarded}}
	states := map[stateKey]*searchState{start.stateKey: start} // best known state per key
	settled := map[stateKey]bool{}
	for {
		// Pick the cheapest state that is not settled yet.
		var current *searchState
		for key, state := range states {
			if settled[key] {
				continue
			}
			if current == nil || state.before(current) {
				current = state
			}
		}
		if current == nil {
			return nil, nil
		}
		settled[current.stateKey] = true
		if current.station == destination {
			return buildJourney(origin, destination, current, transferMinutes), nil
		}

		for _, connection := range network.ConnectionsFrom(current.station) {
			key := stateKey{connection.To, connection.Line}
			if settled[key] {
				continue
			}
			changes := current.line != notBoarded && connection.Line != current.line
			minutes, transfers := current.minutes+connection.Minutes, current.transfers
			if changes {
				minutes += transferMinutes
				transfers++
			}
			if known, ok := states[key]; ok && (known.minutes < minutes || (known.minutes == minutes && known.transfers <= transfers)) {
				continue
			}
			states[key] = &searchState{stateKey: key, minutes: minutes, transfers: transfers, previous: current, via: connection}
		}
	}
}

// buildJourney walks the parent pointers back and groups consecutive hops by
// line.
func buildJourney(origin, destination string, state *searchState, transferMinutes int) *Journey {
	var hops []*searchState
	for at := state; at.previous != nil; at = at.previous {
		hops = append(hops, at)
	}
	slices.Reverse(hops)

	var legs []Leg
	for _, hop := range hops {
		if len(legs) == 0 || legs[len(legs)-1].Line != hop.via.Line {
			legs = append(legs, Leg{Line: hop.via.Line, Stations: []string{hop.previous.station}})
		}
		leg := &legs[len(legs)-1]
		leg.Stations = append(leg.Stations, hop.via.To)
		leg.Minutes += hop.via.Minutes
	}
	return &Journey{Origin: origin, Destination: destination, Legs: legs, TransferMinutes: transferMinutes}
}
