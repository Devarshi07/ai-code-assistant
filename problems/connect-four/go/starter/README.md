# Connect Four engine

This project is the game engine behind our Connect Four app: the board model,
the rules, game flow for online matches, text rendering for logs and support
tickets, and the computer player used by "Play the computer" and the daily
puzzles.

```
| . . . . . . . |      R  Red (always moves first)
| . . . . . . . |      Y  Yellow
| . . . . . . . |      .  empty
| . . . Y . . . |
| . . R R . . . |      Discs fall to the lowest empty cell of a column.
| . . Y R Y . . |      Four in a row across, up, or along either
+---------------+      diagonal wins. A full board with no four is a draw.
  1 2 3 4 5 6 7
```

## Conventions

- The default board has 7 columns and 6 rows.
- **Columns are 0-based in code** (0 is the leftmost column). Players, move
  strings and the rendered board use 1-based numbers. `DescribeMove(3)` is
  `"column 4"`.
- Cells are addressed as `Cell{Col, Row}` with row 0 at the **bottom**.
- A **move string** lists the columns played in order, 1-based, Red first:
  `"4453"` is Red 4, Yellow 4, Red 5, Yellow 3.
- A **grid** is the position drawn top row first, one line per row, using
  `R`, `Y` and `.`. `BoardFromGrid` ignores spaces and `|` borders, and
  works out the side to move from the disc counts.
- A **ply** is one disc dropped by either player.
- Discs are `Disc` values: `Red`, `Yellow` and `Empty`.

## Layout

| File | Responsibility |
| --- | --- |
| `connect4/board.go` | `Board`: `Drop`, `Undo`, legal moves, copying, move strings and grids |
| `connect4/rules.go` | Win detection: `WinningLine`, `IsWinningDrop`, `WinningColumns`, `FindWinner` |
| `connect4/game.go` | `Game`: turns, results, replaying stored move logs |
| `connect4/render.go` | Text boards for the CLI, logs and tickets |
| `connect4/ai.go` | Computer player: `Evaluate`, `ChooseMove`, `Solve` |
| `connect4/samples.go` | A reported game and the daily puzzles used by the demo |
| `main.go` | Demo: replays a game, asks the computer for a move, checks puzzles |

`Board` does not know the rules. It keeps accepting discs after a four,
which is what search code wants when it plays a line out and takes it back
with `Undo()`. `Game` is the layer that enforces "no moves after a win".
Functions that can fail return an error (`*BoardError`, `*GameError`).

## The computer player

`ai.go` holds the heuristic `Evaluate(board, player)` and `CentreOrder`.
`ChooseMove` (the opponent in "Play the computer") and `Solve` (the daily
puzzle checker) are still to be written.

## Running

```
go run .
go test ./tests/...
```
