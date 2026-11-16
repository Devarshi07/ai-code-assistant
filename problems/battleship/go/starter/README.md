# Armada

Armada is the naval-combat simulation library behind the studio's bot-testing
harness. Designers write AI opponents ("bots") for our Battleship-style game;
QA generates seeded fleets, plays every bot against them and tracks how many
shots each one needs.

```
     1  2  3  4  5  6  7  8  9 10        A  Carrier     5 cells
 A   .  .  A  A  A  A  A  .  .  .        B  Battleship  4 cells
 B   .  .  .  .  .  .  .  .  .  .        C  Cruiser     3 cells
 C   .  .  .  .  .  .  .  .  .  .        D  Submarine   3 cells
 D   .  .  .  C  .  .  .  .  .  .        E  Destroyer   2 cells
 E   .  .  .  C  .  .  .  .  .  .
 F   .  .  E  C  .  .  B  B  B  B        RandomFleet(7, 10, DefaultFleet)
 G   .  .  E  .  D  .  .  .  .  .
 H   .  .  .  .  D  .  .  .  .  .
 I   .  .  .  .  D  .  .  .  .  .
 J   .  .  .  .  .  .  .  .  .  .
```

## House rules

- The ocean is square, 10x10 by default (4 to 26 per side). Rows are lettered
  from A at the top, columns numbered from 1, so `B7` is row 1, column 6.
- The standard fleet has ships of length 5, 4, 3, 3 and 2. Ships are straight
  horizontal or vertical lines, stay on the board and never overlap. They may
  touch side by side.
- Every shot comes back `MISS`, `HIT` or `SUNK` (`armada.Miss`, `armada.Hit`,
  `armada.Sunk`). `SUNK` is reported by the shot that hits the last undamaged
  cell of a ship. It does not say which ship.
- **Repeats are wasted.** A shot at a cell that has already been fired at
  still counts as a shot, always comes back `MISS`, is flagged as a repeat in
  the log, and changes nothing on the board.
- A shot off the board returns an `*OffBoardError` and is not counted.
- A match ends when the fleet is sunk or the shot budget runs out. The default
  budget is one shot per cell.

## Layout

The module is `debuggym/battleship`; the library is the `armada` package.

| File | Responsibility |
| --- | --- |
| `armada/ocean.go` | `Coord`, `Ocean`: bounds, neighbours, `A1` labels, text rendering |
| `armada/ships.go` | `Ship`, `Fleet`: placement rules, `DefaultFleet` |
| `armada/placer.go` | `Rng` (mulberry32) and `RandomFleet(seed, size, shipSizes)` |
| `armada/battle.go` | `Battle`: shot resolution, the shot log, the shooter's chart |
| `armada/match.go` | `PlayMatch` and `RunSeries`: the harness that drives bots |
| `armada/bots.go` | The `Bot` interface, `ScriptedBot`, and `SeekerBot` |
| `main.go` | Demo: a seeded fleet, a replayed QA ticket, the reference bot |

`Coord{Row, Col}` is a plain comparable value, so it works directly as a map
key. `ParseLabel("B7")` reads a label and `c.String()` writes one;
`MustParseLabel` is for labels written in code.

Errors are values. `Battle.Fire` returns an `*OffBoardError`, `Fleet.Place`
and `RandomFleet` return a `*PlacementError`, and a bot's `NextShot` returns a
`*BotError` when it has no legal shot left. `NewOcean` panics on a board size
outside 4..26, because sizes come from code, never from players.

## Writing a bot

Implement `Bot`. The match runner creates a **fresh** bot for each match with
a constructor such as `NewMyBot(size, shipSizes)` and then repeats:

```go
coord, err := bot.NextShot()       // a Coord on the board
result, err := battle.Fire(coord)  // armada.Miss / Hit / Sunk
bot.Observe(coord, result)
```

until the fleet is sunk or the budget is spent. The fleet's make-up
(`shipSizes`) is public; where the ships are is not. Bots must never look at
the fleet or the `Battle`. `ScriptedBot` is the simplest example.

## Reproducible fleets

QA replays the same matches in the harness of every language the studio uses,
so `RandomFleet(seed, ...)` must give the identical fleet in all of them.
That's why the placer uses its own mulberry32 generator instead of
`math/rand`.

## Running

```
go run .
go test ./tests/...
```
