package tests

import (
	"fmt"
	"slices"
	"testing"

	"debuggym/card-game/fifteens"
)

// names, assertEqual, mustHand and the other helpers are in phase1_test.go.

func listed(combos [][]fifteens.Card) [][]string {
	out := make([][]string, len(combos))
	for i, combo := range combos {
		out[i] = names(combo)
	}
	return out
}

// assertValidCombinations checks every listed combination without trusting
// the code under test.
//
// Each combination must use cards from the hand, in hand order, and add up to
// the target. The list must have no repeats and must be sorted by card
// positions in dictionary order. (Needs a hand without repeated cards.)
func assertValidCombinations(t *testing.T, cards []fifteens.Card, target int, combos [][]fifteens.Card) {
	t.Helper()
	position := make(map[string]int, len(cards))
	for i, card := range cards {
		position[card.String()] = i
	}
	assertEqual(t, len(position), len(cards), "checker needs a hand without repeated cards")
	var seen [][]int
	for _, combo := range combos {
		if len(combo) == 0 {
			t.Fatal("a combination must hold at least one card")
		}
		var index []int
		total := 0
		for _, card := range combo {
			p, ok := position[card.String()]
			if !ok {
				t.Fatalf("%s is not in the hand", card)
			}
			index = append(index, p)
			total += card.Value()
		}
		for i := 1; i < len(index); i++ {
			if index[i] <= index[i-1] {
				t.Fatalf("%v is not in hand order", names(combo))
			}
		}
		assertEqual(t, total, target, fmt.Sprintf("%v doesn't add up to %d", names(combo), target))
		seen = append(seen, index)
	}
	unique := make(map[string]bool, len(seen))
	for _, index := range seen {
		unique[fmt.Sprint(index)] = true
	}
	assertEqual(t, len(unique), len(seen), "a combination is listed twice")
	sorted := slices.Clone(seen)
	slices.SortFunc(sorted, slices.Compare[[]int])
	assertEqual(t, seen, sorted, "combinations are not in dictionary order of positions")
}

func TestPhase2FindCombinations(t *testing.T) {
	find := fifteens.FindCombinations
	const fifteen = fifteens.Fifteen

	t.Run("two-card fifteen", func(t *testing.T) {
		assertEqual(t, listed(find(mustHand(t, "5H 10S"), fifteen)), [][]string{{"5H", "10S"}}, "combinations")
	})

	t.Run("five-card fifteen", func(t *testing.T) {
		assertEqual(t, listed(find(mustHand(t, "AC 2D 3H 4S 5C"), fifteen)), [][]string{{"AC", "2D", "3H", "4S", "5C"}}, "combinations")
	})

	t.Run("two fives count separately", func(t *testing.T) {
		combos := find(mustHand(t, "JH 5D 5S QC"), fifteen)
		assertEqual(t, listed(combos), [][]string{{"JH", "5D"}, {"JH", "5S"}, {"5D", "QC"}, {"5S", "QC"}}, "combinations")
	})

	t.Run("combinations are listed in position order", func(t *testing.T) {
		assertEqual(t, listed(find(mustHand(t, "7C 2D 6H 8S AD 5C"), fifteen)), [][]string{
			{"7C", "2D", "6H"},
			{"7C", "2D", "AD", "5C"},
			{"7C", "8S"},
			{"2D", "8S", "5C"},
			{"6H", "8S", "AD"},
		}, "combinations")
	})

	t.Run("mixed sizes with repeated ranks", func(t *testing.T) {
		assertEqual(t, listed(find(mustHand(t, "9S 6D 3C 3H AS 2D"), fifteen)), [][]string{
			{"9S", "6D"},
			{"9S", "3C", "3H"},
			{"9S", "3C", "AS", "2D"},
			{"9S", "3H", "AS", "2D"},
			{"6D", "3C", "3H", "AS", "2D"},
		}, "combinations")
	})

	t.Run("a card typed twice counts twice", func(t *testing.T) {
		assertEqual(t, listed(find(mustHand(t, "8C 7H 8C"), fifteen)), [][]string{{"8C", "7H"}, {"7H", "8C"}}, "combinations")
	})

	t.Run("other targets", func(t *testing.T) {
		assertEqual(t, listed(find(mustHand(t, "KD 4C 6H 10S"), 10)), [][]string{{"KD"}, {"4C", "6H"}, {"10S"}}, "target 10")
		assertEqual(t, listed(find(mustHand(t, "3S 3D 9C 6H"), 21)), [][]string{{"3S", "3D", "9C", "6H"}}, "target 21")
	})

	t.Run("nothing adds up", func(t *testing.T) {
		if combos := find(mustHand(t, "KC QD JH"), fifteen); len(combos) != 0 {
			t.Fatalf("KC QD JH: got %v, want none", listed(combos))
		}
		if combos := find(nil, fifteen); len(combos) != 0 {
			t.Fatalf("no cards: got %v, want none", listed(combos))
		}
		if combos := find(mustHand(t, "5H 10S"), 0); len(combos) != 0 {
			t.Fatalf("only non-empty combinations count: target 0 gave %v", listed(combos))
		}
		if combos := find(mustHand(t, "5H 10S"), -5); len(combos) != 0 {
			t.Fatalf("target -5: got %v, want none", listed(combos))
		}
	})

	t.Run("eight-card hand", func(t *testing.T) {
		cards := mustHand(t, "4H 6C 5D 5S JC AH 9D 3S")
		combos := find(cards, fifteen)
		assertEqual(t, len(combos), 11, "number of combinations")
		assertValidCombinations(t, cards, 15, combos)
	})

	t.Run("sixteen-card practice hand", func(t *testing.T) {
		cards := mustHand(t, "5C 2C QS 6S 7H AC 3S 3H QC AD JC 7D QD 6H 2S AH")
		combos := find(cards, fifteen)
		assertEqual(t, len(combos), 205, "number of combinations")
		assertValidCombinations(t, cards, 15, combos)
	})

	t.Run("returns the hand cards", func(t *testing.T) {
		cards := mustHand(t, "6C 4D 5H 9S AC")
		combos := find(cards, fifteen)
		assertEqual(t, listed(combos), [][]string{{"6C", "4D", "5H"}, {"6C", "9S"}, {"5H", "9S", "AC"}}, "combinations")
		assertEqual(t, combos[1], []fifteens.Card{cards[0], cards[3]}, "second combination")
	})
}

func TestPhase2ScoreHand(t *testing.T) {
	t.Run("famous twenty-eight hand", func(t *testing.T) {
		score := fifteens.ScoreHand(mustHand(t, "5C 5D 5H JS 5S"))
		assertEqual(t, []int{len(score.Fifteens), len(score.Pairs), len(score.Runs)}, []int{8, 6, 0}, "fifteens, pairs and runs")
		assertEqual(t, score.Total(), 28, "total")
	})

	t.Run("fifteens of every size score", func(t *testing.T) {
		score := fifteens.ScoreHand(mustHand(t, "2H 3C 4D 6S KH"))
		assertEqual(t, listed(score.Fifteens), [][]string{{"2H", "3C", "4D", "6S"}, {"2H", "3C", "KH"}}, "fifteens")
		assertEqual(t, score.Total(), 7, "total")
		assertEqual(t, fifteens.ScoreHand(mustHand(t, "AC 2D 3H 4S 5C")).Total(), 7, "total for AC 2D 3H 4S 5C")
	})

	t.Run("eight-card hand total", func(t *testing.T) {
		score := fifteens.ScoreHand(mustHand(t, "4H 6C 5D 5S JC AH 9D 3S"))
		assertEqual(t, []int{score.FifteenPoints(), score.PairPoints(), score.RunPoints()}, []int{22, 2, 4}, "fifteen, pair and run points")
		assertEqual(t, score.Total(), 28, "total")
	})

	t.Run("seeded match standings", func(t *testing.T) {
		match := mustMatch(t, players, 2024)
		standings, err := match.Play(5)
		if err != nil {
			t.Fatalf("Play(5): %v", err)
		}
		assertEqual(t, standings, []fifteens.Standing{{Name: "Cy", Total: 31}, {Name: "Ana", Total: 24}, {Name: "Ben", Total: 22}}, "standings")
		last := match.Rounds[len(match.Rounds)-1]
		assertEqual(t, append(names(last.Hands["Cy"]), last.TurnUp.String()), []string{"3C", "AS", "2S", "5D", "4S"}, "Cy's last hand and the turn-up")
		assertEqual(t, last.Scores["Cy"].Total(), 7, "A-2-3-4-5 is a five-card fifteen plus a run of five")
	})
}
