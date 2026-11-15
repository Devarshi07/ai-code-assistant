"""Text previews of a board for the puzzle desk and the CLI."""
from .letters import ALPHABET


def alphabet_strip(mask):
    """'AB.D..' style strip: upper-case letters are on the board, dots are unused."""
    return "".join(ch.upper() if mask >> i & 1 else "." for i, ch in enumerate(ALPHABET))


def render(puzzle):
    """Header, word row and alphabet strip for one puzzle."""
    words = "  ".join(word.text.upper() for word in puzzle.words) or "(empty board)"
    unused = len(puzzle.unused_letters)
    return "\n".join([
        f"{puzzle.day}  {puzzle.theme}: {puzzle.tile_count} tiles",
        f"  {words}",
        f"  [{alphabet_strip(puzzle.covered)}]  {unused} letters unused",
    ])
