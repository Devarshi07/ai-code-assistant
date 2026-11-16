package fifteens

import (
	"fmt"
	"slices"
)

// A match seats MinPlayers to MaxPlayers players, dealt DefaultHandSize
// cards each unless MatchOptions says otherwise.
const (
	MinPlayers      = 2
	MaxPlayers      = 4
	DefaultHandSize = 4
)

// MatchError reports a match that can't be set up as requested.
type MatchError struct {
	Reason string
}

func (e *MatchError) Error() string {
	return e.Reason
}

// MatchOptions configures a new match. Zero values mean seed 0 and the
// default hand size.
type MatchOptions struct {
	Seed     int
	HandSize int
}

// RoundResult is one played round.
type RoundResult struct {
	Number int               // 1 for the first round of the match
	TurnUp Card              // the card turned up after the deal
	Hands  map[string][]Card // cards each player holds (turn-up not included)
	Scores map[string]Score  // each player's hand scored with the turn-up
}

// Standing is a player's total so far.
type Standing struct {
	Name  string
	Total int
}

// Match is the round and match runner used by the game server.
//
// A match seats two to four players around one deck. Every round the dealer
// gathers and shuffles all 52 cards, deals the hands one card at a time in
// seating order, then turns up one more card. The turn-up counts as part of
// every player's hand when the round is scored.
type Match struct {
	Players  []string // in seating order
	Seed     int
	HandSize int
	Totals   map[string]int
	Rounds   []RoundResult
	deck     *Deck
}

// NewMatch seats the players around a deck shuffled from opts.Seed.
func NewMatch(players []string, opts MatchOptions) (*Match, error) {
	handSize := opts.HandSize
	if handSize == 0 {
		handSize = DefaultHandSize
	}
	if len(players) < MinPlayers || len(players) > MaxPlayers {
		return nil, &MatchError{fmt.Sprintf("a match needs %d to %d players", MinPlayers, MaxPlayers)}
	}
	totals := make(map[string]int, len(players))
	for _, name := range players {
		if _, taken := totals[name]; taken {
			return nil, &MatchError{"player names must be unique"}
		}
		totals[name] = 0
	}
	if handSize < 1 || len(players)*handSize+1 > 52 {
		return nil, &MatchError{fmt.Sprintf("cannot deal %d cards to %d players", handSize, len(players))}
	}
	return &Match{
		Players:  slices.Clone(players),
		Seed:     opts.Seed,
		HandSize: handSize,
		Totals:   totals,
		deck:     NewDeck(opts.Seed),
	}, nil
}

// DealRound shuffles the full deck and deals every hand, then the turn-up.
func (m *Match) DealRound() (map[string][]Card, Card, error) {
	m.deck.Reset()
	m.deck.Shuffle()
	hands := make(map[string][]Card, len(m.Players))
	for range m.HandSize {
		for _, name := range m.Players {
			dealt, err := m.deck.Deal(1)
			if err != nil {
				return nil, Card{}, err
			}
			hands[name] = append(hands[name], dealt...)
		}
	}
	turnUp, err := m.deck.Deal(1)
	if err != nil {
		return nil, Card{}, err
	}
	return hands, turnUp[0], nil
}

// PlayRound deals a round, scores every hand with the turn-up and adds the
// scores to the totals.
func (m *Match) PlayRound() (RoundResult, error) {
	hands, turnUp, err := m.DealRound()
	if err != nil {
		return RoundResult{}, err
	}
	scores := make(map[string]Score, len(m.Players))
	for _, name := range m.Players {
		score := ScoreHand(append(slices.Clone(hands[name]), turnUp))
		scores[name] = score
		m.Totals[name] += score.Total()
	}
	result := RoundResult{Number: len(m.Rounds) + 1, TurnUp: turnUp, Hands: hands, Scores: scores}
	m.Rounds = append(m.Rounds, result)
	return result, nil
}

// Play plays more rounds and returns the standings.
func (m *Match) Play(rounds int) ([]Standing, error) {
	for range rounds {
		if _, err := m.PlayRound(); err != nil {
			return nil, err
		}
	}
	return m.Standings(), nil
}

// Standings lists the players with their totals, highest first; ties keep
// seating order.
func (m *Match) Standings() []Standing {
	standings := make([]Standing, len(m.Players))
	for i, name := range m.Players {
		standings[i] = Standing{Name: name, Total: m.Totals[name]}
	}
	slices.SortStableFunc(standings, func(a, b Standing) int { return b.Total - a.Total })
	return standings
}
