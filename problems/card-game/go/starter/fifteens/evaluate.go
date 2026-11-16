package fifteens

// Hand evaluation: finds the card patterns that the scoring rules pay for.
//
// Every function takes a slice of cards and works by position in that slice.
// Two different fives are two different cards, and so is the same card typed
// twice in practice mode. Nothing here awards points; scoring.go turns these
// patterns into a score.

import "slices"

// Fifteen is the total the scoring rules pay for; MinRun is the shortest run.
const (
	Fifteen = 15
	MinRun  = 3
)

// FindPairs returns every two cards of the same rank, as [first, second] in
// hand order.
func FindPairs(cards []Card) [][2]Card {
	var pairs [][2]Card
	for i := range cards {
		for j := i + 1; j < len(cards); j++ {
			if cards[i].Rank == cards[j].Rank {
				pairs = append(pairs, [2]Card{cards[i], cards[j]})
			}
		}
	}
	return pairs
}

// FindRuns returns the runs of three or more consecutive ranks, aces low,
// kings high, no wrap.
//
// Each run is reported once, as rank symbols from lowest to highest, and is
// as long as possible. Repeated ranks don't make extra runs, so 3-4-4-5 holds
// a single run of three.
func FindRuns(cards []Card) [][]string {
	present := make([]int, 0, len(cards))
	for _, card := range cards {
		present = append(present, card.Order())
	}
	slices.Sort(present)
	present = slices.Compact(present)

	var runs [][]string
	var current []int
	flush := func() {
		if len(current) >= MinRun {
			run := make([]string, len(current))
			for i, order := range current {
				run[i] = Ranks[order-1]
			}
			runs = append(runs, run)
		}
	}
	for _, order := range present {
		if len(current) > 0 && order != current[len(current)-1]+1 {
			flush()
			current = nil
		}
		current = append(current, order)
	}
	flush()
	return runs
}

// smallFifteens returns the two- and three-card combinations worth fifteen,
// in hand order.
//
// This is the shortcut the v1 scorer shipped with. It misses fifteens that
// need four or more cards, such as A-2-3-4-5 or 2-3-4-6.
func smallFifteens(cards []Card) [][]Card {
	var found [][]Card
	for i := range cards {
		for j := i + 1; j < len(cards); j++ {
			pairTotal := cards[i].Value() + cards[j].Value()
			if pairTotal == Fifteen {
				found = append(found, []Card{cards[i], cards[j]})
			}
			for k := j + 1; k < len(cards); k++ {
				if pairTotal+cards[k].Value() == Fifteen {
					found = append(found, []Card{cards[i], cards[j], cards[k]})
				}
			}
		}
	}
	return found
}

// FindCombinations returns every combination of one or more cards whose
// values add up to target.
//
// Each combination lists its cards in hand order. Combinations are ordered by
// the positions of their cards, compared like words in a dictionary.
func FindCombinations(cards []Card, target int) [][]Card {
	panic("phase 2: not implemented")
}

// CountCombinations reports how many combinations of cards add up to target.
func CountCombinations(cards []Card, target int) int {
	return len(FindCombinations(cards, target))
}
