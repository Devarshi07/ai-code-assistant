package transit

import (
	"fmt"
	"strings"
)

func plural(count int, word string) string {
	if count == 1 {
		return fmt.Sprintf("%d %s", count, word)
	}
	return fmt.Sprintf("%d %ss", count, word)
}

// FormatStops renders a fewest-stops route as
// "Airport -> Central -> Harbor (2 stops)", or "no route" for nil.
func FormatStops(route []string) string {
	if route == nil {
		return "no route"
	}
	return fmt.Sprintf("%s (%s)", strings.Join(route, " -> "), plural(len(route)-1, "stop"))
}

// FormatJourney renders the one-sentence itinerary shown in the journey card:
//
//	Take Red from Airport to Central (4 min), transfer (5 min), take Blue
//	from Central to Museum (7 min). Total 16 min, 1 transfer.
func FormatJourney(journey *Journey) string {
	if journey == nil {
		return "No journey found."
	}
	if len(journey.Legs) == 0 {
		return fmt.Sprintf("You are already at %s.", journey.Origin)
	}
	var parts []string
	for index, leg := range journey.Legs {
		verb := "Take"
		if index > 0 {
			parts = append(parts, fmt.Sprintf("transfer (%d min)", journey.TransferMinutes))
			verb = "take"
		}
		parts = append(parts, fmt.Sprintf("%s %s from %s to %s (%d min)", verb, leg.Line, leg.Origin(), leg.Destination(), leg.Minutes))
	}
	return fmt.Sprintf("%s. Total %d min, %s.", strings.Join(parts, ", "), journey.TotalMinutes(), plural(journey.Transfers(), "transfer"))
}

// FormatItinerary renders a multi-line itinerary with one row per leg, for
// the detail view.
func FormatItinerary(journey *Journey) string {
	if journey == nil || len(journey.Legs) == 0 {
		return FormatJourney(journey)
	}
	width := 0
	for _, leg := range journey.Legs {
		width = max(width, len(leg.Line))
	}
	var rows []string
	for index, leg := range journey.Legs {
		if index > 0 {
			rows = append(rows, fmt.Sprintf("  %-*s  change at %s (%d min)", width, "", leg.Origin(), journey.TransferMinutes))
		}
		rows = append(rows, fmt.Sprintf("  %-*s  %s -> %s  %d min, %s", width, leg.Line, leg.Origin(), leg.Destination(), leg.Minutes, plural(leg.Stops(), "stop")))
	}
	rows = append(rows, fmt.Sprintf("  %-*s  arrive after %d min", width, "", journey.TotalMinutes()))
	return strings.Join(rows, "\n")
}

// DescribeNetwork summarises every line, in timetable order.
func DescribeNetwork(network *Network) string {
	rows := []string{fmt.Sprintf("%s: %d stations, %d lines", network.Name, network.Len(), len(network.Lines()))}
	width := 0
	for _, line := range network.Lines() {
		width = max(width, len(line.Name))
	}
	for _, line := range network.Lines() {
		first, last := line.Stations[0], line.Stations[len(line.Stations)-1]
		route := first + " - " + last
		if first == last {
			route = first + " (loop)"
		}
		direction := "two-way"
		if line.OneWay {
			direction = "one-way"
		}
		rows = append(rows, fmt.Sprintf("  %-*s  %s  (%s, %d min, %s)", width, line.Name, route, plural(len(line.Stations), "station"), line.RunningTime(), direction))
	}
	return strings.Join(rows, "\n")
}
