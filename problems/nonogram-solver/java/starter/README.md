# Pixelwise puzzle toolkit

Pixelwise is a picture-logic app. Each puzzle is a grid that hides a small
picture: every row and column has a *clue* listing the lengths of its filled
blocks, in order, and the player works out which cells are filled.

```
          1
        2 4 1 4 2        rows read left to right, columns top to bottom
    1 1 . # . # .        "1 1" = a block of 1, a gap, another block of 1
      5 # # # # #        "0"   = the line has no filled cells
```

This project is the back-office toolkit behind the app:

- **Publishing.** Designers draw pictures (`#` filled, `.` empty). The toolkit
  derives the clues and builds the puzzle players see.
- **Importing.** Contributors send puzzles as `.non` clue files. The import
  pipeline solves each one to produce the answer key used by the hint button.
- **Checking answers.** When a player submits a grid, the server verifies it
  against the clues before awarding a star.

## Layout

| Module | Responsibility |
| --- | --- |
| `src/nonogram/Grid.java` | `FILLED`/`EMPTY`, picture parsing (`parse`, `format`), `columns` |
| `src/nonogram/Puzzle.java` | `Puzzle` (validated clues), `minLength`, `formatClue` |
| `src/nonogram/PuzzleException.java` | Raised for malformed puzzles, pictures and files |
| `src/nonogram/Clues.java` | Clue derivation: `lineClue`, `cluesFromGrid`, `puzzleFromPicture` |
| `src/nonogram/PuzzleFile.java` | `.non` files: `parse`, `format`, `load` |
| `src/nonogram/Verify.java` | Answer checking: `findMismatches`, `isSolution` |
| `src/nonogram/Render.java` | ASCII board with clues in the margins |
| `src/nonogram/Solver.java` | `solve(puzzle)`: answer keys for imported puzzles |
| `samples/` | Designer drawings (`.pic`) and contributor puzzles (`.non`) |
| `src/Main.java` | Publishes the drawings and builds answer keys for the samples |

## Conventions

- A grid is an `int[][]` of rows; each row is an `int[]` of `FILLED` (1) / `EMPTY` (0).
- A clue is an `int[]` of positive block lengths. An empty line has the clue
  `{}`, written `0` in files and previews.
- `Puzzle` throws `PuzzleException` for clues that cannot fit their line and puzzles whose row
  clues and column clues fill a different number of cells.

## `.non` format

```
# comment
title: Sailboat
author: R. Okafor
rows: 1 | 2 | 3 | 4 | 5 | 1 | 10 | 8 | 6 | 1 1 1 1 1
cols: 1 | 2 1 | 3 | 4 | 9 | 4 4 | 3 3 | 2 4 | 1 2 | 1 1
```

## Running

```
javac -d out $(find src -name '*.java')
java -cp out Main
```
