"""Finds the misspelled words in a note.

The editor calls check() on every keystroke pause, so it only reports where
the problems are. Suggestions are fetched separately, when the user opens
the right-click menu on an underlined word.
"""
from typing import List, NamedTuple

from .dictionary import normalize
from .suggest import DEFAULT_LIMIT, Suggester
from .tokenizer import tokenize


class Misspelling(NamedTuple):
    word: str    # as written in the note
    start: int   # offset of the first character
    end: int     # offset one past the last character


def match_case(template, word):
    """Give a suggestion the capitalisation of the word it would replace."""
    if _is_shouting(template):
        return word.upper()
    if template[:1].isupper():
        return word[:1].upper() + word[1:]
    return word


def _is_shouting(word):
    """All capitals and longer than one letter: NASA, TODO, DON'T."""
    return len(word) > 1 and word.isupper()


class SpellChecker:
    def __init__(self, dictionary, ignore_uppercase=True):
        self.dictionary = dictionary
        self.ignore_uppercase = ignore_uppercase   # skip acronyms such as NASA
        self._ignored = set()
        self._suggester = None

    def ignore(self, word):
        """'Ignore all' from the context menu: accept word for this session."""
        self._ignored.add(normalize(word))

    def is_known(self, word):
        key = normalize(word)
        if key in self._ignored or key in self.dictionary:
            return True
        # Possessives aren't listed separately: "team's" is fine if "team" is.
        return key.endswith("'s") and key[:-2] in self.dictionary

    def check(self, text) -> List[Misspelling]:
        """Every misspelled word in text, in order of appearance."""
        found = []
        for token in tokenize(text):
            if self.ignore_uppercase and _is_shouting(token.text):
                continue
            if not self.is_known(token.text):
                found.append(Misspelling(token.text, token.start, token.end))
        return found

    def suggest(self, word, limit=DEFAULT_LIMIT):
        """Replacements for word, capitalised the way the user wrote it."""
        if self._suggester is None:
            self._suggester = Suggester(self.dictionary)
        return [match_case(word, s) for s in self._suggester.suggest(word, limit)]
