package tests

import (
	"fmt"
	"maps"
	"slices"
	"strings"
	"testing"
	"time"

	"debuggym/card-game/fifteens"
)

// Every expected count in this file was checked two independent ways:
// enumerating all subsets (for the hands of up to 18 cards) and summing
// binomial coefficients over how many cards of each value are used.

var (
	fullDeck   = fifteens.MustParseHand(fullDeckText())
	marathon40 = fifteens.MustParseHand(
		"2D 2H 9D KH 10C 8S JH 4C 3H 9H 6D 2S KD 10S 3C 7D 6C QH 7C 9C " +
			"QS 4D 10D 2C 4S 5C 6S JD 10H 4H 3S KS KC AC AS JS 5S 3D 5D 7H")
	marathon30 = fifteens.MustParseHand(
		"3D QH 4C KC KH JD 2D 10S 6H 3H QS 9C 9H JC 6S JH 4S 8S 3S 3C " +
			"AS 5S QC 2C 2H 8C 5D JS QD 5H")
)

func fullDeckText() string {
	var cards []string
	for _, suit := range fifteens.Suits {
		for _, rank := range fifteens.Ranks {
			cards = append(cards, rank+suit)
		}
	}
	return strings.Join(cards, " ")
}

var mediumHands = []struct {
	text     string
	expected map[int]int // target -> count
}{
	{"7D 3S 8H 5S 9D KC AC 9H 7C 10H AD 3D", map[int]int{15: 25, 21: 64, 31: 119, 40: 124}},
	{"KH 4H KD KS 10S 9D 6D QD JD 10C 6H QH 5D 5S", map[int]int{15: 22, 21: 35, 31: 137, 40: 422}},
	{"JS JD KD 8S QD KH AC 8D 4H 5H QS 2H JC 10S 7S 9S", map[int]int{15: 25, 21: 79, 31: 291, 40: 723}},
	{"6C 5S 9S KS 3H 6D 8C 8H JS 10C KD 9D AH QH 2H KC 5C 8S", map[int]int{15: 47, 21: 175, 31: 773, 40: 2078}},
	// A practice-mode hand with repeated cards: every position counts.
	{"5H 5H 10S 5H JD AC AC 4S 6D 6D 9C 5H KS 2C", map[int]int{15: 64, 21: 199, 31: 453, 40: 459}},
}

// One tournament round: the targets called at the table, in order.
var marathonRound = []struct {
	cards    []fifteens.Card
	target   int
	expected int
}{
	{fullDeck, 15, 17_264},
	{fullDeck, 25, 746_736},
	{fullDeck, 31, 5_011_024},
	{fullDeck, 100, 1_864_192_096_504},
	{fullDeck, 170, 68_141_176_483_932},
	{fullDeck, 200, 35_865_475_414_775},
	{marathon40, 77, 1_471_665_517},
	{marathon30, 120, 12_473_861},
}

const roundBudget = 25 * time.Millisecond // for the whole round

func TestPhase3CountCombinations(t *testing.T) {
	count := fifteens.CountCombinations

	t.Run("count matches the listing on normal hands", func(t *testing.T) {
		for _, text := range []string{"JH 5D 5S QC", "7C 2D 6H 8S AD 5C", "4H 6C 5D 5S JC AH 9D 3S"} {
			cards := mustHand(t, text)
			assertEqual(t, count(cards, fifteens.Fifteen), len(fifteens.FindCombinations(cards, fifteens.Fifteen)), text)
		}
		assertEqual(t, count(mustHand(t, "KD 4C 6H 10S"), 10), 3, "KD 4C 6H 10S, target 10")
	})

	t.Run("medium hands match brute force", func(t *testing.T) {
		for _, hand := range mediumHands {
			cards := mustHand(t, hand.text)
			for _, target := range slices.Sorted(maps.Keys(hand.expected)) {
				assertEqual(t, count(cards, target), hand.expected[target], fmt.Sprintf("%s, target %d", hand.text, target))
			}
		}
	})

	t.Run("edge cases", func(t *testing.T) {
		fives := mustHand(t, "5H 5H 5H 5H")
		var counts []int
		for _, target := range []int{5, 10, 15, 20, 25} {
			counts = append(counts, count(fives, target))
		}
		assertEqual(t, counts, []int{4, 6, 4, 1, 0}, "5H 5H 5H 5H, targets 5 to 25")
		assertEqual(t, count(nil, 15), 0, "no cards")
		assertEqual(t, count(mustHand(t, "KH"), 10), 1, "KH, target 10")
		assertEqual(t, count(mustHand(t, "5H 10S"), 0), 0, "the empty combination never counts")
		assertEqual(t, count(mustHand(t, "5H 10S"), -4), 0, "target -4")
	})

	t.Run("marathon round is fast and exact", func(t *testing.T) {
		start := time.Now()
		for _, call := range marathonRound {
			got := count(call.cards, call.target)
			elapsed := time.Since(start)
			// Checked after every call, so a slow solution fails quickly
			// instead of running for hours on the bigger targets.
			if elapsed >= roundBudget {
				t.Fatalf("took %dms to get through target %d (%d cards); the whole marathon round must finish in under %dms",
					elapsed.Milliseconds(), call.target, len(call.cards), roundBudget.Milliseconds())
			}
			assertEqual(t, got, call.expected, fmt.Sprintf("%d-card hand, target %d", len(call.cards), call.target))
		}
	})
}
