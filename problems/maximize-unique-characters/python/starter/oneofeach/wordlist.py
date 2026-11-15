"""Loads the designers' candidate list.

Format: one word per line, then its difficulty (1-3), then optional
comma-separated theme tags. Blank lines and ``#`` comments are ignored.

    # word      difficulty   tags
    tango       2            music, dance
    otter       1            animals
"""
import os

from .letters import WordError
from .models import Word

DEFAULT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "words.txt")


class WordListError(ValueError):
    """Raised for a malformed line, with its line number."""


def parse_word_list(text):
    """Parse word-list text into a list of Word objects, in file order."""
    words = []
    for number, raw in enumerate(text.splitlines(), start=1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = line.split(None, 2)
        if len(parts) < 2:
            raise WordListError(f"line {number}: expected 'word difficulty [tags]', got {line!r}")
        word, difficulty = parts[0], parts[1]
        if difficulty not in ("1", "2", "3"):
            raise WordListError(f"line {number}: difficulty must be 1, 2 or 3, got {difficulty!r}")
        tags = [tag.strip().lower() for tag in parts[2].split(",")] if len(parts) == 3 else []
        try:
            words.append(Word(word, int(difficulty), [tag for tag in tags if tag]))
        except WordError as exc:
            raise WordListError(f"line {number}: {exc}") from None
    return words


def load_word_list(path=DEFAULT_PATH):
    with open(path, encoding="utf-8") as handle:
        return parse_word_list(handle.read())


def filter_words(words, theme=None, max_difficulty=None):
    """Candidates tagged with theme (if given) and no harder than max_difficulty."""
    return [word for word in words
            if (theme is None or theme in word.tags)
            and (max_difficulty is None or word.difficulty <= max_difficulty)]


def themes(words):
    """Every theme tag used in the list, alphabetically."""
    return sorted({tag for word in words for tag in word.tags})
