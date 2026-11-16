package tests

import (
	"cmp"
	"errors"
	"reflect"
	"slices"
	"strings"
	"testing"

	"debuggym/battleship/armada"
)

// armada.RandomFleet(7, ...) as recorded by QA. Every other harness produces the same chart.
const seed7Chart = `
     1  2  3  4  5  6  7  8  9 10
 A   .  .  A  A  A  A  A  .  .  .
 B   .  .  .  .  .  .  .  .  .  .
 C   .  .  .  .  .  .  .  .  .  .
 D   .  .  .  C  .  .  .  .  .  .
 E   .  .  .  C  .  .  .  .  .  .
 F   .  .  E  C  .  .  B  B  B  B
 G   .  .  E  .  D  .  .  .  .  .
 H   .  .  .  .  D  .  .  .  .  .
 I   .  .  .  .  D  .  .  .  .  .
 J   .  .  .  .  .  .  .  .  .  .
`

// QA ticket #212: an experimental bot that kept re-firing at the same squares.
var stuckBotShots = []string{"C5", "A3", "A3", "A3", "A3", "A3", "F7", "F7", "F7", "F7",
	"D4", "D4", "D4", "G5", "G5", "G5", "F3", "F3"}

// seededFleet is armada.RandomFleet that fails the test on an error. The
// phase 2 and 3 tests use it too.
func seededFleet(t *testing.T, seed, size int, lengths []int) *armada.Fleet {
	t.Helper()
	fleet, err := armada.RandomFleet(seed, size, lengths)
	if err != nil {
		t.Fatalf("RandomFleet(%d, %d, %v): %v", seed, size, lengths, err)
	}
	return fleet
}

// place adds a ship with its bow at a labelled cell, failing the test on an
// error. The phase 2 tests use it too.
func place(t *testing.T, fleet *armada.Fleet, length int, bow string, vertical bool) {
	t.Helper()
	if _, err := fleet.Place(length, armada.MustParseLabel(bow), vertical); err != nil {
		t.Fatalf("placing a %d-cell ship at %s: %v", length, bow, err)
	}
}

// smallFleet is a 6x6 board: a destroyer on A1-A2 and a vertical cruiser on C4-E4.
func smallFleet(t *testing.T) *armada.Fleet {
	t.Helper()
	fleet := armada.NewFleet(armada.NewOcean(6))
	place(t, fleet, 2, "A1", false)
	place(t, fleet, 3, "C4", true)
	return fleet
}

// fire shoots at a labelled cell, failing the test on an error.
func fire(t *testing.T, battle *armada.Battle, label string) armada.ShotResult {
	t.Helper()
	result, err := battle.Fire(armada.MustParseLabel(label))
	if err != nil {
		t.Fatalf("Fire(%s): %v", label, err)
	}
	return result
}

// assertValidFleet checks that ships are straight, unbroken, on the board and never share a cell.
func assertValidFleet(t *testing.T, fleet *armada.Fleet, size int, lengths []int) {
	t.Helper()
	var got []int
	for _, ship := range fleet.Ships() {
		got = append(got, len(ship.Cells))
	}
	want := slices.Clone(lengths)
	slices.Sort(got)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Fatalf("ship lengths %v, want %v", got, want)
	}
	seen := map[[2]int]bool{}
	for _, ship := range fleet.Ships() {
		cells := make([][2]int, len(ship.Cells))
		for i, c := range ship.Cells {
			cells[i] = [2]int{c.Row, c.Col}
		}
		slices.SortFunc(cells, func(a, b [2]int) int { return cmp.Or(a[0]-b[0], a[1]-b[1]) })
		across := make([][2]int, len(cells))
		down := make([][2]int, len(cells))
		for i := range cells {
			across[i] = [2]int{cells[0][0], cells[0][1] + i}
			down[i] = [2]int{cells[0][0] + i, cells[0][1]}
		}
		if !slices.Equal(cells, across) && !slices.Equal(cells, down) {
			t.Fatalf("%s is not a straight unbroken line: %v", ship.Name, cells)
		}
		for _, cell := range cells {
			r, c := cell[0], cell[1]
			if r < 0 || r >= size || c < 0 || c >= size {
				t.Fatalf("%s hangs off the board at (%d, %d)", ship.Name, r, c)
			}
			if seen[cell] {
				t.Fatalf("%s overlaps another ship at (%d, %d)", ship.Name, r, c)
			}
			seen[cell] = true
		}
	}
}

func TestPhase1Shots(t *testing.T) {
	t.Run("fresh shots report miss, hit and sunk", func(t *testing.T) {
		battle := armada.NewBattle(smallFleet(t))
		got := []armada.ShotResult{fire(t, battle, "A3"), fire(t, battle, "A1"), fire(t, battle, "A2")}
		if want := []armada.ShotResult{armada.Miss, armada.Hit, armada.Sunk}; !slices.Equal(got, want) {
			t.Fatalf("results %v, want %v", got, want)
		}
		if n := battle.ShotsFired(); n != 3 {
			t.Fatalf("ShotsFired() = %d, want 3", n)
		}
		if battle.FleetSunk() {
			t.Fatal("FleetSunk() = true, want false")
		}
	})

	t.Run("repeat shot into water is a wasted miss", func(t *testing.T) {
		battle := armada.NewBattle(smallFleet(t))
		got := []armada.ShotResult{fire(t, battle, "B5"), fire(t, battle, "B5")}
		if want := []armada.ShotResult{armada.Miss, armada.Miss}; !slices.Equal(got, want) {
			t.Fatalf("results %v, want %v", got, want)
		}
		if n := battle.ShotsFired(); n != 2 {
			t.Fatalf("ShotsFired() = %d, want 2", n)
		}
		if log := battle.Log(); len(log) < 2 || !log[1].Repeat {
			t.Fatal("the second shot is not logged as a repeat")
		}
		if n := battle.Repeats(); n != 1 {
			t.Fatalf("Repeats() = %d, want 1", n)
		}
	})

	t.Run("repeat shot at a hit is a wasted miss", func(t *testing.T) {
		battle := armada.NewBattle(smallFleet(t))
		if result := fire(t, battle, "D4"); result != armada.Hit {
			t.Fatalf("first shot at D4: %v, want HIT", result)
		}
		if result := fire(t, battle, "D4"); result != armada.Miss {
			t.Fatalf("second shot at D4: %v; a second shot at a cell that was already hit must be a MISS", result)
		}
		if n := battle.ShotsFired(); n != 2 {
			t.Fatalf("ShotsFired() = %d, want 2", n)
		}
		if log := battle.Log(); len(log) < 2 || !log[1].Repeat {
			t.Fatal("the second shot must be logged as a repeat")
		}
	})

	t.Run("double tap does not sink a destroyer", func(t *testing.T) {
		fleet := smallFleet(t)
		battle := armada.NewBattle(fleet)
		got := []armada.ShotResult{fire(t, battle, "A1"), fire(t, battle, "A1")}
		if want := []armada.ShotResult{armada.Hit, armada.Miss}; !slices.Equal(got, want) {
			t.Fatalf("results %v, want %v", got, want)
		}
		destroyer := fleet.ShipAt(armada.MustParseLabel("A1"))
		if destroyer == nil {
			t.Fatal("no ship at A1")
		}
		if destroyer.IsSunk() {
			t.Fatal("the destroyer is sunk, but only one of its two cells has been hit")
		}
		if result := fire(t, battle, "A2"); result != armada.Sunk {
			t.Fatalf("shot at A2: %v, want SUNK", result)
		}
	})

	t.Run("firing at a sunk ship again is a miss", func(t *testing.T) {
		battle := armada.NewBattle(smallFleet(t))
		for _, cell := range []string{"C4", "D4", "E4"} {
			fire(t, battle, cell)
		}
		if result := fire(t, battle, "E4"); result != armada.Miss {
			t.Fatalf("second shot at E4: %v, want MISS", result)
		}
		if n := battle.Repeats(); n != 1 {
			t.Fatalf("Repeats() = %d, want 1", n)
		}
	})

	t.Run("fleet is sunk only when every ship is", func(t *testing.T) {
		battle := armada.NewBattle(smallFleet(t))
		for _, cell := range []string{"A1", "A2", "C4", "D4"} {
			fire(t, battle, cell)
		}
		if battle.FleetSunk() {
			t.Fatal("FleetSunk() = true while the cruiser is still afloat")
		}
		if result := fire(t, battle, "E4"); result != armada.Sunk {
			t.Fatalf("shot at E4: %v, want SUNK", result)
		}
		if !battle.FleetSunk() {
			t.Fatal("FleetSunk() = false after the last ship went down")
		}
	})

	t.Run("off-board shot returns an error and is not counted", func(t *testing.T) {
		battle := armada.NewBattle(smallFleet(t))
		var offBoard *armada.OffBoardError
		if _, err := battle.Fire(armada.MustParseLabel("G1")); !errors.As(err, &offBoard) {
			t.Fatalf("Fire(G1) error: %v, want an *OffBoardError", err)
		}
		if _, err := battle.Fire(armada.Coord{Row: 0, Col: 6}); !errors.As(err, &offBoard) {
			t.Fatalf("Fire(0, 6) error: %v, want an *OffBoardError", err)
		}
		if n := battle.ShotsFired(); n != 0 {
			t.Fatalf("ShotsFired() = %d, want 0", n)
		}
	})
}

func TestPhase1Matches(t *testing.T) {
	t.Run("stuck bot cannot win by repeating", func(t *testing.T) {
		shots, err := armada.ParseLabels(stuckBotShots)
		if err != nil {
			t.Fatal(err)
		}
		report, err := armada.PlayMatchWithBudget(armada.NewScriptedBot(shots), seededFleet(t, 7, 10, armada.DefaultFleet), len(shots))
		if err != nil {
			t.Fatal(err)
		}
		if report.Shots != 18 {
			t.Fatalf("Shots = %d, want 18", report.Shots)
		}
		if report.Won {
			t.Fatal("the match was won, but the bot only ever hit five distinct cells")
		}
		if report.Repeats != 12 {
			t.Fatalf("Repeats = %d, want 12", report.Repeats)
		}
	})

	t.Run("row-by-row replay wins without repeats", func(t *testing.T) {
		var shots []armada.Coord
		for r := 0; r < 10; r++ {
			for c := 0; c < 10; c++ {
				shots = append(shots, armada.Coord{Row: r, Col: c})
			}
		}
		report, err := armada.PlayMatch(armada.NewScriptedBot(shots), seededFleet(t, 7, 10, armada.DefaultFleet))
		if err != nil {
			t.Fatal(err)
		}
		if !report.Won {
			t.Fatal("the match was lost")
		}
		if report.Shots != 85 {
			t.Fatalf("Shots = %d, want 85: the last ship cell in row order is I5", report.Shots)
		}
		if report.Repeats != 0 {
			t.Fatalf("Repeats = %d, want 0", report.Repeats)
		}
	})
}

func TestPhase1Placement(t *testing.T) {
	t.Run("overlapping ship is rejected", func(t *testing.T) {
		fleet := smallFleet(t)
		var placement *armada.PlacementError
		if _, err := fleet.Place(3, armada.MustParseLabel("D3"), false); !errors.As(err, &placement) {
			t.Fatalf("Place(3, D3) error: %v, want a *PlacementError", err)
		}
		if n := len(fleet.Ships()); n != 2 {
			t.Fatalf("the fleet has %d ships, want 2", n)
		}
	})

	t.Run("ship running off the board is rejected", func(t *testing.T) {
		fleet := armada.NewFleet(armada.NewOcean(6))
		var placement *armada.PlacementError
		if _, err := fleet.Place(4, armada.MustParseLabel("A4"), false); !errors.As(err, &placement) {
			t.Fatalf("Place(4, A4) error: %v, want a *PlacementError", err)
		}
		if _, err := fleet.Place(3, armada.MustParseLabel("E2"), true); !errors.As(err, &placement) {
			t.Fatalf("Place(3, E2, vertical) error: %v, want a *PlacementError", err)
		}
	})

	t.Run("seeded fleets are valid and reproducible", func(t *testing.T) {
		cellsOf := func(fleet *armada.Fleet) [][]armada.Coord {
			var cells [][]armada.Coord
			for _, ship := range fleet.Ships() {
				cells = append(cells, ship.Cells)
			}
			return cells
		}
		for _, tc := range []struct {
			size    int
			lengths []int
		}{{10, []int{5, 4, 3, 3, 2}}, {6, []int{4, 3, 2}}, {15, []int{5, 4, 4, 3, 3, 2, 1}}} {
			for seed := 1; seed <= 40; seed++ {
				fleet := seededFleet(t, seed, tc.size, tc.lengths)
				assertValidFleet(t, fleet, tc.size, tc.lengths)
				if again := seededFleet(t, seed, tc.size, tc.lengths); !reflect.DeepEqual(cellsOf(fleet), cellsOf(again)) {
					t.Fatalf("seed %d gave two different fleets on %dx%d", seed, tc.size, tc.size)
				}
			}
		}
	})

	t.Run("seed 7 matches the recorded chart", func(t *testing.T) {
		got, want := seededFleet(t, 7, 10, armada.DefaultFleet).Render(), strings.Trim(seed7Chart, "\n")
		if got != want {
			t.Fatalf("seed 7 chart:\n%s\nwant:\n%s", got, want)
		}
	})

	t.Run("labels", func(t *testing.T) {
		if c, err := armada.ParseLabel("B7"); err != nil || c != (armada.Coord{Row: 1, Col: 6}) {
			t.Fatalf(`ParseLabel("B7") = (%d, %d), %v; want (1, 6)`, c.Row, c.Col, err)
		}
		if c, err := armada.ParseLabel(" j10 "); err != nil || c != (armada.Coord{Row: 9, Col: 9}) {
			t.Fatalf(`ParseLabel(" j10 ") = (%d, %d), %v; want (9, 9)`, c.Row, c.Col, err)
		}
		if label := (armada.Coord{Row: 0, Col: 0}).String(); label != "A1" {
			t.Fatalf("Coord{0, 0}.String() = %q, want A1", label)
		}
	})
}
