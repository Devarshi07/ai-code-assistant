"""Reading and writing .non puzzle files.

Contributors send puzzles as small text files::

    # Pack 3, puzzle 7
    title: Sailboat
    author: R. Okafor
    rows: 1 | 2 | 3 | 1 1
    cols: 2 | 0 | 3 1

Each field is ``key: value`` on its own line. ``rows`` and ``cols`` list one
clue per line, separated by ``|``; the numbers inside a clue are separated by
spaces (commas are accepted too). ``0`` marks a line with no filled cells.
Lines starting with ``#`` are comments.
"""
from .model import Puzzle, PuzzleError, format_clue

FIELDS = ("title", "author", "rows", "cols")


def parse_clue_list(value, field):
    clues = []
    for index, part in enumerate(value.split("|"), start=1):
        tokens = part.replace(",", " ").split()
        if not tokens:
            raise PuzzleError(f"{field}: clue {index} is blank (write 0 for an empty line)")
        try:
            numbers = [int(token) for token in tokens]
        except ValueError:
            raise PuzzleError(f"{field}: clue {index} ({part.strip()!r}) is not a list of numbers") from None
        if numbers == [0]:
            numbers = []
        elif 0 in numbers:
            raise PuzzleError(f"{field}: clue {index} mixes 0 with other blocks")
        clues.append(numbers)
    return clues


def parse_puzzle(text):
    """Parse the contents of a .non file into a Puzzle."""
    fields = {}
    for number, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        key, sep, value = line.partition(":")
        key = key.strip().lower()
        if not sep or key not in FIELDS:
            raise PuzzleError(f"line {number}: expected one of {', '.join(FIELDS)} followed by ':'")
        if key in fields:
            raise PuzzleError(f"line {number}: {key} is given twice")
        fields[key] = value.strip()
    for required in ("rows", "cols"):
        if required not in fields:
            raise PuzzleError(f"puzzle file has no {required} field")
    return Puzzle(parse_clue_list(fields["rows"], "rows"),
                  parse_clue_list(fields["cols"], "cols"),
                  title=fields.get("title") or "Untitled",
                  author=fields.get("author") or None)


def format_puzzle(puzzle):
    """Serialize a Puzzle in the .non format (round-trips through parse_puzzle)."""
    lines = [f"title: {puzzle.title}"]
    if puzzle.author:
        lines.append(f"author: {puzzle.author}")
    lines.append("rows: " + " | ".join(format_clue(clue) for clue in puzzle.row_clues))
    lines.append("cols: " + " | ".join(format_clue(clue) for clue in puzzle.col_clues))
    return "\n".join(lines) + "\n"


def load_puzzle(path):
    with open(path, encoding="utf-8") as handle:
        return parse_puzzle(handle.read())
