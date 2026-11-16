package tests

import (
	"errors"
	"reflect"
	"slices"
	"testing"

	"debuggym/route-planner/transit"
)

// Pier to Point: 12 min on Coastal with no change, or 4 min of riding on
// Hopper + Uptown with one change at Market.
const coast = `
line Coastal: Pier 3 Beach 3 Cliffs 3 Dunes 3 Point
line Hopper: Pier 2 Market
line Uptown: Market 2 Point
`

// The Shuttle reaches Bridge first, but only the Local continues to Quarry.
const valley = `
line Local: Dock 2 Mill 2 Bridge 2 Quarry
line Shuttle: Dock 1 Depot 1 Bridge
`

// The cable car only goes up, and the coast road is a separate network.
const mountain = `
line Valley: North Gate 4 Mill 3 South Gate
line Cable Car oneway: Mill 12 Summit
line Coast Road: Harbour 6 Lighthouse
`

// hopMinutes returns the running time of one hop a -> b on the named line,
// read from the timetable data, and false if the line has no such hop.
func hopMinutes(network *transit.Network, lineName, a, b string) (int, bool) {
	line, ok := network.Line(lineName)
	if !ok {
		return 0, false
	}
	for i, minutes := range line.Minutes {
		x, y := line.Stations[i], line.Stations[i+1]
		if (x == a && y == b) || (!line.OneWay && y == a && x == b) {
			return minutes, true
		}
	}
	return 0, false
}

// assertLegsChain checks that the legs chain from origin to destination over
// real hops, with consistent minutes.
func assertLegsChain(t *testing.T, network *transit.Network, journey *transit.Journey, origin, destination string, transferMinutes int) {
	t.Helper()
	if journey.Origin != origin || journey.Destination != destination {
		t.Fatalf("the journey runs from %s to %s, want %s to %s", journey.Origin, journey.Destination, origin, destination)
	}
	here := origin
	total := 0
	for i, leg := range journey.Legs {
		if len(leg.Stations) < 2 {
			t.Fatalf("leg %d must ride at least one hop", i+1)
		}
		if leg.Stations[0] != here {
			t.Fatalf("leg %d must start where the journey is (%s), not at %s", i+1, here, leg.Stations[0])
		}
		if i > 0 && leg.Line == journey.Legs[i-1].Line {
			t.Fatalf("consecutive hops on one line belong in one leg (%s)", leg.Line)
		}
		riding := 0
		for s := 1; s < len(leg.Stations); s++ {
			minutes, ok := hopMinutes(network, leg.Line, leg.Stations[s-1], leg.Stations[s])
			if !ok {
				t.Fatalf("%s does not run from %s to %s", leg.Line, leg.Stations[s-1], leg.Stations[s])
			}
			riding += minutes
		}
		if leg.Minutes != riding {
			t.Fatalf("leg %d on %s rides %d min, but its Minutes is %d", i+1, leg.Line, riding, leg.Minutes)
		}
		total += leg.Minutes
		here = leg.Stations[len(leg.Stations)-1]
	}
	if here != destination {
		t.Fatalf("the last leg must end at the destination (%s), not at %s", destination, here)
	}
	changes := max(len(journey.Legs)-1, 0)
	if journey.Transfers() != changes {
		t.Fatalf("Transfers() = %d, want %d", journey.Transfers(), changes)
	}
	if want := total + changes*transferMinutes; journey.TotalMinutes() != want {
		t.Fatalf("TotalMinutes() = %d, want %d", journey.TotalMinutes(), want)
	}
}

// assertValidJourney checks that there is a journey, planned with this
// transfer penalty, whose legs chain from origin to destination.
func assertValidJourney(t *testing.T, network *transit.Network, journey *transit.Journey, origin, destination string, transferMinutes int) {
	t.Helper()
	if journey == nil {
		t.Fatalf("there is a journey from %s to %s, but FastestJourney returned nil", origin, destination)
	}
	if journey.TransferMinutes != transferMinutes {
		t.Fatalf("TransferMinutes = %d, want %d", journey.TransferMinutes, transferMinutes)
	}
	assertLegsChain(t, network, journey, origin, destination, transferMinutes)
}

// ride is one leg as (line, stations, minutes), for comparing whole journeys.
type ride struct {
	line     string
	stations []string
	minutes  int
}

func assertRides(t *testing.T, journey *transit.Journey, want ...ride) {
	t.Helper()
	var got []ride
	for _, leg := range journey.Legs {
		got = append(got, ride{leg.Line, slices.Clone(leg.Stations), leg.Minutes})
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got legs %v, want %v", got, want)
	}
}

func lineNames(journey *transit.Journey) []string {
	var names []string
	for _, leg := range journey.Legs {
		names = append(names, leg.Line)
	}
	return names
}

func assertMinutes(t *testing.T, journey *transit.Journey, minutes int) {
	t.Helper()
	if got := journey.TotalMinutes(); got != minutes {
		t.Errorf("%s to %s: got %d min, want %d", journey.Origin, journey.Destination, got, minutes)
	}
}

func assertCost(t *testing.T, journey *transit.Journey, minutes, transfers int) {
	t.Helper()
	if journey.TotalMinutes() != minutes || journey.Transfers() != transfers {
		t.Errorf("got %d min with %d transfers, want %d min with %d transfers", journey.TotalMinutes(), journey.Transfers(), minutes, transfers)
	}
}

// plan finds the fastest journey and checks that it is valid.
func plan(t *testing.T, network *transit.Network, origin, destination string, transferMinutes int) *transit.Journey {
	t.Helper()
	journey, err := transit.FastestJourney(network, origin, destination, transferMinutes)
	if err != nil {
		t.Fatalf("FastestJourney(%q, %q, %d): %v", origin, destination, transferMinutes, err)
	}
	assertValidJourney(t, network, journey, origin, destination, transferMinutes)
	return journey
}

func TestPhase2SingleLineTripHasNoBoardingPenalty(t *testing.T) {
	journey := plan(t, harbourCity(t), "Airport", "Museum", 5)
	assertMinutes(t, journey, 13)
	assertRides(t, journey, ride{"Red", []string{"Airport", "Central", "Harbor", "Museum"}, 13})
}

func TestPhase2DefaultTransferPenaltyIsFiveMinutes(t *testing.T) {
	network := harbourCity(t)
	journey, err := transit.FastestJourney(network, "Airport", "Science Park", transit.DefaultTransferMinutes)
	if err != nil {
		t.Fatal(err)
	}
	assertValidJourney(t, network, journey, "Airport", "Science Park", 5)
	assertMinutes(t, journey, 17)
}

func TestPhase2DirectExpressBeatsChangingLines(t *testing.T) {
	journey := plan(t, harbourCity(t), "Airport", "University", 5)
	assertMinutes(t, journey, 9)
	assertRides(t, journey, ride{"Express", []string{"Airport", "University"}, 9})
}

func TestPhase2OneTransfer(t *testing.T) {
	journey := plan(t, harbourCity(t), "Airport", "Science Park", 5)
	assertCost(t, journey, 17, 1)
	assertRides(t, journey,
		ride{"Express", []string{"Airport", "University"}, 9},
		ride{"Green", []string{"University", "Science Park"}, 3})
}

func TestPhase2TwoTransfersUsingTheCircleLine(t *testing.T) {
	journey := plan(t, harbourCity(t), "Old Town", "Island Pier", 5)
	assertCost(t, journey, 23, 2)
	assertRides(t, journey,
		ride{"Circle", []string{"Old Town", "Central"}, 2},
		ride{"Red", []string{"Central", "Harbor"}, 3},
		ride{"Ferry", []string{"Harbor", "Island Pier"}, 8})
}

func TestPhase2CustomTransferPenalty(t *testing.T) {
	journey := plan(t, harbourCity(t), "Old Town", "Island Pier", 2)
	assertCost(t, journey, 17, 2)
}

func TestPhase2OneWayFerryGoesRoundTheLoop(t *testing.T) {
	journey := plan(t, harbourCity(t), "Island Pier", "Harbor", 5)
	assertMinutes(t, journey, 15)
	assertRides(t, journey, ride{"Ferry", []string{"Island Pier", "Lighthouse", "Harbor"}, 15})
}

func TestPhase2ReverseOfAOneWayTrip(t *testing.T) {
	network := harbourCity(t)
	assertMinutes(t, plan(t, network, "Lighthouse", "Museum", 5), 21)
	assertMinutes(t, plan(t, network, "Museum", "Lighthouse", 5), 24)
}

func TestPhase2TransferPenaltyDecidesTheRoute(t *testing.T) {
	network := load(t, coast)
	cheap := plan(t, network, "Pier", "Point", 5)
	if cheap.TotalMinutes() != 9 || !slices.Equal(lineNames(cheap), []string{"Hopper", "Uptown"}) {
		t.Errorf("with 5 min transfers: got %d min on %q, want 9 min on [Hopper Uptown]", cheap.TotalMinutes(), lineNames(cheap))
	}
	costly := plan(t, network, "Pier", "Point", 10)
	if costly.TotalMinutes() != 12 || !slices.Equal(lineNames(costly), []string{"Coastal"}) {
		t.Errorf("with 10 min transfers: got %d min on %q, want 12 min on [Coastal]", costly.TotalMinutes(), lineNames(costly))
	}
}

func TestPhase2EqualTimesPreferFewerTransfers(t *testing.T) {
	// With an 8 minute change both routes take 12 minutes.
	journey := plan(t, load(t, coast), "Pier", "Point", 8)
	assertCost(t, journey, 12, 0)
}

func TestPhase2FreeTransfers(t *testing.T) {
	journey := plan(t, load(t, coast), "Pier", "Point", 0)
	assertCost(t, journey, 4, 1)
}

func TestPhase2StayingOnBoardCanBeatAnEarlierArrival(t *testing.T) {
	network := load(t, valley)
	journey := plan(t, network, "Dock", "Quarry", 5)
	assertMinutes(t, journey, 6)
	assertRides(t, journey, ride{"Local", []string{"Dock", "Mill", "Bridge", "Quarry"}, 6})
	assertMinutes(t, plan(t, network, "Dock", "Bridge", 5), 2)
}

func TestPhase2SameOriginAndDestination(t *testing.T) {
	journey := plan(t, harbourCity(t), "Central", "Central", 5)
	if len(journey.Legs) != 0 {
		t.Errorf("got %d legs, want none", len(journey.Legs))
	}
	assertMinutes(t, journey, 0)
}

func TestPhase2UnreachableDestinationReturnsNil(t *testing.T) {
	network := load(t, mountain)
	assertMinutes(t, plan(t, network, "North Gate", "Summit", 5), 21)
	for _, trip := range [][2]string{{"Summit", "Mill"}, {"North Gate", "Lighthouse"}} {
		journey, err := transit.FastestJourney(network, trip[0], trip[1], transit.DefaultTransferMinutes)
		if journey != nil || err != nil {
			t.Errorf("%s to %s: got (%v, %v), want (nil, nil)", trip[0], trip[1], journey, err)
		}
	}
}

func TestPhase2UnknownStationReturnsAnError(t *testing.T) {
	_, err := transit.FastestJourney(harbourCity(t), "Airport", "Atlantis", transit.DefaultTransferMinutes)
	var unknown *transit.UnknownStationError
	if !errors.As(err, &unknown) {
		t.Fatalf("got error %v, want an *UnknownStationError", err)
	}
}

func TestPhase2JourneyCardText(t *testing.T) {
	journey, err := transit.FastestJourney(harbourCity(t), "Airport", "Science Park", transit.DefaultTransferMinutes)
	if err != nil {
		t.Fatal(err)
	}
	want := "Take Express from Airport to University (9 min), transfer (5 min), " +
		"take Green from University to Science Park (3 min). Total 17 min, 1 transfer."
	if got := transit.FormatJourney(journey); got != want {
		t.Errorf("got  %q\nwant %q", got, want)
	}
}
