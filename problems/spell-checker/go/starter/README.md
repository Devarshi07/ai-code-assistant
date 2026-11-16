# Marginalia spell check

Marginalia is a note-taking app. This module is the spell-check service
behind its editor: the editor sends the text of a note, gets back the
misspelled words with their character offsets, and draws a red underline
under each one. When the user right-clicks an underlined word, the editor
asks for replacement suggestions.

```
Shipped the new calender view.
                ^^^^^^^^
  1:17    calender      -> calendar
```

## How a note is checked

1. **Tokenize.** `Tokenize(text)` splits the note into words and records
   where each one starts and ends. Contractions and possessives stay whole
   (`don't`, `team's`), hyphens and other punctuation split words, and
   anything containing a digit (`3rd`, `10am`, `2024`) is skipped.
2. **Look up.** Each word is normalized (lower case, typographic apostrophes
   folded to `'`) and looked up in the `Dictionary`. Possessives of known
   words are accepted, words in ALL CAPS are treated as acronyms and
   skipped, and the user can "Ignore all" a word for the session.
3. **Suggest** (on demand). `Suggester.Suggest(word, limit)` returns the
   dictionary words closest to a misspelling, best first.
   `SpellChecker.Suggest` gives them the user's capitalisation
   (`Teh` -> `The`).

## Layout

| File | Responsibility |
| --- | --- |
| `spellcheck/tokenizer.go` | `Token`, `Tokenize`: words with start/end offsets |
| `spellcheck/dictionary.go` | `Dictionary`: word list with frequencies, `Normalize` |
| `spellcheck/checker.go` | `SpellChecker`: finds `Misspelling`s, ignore list, `MatchCase` |
| `spellcheck/suggest.go` | `EditDistance`, `Suggester`: ranked replacement suggestions |
| `spellcheck/report.go` | Line/column positions, underlines and text reports |
| `spellcheck/data/words.txt` | The base dictionary: `word count` per line, embedded into the package |
| `main.go` | Checks a few sample notes and prints the results |

Offsets count characters (runes) from the start of the note, not bytes:
`Start` is the first character of the word and `End` is one past the last,
so `string([]rune(text)[Start:End])` is the word as the user typed it. The
editor places underlines by character, and characters such as `é` or `’`
take more than one byte in a Go string.

## Running

```
go run .
go test ./tests/...
```
