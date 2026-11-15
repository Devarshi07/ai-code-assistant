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
  strings and the rendered board use 1-based numbers. `describeMove(3)` is
  `"column 4"`.
- Cells are addressed as `[col, row]` with row 0 at the **bottom**.
- A **move string** lists the columns played in order, 1-based, Red first:
  `"4453"` is Red 4, Yellow 4, Red 5, Yellow 3.
- A **grid** is the position drawn top row first, one line per row, using
  `R`, `Y` and `.`. `Board.fromGrid` ignores spaces and `|` borders, and
  works out the side to move from the disc counts.
- A **ply** is one disc dropped by either player.

## Layout

| Module | Responsibility |
| --- | --- |
| `src/board.js` | `Board`: drop, undo, legal moves, copying, move strings and grids |
| `src/rules.js` | Win detection: `winningLine`, `isWinningDrop`, `winningColumns`, `findWinner` |
| `src/game.js` | `Game`: turns, results, replaying stored move logs |
| `src/render.js` | Text boards for the CLI, logs and tickets |
| `src/ai.js` | Computer player: `evaluate`, `chooseMove`, `solve` |
| `src/samples.js` | A reported game and the daily puzzles used by the demo |
| `main.js` | Demo: replays a game, asks the computer for a move, checks puzzles |

`Board` does not know the rules. It keeps accepting discs after a four,
which is what search code wants when it plays a line out and takes it back
with `undo()`. `Game` is the layer that enforces "no moves after a win".

## The computer player

`ai.js` holds the heuristic `evaluate(board, player)` and `centreOrder`.
`chooseMove` (the opponent in "Play the computer") and `solve` (the daily
puzzle checker) are still to be written.

## Running

```
node main.js
node --test "tests/*.test.js"
```
