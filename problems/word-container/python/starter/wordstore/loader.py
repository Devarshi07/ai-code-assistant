"""Reading word lists into a WordContainer.

Lists are UTF-8 text with one entry per line:

    # comment lines start with '#'; blank lines are skipped
    apple
    Ice cream        stored as "icecream"
    jalapeño;60      "entry;score" lines from crossword lists; the score is ignored

A bad entry is recorded in the LoadReport instead of raising, so one stray
line does not abort an import. The bundled lists live in data/: core.txt holds
everyday words and the themed packs (sports.txt, kitchen.txt) overlap it.
"""
from dataclasses import dataclass, field
from pathlib import Path

from .normalize import InvalidWord

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
BUNDLED = ("core", "sports", "kitchen")


@dataclass
class LoadReport:
    """What happened while importing one list."""

    source: str
    added: int = 0
    duplicates: int = 0
    rejected: list = field(default_factory=list)  # (line number, entry, reason)

    def summary(self):
        text = f"{self.source}: {self.added} added, {self.duplicates} already stored"
        if self.rejected:
            text += f", {len(self.rejected)} rejected"
        return text


def entries(text):
    """Yield (line number, entry) for every line that holds an entry."""
    # Lists exported from spreadsheets often start with a byte-order mark.
    for number, line in enumerate(text.lstrip("﻿").split("\n"), start=1):
        entry = line.split(";", 1)[0].strip()
        if entry and not entry.startswith("#"):
            yield number, entry


def load_text(container, text, source="<text>"):
    """Add every entry in text to container and report what happened."""
    report = LoadReport(source)
    for number, entry in entries(text):
        try:
            is_new = container.add(entry)
        except InvalidWord as exc:
            report.rejected.append((number, entry, str(exc)))
            continue
        if is_new:
            report.added += 1
        else:
            report.duplicates += 1
    return report


def load_file(container, path):
    path = Path(path)
    return load_text(container, path.read_text(encoding="utf-8"), path.name)


def load_bundled(container, names=BUNDLED):
    """Import bundled lists in order; returns one LoadReport per list."""
    return [load_file(container, DATA_DIR / f"{name}.txt") for name in names]
