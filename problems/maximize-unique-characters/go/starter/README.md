# One of Each: puzzle desk tools

**One of Each** is a daily word game. Each day players get a themed board of
words, and the rule that makes it a puzzle is simple: **no letter appears on
the board more than once**. A word can't repeat a letter (`otter` is out), and
two words can't share one (`harp` and `drum` both use `r`). The more of the
alphabet a board covers, the better the puzzle plays.

This project is the designers' puzzle desk. It loads the candidate word list,
checks hand-picked boards before they're published, renders previews and
(soon) suggests the best board for a theme automatically.

```
2026-10-14  animals: 12 tiles
  ZEBRA  LYNX  DOG
  [AB.DE.G....L.NO..R.....XYZ]  14 letters unused
```

## Layout

| File | Responsibility |
| --- | --- |
| `oneofeach/letters.go` | Word normalization and 26-bit letter masks (`LetterMask`, `Popcount`, `MaskLetters`) |
| `oneofeach/models.go` | `Word` and `Puzzle`; the `Selection{Words, Total}` answer shape |
| `oneofeach/wordlist.go` | Parses `data/words.txt` (word, difficulty 1-3, theme tags); filtering by theme |
| `oneofeach/validator.go` | `SelectionProblems`: rule violations for a board, used before publishing |
| `oneofeach/solver.go` | `PlayableWords` and `BestSelection` (the board suggestion engine) |
| `oneofeach/board.go` | Text previews: header, word row, alphabet strip |
| `main.go` | Checks this week's hand-picked boards and prints suggestions per theme |

Letter masks use bit 0 for `a` through bit 25 for `z`, so two words share a
letter exactly when `a.Mask & b.Mask != 0`.

## Word list format

```
# word      difficulty   themes
tango       2            music, dance
```

Words are trimmed and lower-cased when loaded; anything other than `a-z` is an
error that reports its line number. The same word may appear in several themes.
The tests read the file as `../data/words.txt` because `go test` runs inside `tests/`.

## Running

```
go run .
go test ./tests/...
```
