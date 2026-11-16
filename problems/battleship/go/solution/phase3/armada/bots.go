package armada

// Bots that play matches. See "Writing a bot" in README.md for the contract.

import (
	"fmt"
	"slices"
)

// BotError reports a bot that has no legal shot left to offer.
type BotError struct {
	Reason string
}

func (e *BotError) Error() string { return e.Reason }

// Bot is an AI opponent.
//
// A fresh bot is created for every match with the board size and the ship
// lengths in the fleet: the fleet's make-up is public, its positions are not.
// The match runner then calls NextShot and Observe in turn until the fleet is
// sunk or the shot budget is spent.
type Bot interface {
	// NextShot picks the cell to fire at next.
	NextShot() (Coord, error)
	// Observe is called once after every shot with the cell and its result.
	Observe(c Coord, result ShotResult)
}

// ScriptedBot fires a fixed list of shots in order. QA uses it to replay bug reports.
type ScriptedBot struct {
	script []Coord
	cursor int
}

// NewScriptedBot returns a bot that fires shots in order.
func NewScriptedBot(shots []Coord) *ScriptedBot {
	return &ScriptedBot{script: slices.Clone(shots)}
}

func (b *ScriptedBot) NextShot() (Coord, error) {
	if b.cursor >= len(b.script) {
		return Coord{}, &BotError{fmt.Sprintf("script exhausted after %d shots", len(b.script))}
	}
	b.cursor++
	return b.script[b.cursor-1], nil
}

// Observe does nothing: the script is fixed.
func (b *ScriptedBot) Observe(Coord, ShotResult) {}

// SeekerBot is the studio's reference opponent: hunt/target with checkerboard parity.
//
// Hunt: fire at cells where row + col is even. A ship two or more cells long
// always covers one of them, so the hunt finds every such ship with at most
// half the board. The odd cells stay queued behind them as a fallback, which
// covers 1-cell ships and guarantees the bot can always finish.
//
// Target: a Hit queues the cell's untried neighbours. They are fired at, most
// recent first, before hunting resumes, so a ship is finished off as soon as
// it is found. Leftover neighbours after a Sunk are simply tried too: a sunk
// report doesn't say which hits belonged to the ship, and a touching ship may
// still be hiding behind them.
type SeekerBot struct {
	size      int
	shipSizes []int
	ocean     *Ocean
	fired     map[Coord]bool // cells already fired at
	targets   []Coord        // stack of cells next to hits
	hunt      []Coord        // even cells, then odd cells
	cursor    int
}

// NewSeekerBot returns a fresh SeekerBot for one match on a size x size board
// against a fleet with these ship lengths.
func NewSeekerBot(size int, shipSizes []int) *SeekerBot {
	b := &SeekerBot{size: size, shipSizes: slices.Clone(shipSizes), ocean: NewOcean(size), fired: map[Coord]bool{}}
	cells := b.ocean.Cells()
	for _, parity := range []int{0, 1} {
		for _, c := range cells {
			if (c.Row+c.Col)%2 == parity {
				b.hunt = append(b.hunt, c)
			}
		}
	}
	return b
}

func (b *SeekerBot) NextShot() (Coord, error) {
	for len(b.targets) > 0 {
		c := b.targets[len(b.targets)-1]
		b.targets = b.targets[:len(b.targets)-1]
		if !b.fired[c] {
			return c, nil
		}
	}
	for b.cursor < len(b.hunt) && b.fired[b.hunt[b.cursor]] {
		b.cursor++
	}
	if b.cursor == len(b.hunt) {
		return Coord{}, &BotError{"every cell has already been fired at"}
	}
	return b.hunt[b.cursor], nil
}

func (b *SeekerBot) Observe(c Coord, result ShotResult) {
	b.fired[c] = true
	if result == Hit {
		for _, n := range b.ocean.Neighbours(c) {
			if !b.fired[n] {
				b.targets = append(b.targets, n)
			}
		}
	}
}
