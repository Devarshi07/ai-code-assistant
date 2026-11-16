package fifteens

import (
	"fmt"
	"slices"
)

// standardOrder is the fresh-deck order: clubs, diamonds, hearts, spades; ace
// to king in each suit.
var standardOrder = freshOrder()

func freshOrder() []Card {
	cards := make([]Card, 0, len(Suits)*len(Ranks))
	for _, suit := range Suits {
		for _, rank := range Ranks {
			cards = append(cards, Card{Rank: rank, Suit: suit})
		}
	}
	return cards
}

// DeckError reports a deal that asks for more cards than the deck holds.
type DeckError struct {
	Requested, Left int
}

func (e *DeckError) Error() string {
	return fmt.Sprintf("cannot deal %d card(s), only %d left", e.Requested, e.Left)
}

// SeededRandom is a 32-bit linear congruential generator (Numerical Recipes
// constants). The JavaScript client implements the same arithmetic, so both
// produce the same sequence for the same seed.
type SeededRandom struct {
	state uint32
}

// NewSeededRandom starts a generator. The seed is taken modulo 2^32.
func NewSeededRandom(seed int) *SeededRandom {
	return &SeededRandom{state: uint32(seed)}
}

// NextUint32 advances the generator and returns its new state.
func (r *SeededRandom) NextUint32() uint32 {
	r.state = r.state*1664525 + 1013904223
	return r.state
}

// Below returns an integer in [0, n), taken from the high bits of the next value.
func (r *SeededRandom) Below(n int) int {
	return int(uint64(r.NextUint32()) * uint64(n) >> 32)
}

// Deck is a standard 52-card deck with reproducible shuffles: the cards not
// yet dealt, top of the deck first.
//
// Every match stores its seed. Support's replay tool rebuilds a disputed
// match from that seed, so a given seed must always produce the same deals,
// on the server and in the JavaScript client alike. That is why the deck uses
// its own small generator instead of math/rand.
type Deck struct {
	Seed  int
	rng   *SeededRandom
	cards []Card
}

// NewDeck returns a full deck in fresh-deck order.
func NewDeck(seed int) *Deck {
	d := &Deck{Seed: seed, rng: NewSeededRandom(seed)}
	d.Reset()
	return d
}

// Reset gathers all 52 cards back into the deck, in fresh-deck order.
func (d *Deck) Reset() {
	d.cards = standardOrder
}

// Shuffle is a Fisher-Yates shuffle of the cards currently in the deck.
func (d *Deck) Shuffle() {
	for i := len(d.cards) - 1; i > 0; i-- {
		j := d.rng.Below(i + 1)
		d.cards[i], d.cards[j] = d.cards[j], d.cards[i]
	}
}

// Deal removes count cards from the top of the deck and returns them.
func (d *Deck) Deal(count int) ([]Card, error) {
	if count > len(d.cards) {
		return nil, &DeckError{Requested: count, Left: len(d.cards)}
	}
	dealt := slices.Clone(d.cards[:count])
	// Move the rest up to the top in place, so the deck keeps one backing array.
	d.cards = append(d.cards[:0], d.cards[count:]...)
	return dealt, nil
}

// Peek returns the cards still in the deck, top first (a copy).
func (d *Deck) Peek() []Card {
	return slices.Clone(d.cards)
}

// Size is the number of cards still in the deck.
func (d *Deck) Size() int {
	return len(d.cards)
}

func (d *Deck) String() string {
	return fmt.Sprintf("Deck(seed=%d, %d cards left)", d.Seed, d.Size())
}
