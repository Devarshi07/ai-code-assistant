"""Plain-text views of spell-check results, for the CLI and support logs."""


def line_col(text, offset):
    """1-based (line, column) of a character offset in text."""
    line = text.count("\n", 0, offset) + 1
    column = offset - text.rfind("\n", 0, offset)
    return line, column


def underline(text, misspellings, mark="^"):
    """The text with a row of marks under each misspelled word."""
    out = []
    line_start = 0
    for line in text.split("\n"):
        line_end = line_start + len(line)
        marks = [" "] * len(line)
        for m in misspellings:
            for i in range(max(m.start, line_start), min(m.end, line_end)):
                marks[i - line_start] = mark
        out.append(line)
        if mark in marks:
            out.append("".join(marks).rstrip())
        line_start = line_end + 1
    return "\n".join(out)


def format_report(text, misspellings, suggest=None):
    """One row per misspelling: line:column, the word, and suggestions.

    suggest, when given, is called with each misspelled word and returns
    the replacements to list.
    """
    if not misspellings:
        return "No spelling issues found."
    noun = "issue" if len(misspellings) == 1 else "issues"
    rows = [f"{len(misspellings)} spelling {noun}:"]
    for m in misspellings:
        line, column = line_col(text, m.start)
        row = f"  {line}:{column}".ljust(10) + m.word
        if suggest is not None:
            options = suggest(m.word)
            row = row.ljust(24) + ("-> " + ", ".join(options) if options else "(no suggestions)")
        rows.append(row)
    return "\n".join(rows)
