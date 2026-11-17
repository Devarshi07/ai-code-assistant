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
| `nonogram/model.go` | `Puzzle` (validated clues), `Filled`/`Empty`, picture parsing, `Columns` |
| `nonogram/clues.go` | Clue derivation: `LineClue`, `CluesFromGrid`, `PuzzleFromPicture` |
| `nonogram/puzzlefile.go` | `.non` files: `ParsePuzzle`, `FormatPuzzle`, `LoadPuzzle` |
| `nonogram/verify.go` | Answer checking: `FindMismatches`, `IsSolution` |
| `nonogram/render.go` | ASCII board with clues in the margins |
| `nonogram/solver.go` | `Solve(puzzle)`: answer keys for imported puzzles |
| `samples/` | Designer drawings (`.pic`) and contributor puzzles (`.non`) |
| `main.go` | Publishes the drawings and builds answer keys for the samples |

## Conventions

- A grid is a `[][]int` of rows; each row is a slice of `Filled` (1) / `Empty` (0).
- A clue is a `[]int` of positive block lengths. An empty line has the clue
  `[]int{}`, written `0` in files and previews.
- `NewPuzzle` returns a `*PuzzleError` for clues that cannot fit their line and puzzles whose row
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
go run .
go test ./tests/...
```
