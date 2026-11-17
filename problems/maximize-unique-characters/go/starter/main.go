// Command main is the puzzle desk preview: it checks this week's hand-picked
// boards and suggests the best board per theme.
package main

import (
	"fmt"
	"os"
	"strings"

	"debuggym/maximize-unique-characters/oneofeach"
)

// Boards the designers picked by hand for this week.
var schedule = []struct {
	day, theme string
	words      []string
}{
	{"2026-10-12", "kitchen", []string{"butter", "fig", "jam", "wok"}},
	{"2026-10-13", "music", []string{"drum", "harp", "tempo", "sax"}},
	{"2026-10-14", "animals", []string{"zebra", "lynx", "dog"}},
	{"2026-10-15", "garden", []string{"tulip", "fern", "moss"}},
}

// suggest runs the solver and turns a panic (the unfinished solver) into an error.
func suggest(candidates []oneofeach.Word) (best oneofeach.Selection, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("%v", r)
		}
	}()
	return oneofeach.BestSelection(candidates), nil
}

func run() error {
	words, err := oneofeach.LoadWordList(oneofeach.DefaultPath)
	if err != nil {
		return err
	}
	themes := oneofeach.Themes(words)
	fmt.Printf("Loaded %d candidates in %d themes, %d playable spellings\n\n", len(words), len(themes), len(oneofeach.PlayableWords(words)))

	fmt.Println("== Hand-picked boards")
	for _, pick := range schedule {
		puzzle, err := oneofeach.NewPuzzle(pick.day, pick.theme, pick.words)
		if err != nil {
			return err
		}
		fmt.Println(oneofeach.Render(puzzle))
		problems := oneofeach.SelectionProblems(puzzle.Words)
		if len(problems) > 0 {
			fmt.Println("  status: REJECTED: " + strings.Join(problems, "; "))
		} else {
			fmt.Println("  status: ok")
		}
		fmt.Println()
	}

	fmt.Println("== Suggested boards (difficulty 2 or easier)")
	for _, theme := range themes {
		candidates := oneofeach.FilterWords(words, oneofeach.FilterOptions{Theme: theme, MaxDifficulty: 2})
		best, err := suggest(candidates)
		if err != nil {
			fmt.Printf("  solver unavailable: %v\n", err)
			break
		}
		puzzle, err := oneofeach.NewPuzzle("next week", theme, best.Words)
		if err != nil {
			return err
		}
		fmt.Println(oneofeach.Render(puzzle))
		fmt.Printf("  covers %d letters from %d candidates\n\n", best.Total, len(candidates))
	}
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
