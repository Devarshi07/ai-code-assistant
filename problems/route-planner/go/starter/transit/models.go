// Package transit is the journey-planning backend of the Harbour City transit
// app: it loads the timetable into a network of stations and lines and plans
// routes and journeys over it.
//
// Station and line names are case-sensitive strings exactly as they appear in
// the timetable ("Old Town", "Red"). Running times are whole minutes.
package transit

import (
	"fmt"
	"slices"
)

// DefaultTransferMinutes is how long a rider needs to change lines at a
// station (walk, wait, board).
const DefaultTransferMinutes = 5

// Segment is one hop of a line between two consecutive stops, in timetable order.
type Segment struct {
	Origin      string
	Destination string
	Minutes     int
}

// Connection is a directed edge in the network: from some station, ride Line to To.
type Connection struct {
	To      string
	Line    string
	Minutes int
}

// Station is a stop on the network and the lines calling there.
type Station struct {
	Name  string
	Lines []string // lines calling here, in load order
}

func (s *Station) addLine(lineName string) {
	if !slices.Contains(s.Lines, lineName) {
		s.Lines = append(s.Lines, lineName)
	}
}

// Line is a transit line as written in the timetable.
//
// Minutes[i] is the running time between Stations[i] and Stations[i+1].
// Trains run in both directions unless OneWay is set.
type Line struct {
	Name     string
	Stations []string
	Minutes  []int
	OneWay   bool
}

// NewLine returns a line after checking that its stations and running times
// fit together.
func NewLine(name string, stations []string, minutes []int, oneWay bool) (*Line, error) {
	if len(stations) < 2 {
		return nil, fmt.Errorf("line %s needs at least two stations", name)
	}
	if len(minutes) != len(stations)-1 {
		return nil, fmt.Errorf("line %s needs one running time per pair of stops", name)
	}
	return &Line{Name: name, Stations: stations, Minutes: minutes, OneWay: oneWay}, nil
}

// Segments streams each hop between consecutive stops, in timetable order.
// The channel is closed after the last hop.
func (l *Line) Segments() <-chan Segment {
	hops := make(chan Segment)
	go func() {
		defer close(hops)
		for i, minutes := range l.Minutes {
			hops <- Segment{Origin: l.Stations[i], Destination: l.Stations[i+1], Minutes: minutes}
		}
	}()
	return hops
}

// RunningTime is the number of minutes from the first stop to the last.
func (l *Line) RunningTime() int {
	total := 0
	for _, minutes := range l.Minutes {
		total += minutes
	}
	return total
}

// Leg is a continuous ride on one line.
//
// Stations runs from the boarding station to the alighting station inclusive;
// Minutes is the riding time of this leg only.
type Leg struct {
	Line     string
	Stations []string
	Minutes  int
}

// Origin is the boarding station.
func (l Leg) Origin() string { return l.Stations[0] }

// Destination is the alighting station.
func (l Leg) Destination() string { return l.Stations[len(l.Stations)-1] }

// Stops is the number of hops ridden.
func (l Leg) Stops() int { return len(l.Stations) - 1 }

// Journey is a planned trip: legs in travel order and the transfer penalty
// used to plan it.
type Journey struct {
	Origin          string
	Destination     string
	Legs            []Leg
	TransferMinutes int
}

// Transfers is the number of changes between lines.
func (j *Journey) Transfers() int { return max(len(j.Legs)-1, 0) }

// RidingMinutes is the time spent on board.
func (j *Journey) RidingMinutes() int {
	total := 0
	for _, leg := range j.Legs {
		total += leg.Minutes
	}
	return total
}

// TotalMinutes is the riding time plus the transfer penalty for every change.
func (j *Journey) TotalMinutes() int {
	return j.RidingMinutes() + j.Transfers()*j.TransferMinutes
}
