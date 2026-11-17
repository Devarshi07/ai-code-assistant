package kitchen

// Plain-text reports for the expo screen and the end-of-service email.

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

func flagsOf(order Order) string {
	var flags []string
	if order.Priority {
		flags = append(flags, "app")
	}
	if order.Due != nil {
		flags = append(flags, "due "+FormatClock(*order.Due))
	}
	if len(flags) == 0 {
		return ""
	}
	return "  [" + strings.Join(flags, ", ") + "]"
}

// Rail is the ticket rail as the line sees it: one row per order with its quote.
func Rail(orders []Order, menu *Menu) ([]string, error) {
	rows := make([]string, 0, len(orders))
	for _, order := range orders {
		quote, err := order.Quote(menu)
		if err != nil {
			return nil, err
		}
		rows = append(rows, fmt.Sprintf("%5d  %7s  quote %-11s%s%s",
			order.ID, FormatClock(order.Arrival), FormatClock(quote), strings.Join(order.Dishes, ", "), flagsOf(order)))
	}
	return rows, nil
}

// Load is the dishes cooked and cook-minutes spent at one station over a service.
type Load struct {
	Dishes  int
	Minutes int
}

// StationLoad maps each station to its Load for the whole service.
func StationLoad(orders []Order, menu *Menu, stations []Station) (map[string]Load, error) {
	load := make(map[string]Load, len(stations))
	for _, station := range stations {
		load[station.Name] = Load{}
	}
	for _, order := range orders {
		for _, name := range order.Dishes {
			item, err := menu.Get(name)
			if err != nil {
				return nil, err
			}
			entry := load[item.Station]
			load[item.Station] = Load{Dishes: entry.Dishes + 1, Minutes: entry.Minutes + item.Prep}
		}
	}
	return load, nil
}

// Utilisation is the share of each station's cook-minutes spent cooking, first ticket to last plate.
func Utilisation(orders []Order, menu *Menu, stations []Station, ready map[int]int) (map[string]float64, error) {
	lastPlate := math.MinInt
	for _, minute := range ready {
		lastPlate = max(lastPlate, minute)
	}
	firstTicket := math.MaxInt
	for _, order := range orders {
		firstTicket = min(firstTicket, order.Arrival)
	}
	span := max(lastPlate-firstTicket, 1)
	load, err := StationLoad(orders, menu, stations)
	if err != nil {
		return nil, err
	}
	shares := make(map[string]float64, len(stations))
	for _, station := range stations {
		shares[station.Name] = float64(load[station.Name].Minutes) / float64(station.Cooks*span)
	}
	return shares, nil
}

// ServiceReport prints per-order ready times and lateness, then how hard each station worked.
func ServiceReport(title string, orders []Order, menu *Menu, stations []Station, run Run) (string, error) {
	late := make(map[int]int, len(run.Late))
	lateMinutes := 0
	for _, entry := range run.Late {
		late[entry.ID] = entry.MinutesLate
		lateMinutes += entry.MinutesLate
	}
	first := math.MaxInt
	for _, order := range orders {
		first = min(first, order.Arrival)
	}
	last := math.MinInt
	for _, minute := range run.Ready {
		last = max(last, minute)
	}
	dishes := 0
	for _, order := range orders {
		dishes += len(order.Dishes)
	}
	lines := []string{
		fmt.Sprintf("%s: %d orders, %d dishes, first ticket %s, last plate %s",
			title, len(orders), dishes, FormatClock(first), FormatClock(last)),
		"",
		"order  in       ready      wait  due      status",
	}
	byArrival := append([]Order(nil), orders...)
	sort.SliceStable(byArrival, func(i, j int) bool {
		if byArrival[i].Arrival != byArrival[j].Arrival {
			return byArrival[i].Arrival < byArrival[j].Arrival
		}
		return byArrival[i].ID < byArrival[j].ID
	})
	for _, order := range byArrival {
		ready := run.Ready[order.ID]
		due := ""
		if order.Due != nil {
			due = FormatClock(*order.Due)
		}
		status := ""
		if minutes, isLate := late[order.ID]; isLate {
			status = "LATE " + FormatDuration(minutes)
		} else if order.Due != nil {
			status = "on time"
		}
		if order.Priority {
			if status == "" {
				status = "app"
			} else {
				status += ", app"
			}
		}
		row := fmt.Sprintf("%5d  %7s  %-9s%6s  %-7s  %s",
			order.ID, FormatClock(order.Arrival), FormatClock(ready), FormatDuration(ready-order.Arrival), due, status)
		lines = append(lines, strings.TrimRight(row, " "))
	}

	promised := 0
	for _, order := range orders {
		if order.Due != nil {
			promised++
		}
	}
	longestID, longestWait := -1, -1
	for _, order := range orders {
		wait := run.Ready[order.ID] - order.Arrival
		if longestID < 0 || wait > longestWait || (wait == longestWait && order.ID < longestID) {
			longestID, longestWait = order.ID, wait
		}
	}
	lines = append(lines,
		"",
		fmt.Sprintf("%d of %d promised orders late (%s in total). Longest wait: %s (order %d).",
			len(late), promised, FormatDuration(lateMinutes), FormatDuration(longestWait), longestID),
		"",
		"station  cooks  dishes  cooking   busy",
	)
	load, err := StationLoad(orders, menu, stations)
	if err != nil {
		return "", err
	}
	shares, err := Utilisation(orders, menu, stations, run.Ready)
	if err != nil {
		return "", err
	}
	for _, station := range stations {
		entry := load[station.Name]
		share := fmt.Sprintf("%d%%", int(math.Round(shares[station.Name]*100)))
		lines = append(lines, fmt.Sprintf("%-8s %5d  %6d  %7s  %5s",
			station.Name, station.Cooks, entry.Dishes, FormatDuration(entry.Minutes), share))
	}
	return strings.Join(lines, "\n"), nil
}
