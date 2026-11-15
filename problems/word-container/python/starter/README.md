# Gridword word store

Gridword is a crossword and word-game helper. Setters build puzzles in the grid
editor, and players use the solver panel when they're stuck. Both sit on top of
this package: the **word store** that imports word lists, answers "is this a
word?", powers autocomplete, and (soon) answers crossword pattern searches such
as `c?t` or `c?t*`.

## Words

The store keeps every entry in one canonical form, because a grid holds one
plain letter per square (`wordstore/normalize.py`):

| Entry | Stored as | Rule |
| --- | --- | --- |
| `Café`, ` CAFE ` | `cafe` | trimmed, lowercased, accents stripped |
| `ice cream`, `Jiu-Jitsu`, `o'clock` | `icecream`, `jiujitsu`, `oclock` | spaces, hyphens and apostrophes dropped |
| `r2d2`, `24/7`, `r&b` | rejected (`InvalidWord`) | anything else that is not a-z |

Every public method normalises its input, so `"Café" in words` and
`words.count("CA")` behave as expected.

## Patterns

The solver panel accepts patterns that describe a whole word
(`wordstore/pattern.py`):

| Symbol | Meaning | Example |
| --- | --- | --- |
| letter | exactly that letter | `cat` |
| `?` (or `.` / `_`) | exactly one letter | `c?t` matches cat, cot, cut |
| `*` | any run of letters, including none | `c*t` matches cat, chart; `cat*` matches cat, cats |

`parse_pattern` already validates and canonicalises input. Matching words
against a pattern is not implemented yet.

## Layout

| Module | Responsibility |
| --- | --- |
| `wordstore/normalize.py` | `normalize_word`, `InvalidWord`, accent stripping |
| `wordstore/container.py` | `WordContainer`: a trie with add, remove, `in`, `len`, `count(prefix)`, sorted iteration and `with_prefix` |
| `wordstore/pattern.py` | `Pattern` and `parse_pattern` for crossword patterns |
| `wordstore/loader.py` | Importing word lists (`load_text`, `load_file`, `load_bundled`) with a `LoadReport` per list |
| `wordstore/report.py` | Text views: the stats panel's A-Z breakdown, autocomplete lines, search results |
| `data/*.txt` | Bundled lists: `core`, plus the `sports` and `kitchen` theme packs |
| `main.py` | Imports the bundled lists and prints the stats panel, autocomplete and searches |

### WordContainer at a glance

```python
words = WordContainer(["cat", "cart"])
words.add("Cot")              # True: new word, stored as "cot"
words.add("cat")              # False: already stored
"cart" in words               # True
len(words)                    # 3
words.count("ca")             # 2 words start with "ca"
list(words.with_prefix("c"))  # ["cart", "cat", "cot"]
words.remove("cart")          # True
words.match("c?t")            # pattern search (not implemented yet)
```

## Running

```
python main.py
python -m unittest discover -s tests -v
```
