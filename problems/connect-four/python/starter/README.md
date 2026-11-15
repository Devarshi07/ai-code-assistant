# Connect Four engine

This package is the game engine behind our Connect Four app: the board model,
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
  strings and the rendered board use 1-based numbers. `describe_move(3)` is
  `"column 4"`.
- Cells are addressed as `(col, row)` with row 0 at the **bottom**.
- A **move string** lists the columns played in order, 1-based, Red first:
  `"4453"` is Red 4, Yellow 4, Red 5, Yellow 3.
- A **grid** is the position drawn top row first, one line per row, using
  `R`, `Y` and `.`. `Board.from_grid` ignores spaces and `|` borders, and
  works out the side to move from the disc counts.
- A **ply** is one disc dropped by either player.

## Layout

| Module | Responsibility |
| --- | --- |
| `connect4/board.py` | `Board`: drop, undo, legal moves, copying, move strings and grids |
| `connect4/rules.py` | Win detection: `winning_line`, `is_winning_drop`, `winning_columns`, `find_winner` |
| `connect4/game.py` | `Game`: turns, results, replaying stored move logs |
| `connect4/render.py` | Text boards for the CLI, logs and tickets |
| `connect4/ai.py` | Computer player: `evaluate`, `choose_move`, `solve` |
| `connect4/samples.py` | A reported game and the daily puzzles used by the demo |
| `main.py` | Demo: replays a game, asks the computer for a move, checks puzzles |

`Board` does not know the rules. It keeps accepting discs after a four,
which is what search code wants when it plays a line out and takes it back
with `undo()`. `Game` is the layer that enforces "no moves after a win".

## The computer player

`ai.py` holds the heuristic `evaluate(board, player)` and `centre_order`.
`choose_move` (the opponent in "Play the computer") and `solve` (the daily
puzzle checker) are still to be written.

## Running

```
python main.py
python -m unittest discover -s tests -v
```
