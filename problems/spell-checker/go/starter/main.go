// Spell-checks a few sample notes and prints what the editor would show.
package main

import (
	"fmt"
	"log"

	"debuggym/spell-checker/spellcheck"
)

var notes = []struct{ name, text string }{
	{"standup.txt", "Standup, Tuesday\n" +
		"Shipped the new calender view. We'll fix the seperate login bugs tomorow.\n" +
		"Don't forget: the team's retro moved to 3pm."},
	{"groceries.txt", "Groceries - milk, eggs, bread, cheese and 2 bananas\n" +
		"Pick up the reciept for the dinner party"},
	{"trip.txt", "Flight on the 14th. Hotel is definately booked,\n" +
		"but I havent got the passport back yet. Teh tickets are in my email."},
}

func main() {
	dictionary, err := spellcheck.LoadDefault()
	if err != nil {
		log.Fatal(err)
	}
	checker := spellcheck.NewSpellChecker(dictionary)
	fmt.Printf("Dictionary: %d words\n\n", dictionary.Len())
	for _, note := range notes {
		issues := checker.Check(note.text)
		fmt.Println("== " + note.name)
		fmt.Println(spellcheck.Underline(note.text, issues))
		fmt.Println()
		if report, err := reportWithSuggestions(checker, note.text, issues); err == nil {
			fmt.Println(report)
		} else {
			fmt.Println(spellcheck.FormatReport(note.text, issues, nil))
			fmt.Printf("  (suggestions unavailable: %v)\n", err)
		}
		fmt.Println()
	}
}

// reportWithSuggestions is the report with suggestions for each word. A panic
// from unfinished suggestion code becomes an error, so the demo still prints
// the rest.
func reportWithSuggestions(checker *spellcheck.SpellChecker, text string, issues []spellcheck.Misspelling) (report string, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("%v", r)
		}
	}()
	suggest := func(word string) []string { return checker.Suggest(word, spellcheck.DefaultLimit) }
	return spellcheck.FormatReport(text, issues, suggest), nil
}
