# Gridword word store

Gridword is a crossword and word-game helper. Setters build puzzles in the grid
editor, and players use the solver panel when they're stuck. Both sit on top of
this package: the **word store** that imports word lists, answers "is this a
word?", powers autocomplete, and (soon) answers crossword pattern searches such
as `c?t` or `c?t*`.

## Words

The store keeps every entry in one canonical form, because a grid holds one
plain letter per square (`src/wordstore/Normalize.java`):

| Entry | Stored as | Rule |
| --- | --- | --- |
| `Café`, ` CAFE ` | `cafe` | trimmed, lowercased, accents stripped |
| `ice cream`, `Jiu-Jitsu`, `o'clock` | `icecream`, `jiujitsu`, `oclock` | spaces, hyphens and apostrophes dropped |
| `r2d2`, `24/7`, `r&b` | rejected (`InvalidWordException`) | anything else that is not a-z |

Every public method normalises its input, so `words.has("Café")` and
`words.count("CA")` behave as expected.

## Patterns

The solver panel accepts patterns that describe a whole word
(`src/wordstore/Pattern.java`):

| Symbol | Meaning | Example |
| --- | --- | --- |
| letter | exactly that letter | `cat` |
| `?` (or `.` / `_`) | exactly one letter | `c?t` matches cat, cot, cut |
| `*` | any run of letters, including none | `c*t` matches cat, chart; `cat*` matches cat, cats |

`Pattern.parse` already validates and canonicalises input. Matching words
against a pattern is not implemented yet.

## Layout

| File | Responsibility |
| --- | --- |
| `src/wordstore/Normalize.java` | `normalizeWord`, `InvalidWordException`, accent stripping |
| `src/wordstore/WordContainer.java` | `WordContainer`: a trie with `add`, `remove`, `has`, `size`, `count(prefix)`, sorted iteration and `withPrefix` |
| `src/wordstore/Pattern.java` | `Pattern` and `Pattern.parse` for crossword patterns |
| `src/wordstore/Loader.java` | Importing word lists (`loadText`, `loadFile`, `loadBundled`) with a `LoadReport` per list |
| `src/wordstore/Report.java` | Text views: the stats panel's A-Z breakdown, autocomplete lines, search results |
| `data/*.txt` | Bundled lists: `core`, plus the `sports` and `kitchen` theme packs |
| `src/Main.java` | Imports the bundled lists and prints the stats panel, autocomplete and searches |

### WordContainer at a glance

```java
WordContainer words = new WordContainer(List.of("cat", "cart"));
words.add("Cot");             // true: new word, stored as "cot"
words.add("cat");             // false: already stored
words.has("cart");            // true
words.size();                 // 3
words.count("ca");            // 2 words start with "ca"
words.withPrefix("c");        // [cart, cat, cot]
words.remove("cart");         // true
words.match("c?t");           // pattern search (not implemented yet)
```

## Running

The tests run from the project root, so `data/` resolves as a relative path.
Use the Run button for `Main`, and the test runner for `tests/`.
