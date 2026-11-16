package tests

import (
	"maps"
	"slices"
	"strings"
	"testing"
	"time"

	"debuggym/battleship/armada"
)

// Hand-drawn QA fleets where ships touch. '.' is water; each letter is one ship.
const stacked = `
AAAAA.....
BBBB......
CCC.......
DDD.......
EE........
..........
..........
..........
..........
..........
`

const palisade = `
..........
..........
..........
..........
..........
.....A....
.....AB...
.....ABCD.
.....ABCDE
.....ABCDE
`

const harbour = `
..........
..........
..........
...AAAAA..
...BBBBE..
...CCCDE..
......D...
......D...
..........
..........
`

const corner = `
AAA..
BB...
C....
D....
.....
`

// chartFleet builds a fleet from a hand-drawn chart (an independent parser, not the codebase's).
func chartFleet(t *testing.T, text string) *armada.Fleet {
	t.Helper()
	var rows []string
	for _, line := range strings.Split(text, "\n") {
		if line != "" {
			rows = append(rows, line)
		}
	}
	fleet := armada.NewFleet(armada.NewOcean(len(rows)))
	ships := map[rune][]armada.Coord{}
	for r, line := range rows {
		for c, ch := range line {
			if ch != '.' {
				ships[ch] = append(ships[ch], armada.Coord{Row: r, Col: c})
			}
		}
	}
	for _, letter := range slices.Sorted(maps.Keys(ships)) {
		cells := ships[letter]
		vertical := len(cells) > 1 && cells[0].Col == cells[1].Col
		if _, err := fleet.Place(len(cells), cells[0], vertical); err != nil {
			t.Fatalf("chart ship %c: %v", letter, err)
		}
	}
	return fleet
}

func average(values []int) float64 {
	total := 0
	for _, v := range values {
		total += v
	}
	return float64(total) / float64(len(values))
}

// referee and sinkSeeded are in phase2_test.go, seededFleet in phase1_test.go.

func TestPhase3Efficiency(t *testing.T) {
	t.Run("standard board averages under 70 shots", func(t *testing.T) {
		start := time.Now()
		var shots []int
		for seed := 1; seed <= 60; seed++ {
			shots = append(shots, sinkSeeded(t, seed, 10, armada.DefaultFleet))
		}
		elapsed := time.Since(start)
		if mean := average(shots); mean >= 70 {
			t.Fatalf("averaged %.1f shots over 60 standard fleets; must be under 70", mean)
		}
		if elapsed >= time.Second {
			t.Fatalf("60 matches took %dms; the benchmark must finish in under 1000ms", elapsed.Milliseconds())
		}
	})

	t.Run("large board averages under 135 shots", func(t *testing.T) {
		var shots []int
		for seed := 1; seed <= 30; seed++ {
			shots = append(shots, sinkSeeded(t, seed, 15, armada.DefaultFleet))
		}
		if mean := average(shots); mean >= 135 {
			t.Fatalf("averaged %.1f shots over 30 fleets on 15x15; must be under 135", mean)
		}
	})
}

func TestPhase3Robustness(t *testing.T) {
	t.Run("touching ships are all sunk", func(t *testing.T) {
		for _, chart := range []struct{ name, text string }{
			{"stacked", stacked}, {"palisade", palisade}, {"harbour", harbour}, {"corner", corner},
		} {
			fleet := chartFleet(t, chart.text)
			if _, err := referee(armada.NewSeekerBot(fleet.Ocean().Size(), fleet.ShipSizes()), fleet); err != nil {
				t.Fatalf("%s fleet: %v", chart.name, err)
			}
		}
	})

	t.Run("one-cell ships are found", func(t *testing.T) {
		for _, tc := range []struct {
			size    int
			lengths []int
		}{{6, []int{3, 2, 1, 1}}, {9, []int{4, 3, 1, 1, 1}}, {12, append(slices.Clone(armada.DefaultFleet), 1)}} {
			for seed := 1; seed <= 15; seed++ {
				sinkSeeded(t, seed, tc.size, tc.lengths)
			}
		}
	})

	t.Run("many board sizes", func(t *testing.T) {
		for size := 5; size <= 16; size++ {
			lengths := []int{5, 4, 4, 3, 3, 2, 2}
			switch {
			case size < 7:
				lengths = []int{3, 2}
			case size < 10:
				lengths = []int{4, 3, 2, 2}
			case size < 14:
				lengths = armada.DefaultFleet
			}
			for seed := 1; seed <= 8; seed++ {
				sinkSeeded(t, seed, size, lengths)
			}
		}
	})
}
