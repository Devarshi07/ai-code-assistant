package tests

import (
	"fmt"
	"slices"
	"testing"

	"debuggym/battleship/armada"
)

// referee plays bot against fleet with an independent referee and returns the
// shot count, or an error for the first rule the bot breaks.
//
// Results are worked out from the ships' cells here, not by Battle. The bot
// must stay on the board, never fire at a cell twice, and sink every ship
// within one shot per cell. A bot that panics loses the match the same way,
// so one broken match fails its own test instead of stopping the whole run.
// The phase 3 tests use the referee too.
func referee(bot armada.Bot, fleet *armada.Fleet) (shots int, err error) {
	type cell struct{ row, col int }
	size := fleet.Ocean().Size()
	owner := map[cell]int{}
	afloat := make([]int, len(fleet.Ships()))
	for i, ship := range fleet.Ships() {
		for _, c := range ship.Cells {
			owner[cell{c.Row, c.Col}] = i
		}
		afloat[i] = len(ship.Cells)
	}
	fired := map[cell]bool{}
	defer func() {
		if r := recover(); r != nil {
			shots, err = len(fired), fmt.Errorf("the bot panicked after %d shots: %v", len(fired), r)
		}
	}()
	for slices.ContainsFunc(afloat, func(n int) bool { return n > 0 }) {
		if len(fired) >= size*size {
			return len(fired), fmt.Errorf("the fleet is still afloat after %d shots", size*size)
		}
		shot, err := bot.NextShot()
		if err != nil {
			return len(fired), fmt.Errorf("NextShot after %d shots: %w", len(fired), err)
		}
		row, col := shot.Row, shot.Col
		if row < 0 || row >= size || col < 0 || col >= size {
			return len(fired), fmt.Errorf("shot (%d, %d) is off the %dx%d board", row, col, size, size)
		}
		if fired[cell{row, col}] {
			return len(fired), fmt.Errorf("cell (%d, %d) was fired at twice", row, col)
		}
		fired[cell{row, col}] = true
		result := armada.Miss
		if ship, ok := owner[cell{row, col}]; ok {
			afloat[ship]--
			result = armada.Hit
			if afloat[ship] == 0 {
				result = armada.Sunk
			}
		}
		bot.Observe(armada.Coord{Row: row, Col: col}, result)
	}
	return len(fired), nil
}

// sinkSeeded plays a fresh SeekerBot against a seeded fleet under the referee
// and returns the shot count, failing the test if the bot breaks a rule. The
// phase 3 tests use it too.
func sinkSeeded(t *testing.T, seed, size int, lengths []int) int {
	t.Helper()
	shots, err := referee(armada.NewSeekerBot(size, lengths), seededFleet(t, seed, size, lengths))
	if err != nil {
		t.Fatalf("seed %d on %dx%d: %v", seed, size, size, err)
	}
	return shots
}

func TestPhase2SeekerBot(t *testing.T) {
	t.Run("sinks standard fleets without repeats", func(t *testing.T) {
		for seed := 1; seed <= 25; seed++ {
			if shots := sinkSeeded(t, seed, 10, armada.DefaultFleet); shots > 100 {
				t.Fatalf("seed %d: %d shots", seed, shots)
			}
		}
	})

	t.Run("ships hiding along the far edges", func(t *testing.T) {
		fleet := armada.NewFleet(armada.NewOcean(10))
		place(t, fleet, 5, "J6", false) // J6-J10, the bottom row
		place(t, fleet, 4, "E10", true) // E10-H10, the right-hand column
		place(t, fleet, 3, "A8", false) // A8-A10
		place(t, fleet, 3, "H1", true)  // H1-J1
		place(t, fleet, 2, "J4", false) // J4-J5
		if _, err := referee(armada.NewSeekerBot(10, armada.DefaultFleet), fleet); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("small board", func(t *testing.T) {
		for seed := 1; seed <= 20; seed++ {
			sinkSeeded(t, seed, 5, []int{3, 2})
		}
	})

	t.Run("crowded board", func(t *testing.T) {
		for seed := 1; seed <= 10; seed++ {
			sinkSeeded(t, seed, 7, armada.DefaultFleet)
		}
	})

	t.Run("large board", func(t *testing.T) {
		for seed := 1; seed <= 5; seed++ {
			sinkSeeded(t, seed, 20, []int{5, 4, 4, 3, 3, 2})
		}
	})

	t.Run("fleet with a one-cell patrol boat", func(t *testing.T) {
		for seed := 1; seed <= 20; seed++ {
			sinkSeeded(t, seed, 8, []int{4, 3, 1})
		}
	})

	t.Run("full match through the runner", func(t *testing.T) {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("the bot panicked: %v", r)
			}
		}()
		report, err := armada.PlayMatch(armada.NewSeekerBot(10, armada.DefaultFleet), seededFleet(t, 7, 10, armada.DefaultFleet))
		if err != nil {
			t.Fatal(err)
		}
		if !report.Won {
			t.Fatal("the match was lost")
		}
		if report.Repeats != 0 {
			t.Fatalf("Repeats = %d, want 0", report.Repeats)
		}
		if report.Shots > 100 {
			t.Fatalf("Shots = %d, want at most 100", report.Shots)
		}
	})
}
