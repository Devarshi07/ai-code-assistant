"""Spell checking for Marginalia notes."""
from .checker import Misspelling, SpellChecker, match_case
from .dictionary import Dictionary, normalize
from .suggest import MAX_DISTANCE, Suggester, edit_distance
from .tokenizer import Token, tokenize

__all__ = ["Misspelling", "SpellChecker", "match_case", "Dictionary", "normalize",
           "MAX_DISTANCE", "Suggester", "edit_distance", "Token", "tokenize"]
