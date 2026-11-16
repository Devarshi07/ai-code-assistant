# Fifteens scoring engine

Fifteens is a casual card game in the spirit of cribbage scoring. This module
is the server-side engine: it parses cards, shuffles and deals seeded decks,
finds the scoring patterns in a hand, and runs rounds and matches.

## Rules

Cards are written rank then suit: `AC`, `7D`, `10H`, `QS` (`T` is accepted
for ten). Suits are `C D H S`.

| Rank | Counting value (fifteens) | Rank order (runs) |
| --- | --- | --- |
| A | 1 | 1 |
| 2 to 10 | face value | 2 to 10 |
| J, Q, K | 10 | 11, 12, 13 |

A hand scores:

- **Fifteens:** 2 points for every combination of cards whose values add up
  to 15. Cards count by position, so `JH 5D 5S` holds two fifteens
  (`JH+5D` and `JH+5S`).
- **Pairs:** 2 points for every two cards of the same rank (three of a kind
  is three pairs).
- **Runs:** 1 point per rank in each run of three or more consecutive ranks.
  Aces are low and runs don't wrap past the king.

A match seats 2 to 4 players. Each round the whole deck is gathered and
shuffled, every player is dealt a hand (4 cards by default) one card at a time,
and one more card is turned up. Each hand is scored together with the turn-up.

Every match keeps its seed, and support's replay tool rebuilds disputed
matches from it, so the same seed must always produce the same deals.

## Layout

The module is `debuggym/card-game`; the engine is the `fifteens` package.

| File | Responsibility |
| --- | --- |
| `fifteens/cards.go` | `Card` (rank, suit, value, order), `ParseCard`, `ParseHand` |
| `fifteens/deck.go` | `SeededRandom` (32-bit LCG shared with the JavaScript client), `Deck` |
| `fifteens/evaluate.go` | Pattern finding: pairs, runs, fifteens, combination search |
| `fifteens/scoring.go` | `ScoreHand` and the `Score` breakdown |
| `fifteens/match.go` | `Match`: dealing rounds, scoring them, standings |
| `fifteens/tournament.go` | Marathon mode: combination counts for huge hands |
| `main.go` | Plays a seeded five-round match and scores showcase hands |

Cards are `Card` values; `card.String()` gives the short form such as `10H`.
Functions that can fail return an error (`*CardError`, `*DeckError`,
`*MatchError`).

## Running

```
go run .
go test ./tests/...
```
