package tests

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"testing"

	"debuggym/route-planner/transit"
)

// harbourCity loads the sample network or stops the test.
func harbourCity(t *testing.T) *transit.Network {
	t.Helper()
	network, err := transit.LoadHarbourCity()
	if err != nil {
		t.Fatalf("loading Harbour City: %v", err)
	}
	return network
}

// load builds a network from timetable text or stops the test.
func load(t *testing.T, text string) *transit.Network {
	t.Helper()
	network, err := transit.LoadNetwork(text, "network")
	if err != nil {
		t.Fatalf("loading the timetable: %v", err)
	}
	return network
}

// lineNamed looks up a line or stops the test.
func lineNamed(t *testing.T, network *transit.Network, name string) *transit.Line {
	t.Helper()
	line, ok := network.Line(name)
	if !ok {
		t.Fatalf("the network has no line %q", name)
	}
	return line
}

// runsDirectly reports whether some line runs straight from a to b, judged
// from the timetable data.
func runsDirectly(network *transit.Network, a, b string) bool {
	for _, line := range network.Lines() {
		for i := 0; i+1 < len(line.Stations); i++ {
			x, y := line.Stations[i], line.Stations[i+1]
			if (x == a && y == b) || (!line.OneWay && y == a && x == b) {
				return true
			}
		}
	}
	return false
}

func fewestStops(t *testing.T, network *transit.Network, origin, destination string) []string {
	t.Helper()
	route, err := transit.FewestStops(network, origin, destination)
	if err != nil {
		t.Fatalf("FewestStops(%q, %q): %v", origin, destination, err)
	}
	return route
}

func assertRoute(t *testing.T, network *transit.Network, route []string, origin, destination string, stops int) {
	t.Helper()
	if route == nil {
		t.Fatalf("riders can get from %s to %s, but there is no route", origin, destination)
	}
	if route[0] != origin || route[len(route)-1] != destination {
		t.Fatalf("the route must run from %s to %s, got %s", origin, destination, strings.Join(route, " -> "))
	}
	for i := 1; i < len(route); i++ {
		if !runsDirectly(network, route[i-1], route[i]) {
			t.Fatalf("no line runs from %s to %s", route[i-1], route[i])
		}
	}
	if len(route)-1 != stops {
		t.Fatalf("%s to %s is %d stops, got %s", origin, destination, stops, strings.Join(route, " -> "))
	}
}

// assertConnections compares connections as sets of "to|line|minutes".
func assertConnections(t *testing.T, connections []transit.Connection, want ...string) {
	t.Helper()
	var got []string
	for _, c := range connections {
		got = append(got, fmt.Sprintf("%s|%s|%d", c.To, c.Line, c.Minutes))
	}
	slices.Sort(got)
	got = slices.Compact(got)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Errorf("got connections %q, want %q", got, want)
	}
}

func assertStrings(t *testing.T, got, want []string) {
	t.Helper()
	if !slices.Equal(got, want) {
		t.Errorf("got %q, want %q", got, want)
	}
}

// Quick routes

func TestPhase1OutboundTripOnTheRedLine(t *testing.T) {
	network := harbourCity(t)
	assertRoute(t, network, fewestStops(t, network, "Airport", "Museum"), "Airport", "Museum", 3)
}

func TestPhase1ReturnTripOnTheRedLine(t *testing.T) {
	network := harbourCity(t)
	assertRoute(t, network, fewestStops(t, network, "Museum", "Airport"), "Museum", "Airport", 3)
}

func TestPhase1RiversideToUniversityIsTwoStops(t *testing.T) {
	network := harbourCity(t)
	assertRoute(t, network, fewestStops(t, network, "Riverside", "University"), "Riverside", "University", 2)
}

func TestPhase1RoundTripsTakeTheSameNumberOfStops(t *testing.T) {
	network := harbourCity(t)
	for _, pair := range [][2]string{{"Airport", "Museum"}, {"University", "Harbor"}, {"City Hall", "Airport"}, {"Science Park", "Old Town"}} {
		a, b := pair[0], pair[1]
		there := fewestStops(t, network, a, b)
		back := fewestStops(t, network, b, a)
		if there == nil {
			t.Fatalf("%s to %s: no route", a, b)
		}
		if back == nil {
			t.Fatalf("%s to %s: no route", b, a)
		}
		if len(there) != len(back) {
			t.Errorf("%s to %s and back should be the same length, got %s and %s", a, b, strings.Join(there, " -> "), strings.Join(back, " -> "))
		}
	}
}

func TestPhase1FerryOnlySailsOneWay(t *testing.T) {
	assertStrings(t, fewestStops(t, harbourCity(t), "Island Pier", "Harbor"), []string{"Island Pier", "Lighthouse", "Harbor"})
}

func TestPhase1SameStationIsAZeroStopRoute(t *testing.T) {
	assertStrings(t, fewestStops(t, harbourCity(t), "Central", "Central"), []string{"Central"})
}

func TestPhase1UnknownStationIsReported(t *testing.T) {
	_, err := transit.FewestStops(harbourCity(t), "Atlantis", "Central")
	var unknown *transit.UnknownStationError
	if !errors.As(err, &unknown) {
		t.Fatalf("got error %v, want an *UnknownStationError", err)
	}
}

// Network

func TestPhase1TwoWayLinesConnectInBothDirections(t *testing.T) {
	assertConnections(t, harbourCity(t).ConnectionsFrom("Harbor"), "Central|Red|3", "Museum|Red|6", "Riverside|Green|6", "Island Pier|Ferry|8")
}

func TestPhase1OneWayLineRunsInTimetableOrderOnly(t *testing.T) {
	assertConnections(t, harbourCity(t).ConnectionsFrom("Island Pier"), "Lighthouse|Ferry|5")
}

func TestPhase1NeighboursOfCentral(t *testing.T) {
	assertStrings(t, harbourCity(t).Neighbours("Central"), []string{"Airport", "Harbor", "Market Square", "Old Town", "University"})
}

func TestPhase1LinesCallingAtCentral(t *testing.T) {
	assertStrings(t, harbourCity(t).LinesAt("Central"), []string{"Red", "Blue", "Circle"})
}

// Timetable

func TestPhase1MultiWordStationNamesAndMinutes(t *testing.T) {
	circle := lineNamed(t, harbourCity(t), "Circle")
	assertStrings(t, circle.Stations, []string{"Central", "Market Square", "City Hall", "Old Town", "Central"})
	if want := []int{2, 2, 3, 2}; !slices.Equal(circle.Minutes, want) {
		t.Errorf("got minutes %v, want %v", circle.Minutes, want)
	}
	if circle.OneWay {
		t.Errorf("the Circle line runs both ways")
	}
}

func TestPhase1OnewayFlag(t *testing.T) {
	ferry := lineNamed(t, harbourCity(t), "Ferry")
	if !ferry.OneWay {
		t.Errorf("the Ferry is one-way")
	}
	assertStrings(t, ferry.Stations, []string{"Harbor", "Island Pier", "Lighthouse", "Harbor"})
}

func TestPhase1CommentsAndBlankLinesAreIgnored(t *testing.T) {
	network := load(t, "# depot shuttle\n\nline Night Owl: Depot 12 Old Mill  # weekends\n")
	var names []string
	for _, line := range network.Lines() {
		names = append(names, line.Name)
	}
	assertStrings(t, names, []string{"Night Owl"})
	assertStrings(t, lineNamed(t, network, "Night Owl").Stations, []string{"Depot", "Old Mill"})
}

func TestPhase1MalformedEntriesReportTheirLineNumber(t *testing.T) {
	for _, entry := range []string{"line Red Airport 4 Central", "line Red: Airport 4", "line Red: 4 Airport",
		"line Red: Airport", "line Red: Airport 0 Central", "line: Airport 4 Central"} {
		_, err := transit.LoadNetwork("# header\n"+entry, "network")
		var timetableErr *transit.TimetableError
		if !errors.As(err, &timetableErr) || timetableErr.LineNumber != 2 {
			t.Errorf("%q: got error %v, want a *TimetableError on line 2", entry, err)
		}
	}
}

func TestPhase1DuplicateLineNamesAreRejected(t *testing.T) {
	_, err := transit.LoadNetwork("line Red: A 1 B\nline Red: C 1 D\n", "network")
	var timetableErr *transit.TimetableError
	if !errors.As(err, &timetableErr) {
		t.Fatalf("got error %v, want a *TimetableError", err)
	}
}
