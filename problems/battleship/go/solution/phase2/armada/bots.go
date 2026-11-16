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

// SeekerBot is the studio's reference opponent: it finds and sinks a hidden fleet.
//
// It sweeps the board row by row from A1. Every cell is tried exactly once,
// so the fleet is always sunk within size * size shots and nothing repeats.
type SeekerBot struct {
	size      int
	shipSizes []int
	queue     []Coord
	cursor    int
}

// NewSeekerBot returns a fresh SeekerBot for one match on a size x size board
// against a fleet with these ship lengths.
func NewSeekerBot(size int, shipSizes []int) *SeekerBot {
	return &SeekerBot{size: size, shipSizes: slices.Clone(shipSizes), queue: NewOcean(size).Cells()}
}

func (b *SeekerBot) NextShot() (Coord, error) {
	if b.cursor >= len(b.queue) {
		return Coord{}, &BotError{"every cell has already been fired at"}
	}
	b.cursor++
	return b.queue[b.cursor-1], nil
}

// Observe does nothing: a sweep does not need the outcome.
func (b *SeekerBot) Observe(c Coord, result ShotResult) {}
