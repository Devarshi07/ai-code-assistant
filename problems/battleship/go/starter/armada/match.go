package armada

// Match runner: plays a bot against a hidden fleet and reports the outcome.

import (
	"errors"
	"fmt"
	"reflect"
	"slices"
)

// MatchReport is the outcome of one match.
type MatchReport struct {
	Bot     string
	Shots   int
	Won     bool // every ship sunk within the budget
	Repeats int  // shots at cells that had already been fired at
	Battle  *Battle
}

// Summary is the report as one line for logs.
func (r *MatchReport) Summary() string {
	verdict := "did not sink the fleet"
	if r.Won {
		verdict = "sank the fleet"
	}
	return fmt.Sprintf("%s %s in %d shots (%d repeated)", r.Bot, verdict, r.Shots, r.Repeats)
}

// PlayMatch lets bot fire until the fleet is sunk or the default budget of
// one shot per cell is spent, which is enough for any bot that never fires
// at the same cell twice.
func PlayMatch(bot Bot, fleet *Fleet) (*MatchReport, error) {
	size := fleet.Ocean().Size()
	return PlayMatchWithBudget(bot, fleet, size*size)
}

// PlayMatchWithBudget is PlayMatch with an explicit shot budget.
//
// The bot only ever sees coordinates and ShotResults; it never gets the
// fleet. An error from the bot, or a shot off the board, ends the match.
func PlayMatchWithBudget(bot Bot, fleet *Fleet, budget int) (*MatchReport, error) {
	battle := NewBattle(fleet)
	for !battle.FleetSunk() && battle.ShotsFired() < budget {
		shot, err := bot.NextShot()
		if err != nil {
			return nil, err
		}
		result, err := battle.Fire(shot)
		if err != nil {
			return nil, err
		}
		bot.Observe(shot, result)
	}
	return &MatchReport{Bot: botName(bot), Shots: battle.ShotsFired(), Won: battle.FleetSunk(), Repeats: battle.Repeats(), Battle: battle}, nil
}

// RunSeries benchmarks a bot over seeded fleets. Each match gets a fresh bot
// from newBot(size, shipSizes), such as NewSeekerBot. It returns a one-line
// summary for dashboards and the CLI.
func RunSeries[B Bot](newBot func(size int, shipSizes []int) B, seeds []int, size int, shipSizes []int) (string, error) {
	if len(seeds) == 0 {
		return "", errors.New("no seeds to benchmark")
	}
	var name string
	shots := make([]int, 0, len(seeds))
	wins, total := 0, 0
	for _, seed := range seeds {
		fleet, err := RandomFleet(seed, size, shipSizes)
		if err != nil {
			return "", err
		}
		report, err := PlayMatch(newBot(size, shipSizes), fleet)
		if err != nil {
			return "", err
		}
		name = report.Bot
		shots = append(shots, report.Shots)
		total += report.Shots
		if report.Won {
			wins++
		}
	}
	mean := float64(total) / float64(len(shots))
	return fmt.Sprintf("%s: %d/%d fleets sunk, %.1f shots on average (best %d, worst %d)",
		name, wins, len(shots), mean, slices.Min(shots), slices.Max(shots)), nil
}

// botName is the bot's type name, such as "SeekerBot".
func botName(bot Bot) string {
	t := reflect.TypeOf(bot)
	for t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	return t.Name()
}
