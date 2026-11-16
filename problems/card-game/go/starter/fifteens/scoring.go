package fifteens

// Scoring rules for Fifteens.
//
//	fifteens   2 points for every combination of cards adding up to 15
//	pairs      2 points for every two cards of the same rank
//	runs       1 point per rank in each run of three or more consecutive ranks
//
// During a match a player's hand is scored together with the round's turn-up
// card, so a four-card hand is scored as five cards.

import (
	"fmt"
	"strings"
)

// Points for each scoring pattern.
const (
	PointsPerFifteen = 2
	PointsPerPair    = 2
	PointsPerRunRank = 1
)

// Score is what a hand scored, with the patterns behind each part of the score.
type Score struct {
	Fifteens [][]Card   // card combinations adding up to 15
	Pairs    [][2]Card  // pairs of cards of the same rank
	Runs     [][]string // runs as rank symbols, e.g. ["3" "4" "5"]
}

func (s Score) FifteenPoints() int {
	return PointsPerFifteen * len(s.Fifteens)
}

func (s Score) PairPoints() int {
	return PointsPerPair * len(s.Pairs)
}

func (s Score) RunPoints() int {
	ranks := 0
	for _, run := range s.Runs {
		ranks += len(run)
	}
	return PointsPerRunRank * ranks
}

func (s Score) Total() int {
	return s.FifteenPoints() + s.PairPoints() + s.RunPoints()
}

// ScoreHand scores a hand (including the turn-up card, if there is one).
func ScoreHand(cards []Card) Score {
	// TODO(FIF-31): count fifteens of every size, not just two and three cards.
	return Score{Fifteens: smallFifteens(cards), Pairs: FindPairs(cards), Runs: FindRuns(cards)}
}

// DescribeScore is the one-line summary for the table view, e.g.
// "8 pts: 15s x2, pair x1, run 3-4-5".
func DescribeScore(score Score) string {
	var parts []string
	if len(score.Fifteens) > 0 {
		parts = append(parts, fmt.Sprintf("15s x%d", len(score.Fifteens)))
	}
	if len(score.Pairs) > 0 {
		parts = append(parts, fmt.Sprintf("pair x%d", len(score.Pairs)))
	}
	for _, run := range score.Runs {
		parts = append(parts, "run "+strings.Join(run, "-"))
	}
	text := fmt.Sprintf("%d pts", score.Total())
	if len(parts) > 0 {
		text += ": " + strings.Join(parts, ", ")
	}
	return text
}

// DescribeFifteens spells the fifteens out, e.g. "5H+JD, 5H+QC".
func DescribeFifteens(score Score) string {
	combos := make([]string, len(score.Fifteens))
	for i, combo := range score.Fifteens {
		combos[i] = strings.ReplaceAll(FormatCards(combo), " ", "+")
	}
	return strings.Join(combos, ", ")
}
