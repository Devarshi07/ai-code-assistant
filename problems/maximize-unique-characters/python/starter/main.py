"""Puzzle desk preview: checks this week's hand-picked boards and suggests the best board per theme."""
from oneofeach import Puzzle, best_selection, filter_words, load_word_list, playable_words, selection_problems, themes
from oneofeach.board import render

# Boards the designers picked by hand for this week.
SCHEDULE = [
    ("2026-10-12", "kitchen", ["butter", "fig", "jam", "wok"]),
    ("2026-10-13", "music", ["drum", "harp", "tempo", "sax"]),
    ("2026-10-14", "animals", ["zebra", "lynx", "dog"]),
    ("2026-10-15", "garden", ["tulip", "fern", "moss"]),
]


def main():
    words = load_word_list()
    print(f"Loaded {len(words)} candidates in {len(themes(words))} themes, "
          f"{len(playable_words(words))} playable spellings\n")

    print("== Hand-picked boards")
    for day, theme, picks in SCHEDULE:
        puzzle = Puzzle(day, theme, picks)
        print(render(puzzle))
        problems = selection_problems(puzzle.words)
        print("  status: " + ("ok" if not problems else "REJECTED: " + "; ".join(problems)))
        print()

    print("== Suggested boards (difficulty 2 or easier)")
    for theme in themes(words):
        candidates = filter_words(words, theme=theme, max_difficulty=2)
        try:
            best = best_selection(candidates)
        except NotImplementedError as exc:
            print(f"  solver unavailable: {exc}")
            break
        print(render(Puzzle("next week", theme, best.words)))
        print(f"  covers {best.total} letters from {len(candidates)} candidates\n")


if __name__ == "__main__":
    main()
