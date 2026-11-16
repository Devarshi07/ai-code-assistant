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

// FindCombinations returns every combination of one or more cards whose
// values add up to target.
//
// Each combination lists its cards in hand order. Combinations are ordered by
// the positions of their cards, compared like words in a dictionary.
//
// Depth-first search over positions: the next card added always sits to the
// right of the last one, which yields combinations in exactly that dictionary
// order. Card values are positive, so a branch stops as soon as its total
// reaches the target.
func FindCombinations(cards []Card, target int) [][]Card {
	var found [][]Card
	if target <= 0 {
		return found
	}
	values := make([]int, len(cards))
	for i, card := range cards {
		values[i] = card.Value()
	}
	chosen := make([]int, 0, len(cards))
	var extend func(start, total int)
	extend = func(start, total int) {
		for i := start; i < len(cards); i++ {
			newTotal := total + values[i]
			if newTotal > target {
				continue
			}
			chosen = append(chosen, i)
			if newTotal == target {
				combo := make([]Card, len(chosen))
				for k, j := range chosen {
					combo[k] = cards[j]
				}
				found = append(found, combo)
			} else {
				extend(i+1, newTotal)
			}
			chosen = chosen[:len(chosen)-1]
		}
	}
	extend(0, 0)
	return found
}

// CountCombinations reports how many combinations of cards add up to target.
//
// Subset-sum counting instead of listing: ways[t] is the number of
// combinations of the cards seen so far that add up to t. Each new card either
// stays out or joins a combination worth t - value. Totals are updated from
// high to low so a card is never used twice in one pass.
// O(len(cards) * target) time and O(target) memory.
//
// Hands have at most 52 cards, so every count is below 2^52 and fits an int
// (64 bits) exactly; an int32 would overflow.
func CountCombinations(cards []Card, target int) int {
	if target <= 0 {
		return 0
	}
	ways := make([]int, target+1)
	ways[0] = 1 // the empty combination; never counted on its own because target > 0
	for _, card := range cards {
		value := card.Value()
		for total := target; total >= value; total-- {
			ways[total] += ways[total-value]
		}
	}
	return ways[target]
}
