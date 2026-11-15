# One of Each: puzzle desk tools

**One of Each** is a daily word game. Each day players get a themed board of
words, and the rule that makes it a puzzle is simple: **no letter appears on
the board more than once**. A word can't repeat a letter (`otter` is out), and
two words can't share one (`harp` and `drum` both use `r`). The more of the
alphabet a board covers, the better the puzzle plays.

This package is the designers' puzzle desk. It loads the candidate word list,
checks hand-picked boards before they're published, renders previews and
(soon) suggests the best board for a theme automatically.

```
2026-10-14  animals: 12 tiles
  ZEBRA  LYNX  DOG
  [AB.DE.G....L.NO..R.....XYZ]  14 letters unused
```

## Layout

| Module | Responsibility |
| --- | --- |
| `oneofeach/letters.py` | Word normalization and 26-bit letter masks (`letter_mask`, `popcount`, `mask_letters`) |
| `oneofeach/models.py` | `Word`, `Selection` and `Puzzle` |
| `oneofeach/wordlist.py` | Parses `data/words.txt` (word, difficulty 1-3, theme tags); filtering by theme |
| `oneofeach/validator.py` | `selection_problems`: rule violations for a board, used before publishing |
| `oneofeach/solver.py` | `playable_words` and `best_selection` (the board suggestion engine) |
| `oneofeach/board.py` | Text previews: header, word row, alphabet strip |
| `main.py` | Checks this week's hand-picked boards and prints suggestions per theme |

Letter masks use bit 0 for `a` through bit 25 for `z`, so two words share a
letter exactly when `a.mask & b.mask` is non-zero.

## Word list format

```
# word      difficulty   themes
tango       2            music, dance
```

Words are trimmed and lower-cased when loaded; anything other than `a-z` is an
error that reports its line number. The same word may appear in several themes.

## Running

```
python main.py
python -m unittest discover -s tests -v
```
