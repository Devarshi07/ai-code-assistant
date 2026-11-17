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
  strings and the rendered board use 1-based numbers. `Render.describeMove(3)`
  is `"column 4"`.
- Cells are addressed as `Cell(col, row)` with row 0 at the **bottom**.
- A **move string** lists the columns played in order, 1-based, Red first:
  `"4453"` is Red 4, Yellow 4, Red 5, Yellow 3.
- A **grid** is the position drawn top row first, one line per row, using
  `R`, `Y` and `.`. `Board.fromGrid` ignores spaces and `|` borders, and
  works out the side to move from the disc counts.
- A **ply** is one disc dropped by either player.
- Discs are `char`s: `Board.RED`, `Board.YELLOW` and `Board.EMPTY`.

## Layout

| Class | Responsibility |
| --- | --- |
| `src/connect4/Board.java` | `Board`: drop, undo, legal moves, copying, move strings and grids |
| `src/connect4/Rules.java` | Win detection: `winningLine`, `isWinningDrop`, `winningColumns`, `findWinner` |
| `src/connect4/Game.java` | `Game`: turns, results, replaying stored move logs |
| `src/connect4/Render.java` | Text boards for the CLI, logs and tickets |
| `src/connect4/Ai.java` | Computer player: `evaluate`, `chooseMove`, `solve` |
| `src/connect4/Samples.java` | A reported game and the daily puzzles used by the demo |
| `src/connect4/Cell.java`, `BoardException.java`, `GameException.java` | A cell, and the errors for bad positions and illegal moves |
| `src/Main.java` | Demo: replays a game, asks the computer for a move, checks puzzles |

`Board` does not know the rules. It keeps accepting discs after a four,
which is what search code wants when it plays a line out and takes it back
with `undo()`. `Game` is the layer that enforces "no moves after a win".

## The computer player

`Ai.java` holds the heuristic `evaluate(board, player)` and `centreOrder`.
`chooseMove` (the opponent in "Play the computer") and `solve` (the daily
puzzle checker) are still to be written.

## Running

Java 21, no build tool. The tests are JUnit 5 classes in `tests/`
(`package tests`):

```
javac -d out -cp junit-platform-console-standalone.jar $(find src tests -name '*.java')
java -cp out Main
java -jar junit-platform-console-standalone.jar execute --class-path out --scan-class-path
```
