// Package fifteens is the scoring engine for Fifteens, a casual card game: it
// parses cards, shuffles and deals seeded decks, finds the scoring patterns in
// a hand, and runs rounds and matches.
//
// Cards are written rank first, then suit: "AC" is the ace of clubs, "10H"
// the ten of hearts and "QS" the queen of spades. "T" is accepted for ten
// because some older clients still send it. Hands travel as space- or
// comma-separated strings such as "5H 5S JD QC".
package fifteens

import (
	"fmt"
	"slices"
	"strings"
)

// Ranks from ace to king, and suits in fresh-deck order.
var (
	Ranks = []string{"A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"}
	Suits = []string{"C", "D", "H", "S"}
)

var suitNames = map[string]string{"C": "clubs", "D": "diamonds", "H": "hearts", "S": "spades"}

// FaceValue is what jacks, queens and kings are worth when counting fifteens.
const FaceValue = 10

// CardError reports card text the parser doesn't understand.
type CardError struct {
	Text string
}

func (e *CardError) Error() string {
	return fmt.Sprintf("not a card: '%s'", e.Text)
}

// Card is one playing card, such as the ten of hearts (Rank "10", Suit "H").
type Card struct {
	Rank string
	Suit string
}

// Order is the rank order used for runs and sorting: A=1, 2-10, J=11, Q=12, K=13.
func (c Card) Order() int {
	return slices.Index(Ranks, c.Rank) + 1
}

// Value is the counting value for fifteens: A=1, number cards at face value, J/Q/K=10.
func (c Card) Value() int {
	return min(c.Order(), FaceValue)
}

// Name spells the card out, such as "10 of hearts".
func (c Card) Name() string {
	return c.Rank + " of " + suitNames[c.Suit]
}

// String gives the short form, such as "10H".
func (c Card) String() string {
	return c.Rank + c.Suit
}

// ParseCard parses one card such as "10H", "qs" or "AC".
func ParseCard(text string) (Card, error) {
	token := strings.ToUpper(strings.TrimSpace(text))
	split := max(len(token)-1, 0)
	rank, suit := token[:split], token[split:]
	if rank == "T" {
		rank = "10"
	}
	if !slices.Contains(Ranks, rank) || !slices.Contains(Suits, suit) {
		return Card{}, &CardError{Text: text}
	}
	return Card{Rank: rank, Suit: suit}, nil
}

// ParseHand parses a hand written as "5H 5S JD" or "5H,5S,JD". The order of
// the cards is kept: it is the order the player sees them in.
func ParseHand(text string) ([]Card, error) {
	fields := strings.Fields(strings.ReplaceAll(text, ",", " "))
	cards := make([]Card, 0, len(fields))
	for _, field := range fields {
		card, err := ParseCard(field)
		if err != nil {
			return nil, err
		}
		cards = append(cards, card)
	}
	return cards, nil
}

// MustParseHand is like ParseHand but panics on a bad card. It is meant for
// hands written into code, such as demos and tests.
func MustParseHand(text string) []Card {
	cards, err := ParseHand(text)
	if err != nil {
		panic(err)
	}
	return cards
}

// FormatCards writes cards in short form, separated by spaces.
func FormatCards(cards []Card) string {
	parts := make([]string, len(cards))
	for i, card := range cards {
		parts[i] = card.String()
	}
	return strings.Join(parts, " ")
}
