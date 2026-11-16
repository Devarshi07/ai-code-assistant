# Fifteens scoring engine

Fifteens is a casual card game in the spirit of cribbage scoring. This package
is the engine shared by the web client and the game server: it parses cards,
shuffles and deals seeded decks, finds the scoring patterns in a hand, and runs
rounds and matches.

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

| Module | Responsibility |
| --- | --- |
| `src/cards.ts` | `Card` (rank, suit, value, order), `parseCard`, `parseHand` |
| `src/deck.ts` | `SeededRandom` (32-bit LCG shared with the Python server), `Deck` |
| `src/evaluate.ts` | Pattern finding: pairs, runs, fifteens, combination search |
| `src/scoring.ts` | `scoreHand` and the `Score` breakdown |
| `src/match.ts` | `Match`: dealing rounds, scoring them, standings |
| `src/tournament.ts` | Marathon mode: combination counts for huge hands |
| `main.ts` | Plays a seeded five-round match and scores showcase hands |

Cards are `Card` instances; `String(card)` gives the short form such as `10H`.

The sources are ES modules. Node 22 runs them directly by stripping the type
annotations (there is no separate build step and no type check at run time),
so imports keep their `.ts` extension and the code avoids `enum` and other
syntax that needs compiling.

## Running

```
node --experimental-strip-types main.ts
node --test --experimental-strip-types "tests/*.test.ts"
```
