package tests

// Deterministic timetable generator for large test networks.
//
// Stations sit on a size x size street grid and are named after their grid
// cell ("S12-7"). Each line wanders across the grid without revisiting a
// stop; about one in five is an express that skips cells and runs faster per
// cell, and about one in eight is one-way. The tests in the other languages
// use the same generator, so a seed produces the same network in each.

import (
	"fmt"
	"slices"
	"strings"
)

// directions are the grid steps for east, south, west, north; turning right
// is +1, left is +3.
var directions = [4][2]int{{0, 1}, {1, 0}, {0, -1}, {-1, 0}}

// lcg is the Park-Miller "minimal standard" generator.
type lcg struct {
	state int64
}

func newLcg(seed int64) *lcg {
	state := seed % 2147483647
	if state == 0 {
		state = 1
	}
	return &lcg{state: state}
}

func (r *lcg) below(n int) int {
	r.state = r.state * 48271 % 2147483647
	return int(r.state % int64(n))
}

// generateTimetable returns the timetable text and its station names, sorted.
func generateTimetable(seed int64, size, lines, minStops, maxStops int) (string, []string) {
	rng := newLcg(seed)
	entries := []string{fmt.Sprintf("# generated: seed %d, %dx%d grid, %d lines", seed, size, size, lines)}
	stations := map[string]bool{}
	for number := 1; number <= lines; number++ {
		express := rng.below(5) == 0
		stride := 1
		if express {
			stride = 2 + rng.below(2)
		}
		row := rng.below(size)
		col := rng.below(size)
		heading := rng.below(4)
		target := minStops + rng.below(maxStops-minStops+1)
		stops := [][2]int{{row, col}}
		var minutes []int
		seen := map[[2]int]bool{{row, col}: true}
		for len(stops) < target {
			roll := rng.below(10)
			var order [3]int
			switch {
			case roll < 7:
				order = [3]int{heading, (heading + 1) % 4, (heading + 3) % 4}
			case roll < 9:
				order = [3]int{(heading + 1) % 4, heading, (heading + 3) % 4}
			default:
				order = [3]int{(heading + 3) % 4, heading, (heading + 1) % 4}
			}
			moved := false
			for _, turn := range order {
				nr := row + directions[turn][0]*stride
				nc := col + directions[turn][1]*stride
				if nr >= 0 && nr < size && nc >= 0 && nc < size && !seen[[2]int{nr, nc}] {
					row, col, heading = nr, nc, turn
					moved = true
					break
				}
			}
			if !moved {
				break // boxed in: the line ends here
			}
			stops = append(stops, [2]int{row, col})
			seen[[2]int{row, col}] = true
			if express {
				minutes = append(minutes, stride+rng.below(2))
			} else {
				minutes = append(minutes, 2+rng.below(3))
			}
		}
		oneWay := rng.below(8) == 0
		names := make([]string, len(stops))
		for i, cell := range stops {
			names[i] = fmt.Sprintf("S%d-%d", cell[0], cell[1])
			stations[names[i]] = true
		}
		var body strings.Builder
		body.WriteString(names[0])
		for i := 1; i < len(names); i++ {
			fmt.Fprintf(&body, " %d %s", minutes[i-1], names[i])
		}
		kind, flag := "L", ""
		if express {
			kind = "X"
		}
		if oneWay {
			flag = " oneway"
		}
		entries = append(entries, fmt.Sprintf("line %s%d%s: %s", kind, number, flag, body.String()))
	}
	sorted := make([]string, 0, len(stations))
	for name := range stations {
		sorted = append(sorted, name)
	}
	slices.Sort(sorted)
	return strings.Join(entries, "\n") + "\n", sorted
}

type query struct {
	origin, destination string
}

// pickQueries returns deterministic (origin, destination) pairs of distinct stations.
func pickQueries(seed int64, stations []string, count int) []query {
	rng := newLcg(seed)
	var queries []query
	for len(queries) < count {
		origin := stations[rng.below(len(stations))]
		destination := stations[rng.below(len(stations))]
		if origin != destination {
			queries = append(queries, query{origin, destination})
		}
	}
	return queries
}
