# Gridword word store

Gridword is a crossword and word-game helper. Setters build puzzles in the grid
editor, and players use the solver panel when they're stuck. Both sit on top of
this package: the **word store** that imports word lists, answers "is this a
word?", powers autocomplete, and (soon) answers crossword pattern searches such
as `c?t` or `c?t*`.

## Words

The store keeps every entry in one canonical form, because a grid holds one
plain letter per square (`wordstore/normalize.go`):

| Entry | Stored as | Rule |
| --- | --- | --- |
| `Café`, ` CAFE ` | `cafe` | trimmed, lowercased, accents stripped |
| `ice cream`, `Jiu-Jitsu`, `o'clock` | `icecream`, `jiujitsu`, `oclock` | spaces, hyphens and apostrophes dropped |
| `r2d2`, `24/7`, `r&b` | rejected (`*InvalidWord` error) | anything else that is not a-z |

Every public method normalises its input, so `words.Has("Café")` and
`words.Count("CA")` behave as expected.

## Patterns

The solver panel accepts patterns that describe a whole word
(`wordstore/pattern.go`):

| Symbol | Meaning | Example |
| --- | --- | --- |
| letter | exactly that letter | `cat` |
| `?` (or `.` / `_`) | exactly one letter | `c?t` matches cat, cot, cut |
| `*` | any run of letters, including none | `c*t` matches cat, chart; `cat*` matches cat, cats |

`ParsePattern` already validates and canonicalises input. Matching words
against a pattern is not implemented yet.

## Layout

| File | Responsibility |
| --- | --- |
| `wordstore/normalize.go` | `NormalizeWord`, `InvalidWord`, accent stripping |
| `wordstore/container.go` | `WordContainer`: a trie with `Add`, `Remove`, `Has`, `Size`, `Count(prefix)`, sorted iteration (`Each`, `Words`) and `WithPrefix` |
| `wordstore/pattern.go` | `Pattern` and `ParsePattern` for crossword patterns |
| `wordstore/loader.go` | Importing word lists (`LoadText`, `LoadFile`, `LoadBundled`) with a `LoadReport` per list |
| `wordstore/report.go` | Text views: the stats panel's A-Z breakdown, autocomplete lines, search results |
| `data/*.txt` | Bundled lists: `core`, plus the `sports` and `kitchen` theme packs |
| `main.go` | Imports the bundled lists and prints the stats panel, autocomplete and searches |

### WordContainer at a glance

```go
words := wordstore.New()
words.AddAll([]string{"cat", "cart"})
words.Add("Cot")             // true, nil: new word, stored as "cot"
words.Add("cat")             // false, nil: already stored
words.Has("cart")            // true
words.Size()                 // 3
words.Count("ca")            // 2, nil: 2 words start with "ca"
words.WithPrefix("c")        // ["cart", "cat", "cot"], nil
words.Remove("cart")         // true
words.Match("c?t", wordstore.NoLimit) // pattern search (not implemented yet)
```

## Running

```
go run .
go test ./tests/...
```
