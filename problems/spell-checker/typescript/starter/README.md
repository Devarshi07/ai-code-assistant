# Marginalia spell check

Marginalia is a note-taking app. This package is the spell-check service
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

1. **Tokenize.** `tokenize(text)` splits the note into words and records
   where each one starts and ends. Contractions and possessives stay whole
   (`don't`, `team's`), hyphens and other punctuation split words, and
   anything containing a digit (`3rd`, `10am`, `2024`) is skipped.
2. **Look up.** Each word is normalized (lower case, typographic apostrophes
   folded to `'`) and looked up in the `Dictionary`. Possessives of known
   words are accepted, words in ALL CAPS are treated as acronyms and
   skipped, and the user can "Ignore all" a word for the session.
3. **Suggest** (on demand). `suggester.suggest(word)` returns the dictionary
   words closest to a misspelling, best first. `checker.suggest` gives them
   the user's capitalisation (`Teh` -> `The`).

## Layout

| Module | Responsibility |
| --- | --- |
| `src/tokenizer.ts` | `tokenize`, `Token`: words with start/end offsets |
| `src/dictionary.ts` | `Dictionary`: word list with frequencies, `normalize` |
| `src/checker.ts` | `SpellChecker`: finds `Misspelling`s, ignore list, `matchCase` |
| `src/suggest.ts` | `editDistance`, `Suggester`: ranked replacement suggestions |
| `src/report.ts` | Line/column positions, underlines and text reports |
| `src/data/words.txt` | The base dictionary: `word count` per line |
| `main.ts` | Checks a few sample notes and prints the results |

Tokens and misspellings are plain objects: a `Token` is `{ text, start, end }`
and a `Misspelling` is `{ word, start, end }`. Offsets are string indices into
the original note: `start` is the first character of the word and `end` is
one past the last, so `text.slice(start, end)` is the word as the user typed
it.

## Running

Node 22 runs the `.ts` files directly by stripping the types, so there is no
build step (and no type check). `package.json` makes them ES modules.

```
node main.ts
node --test "tests/*.test.ts"
```
