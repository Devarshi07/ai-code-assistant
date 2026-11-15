"""Text views of the store, used by the CLI and the editors' stats panel."""
from itertools import islice
from string import ascii_lowercase

BAR_WIDTH = 30


def letter_breakdown(container):
    """(letter, words starting with it) for every first letter in use."""
    rows = []
    for letter in ascii_lowercase:
        total = container.count(letter)
        if total:
            rows.append((letter, total))
    return rows


def plural(n, word):
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def format_store_report(container, title="Word store"):
    """Headline total plus an A-Z bar chart."""
    rows = letter_breakdown(container)
    widest = max((total for _, total in rows), default=1)
    lines = [f"{title}: {plural(len(container), 'word')}"]
    for letter, total in rows:
        bar = "#" * max(1, (BAR_WIDTH * total + widest // 2) // widest)
        lines.append(f"  {letter}  {bar:<{BAR_WIDTH}} {total:>4}")
    lines.append(f"  A-Z total: {sum(total for _, total in rows)}")
    return "\n".join(lines)


def format_prefix(container, prefix, shown=6):
    """One autocomplete line: the badge count and the first few completions."""
    total = container.count(prefix)
    words = list(islice(container.with_prefix(prefix), shown))
    more = f" (+{total - len(words)} more)" if total > len(words) else ""
    listed = ", ".join(words) if words else "-"
    return f"{prefix}...  {plural(total, 'word')}: {listed}{more}"


def format_matches(pattern, words, limit=None):
    """One pattern-search line, noting when the list was cut at limit."""
    if not words:
        return f"{pattern}  no matches"
    cut = " ..." if limit is not None and len(words) == limit else ""
    return f"{pattern}  {', '.join(words)}{cut}"
