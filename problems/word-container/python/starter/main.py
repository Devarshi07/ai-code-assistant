"""Demo: import the bundled lists, then show the stats panel, autocomplete and pattern search."""
from wordstore import WordContainer
from wordstore.loader import load_bundled
from wordstore.report import format_matches, format_prefix, format_store_report

AUTOCOMPLETE = ["bowl", "squ", "ten"]
RETIRED = ["squash", "tennis"]  # flagged by the editors as overused
SEARCHES = [("c?t", None), ("?a?e", 8), ("b??l", None), ("*ing", None), ("*ball", None), ("c*e", 6)]


def main():
    words = WordContainer()
    print("Import")
    for report in load_bundled(words):
        print(f"  {report.summary()}")
        for number, entry, reason in report.rejected:
            print(f"    line {number}: {reason}")
    print()
    print(format_store_report(words))
    print()

    print("Autocomplete")
    for prefix in AUTOCOMPLETE:
        print(f"  {format_prefix(words, prefix)}")
    for word in RETIRED:
        words.remove(word)
    print(f"  retired {', '.join(RETIRED)}; {len(words)} words left")
    for prefix in AUTOCOMPLETE:
        print(f"  {format_prefix(words, prefix)}")
    print()

    print("Pattern search")
    for pattern, limit in SEARCHES:
        try:
            found = words.match(pattern, limit)
        except NotImplementedError as exc:
            print(f"  {pattern}  {exc}")
            break
        print(f"  {format_matches(pattern, found, limit)}")


if __name__ == "__main__":
    main()
