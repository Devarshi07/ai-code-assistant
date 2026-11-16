package tests

import (
	"errors"
	"fmt"
	"reflect"
	"testing"

	"debuggym/card-game/fifteens"
)

// The helpers in this file are shared by every test file in the package.

var players = []string{"Ana", "Ben", "Cy"}

// assertEqual stops the test when got and want differ.
func assertEqual(t *testing.T, got, want any, what string) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%s: got %v, want %v", what, got, want)
	}
}

func names(cards []fifteens.Card) []string {
	out := make([]string, len(cards))
	for i, card := range cards {
		out[i] = card.String()
	}
	return out
}

func distinct(items []string) int {
	seen := make(map[string]bool, len(items))
	for _, item := range items {
		seen[item] = true
	}
	return len(seen)
}

func mustCard(t *testing.T, text string) fifteens.Card {
	t.Helper()
	card, err := fifteens.ParseCard(text)
	if err != nil {
		t.Fatalf("ParseCard(%q): %v", text, err)
	}
	return card
}

func mustHand(t *testing.T, text string) []fifteens.Card {
	t.Helper()
	cards, err := fifteens.ParseHand(text)
	if err != nil {
		t.Fatalf("ParseHand(%q): %v", text, err)
	}
	return cards
}

func mustDeal(t *testing.T, deck *fifteens.Deck, count int) []fifteens.Card {
	t.Helper()
	cards, err := deck.Deal(count)
	if err != nil {
		t.Fatalf("Deal(%d): %v", count, err)
	}
	return cards
}

func mustMatch(t *testing.T, seated []string, seed int) *fifteens.Match {
	t.Helper()
	match, err := fifteens.NewMatch(seated, fifteens.MatchOptions{Seed: seed})
	if err != nil {
		t.Fatalf("NewMatch: %v", err)
	}
	return match
}

func mustPlayRound(t *testing.T, match *fifteens.Match) fifteens.RoundResult {
	t.Helper()
	result, err := match.PlayRound()
	if err != nil {
		t.Fatalf("round %d: %v", len(match.Rounds)+1, err)
	}
	return result
}

// dealtCards is every card on the table in a round: all hands plus the turn-up.
func dealtCards(result fifteens.RoundResult) []string {
	var cards []string
	for _, hand := range result.Hands {
		cards = append(cards, names(hand)...)
	}
	return append(cards, result.TurnUp.String())
}

func TestPhase1Cards(t *testing.T) {
	t.Run("parses tens and face cards", func(t *testing.T) {
		ten := mustCard(t, "10H")
		assertEqual(t, []any{ten.Rank, ten.Suit, ten.Value()}, []any{"10", "H", 10}, `rank, suit and value of "10H"`)
		assertEqual(t, mustCard(t, "qs").String(), "QS", `ParseCard("qs")`)
		assertEqual(t, mustCard(t, " ac ").String(), "AC", `ParseCard(" ac ")`)
		assertEqual(t, mustCard(t, "TD").String(), "10D", `ParseCard("TD")`)
	})

	t.Run("counting values and rank order", func(t *testing.T) {
		var values, orders []int
		for _, card := range mustHand(t, "AC 7D 10S JH QC KD") {
			values = append(values, card.Value())
			orders = append(orders, card.Order())
		}
		assertEqual(t, values, []int{1, 7, 10, 10, 10, 10}, "values")
		assertEqual(t, orders, []int{1, 7, 10, 11, 12, 13}, "orders")
	})

	t.Run("rejects unknown cards", func(t *testing.T) {
		for _, text := range []string{"1H", "11S", "5X", "Z", ""} {
			_, err := fifteens.ParseCard(text)
			var cardErr *fifteens.CardError
			if !errors.As(err, &cardErr) {
				t.Fatalf("ParseCard(%q): got error %v, want a *CardError", text, err)
			}
		}
	})

	t.Run("ParseHand keeps order and accepts commas", func(t *testing.T) {
		assertEqual(t, names(mustHand(t, "5H, 5S JD,QC")), []string{"5H", "5S", "JD", "QC"}, `ParseHand("5H, 5S JD,QC")`)
	})
}

func TestPhase1Scoring(t *testing.T) {
	t.Run("pairs score two points each", func(t *testing.T) {
		cards := mustHand(t, "7H 7S 7D 2C")
		var pairs [][]string
		for _, pair := range fifteens.FindPairs(cards) {
			pairs = append(pairs, names(pair[:]))
		}
		assertEqual(t, pairs, [][]string{{"7H", "7S"}, {"7H", "7D"}, {"7S", "7D"}}, "pairs")
		assertEqual(t, fifteens.ScoreHand(cards).Total(), 6, "total")
	})

	t.Run("runs score one point per rank", func(t *testing.T) {
		assertEqual(t, fifteens.FindRuns(mustHand(t, "9C 10D JH QS KD")), [][]string{{"9", "10", "J", "Q", "K"}}, "runs in 9C 10D JH QS KD")
		assertEqual(t, fifteens.FindRuns(mustHand(t, "3C 4D 4H 5S 9C")), [][]string{{"3", "4", "5"}}, "runs in 3C 4D 4H 5S 9C")
		if runs := fifteens.FindRuns(mustHand(t, "QC KD AH 2S")); len(runs) != 0 {
			t.Fatalf("runs don't wrap from king to ace: got %v", runs)
		}
	})

	t.Run("face cards make fifteen with a five", func(t *testing.T) {
		score := fifteens.ScoreHand(mustHand(t, "KH 5D"))
		var fifteensFound [][]string
		for _, combo := range score.Fifteens {
			fifteensFound = append(fifteensFound, names(combo))
		}
		assertEqual(t, fifteensFound, [][]string{{"KH", "5D"}}, "fifteens")
		assertEqual(t, score.Total(), 2, "total")
	})

	t.Run("mixed hand breakdown", func(t *testing.T) {
		score := fifteens.ScoreHand(mustHand(t, "QD 3S 4H 5C 5S"))
		assertEqual(t, []int{score.FifteenPoints(), score.PairPoints(), score.RunPoints()}, []int{4, 2, 3}, "fifteen, pair and run points")
		assertEqual(t, score.Total(), 9, "total")
	})
}

func TestPhase1Deck(t *testing.T) {
	t.Run("new deck holds all 52 cards", func(t *testing.T) {
		deck := fifteens.NewDeck(1)
		assertEqual(t, deck.Size(), 52, "size")
		cards := names(mustDeal(t, deck, 52))
		assertEqual(t, distinct(cards), 52, "distinct cards")
		assertEqual(t, cards[:3], []string{"AC", "2C", "3C"}, "an unshuffled deck is in fresh-deck order")
		_, err := deck.Deal(1)
		var deckErr *fifteens.DeckError
		if !errors.As(err, &deckErr) {
			t.Fatalf("Deal(1) on an empty deck: got error %v, want a *DeckError", err)
		}
	})

	t.Run("dealt cards leave the deck", func(t *testing.T) {
		deck := fifteens.NewDeck(5)
		deck.Shuffle()
		hand := names(mustDeal(t, deck, 5))
		assertEqual(t, deck.Size(), 47, "size")
		rest := map[string]bool{}
		for _, card := range names(deck.Peek()) {
			rest[card] = true
		}
		for _, card := range hand {
			if rest[card] {
				t.Fatalf("a dealt card is still in the deck: %s", card)
			}
		}
	})

	t.Run("reset brings every card back", func(t *testing.T) {
		deck := fifteens.NewDeck(8)
		deck.Shuffle()
		mustDeal(t, deck, 20)
		deck.Reset()
		assertEqual(t, deck.Size(), 52, "size")
		assertEqual(t, distinct(names(deck.Peek())), 52, "distinct cards")
	})

	t.Run("seeded shuffle matches the replay log", func(t *testing.T) {
		deck := fifteens.NewDeck(42)
		deck.Shuffle()
		assertEqual(t, names(mustDeal(t, deck, 6)), []string{"5H", "9S", "9C", "JS", "3C", "2D"}, "first six cards")
	})

	t.Run("same seed gives the same deal", func(t *testing.T) {
		first := fifteens.NewDeck(7)
		second := fifteens.NewDeck(7)
		first.Shuffle()
		second.Shuffle()
		assertEqual(t, names(mustDeal(t, first, 5)), names(mustDeal(t, second, 5)), "first deck's deal vs second deck's")
	})
}

func TestPhase1Match(t *testing.T) {
	t.Run("round deals distinct cards", func(t *testing.T) {
		result := mustPlayRound(t, mustMatch(t, players, 3))
		var sizes []int
		for _, name := range players {
			sizes = append(sizes, len(result.Hands[name]))
		}
		assertEqual(t, sizes, []int{4, 4, 4}, "hand sizes")
		assertEqual(t, distinct(dealtCards(result)), 13, "the same card was dealt twice in one round")
	})

	t.Run("first rounds match the replay log", func(t *testing.T) {
		match := mustMatch(t, []string{"Ana", "Ben"}, 4412)
		first := mustPlayRound(t, match)
		assertEqual(t, names(first.Hands["Ana"]), []string{"KH", "3C", "10C", "6S"}, "round 1, Ana")
		assertEqual(t, names(first.Hands["Ben"]), []string{"8C", "7C", "8D", "8H"}, "round 1, Ben")
		assertEqual(t, first.TurnUp.String(), "5D", "round 1 turn-up")
		second := mustPlayRound(t, match)
		assertEqual(t, names(second.Hands["Ana"]), []string{"4C", "2S", "7S", "JH"}, "round 2, Ana")
		assertEqual(t, names(second.Hands["Ben"]), []string{"6C", "AH", "JS", "9H"}, "round 2, Ben")
		assertEqual(t, second.TurnUp.String(), "4H", "round 2 turn-up")
	})

	t.Run("long match uses the full deck every round", func(t *testing.T) {
		match := mustMatch(t, players, 11)
		if _, err := match.Play(8); err != nil {
			t.Fatalf("Play(8): %v", err)
		}
		assertEqual(t, len(match.Rounds), 8, "rounds played")
		for _, result := range match.Rounds {
			assertEqual(t, distinct(dealtCards(result)), 13, fmt.Sprintf("round %d reused a card", result.Number))
		}
		scored, total := 0, 0
		for _, result := range match.Rounds {
			for _, score := range result.Scores {
				scored += score.Total()
			}
		}
		for _, points := range match.Totals {
			total += points
		}
		assertEqual(t, total, scored, "sum of the totals vs sum of the round scores")
	})

	t.Run("replaying a seed reproduces the match", func(t *testing.T) {
		original := mustMatch(t, players, 2024)
		if _, err := original.Play(3); err != nil {
			t.Fatalf("original Play(3): %v", err)
		}
		replay := mustMatch(t, players, 2024)
		if _, err := replay.Play(3); err != nil {
			t.Fatalf("replay Play(3): %v", err)
		}
		for i, before := range original.Rounds {
			after := replay.Rounds[i]
			for _, name := range players {
				assertEqual(t, names(after.Hands[name]), names(before.Hands[name]), fmt.Sprintf("round %d, %s", before.Number, name))
			}
			assertEqual(t, after.TurnUp.String(), before.TurnUp.String(), fmt.Sprintf("round %d turn-up", before.Number))
		}
		assertEqual(t, replay.Standings(), original.Standings(), "standings")
	})
}
