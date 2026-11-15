"""Spell-checks a few sample notes and prints what the editor would show."""
from spellcheck import Dictionary, SpellChecker
from spellcheck.report import format_report, underline

NOTES = {
    "standup.txt": (
        "Standup, Tuesday\n"
        "Shipped the new calender view. We'll fix the seperate login bugs tomorow.\n"
        "Don't forget: the team's retro moved to 3pm."
    ),
    "groceries.txt": (
        "Groceries - milk, eggs, bread, cheese and 2 bananas\n"
        "Pick up the reciept for the dinner party"
    ),
    "trip.txt": (
        "Flight on the 14th. Hotel is definately booked,\n"
        "but I havent got the passport back yet. Teh tickets are in my email."
    ),
}


def main():
    checker = SpellChecker(Dictionary.load())
    print(f"Dictionary: {len(checker.dictionary)} words\n")
    for name, text in NOTES.items():
        issues = checker.check(text)
        print(f"== {name}")
        print(underline(text, issues))
        print()
        try:
            print(format_report(text, issues, checker.suggest))
        except NotImplementedError as exc:
            print(format_report(text, issues))
            print(f"  (suggestions unavailable: {exc})")
        print()


if __name__ == "__main__":
    main()
