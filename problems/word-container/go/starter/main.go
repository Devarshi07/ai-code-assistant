// Command main imports the bundled lists, then shows the stats panel,
// autocomplete and pattern search.
package main

import (
	"fmt"
	"os"
	"strings"

	"debuggym/word-container/wordstore"
)

var autocomplete = []string{"bowl", "squ", "ten"}

// Retired words were flagged by the editors as overused.
var retired = []string{"squash", "tennis"}

var searches = []struct {
	pattern string
	limit   int
}{
	{"c?t", wordstore.NoLimit}, {"?a?e", 8}, {"b??l", wordstore.NoLimit},
	{"*ing", wordstore.NoLimit}, {"*ball", wordstore.NoLimit}, {"c*e", 6},
}

func run() error {
	words := wordstore.New()
	fmt.Println("Import")
	reports, err := wordstore.LoadBundled(words, "data")
	if err != nil {
		return err
	}
	for _, report := range reports {
		fmt.Println("  " + report.Summary())
		for _, rejected := range report.Rejected {
			fmt.Printf("    line %d: %s\n", rejected.Line, rejected.Reason)
		}
	}
	fmt.Println()
	fmt.Println(wordstore.FormatStoreReport(words, "Word store"))
	fmt.Println()

	fmt.Println("Autocomplete")
	for _, prefix := range autocomplete {
		fmt.Println("  " + wordstore.FormatPrefix(words, prefix, 6))
	}
	for _, word := range retired {
		words.Remove(word)
	}
	fmt.Printf("  retired %s; %d words left\n", strings.Join(retired, ", "), words.Size())
	for _, prefix := range autocomplete {
		fmt.Println("  " + wordstore.FormatPrefix(words, prefix, 6))
	}
	fmt.Println()

	fmt.Println("Pattern search")
	for _, search := range searches {
		found, err := words.Match(search.pattern, search.limit)
		if err != nil {
			fmt.Printf("  %s  %v\n", search.pattern, err)
			break
		}
		fmt.Println("  " + wordstore.FormatMatches(search.pattern, found, search.limit))
	}
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
