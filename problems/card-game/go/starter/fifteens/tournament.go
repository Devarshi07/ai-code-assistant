package fifteens

// Tournament marathon mode.
//
// In tournament finals the cards are not dealt into small hands. A marathon
// hand of up to a full deck is spread face up and the table calls bonus
// targets such as 15, 31 or 100. For every target the scoreboard shows how
// many combinations of cards (by position, as everywhere else) add up to it.
// Only the counts are needed; nobody wants the combinations listed.

import (
	"fmt"
	"strconv"
	"strings"
)

// Marathon hands come from a single deck.
const (
	MaxMarathonCards = 52
	MaxTarget        = 200
)

// MarathonCount is the scoreboard line for one target.
type MarathonCount struct {
	Target int
	Count  int
}

// MarathonCounts counts the combinations of cards adding up to each target,
// in the order the targets are given. With no targets it counts fifteens.
func MarathonCounts(cards []Card, targets ...int) ([]MarathonCount, error) {
	if len(targets) == 0 {
		targets = []int{Fifteen}
	}
	if len(cards) > MaxMarathonCards {
		return nil, fmt.Errorf("a marathon hand has at most %d cards", MaxMarathonCards)
	}
	for _, target := range targets {
		if target < 1 || target > MaxTarget {
			return nil, fmt.Errorf("targets must be between 1 and %d", MaxTarget)
		}
	}
	counts := make([]MarathonCount, len(targets))
	for i, target := range targets {
		counts[i] = MarathonCount{Target: target, Count: CountCombinations(cards, target)}
	}
	return counts, nil
}

// FormatMarathon renders the scoreboard for a marathon hand.
func FormatMarathon(cards []Card, counts []MarathonCount) string {
	shown := FormatCards(cards[:min(8, len(cards))])
	if len(cards) > 8 {
		shown += " ..."
	}
	lines := []string{fmt.Sprintf("Marathon hand (%d cards): %s", len(cards), shown)}
	for _, c := range counts {
		lines = append(lines, fmt.Sprintf("  target %3d: %s combinations", c.Target, groupThousands(c.Count)))
	}
	return strings.Join(lines, "\n")
}

// groupThousands writes a count with commas between groups of three digits,
// as in 17,264.
func groupThousands(count int) string {
	digits := strconv.Itoa(count)
	var b strings.Builder
	for i, digit := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(digit)
	}
	return b.String()
}
