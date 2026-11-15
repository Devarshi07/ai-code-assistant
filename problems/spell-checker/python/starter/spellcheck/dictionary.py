"""The word list behind the spell checker, with usage frequencies.

File format: one entry per line, a word and how often it appeared in the
notes corpus, separated by whitespace. A missing count means 1. Blank lines
and lines starting with # are ignored.

    receive   215
    don't     3020
"""
from pathlib import Path

DEFAULT_WORDS = Path(__file__).parent / "data" / "words.txt"


def normalize(word):
    """Lookup key for a word: lower case, typographic apostrophes as '."""
    return word.replace("’", "'").lower()


class Dictionary:
    """Known words and their frequencies, keyed by normalize(word)."""

    def __init__(self, counts=None):
        self._counts = {}
        for word, count in (counts or {}).items():
            self.add(word, count)

    @classmethod
    def parse(cls, text):
        dictionary = cls()
        for number, raw in enumerate(text.splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) > 2 or (len(parts) == 2 and not parts[1].isdigit()):
                raise ValueError(f"line {number}: expected 'word count', got {raw!r}")
            dictionary.add(parts[0], int(parts[1]) if len(parts) == 2 else 1)
        return dictionary

    @classmethod
    def load(cls, path=DEFAULT_WORDS):
        return cls.parse(Path(path).read_text(encoding="utf-8"))

    def add(self, word, count=1):
        """Add word, or add count to it if it is already known."""
        key = normalize(word)
        self._counts[key] = self._counts.get(key, 0) + count

    def __contains__(self, word):
        return normalize(word) in self._counts

    def frequency(self, word):
        """How common word is; 0 when it isn't in the dictionary."""
        return self._counts.get(normalize(word), 0)

    def words(self):
        """Every entry's lookup key, in the order they were added."""
        return list(self._counts)

    def __len__(self):
        return len(self._counts)
