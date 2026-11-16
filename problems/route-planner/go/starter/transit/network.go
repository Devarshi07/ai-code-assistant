package transit

import (
	"fmt"
	"slices"
)

// UnknownStationError reports a query for a station that is not in the network.
type UnknownStationError struct {
	Station string
}

func (e *UnknownStationError) Error() string {
	return fmt.Sprintf("unknown station: %q", e.Station)
}

// Network holds the stations and lines loaded from a timetable.
//
// Connections are directed: a two-way line contributes one connection in each
// direction for every segment, a one-way line only the timetable direction.
type Network struct {
	Name        string
	stations    map[string]*Station     // station name -> Station
	lines       []*Line                 // in timetable order
	lineByName  map[string]*Line        // line name -> Line
	connections map[string][]Connection // station name -> connections leaving it
}

// NewNetwork returns an empty network.
func NewNetwork(name string) *Network {
	return &Network{
		Name:        name,
		stations:    map[string]*Station{},
		lineByName:  map[string]*Line{},
		connections: map[string][]Connection{},
	}
}

// AddLine adds a line with its stations and connections.
func (n *Network) AddLine(line *Line) error {
	if _, ok := n.lineByName[line.Name]; ok {
		return fmt.Errorf("duplicate line %q", line.Name)
	}
	n.lines = append(n.lines, line)
	n.lineByName[line.Name] = line
	for _, name := range line.Stations {
		n.ensureStation(name).addLine(line.Name)
	}

	segments := line.Segments()
	for segment := range segments {
		n.connect(segment.Origin, Connection{To: segment.Destination, Line: line.Name, Minutes: segment.Minutes})
	}
	if !line.OneWay {
		// Trains run back along the same track, with the same running times.
		for segment := range segments {
			n.connect(segment.Destination, Connection{To: segment.Origin, Line: line.Name, Minutes: segment.Minutes})
		}
	}
	return nil
}

func (n *Network) ensureStation(name string) *Station {
	station, ok := n.stations[name]
	if !ok {
		station = &Station{Name: name}
		n.stations[name] = station
		n.connections[name] = nil
	}
	return station
}

func (n *Network) connect(origin string, connection Connection) {
	n.connections[origin] = append(n.connections[origin], connection)
}

// Station looks up a station by name. It returns an *UnknownStationError if
// there is no such station.
func (n *Network) Station(name string) (*Station, error) {
	station, ok := n.stations[name]
	if !ok {
		return nil, &UnknownStationError{Station: name}
	}
	return station, nil
}

// ConnectionsFrom returns every connection leaving the named station, across
// all lines. An unknown station has none. The slice is shared with the
// network; treat it as read-only.
func (n *Network) ConnectionsFrom(name string) []Connection {
	return n.connections[name]
}

// Neighbours returns the names of the stations one hop away, sorted.
func (n *Network) Neighbours(name string) []string {
	var names []string
	for _, connection := range n.ConnectionsFrom(name) {
		if !slices.Contains(names, connection.To) {
			names = append(names, connection.To)
		}
	}
	slices.Sort(names)
	return names
}

// LinesAt returns the names of the lines calling at the named station, in
// load order.
func (n *Network) LinesAt(name string) []string {
	station, ok := n.stations[name]
	if !ok {
		return nil
	}
	return slices.Clone(station.Lines)
}

// Lines returns every line in timetable order. The slice is shared with the
// network; treat it as read-only.
func (n *Network) Lines() []*Line {
	return n.lines
}

// Line looks up a line by name.
func (n *Network) Line(name string) (*Line, bool) {
	line, ok := n.lineByName[name]
	return line, ok
}

// Has reports whether the network has a station with this name.
func (n *Network) Has(name string) bool {
	_, ok := n.stations[name]
	return ok
}

// Len returns the number of stations.
func (n *Network) Len() int {
	return len(n.stations)
}

func (n *Network) String() string {
	return fmt.Sprintf("Network(%s, %d stations, %d lines)", n.Name, len(n.stations), len(n.lines))
}
